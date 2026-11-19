import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { PlayerRegistry, Competition, Team, Match, Group, UserRole, PlayerCategory } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database with WAL for high concurrency
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { timeout: 10000 });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 10000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, value TEXT);
`);

const ALLOWED_TABLES = new Set(['users', 'competitions', 'teams', 'matches', 'groups', 'logs']);

function getOrCreateSecret(key: string, envValue?: string): string {
  if (envValue && envValue.trim().length >= 16) {
    return envValue.trim();
  }
  const row = db.prepare('SELECT value FROM system_state WHERE key = ?').get(key) as { value: string } | undefined;
  if (row?.value) {
    return row.value;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)').run(key, generated);
  return generated;
}

const SESSION_SECRET = getOrCreateSecret('session_secret', process.env.SESSION_SECRET);
const VAULT_SECRET = getOrCreateSecret('vault_secret', process.env.VAULT_SECRET);
const VAULT_KEY = crypto.createHash('sha256').update(VAULT_SECRET).digest();
const SESSION_COOKIE_NAME = 'petanca_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredUser extends Omit<PlayerRegistry, 'password'> {
  password?: string;
  passwordHash?: string;
  passwordEncrypted?: string;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: string;
}

interface DataStore {
  users: StoredUser[];
  competitions: Competition[];
  teams: Team[];
  matches: Match[];
  groups: Group[];
  logs: AuditLog[];
}

interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
}

// Crypto helpers
function scryptDerived(plain: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptDerived(plain, salt);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function hashPasswordSync(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(plain: string, storedHash?: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derived = await scryptDerived(plain, salt);
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function encryptVaultPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1$${iv.toString('base64')}$${tag.toString('base64')}$${encrypted.toString('base64')}`;
}

function decryptVaultPassword(payload?: string): string {
  if (!payload || !payload.startsWith('v1$')) return '';
  try {
    const parts = payload.split('$');
    if (parts.length !== 4) return '';
    const [, ivB64, tagB64, cipherB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      VAULT_KEY,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

function signSessionToken(user: StoredUser): string {
  const now = Date.now();
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token?: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const sigB64 = token.slice(dotIndex + 1);
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload?.sub || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const VALID_ROLES = new Set<UserRole>(['ADMIN', 'PLAYER', 'CLUB_ADMIN', 'REFEREE']);
const VALID_CATEGORIES = new Set<PlayerCategory>(['SENIOR 1', 'SENIOR 2', 'JUVENILE', 'FEMININE', 'ADMIN']);

function normalizeUserRecord(raw: any): StoredUser {
  const rawRole = String(raw?.role ?? 'PLAYER').toUpperCase().trim() as UserRole;
  const role: UserRole = VALID_ROLES.has(rawRole) ? rawRole : 'PLAYER';
  const rawCat = String(raw?.category ?? 'SENIOR 1').toUpperCase().trim() as PlayerCategory;
  const category: PlayerCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : 'SENIOR 1';
  const name = String(raw?.name ?? 'Usuario Sin Nombre').trim() || 'Usuario Sin Nombre';
  const username = String(raw?.username ?? `usr_${Date.now()}`).trim();

  const normalized: StoredUser = {
    id: String(raw?.id ?? `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    license: String(raw?.license ?? '').trim(),
    name,
    club: String(raw?.club ?? 'Sin Club').trim() || 'Sin Club',
    category,
    username,
    role,
    avatar: raw?.avatar ? String(raw.avatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    phone: raw?.phone ? String(raw.phone).trim() : undefined,
    canRegisterClubMembers: Boolean(raw?.canRegisterClubMembers),
    passwordHash: typeof raw?.passwordHash === 'string' ? raw.passwordHash : undefined,
    passwordEncrypted: typeof raw?.passwordEncrypted === 'string' ? raw.passwordEncrypted : undefined,
  };

  if (typeof raw?.password === 'string' && raw.password.length > 0) {
    normalized.password = raw.password;
  }
  return normalized;
}

function sanitizeUserForClient(user: StoredUser, includeAdminPassword = false): PlayerRegistry {
  const safe: PlayerRegistry = {
    id: user.id,
    license: String(user.license ?? ''),
    name: String(user.name ?? ''),
    club: String(user.club ?? ''),
    category: user.category || 'SENIOR 1',
    username: String(user.username ?? ''),
    password: includeAdminPassword ? decryptVaultPassword(user.passwordEncrypted) : '',
    role: user.role || 'PLAYER',
    avatar: user.avatar,
    phone: user.phone,
    canRegisterClubMembers: Boolean(user.canRegisterClubMembers),
  };
  return safe;
}

// Initial Data
const DEFAULT_ADMIN_SEED = {
  id: 'admin-1',
  license: 'ADM-001',
  name: 'Director General',
  club: 'Federación',
  category: 'ADMIN' as PlayerCategory,
  username: 'admin',
  password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
  role: 'ADMIN' as UserRole,
  avatar: 'https://ui-avatars.com/api/?name=Director+General&background=d42111&color=fff',
};

let store: DataStore = {
  users: [],
  competitions: [],
  teams: [],
  matches: [],
  groups: [],
  logs: [],
};

let dataVersion = 1;
let snapshotCache: { version: number; adminJson: string; playerJson: string } | null = null;

function bumpVersion() {
  dataVersion++;
  snapshotCache = null;
}

function getSnapshotJson(isAdmin: boolean): string {
  if (!snapshotCache || snapshotCache.version !== dataVersion) {
    const adminUsers = store.users.map((u) => sanitizeUserForClient(u, true));
    const playerUsers = store.users.map((u) => sanitizeUserForClient(u, false));

    const adminPayload = {
      users: adminUsers,
      competitions: store.competitions,
      teams: store.teams,
      matches: store.matches,
      groups: store.groups,
      logs: store.logs.slice(-500),
    };

    const playerPayload = {
      users: playerUsers,
      competitions: store.competitions,
      teams: store.teams,
      matches: store.matches,
      groups: store.groups,
      logs: [],
    };

    snapshotCache = {
      version: dataVersion,
      adminJson: JSON.stringify(adminPayload),
      playerJson: JSON.stringify(playerPayload),
    };
  }
  return isAdmin ? snapshotCache.adminJson : snapshotCache.playerJson;
}

// SQLite Helper Functions (table name strictly whitelisted)
function upsert(table: string, id: string, data: any) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`).run(id, JSON.stringify(data));
  bumpVersion();
}

function remove(table: string, id: string) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  bumpVersion();
}

function loadData() {
  try {
    const rawUsers = db.prepare('SELECT data FROM users').all().map((row: any) => JSON.parse(row.data));
    store.competitions = db.prepare('SELECT data FROM competitions').all().map((row: any) => JSON.parse(row.data));
    store.teams = db.prepare('SELECT data FROM teams').all().map((row: any) => JSON.parse(row.data));
    store.matches = db.prepare('SELECT data FROM matches').all().map((row: any) => JSON.parse(row.data));
    store.groups = db.prepare('SELECT data FROM groups').all().map((row: any) => JSON.parse(row.data));
    store.logs = db.prepare('SELECT data FROM logs').all().map((row: any) => JSON.parse(row.data));

    if (rawUsers.length === 0) {
      const adminUser: StoredUser = {
        ...normalizeUserRecord(DEFAULT_ADMIN_SEED),
        passwordHash: hashPasswordSync(DEFAULT_ADMIN_SEED.password),
        passwordEncrypted: encryptVaultPassword(DEFAULT_ADMIN_SEED.password),
      };
      delete adminUser.password;
      upsert('users', adminUser.id, adminUser);
      store.users = [adminUser];
      console.log('Initialized default admin user with encrypted credentials.');
    } else {
      let migratedCount = 0;
      const migrateTx = db.transaction((usersList: any[]) => {
        const result: StoredUser[] = [];
        for (const raw of usersList) {
          const user = normalizeUserRecord(raw);
          let changed = false;

          if (user.password) {
            if (!user.passwordHash) {
              user.passwordHash = hashPasswordSync(user.password);
            }
            if (!user.passwordEncrypted) {
              user.passwordEncrypted = encryptVaultPassword(user.password);
            }
            delete user.password;
            changed = true;
          } else if (!user.passwordHash) {
            const fallbackPass = Math.random().toString(36).slice(-8);
            user.passwordHash = hashPasswordSync(fallbackPass);
            user.passwordEncrypted = encryptVaultPassword(fallbackPass);
            changed = true;
          }

          if (changed) {
            db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)').run(user.id, JSON.stringify(user));
            migratedCount++;
          }
          result.push(user);
        }
        return result;
      });
      store.users = migrateTx(rawUsers);
      console.log(`Loaded ${store.users.length} users from SQLite (migrated ${migratedCount} records).`);
    }
  } catch (error) {
    console.error('Error loading data from SQLite:', error);
  }
}

function logAction(user: string, action: string, details: string) {
  const newLog: AuditLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    user,
    action,
    details,
  };
  store.logs.push(newLog);
  if (store.logs.length > 2000) {
    store.logs = store.logs.slice(-1000);
  }
  upsert('logs', newLog.id, newLog);
}

loadData();

// Auth Middleware
function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.cookies?.[SESSION_COOKIE_NAME];
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
  }
  const user = store.users.find((u) => u.id === payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado. Inicia sesión de nuevo.' });
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
  }
  next();
}

function requireAdminOrClubAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user) return res.status(401).json({ error: 'No autenticado.' });
  if (user.role === 'ADMIN') return next();
  if (user.role === 'CLUB_ADMIN' && user.canRegisterClubMembers) return next();
  return res.status(403).json({ error: 'No tienes permisos para gestionar inscripciones.' });
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cookieParser());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // Generous global API rate limiter (supports 300+ concurrent venue/Wi-Fi users)
  const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 12000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones desde esta red. Inténtalo en unos segundos.' },
  });
  app.use('/api', globalApiLimiter);

  // Per-account + IP brute-force protection (only counts failed attempts, never blocks concurrent valid logins)
  const failedLoginMap = new Map<string, { count: number; resetAt: number }>();
  const LOGIN_WINDOW_MS = 10 * 60 * 1000;
  const MAX_FAILED_LOGINS = 15;

  function recordFailedLogin(key: string) {
    const now = Date.now();
    const entry = failedLoginMap.get(key);
    if (!entry || now > entry.resetAt) {
      failedLoginMap.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
      entry.count += 1;
    }
    if (failedLoginMap.size > 10000) {
      for (const [k, v] of failedLoginMap.entries()) {
        if (now > v.resetAt) failedLoginMap.delete(k);
      }
    }
  }

  // Public Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: dataVersion, usersCount: store.users.length });
  });

  // Auth Routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = String(req.body?.username ?? '').trim();
      const password = String(req.body?.password ?? '');
      const attemptKey = `${req.ip}:${username.toLowerCase()}`;

      const existingAttempt = failedLoginMap.get(attemptKey);
      if (existingAttempt && Date.now() <= existingAttempt.resetAt && existingAttempt.count >= MAX_FAILED_LOGINS) {
        return res.status(429).json({ message: 'Demasiados intentos fallidos para esta cuenta. Espera unos minutos.' });
      }

      if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña obligatorios.' });
      }

      const user = store.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        recordFailedLogin(attemptKey);
        return res.status(401).json({ message: 'Credenciales incorrectas.' });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        recordFailedLogin(attemptKey);
        return res.status(401).json({ message: 'Credenciales incorrectas.' });
      }

      failedLoginMap.delete(attemptKey);
      const token = signSessionToken(user);
      setSessionCookie(req, res, token);

      res.json({
        success: true,
        token,
        user: sanitizeUserForClient(user, false),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error interno al iniciar sesión.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: sanitizeUserForClient(req.authUser!, false) });
  });

  app.put('/api/auth/password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword ?? '');
      const newPassword = String(req.body?.newPassword ?? '');

      if (newPassword.length < 4) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      }

      const user = req.authUser!;
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      }

      const updatedUser: StoredUser = {
        ...user,
        passwordHash: await hashPassword(newPassword),
        passwordEncrypted: encryptVaultPassword(newPassword),
      };
      delete updatedUser.password;

      store.users = store.users.map((u) => (u.id === user.id ? updatedUser : u));
      upsert('users', user.id, updatedUser);
      logAction(user.username, 'SELF_PASSWORD_CHANGE', `Usuario ${user.username} actualizó su contraseña`);

      res.json({ success: true, user: sanitizeUserForClient(updatedUser, false) });
    } catch (error) {
      console.error('Self password change error:', error);
      res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    }
  });

  // Restrict registration endpoint to ADMIN only so nobody can self-elevate roles
  app.post('/api/auth/register', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const normalized = normalizeUserRecord(req.body);
      const plainPassword = String(req.body?.password ?? Math.random().toString(36).slice(-8));
      if (store.users.some((u) => u.username.toLowerCase() === normalized.username.toLowerCase())) {
        return res.status(400).json({ message: 'El nombre de usuario ya existe.' });
      }
      const stored: StoredUser = {
        ...normalized,
        passwordHash: await hashPassword(plainPassword),
        passwordEncrypted: encryptVaultPassword(plainPassword),
      };
      delete stored.password;
      store.users.push(stored);
      upsert('users', stored.id, stored);
      res.json(sanitizeUserForClient(stored, true));
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Error al registrar usuario.' });
    }
  });

  // Sync / Data Snapshot Routes (Protected by Auth, Admin vs Player visibility)
  app.get('/api/data/version', requireAuth, (_req, res) => {
    res.json({ version: dataVersion });
  });

  app.get('/api/data', requireAuth, (req: AuthenticatedRequest, res) => {
    const isAdmin = req.authUser?.role === 'ADMIN';
    res.type('application/json').send(getSnapshotJson(isAdmin));
  });

  app.get('/api/logs', requireAuth, requireAdmin, (_req, res) => {
    res.json(store.logs);
  });

  // Users Management (Admin sees vault passwords; non-admins never see any passwords)
  app.get('/api/users', requireAuth, (req: AuthenticatedRequest, res) => {
    const isAdmin = req.authUser?.role === 'ADMIN';
    res.json(store.users.map((u) => sanitizeUserForClient(u, isAdmin)));
  });

  app.post('/api/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const normalized = normalizeUserRecord(req.body);
      const plainPassword = String(req.body?.password ?? Math.random().toString(36).slice(-8));

      if (!normalized.license || !normalized.name) {
        return res.status(400).json({ error: 'Nombre y licencia son obligatorios.' });
      }
      if (store.users.some((u) => u.license.toLowerCase() === normalized.license.toLowerCase())) {
        return res.status(400).json({ error: 'Ya existe un usuario con esta licencia.' });
      }
      if (store.users.some((u) => u.username.toLowerCase() === normalized.username.toLowerCase())) {
        return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de acceso.' });
      }

      const stored: StoredUser = {
        ...normalized,
        passwordHash: await hashPassword(plainPassword),
        passwordEncrypted: encryptVaultPassword(plainPassword),
      };
      delete stored.password;

      store.users.push(stored);
      upsert('users', stored.id, stored);
      logAction(req.authUser!.username, 'CREATE_USER', `Creado usuario ${stored.username} (${stored.role})`);
      res.json(sanitizeUserForClient(stored, true));
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Error al crear usuario.' });
    }
  });

  app.post('/api/users/batch', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const usersToImport = Array.isArray(req.body) ? req.body : req.body?.users;
      if (!Array.isArray(usersToImport)) {
        return res.status(400).json({ error: 'Se esperaba una lista de usuarios.' });
      }

      const existingLicenses = new Set(store.users.map((u) => u.license.toLowerCase()));
      const existingUsernames = new Set(store.users.map((u) => u.username.toLowerCase()));

      const uniqueRaw = usersToImport.filter((u) => {
        const lic = String(u?.license ?? '').trim().toLowerCase();
        return lic && !existingLicenses.has(lic);
      });

      if (uniqueRaw.length === 0 && usersToImport.length > 0) {
        return res.status(400).json({ error: 'Todos los usuarios a importar ya existen (licencia duplicada).' });
      }

      const preparedUsers: StoredUser[] = await Promise.all(
        uniqueRaw.map(async (raw) => {
          const normalized = normalizeUserRecord(raw);
          let candidateUsername = normalized.username;
          let counter = 1;
          while (existingUsernames.has(candidateUsername.toLowerCase())) {
            candidateUsername = `${normalized.username}${counter}`;
            counter++;
          }
          existingUsernames.add(candidateUsername.toLowerCase());
          normalized.username = candidateUsername;

          const plainPass = String(raw?.password ?? Math.random().toString(36).slice(-8));
          const stored: StoredUser = {
            ...normalized,
            passwordHash: await hashPassword(plainPass),
            passwordEncrypted: encryptVaultPassword(plainPass),
          };
          delete stored.password;
          return stored;
        })
      );

      store.users.push(...preparedUsers);

      const insertMany = db.transaction((list: StoredUser[]) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)');
        for (const user of list) {
          stmt.run(user.id, JSON.stringify(user));
        }
      });
      insertMany(preparedUsers);
      bumpVersion();

      logAction(
        req.authUser!.username,
        'BATCH_IMPORT_USERS',
        `Importados ${preparedUsers.length} usuarios (omitidos ${usersToImport.length - preparedUsers.length} duplicados)`
      );
      res.json({ success: true, count: preparedUsers.length, skipped: usersToImport.length - preparedUsers.length });
    } catch (error) {
      console.error('Batch import error:', error);
      res.status(500).json({ error: 'Error al importar usuarios.' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const existing = store.users.find((u) => u.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const normalized = normalizeUserRecord({ ...existing, ...req.body, id });
      let passwordHash = existing.passwordHash;
      let passwordEncrypted = existing.passwordEncrypted;

      const requestedNewPass = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
      const currentPlain = decryptVaultPassword(existing.passwordEncrypted);

      if (requestedNewPass && requestedNewPass !== currentPlain) {
        if (requestedNewPass.length < 4) {
          return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
        }
        passwordHash = await hashPassword(requestedNewPass);
        passwordEncrypted = encryptVaultPassword(requestedNewPass);
        logAction(req.authUser!.username, 'ADMIN_PASSWORD_CHANGE', `Admin cambió contraseña de ${normalized.username}`);
      }

      const updatedUser: StoredUser = {
        ...normalized,
        passwordHash,
        passwordEncrypted,
      };
      delete updatedUser.password;

      store.users = store.users.map((u) => (u.id === id ? updatedUser : u));
      upsert('users', id, updatedUser);
      res.json(sanitizeUserForClient(updatedUser, true));
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Error al actualizar usuario.' });
    }
  });

  app.put('/api/users/:id/password', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const newPassword = String(req.body?.password ?? '').trim();
      if (newPassword.length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
      }
      const existing = store.users.find((u) => u.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const updatedUser: StoredUser = {
        ...existing,
        passwordHash: await hashPassword(newPassword),
        passwordEncrypted: encryptVaultPassword(newPassword),
      };
      delete updatedUser.password;

      store.users = store.users.map((u) => (u.id === id ? updatedUser : u));
      upsert('users', id, updatedUser);
      logAction(req.authUser!.username, 'ADMIN_PASSWORD_RESET', `Admin actualizó contraseña de ${existing.username}`);

      res.json(sanitizeUserForClient(updatedUser, true));
    } catch (error) {
      console.error('Admin password reset error:', error);
      res.status(500).json({ error: 'Error al actualizar la contraseña.' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (req.authUser?.id === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta activa de administrador.' });
    }
    store.users = store.users.filter((u) => u.id !== id);
    remove('users', id);
    logAction(req.authUser!.username, 'DELETE_USER', `Eliminado usuario ${id}`);
    res.json({ success: true });
  });

  // Players alias (protected)
  app.get('/api/players', requireAuth, (req: AuthenticatedRequest, res) => {
    const isAdmin = req.authUser?.role === 'ADMIN';
    res.json(store.users.map((u) => sanitizeUserForClient(u, isAdmin)));
  });

  app.post('/api/players', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const normalized = normalizeUserRecord(req.body);
      const plainPass = String(req.body?.password ?? Math.random().toString(36).slice(-8));
      const stored: StoredUser = {
        ...normalized,
        passwordHash: await hashPassword(plainPass),
        passwordEncrypted: encryptVaultPassword(plainPass),
      };
      delete stored.password;
      store.users.push(stored);
      upsert('users', stored.id, stored);
      res.json(sanitizeUserForClient(stored, true));
    } catch (error) {
      console.error('Create player error:', error);
      res.status(500).json({ error: 'Error al crear jugador.' });
    }
  });

  // Competition Routes
  app.get('/api/competitions/:id/qr', requireAuth, (req, res) => {
    res.json({ qrCode: `checkin-${req.params.id}` });
  });

  app.get('/api/competitions/:id/groups', requireAuth, (req, res) => {
    const { id } = req.params;
    res.json(store.groups.filter((g) => g.competitionId === id));
  });

  app.post('/api/competitions/:id/phase2', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    logAction(req.authUser!.username, 'START_PHASE2', `Fase 2 iniciada en competición ${id}`);
    res.json({ success: true });
  });

  app.get('/api/competitions', requireAuth, (_req, res) => {
    res.json(store.competitions);
  });

  app.post('/api/competitions', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const newComp = req.body;
    store.competitions.unshift(newComp);
    upsert('competitions', newComp.id, newComp);
    logAction(req.authUser!.username, 'CREATE_COMPETITION', `Competición ${newComp.name}`);
    res.json(newComp);
  });

  app.put('/api/competitions/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const updatedComp = req.body;
      store.competitions = store.competitions.map((c) => (c.id === id ? updatedComp : c));
      upsert('competitions', id, updatedComp);
      res.json(updatedComp);
    } catch (e: any) {
      console.error('Failed to update competition:', e);
      res.status(500).json({ error: e.message || 'Failed to update competition' });
    }
  });

  app.delete('/api/competitions/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    store.competitions = store.competitions.filter((c) => c.id !== id);
    remove('competitions', id);

    store.teams.filter((t) => t.competitionId === id).forEach((t) => remove('teams', t.id));
    store.teams = store.teams.filter((t) => t.competitionId !== id);

    store.matches.filter((m) => m.competitionId === id).forEach((m) => remove('matches', m.id));
    store.matches = store.matches.filter((m) => m.competitionId !== id);

    store.groups.filter((g) => g.competitionId === id).forEach((g) => remove('groups', g.id));
    store.groups = store.groups.filter((g) => g.competitionId !== id);

    logAction(req.authUser!.username, 'DELETE_COMPETITION', `Eliminada competición ${id}`);
    res.json({ success: true });
  });

  // Teams Routes
  app.post('/api/teams', requireAuth, requireAdminOrClubAdmin, (req: AuthenticatedRequest, res) => {
    const newTeam = req.body as Team;
    if (req.authUser!.role === 'CLUB_ADMIN') {
      const clubPlayers = new Set(
        store.users.filter((u) => u.club === req.authUser!.club).map((u) => u.name)
      );
      if (!Array.isArray(newTeam.players) || !newTeam.players.every((p) => clubPlayers.has(p))) {
        return res.status(403).json({ error: 'Solo puedes inscribir jugadores de tu propio club.' });
      }
    }

    store.teams.push(newTeam);
    upsert('teams', newTeam.id, newTeam);

    if (newTeam.competitionId) {
      store.competitions = store.competitions.map((c) => {
        if (c.id === newTeam.competitionId) {
          const updatedComp = { ...c, registeredCount: (c.registeredCount || 0) + 1 };
          upsert('competitions', updatedComp.id, updatedComp);
          return updatedComp;
        }
        return c;
      });
    }
    res.json(newTeam);
  });

  app.post('/api/teams/batch', requireAuth, requireAdminOrClubAdmin, (req: AuthenticatedRequest, res) => {
    const teamsToImport = Array.isArray(req.body) ? req.body : req.body?.teams;
    const actor = req.authUser!.username;

    if (!Array.isArray(teamsToImport)) {
      return res.status(400).json({ error: 'Expected an array of teams' });
    }

    if (req.authUser!.role === 'CLUB_ADMIN') {
      const clubPlayers = new Set(
        store.users.filter((u) => u.club === req.authUser!.club).map((u) => u.name)
      );
      const valid = teamsToImport.every(
        (t: Team) => Array.isArray(t.players) && t.players.every((p) => clubPlayers.has(p))
      );
      if (!valid) {
        return res.status(403).json({ error: 'Solo puedes importar equipos con jugadores de tu club.' });
      }
    }

    store.teams.push(...teamsToImport);
    const insertMany = db.transaction((teams: Team[]) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO teams (id, data) VALUES (?, ?)');
      for (const team of teams) {
        stmt.run(team.id, JSON.stringify(team));
      }
    });
    insertMany(teamsToImport);
    bumpVersion();

    teamsToImport.forEach((team: Team) => {
      if (team.competitionId) {
        store.competitions = store.competitions.map((c) => {
          if (c.id === team.competitionId) {
            const updatedComp = { ...c, registeredCount: (c.registeredCount || 0) + 1 };
            upsert('competitions', updatedComp.id, updatedComp);
            return updatedComp;
          }
          return c;
        });
      }
    });
    logAction(actor, 'BATCH_IMPORT_TEAMS', `Imported ${teamsToImport.length} teams`);
    res.json({ success: true, count: teamsToImport.length });
  });

  app.put('/api/teams/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.id);
      const existing = store.teams.find((t) => t.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Equipo no encontrado.' });
      }

      if (req.authUser!.role === 'ADMIN') {
        const updatedTeam = req.body;
        store.teams = store.teams.map((t) => (t.id === id ? updatedTeam : t));
        upsert('teams', id, updatedTeam);
        return res.json(updatedTeam);
      }

      // Non-admin players can ONLY check in their own team via QR/Manual Check-In
      const isMember = existing.players?.some(
        (p) => p.toLowerCase() === req.authUser!.name.toLowerCase()
      );
      if (!isMember) {
        return res.status(403).json({ error: 'No tienes permiso para modificar este equipo.' });
      }
      const checkedInTeam = { ...existing, checkedIn: Boolean(req.body?.checkedIn) };
      store.teams = store.teams.map((t) => (t.id === id ? checkedInTeam : t));
      upsert('teams', id, checkedInTeam);
      res.json(checkedInTeam);
    } catch (e: any) {
      console.error('Failed to update team:', e);
      res.status(500).json({ error: e.message || 'Failed to update team' });
    }
  });

  app.post('/api/teams/update-batch', requireAuth, requireAdmin, (req, res) => {
    try {
      const updatedTeams = req.body;
      if (!Array.isArray(updatedTeams)) {
        return res.status(400).json({ error: 'Expected array of teams' });
      }
      const updateMany = db.transaction((teams: Team[]) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO teams (id, data) VALUES (?, ?)');
        teams.forEach((team) => {
          const index = store.teams.findIndex((t) => t.id === team.id);
          if (index !== -1) {
            store.teams[index] = team;
          } else {
            store.teams.push(team);
          }
          stmt.run(team.id, JSON.stringify(team));
        });
      });
      updateMany(updatedTeams);
      bumpVersion();
      res.json(updatedTeams);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/teams/:id', requireAuth, requireAdminOrClubAdmin, (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const teamToDelete = store.teams.find((t) => t.id === id);
    if (!teamToDelete) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }

    if (req.authUser!.role === 'CLUB_ADMIN') {
      const clubPlayers = new Set(
        store.users.filter((u) => u.club === req.authUser!.club).map((u) => u.name)
      );
      if (!teamToDelete.players.every((p) => clubPlayers.has(p))) {
        return res.status(403).json({ error: 'Solo puedes eliminar inscripciones de tu propio club.' });
      }
    }

    if (teamToDelete.competitionId) {
      store.competitions = store.competitions.map((c) => {
        if (c.id === teamToDelete.competitionId) {
          const updatedComp = { ...c, registeredCount: Math.max(0, (c.registeredCount || 0) - 1) };
          upsert('competitions', updatedComp.id, updatedComp);
          return updatedComp;
        }
        return c;
      });
    }
    store.teams = store.teams.filter((t) => t.id !== id);
    remove('teams', id);
    res.json({ success: true });
  });

  app.put('/api/teams', requireAuth, requireAdmin, (req, res) => {
    const updatedTeams = req.body;
    if (!Array.isArray(updatedTeams)) {
      return res.status(400).json({ error: 'Expected array of teams' });
    }
    store.teams = updatedTeams;
    const insertMany = db.transaction((teams: Team[]) => {
      db.prepare('DELETE FROM teams').run();
      const stmt = db.prepare('INSERT INTO teams (id, data) VALUES (?, ?)');
      for (const team of teams) {
        stmt.run(team.id, JSON.stringify(team));
      }
    });
    insertMany(updatedTeams);
    bumpVersion();
    res.json(store.teams);
  });

  // Matches Routes (Admin/Referee full control; Players only score/validate their own matches)
  app.post('/api/matches', requireAuth, (req: AuthenticatedRequest, res) => {
    const newMatches = req.body;
    if (!Array.isArray(newMatches)) {
      return res.status(400).json({ error: 'Expected array of matches' });
    }

    const role = req.authUser!.role;
    const isStaff = role === 'ADMIN' || role === 'REFEREE';

    if (!isStaff) {
      const userName = req.authUser!.name.toLowerCase();
      for (const incoming of newMatches) {
        const existing = store.matches.find((m) => m.id === incoming.id);
        if (!existing) {
          return res.status(403).json({ error: 'Solo los administradores pueden crear partidas nuevas.' });
        }
        const isParticipant =
          existing.team1.players?.some((p) => p.toLowerCase() === userName) ||
          existing.team2.players?.some((p) => p.toLowerCase() === userName);
        if (!isParticipant) {
          return res.status(403).json({ error: 'No tienes permiso para modificar partidas de otros jugadores.' });
        }
      }
    }

    const sanitizedMatches: Match[] = isStaff
      ? newMatches
      : newMatches.map((incoming: Match) => {
          const existing = store.matches.find((m) => m.id === incoming.id)!;
          return {
            ...existing,
            score1: incoming.score1,
            score2: incoming.score2,
            proposedScore1: incoming.proposedScore1,
            proposedScore2: incoming.proposedScore2,
            proposedByTeamId: incoming.proposedByTeamId,
            status: incoming.status,
          };
        });

    const insertMany = db.transaction((matchesList: Match[]) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO matches (id, data) VALUES (?, ?)');
      matchesList.forEach((m) => {
        const index = store.matches.findIndex((existing) => existing.id === m.id);
        if (index !== -1) {
          store.matches[index] = m;
        } else {
          store.matches.push(m);
        }
        stmt.run(m.id, JSON.stringify(m));
      });
    });
    insertMany(sanitizedMatches);
    bumpVersion();

    res.json(sanitizedMatches);
  });

  app.put('/api/matches/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const existing = store.matches.find((m) => m.id === id);
    if (!existing) {
      return res.status(404).json({ error: 'Partida no encontrada.' });
    }

    const role = req.authUser!.role;
    const isStaff = role === 'ADMIN' || role === 'REFEREE';
    if (!isStaff) {
      const userName = req.authUser!.name.toLowerCase();
      const isParticipant =
        existing.team1.players?.some((p) => p.toLowerCase() === userName) ||
        existing.team2.players?.some((p) => p.toLowerCase() === userName);
      if (!isParticipant) {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta partida.' });
      }
    }

    const updatedMatch: Match = isStaff
      ? req.body
      : {
          ...existing,
          score1: req.body.score1,
          score2: req.body.score2,
          proposedScore1: req.body.proposedScore1,
          proposedScore2: req.body.proposedScore2,
          proposedByTeamId: req.body.proposedByTeamId,
          status: req.body.status,
        };

    store.matches = store.matches.map((m) => (m.id === id ? updatedMatch : m));
    upsert('matches', id, updatedMatch);
    res.json(updatedMatch);
  });

  // Groups Routes
  app.post('/api/groups', requireAuth, requireAdmin, (req, res) => {
    const newGroups = req.body;
    if (!Array.isArray(newGroups)) {
      return res.status(400).json({ error: 'Expected array of groups' });
    }
    store.groups = newGroups;

    const insertMany = db.transaction((groupsList: Group[]) => {
      db.prepare('DELETE FROM groups').run();
      const stmt = db.prepare('INSERT INTO groups (id, data) VALUES (?, ?)');
      for (const group of groupsList) {
        stmt.run(group.id, JSON.stringify(group));
      }
    });
    insertMany(newGroups);
    bumpVersion();

    res.json(store.groups);
  });

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        maxAge: '7d',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*all', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Catch malformed URL scanner requests (e.g. URIError: Failed to decode param '%c0') cleanly
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof URIError || err?.status === 400) {
      return res.status(400).json({ error: 'Solicitud mal formada.' });
    }
    console.error('Unhandled Express error:', err?.message || err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
