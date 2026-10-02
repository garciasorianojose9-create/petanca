import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { PlayerRegistry, Competition, Team, Match, Group, UserRole } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { timeout: 8000 });
db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for high concurrency
db.pragma('busy_timeout = 8000');

// Create tables for each entity type
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, value TEXT);
`);

// Initial Data
const INITIAL_USERS: PlayerRegistry[] = [
    { 
        id: 'admin-1', 
        license: 'ADM-001', 
        name: 'Director General', 
        club: 'Federación', 
        category: 'ADMIN', 
        username: 'admin', 
        password: 'admin123', 
        role: 'ADMIN',
        avatar: 'https://ui-avatars.com/api/?name=Director+General&background=d42111&color=fff'
    }
];

// Data Store Structure
interface AuditLog {
    id: string;
    action: string;
    user: string;
    details: string;
    timestamp: string;
}

interface DataStore {
    users: PlayerRegistry[];
    competitions: Competition[];
    teams: Team[];
    matches: Match[];
    groups: Group[];
    logs: AuditLog[];
}

// In-memory storage for ultra-fast reads (0ms latency)
let store: DataStore = {
    users: [],
    competitions: [],
    teams: [],
    matches: [],
    groups: [],
    logs: []
};

let dataVersion = 0;

// SQLite Helper Functions
function upsert(table: string, id: string, data: any) {
    db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`).run(id, JSON.stringify(data));
    dataVersion++;
}

function remove(table: string, id: string) {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    dataVersion++;
}

function clear(table: string) {
    db.prepare(`DELETE FROM ${table}`).run();
    dataVersion++;
}

// Load data from SQLite into memory on startup
function loadData() {
    try {
        store.users = db.prepare('SELECT data FROM users').all().map((row: any) => JSON.parse(row.data));
        store.competitions = db.prepare('SELECT data FROM competitions').all().map((row: any) => JSON.parse(row.data));
        store.teams = db.prepare('SELECT data FROM teams').all().map((row: any) => JSON.parse(row.data));
        store.matches = db.prepare('SELECT data FROM matches').all().map((row: any) => JSON.parse(row.data));
        store.groups = db.prepare('SELECT data FROM groups').all().map((row: any) => JSON.parse(row.data));
        store.logs = db.prepare('SELECT data FROM logs').all().map((row: any) => JSON.parse(row.data));
        
        if (store.users.length === 0) {
            console.log('No data found in SQLite, using defaults.');
            INITIAL_USERS.forEach(u => upsert('users', u.id, u));
            store.users = [...INITIAL_USERS];
        } else {
            console.log('Data loaded successfully from SQLite.');
        }
    } catch (error) {
        console.error('Error loading data from SQLite:', error);
    }
}

// Helper to log actions
function logAction(user: string, action: string, details: string) {
    const newLog: AuditLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        user,
        action,
        details
    };
    store.logs.push(newLog);
    upsert('logs', newLog.id, newLog);
    console.log(`[AUDIT] ${user} - ${action}: ${details}`);
}

// Load initially
loadData();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Use compression to drastically reduce bandwidth for large JSON payloads
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/data/version', (req, res) => {
    res.json({ version: dataVersion });
  });

  app.get('/api/data', (req, res) => {
    res.json(store);
  });

  // Logs Endpoint
  app.get('/api/logs', (req, res) => {
      res.json(store.logs);
  });

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Case-insensitive username check
    const user = store.users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === password
    );
    
    if (user) {
      const { password, ...userWithoutPassword } = user;
      // Wrap in object to match frontend expectation
      res.json({
          success: true,
          token: 'mock-token',
          user: userWithoutPassword
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const newUser = req.body;
    if (store.users.some(u => u.username === newUser.username)) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    store.users.push(newUser);
    upsert('users', newUser.id, newUser);
    const { password, ...userWithoutPassword } = newUser;
    res.json(userWithoutPassword);
  });

  // Users
  app.get('/api/users', (req, res) => {
    res.json(store.users);
  });

  app.post('/api/users', (req, res) => {
    const newUser = req.body;
    
    // Check for duplicates
    if (store.users.some(u => u.license === newUser.license)) {
      return res.status(400).json({ error: 'Ya existe un usuario con esta licencia.' });
    }

    store.users.push(newUser);
    upsert('users', newUser.id, newUser);
    res.json(newUser);
  });

  app.post('/api/users/batch', (req, res) => {
    const { users, adminUser } = req.body; 
    
    // Handle both direct array (legacy) and new object format
    const usersToImport = Array.isArray(req.body) ? req.body : users;
    const actor = adminUser || 'unknown';

    if (Array.isArray(usersToImport)) {
        // Filter out duplicates
        const newUsers = usersToImport.filter(newUser => {
            return !store.users.some(existingUser => 
                existingUser.license === newUser.license
            );
        });

        if (newUsers.length === 0 && usersToImport.length > 0) {
            return res.status(400).json({ error: 'Todos los usuarios a importar ya existen (licencia duplicada).' });
        }

        store.users.push(...newUsers);
        
        // Use a transaction for batch inserts
        const insertMany = db.transaction((users) => {
            for (const user of users) {
                db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)').run(user.id, JSON.stringify(user));
            }
        });
        insertMany(newUsers);
        dataVersion++;

        logAction(actor, 'BATCH_IMPORT_USERS', `Imported ${newUsers.length} users (skipped ${usersToImport.length - newUsers.length} duplicates)`);
        res.json({ success: true, count: newUsers.length, skipped: usersToImport.length - newUsers.length });
    } else {
        res.status(400).json({ error: "Expected an array of users" });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updatedUser = req.body;
    store.users = store.users.map(u => u.id === id ? updatedUser : u);
    upsert('users', id, updatedUser);
    res.json(updatedUser);
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    store.users = store.users.filter(u => u.id !== id);
    remove('users', id);
    res.json({ success: true });
  });

  // Players (alias)
  app.get('/api/players', (req, res) => {
    res.json(store.users);
  });

  app.post('/api/players', (req, res) => {
    const newPlayer = req.body;
    store.users.push(newPlayer);
    upsert('users', newPlayer.id, newPlayer);
    res.json(newPlayer);
  });

  // Competition specific routes
  app.get('/api/competitions/:id/qr', (req, res) => {
    res.json({ qrCode: `mock-qr-code-${req.params.id}` });
  });

  app.get('/api/competitions/:id/groups', (req, res) => {
    const { id } = req.params;
    const compGroups = store.groups.filter(g => g.competitionId === id);
    res.json(compGroups);
  });

  app.post('/api/competitions/:id/phase2', (req, res) => {
    const { id } = req.params;
    console.log(`Generating phase 2 for competition ${id}`);
    res.json({ success: true });
  });

  // Competitions
  app.get('/api/competitions', (req, res) => {
    res.json(store.competitions);
  });

  app.post('/api/competitions', (req, res) => {
    const newComp = req.body;
    store.competitions.unshift(newComp);
    upsert('competitions', newComp.id, newComp);
    res.json(newComp);
  });

  app.put('/api/competitions/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updatedComp = req.body;
        store.competitions = store.competitions.map(c => c.id === id ? updatedComp : c);
        upsert('competitions', id, updatedComp);
        res.json(updatedComp);
    } catch (e: any) {
        console.error("Failed to update competition:", e);
        res.status(500).json({ error: e.message || "Failed to update competition" });
    }
  });

  app.delete('/api/competitions/:id', (req, res) => {
    const { id } = req.params;
    store.competitions = store.competitions.filter(c => c.id !== id);
    remove('competitions', id);
    
    // Delete related teams, matches, and groups
    store.teams.filter(t => t.competitionId === id).forEach(t => remove('teams', t.id));
    store.teams = store.teams.filter(t => t.competitionId !== id);
    
    store.matches.filter(m => m.competitionId === id).forEach(m => remove('matches', m.id));
    store.matches = store.matches.filter(m => m.competitionId !== id);
    
    store.groups.filter(g => g.competitionId === id).forEach(g => remove('groups', g.id));
    store.groups = store.groups.filter(g => g.competitionId !== id);
    
    res.json({ success: true });
  });

  // Teams
  app.post('/api/teams', (req, res) => {
    const newTeam = req.body;
    store.teams.push(newTeam);
    upsert('teams', newTeam.id, newTeam);
    
    if (newTeam.competitionId) {
        store.competitions = store.competitions.map(c => {
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

  app.post('/api/teams/batch', (req, res) => {
    const { teams, adminUser } = req.body;
    
    const teamsToImport = Array.isArray(req.body) ? req.body : teams;
    const actor = adminUser || 'unknown';

    if (Array.isArray(teamsToImport)) {
        store.teams.push(...teamsToImport);
        
        const insertMany = db.transaction((teams) => {
            for (const team of teams) {
                db.prepare('INSERT OR REPLACE INTO teams (id, data) VALUES (?, ?)').run(team.id, JSON.stringify(team));
            }
        });
        insertMany(teamsToImport);
        dataVersion++;

        // Update competition counts
        teamsToImport.forEach(team => {
            if (team.competitionId) {
                store.competitions = store.competitions.map(c => {
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
    } else {
        res.status(400).json({ error: "Expected an array of teams" });
    }
  });

  app.put('/api/teams/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updatedTeam = req.body;
      store.teams = store.teams.map(t => t.id === id ? updatedTeam : t);
      upsert('teams', id, updatedTeam);
      res.json(updatedTeam);
    } catch (e: any) {
      console.error("Failed to update team:", e);
      res.status(500).json({ error: e.message || "Failed to update team" });
    }
  });

  app.post('/api/teams/update-batch', (req, res) => {
    try {
        const updatedTeams = req.body;
        const updateMany = db.transaction((teams) => {
            teams.forEach((team: any) => {
                const index = store.teams.findIndex(t => t.id === team.id);
                if (index !== -1) {
                    store.teams[index] = team;
                } else {
                    store.teams.push(team);
                }
                upsert('teams', team.id, team);
            });
        });
        updateMany(updatedTeams);
        // bump data version
        const currentVersionStr = (db.prepare('SELECT value FROM system_state WHERE key = ?').get('data_version') as any)?.value;
        const newVersion = (parseInt(currentVersionStr || '0') + 1).toString();
        db.prepare('INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)').run('data_version', newVersion);
        res.json(updatedTeams);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/teams/:id', (req, res) => {
    const { id } = req.params;
    const teamToDelete = store.teams.find(t => t.id === id);
    if (teamToDelete && teamToDelete.competitionId) {
        store.competitions = store.competitions.map(c => {
            if (c.id === teamToDelete.competitionId) {
                const updatedComp = { ...c, registeredCount: Math.max(0, (c.registeredCount || 0) - 1) };
                upsert('competitions', updatedComp.id, updatedComp);
                return updatedComp;
            }
            return c;
        });
    }
    store.teams = store.teams.filter(t => t.id !== id);
    remove('teams', id);
    res.json({ success: true });
  });
  
  app.put('/api/teams', (req, res) => {
      const updatedTeams = req.body;
      store.teams = updatedTeams;
      
      const insertMany = db.transaction((teams) => {
          db.prepare('DELETE FROM teams').run();
          for (const team of teams) {
              db.prepare('INSERT INTO teams (id, data) VALUES (?, ?)').run(team.id, JSON.stringify(team));
          }
      });
      insertMany(updatedTeams);
      dataVersion++;
      
      res.json(store.teams);
  });

  // Matches
  app.post('/api/matches', (req, res) => {
    const newMatches = req.body;
    
    const insertMany = db.transaction((matches) => {
        matches.forEach((newMatch: Match) => {
            const index = store.matches.findIndex(m => m.id === newMatch.id);
            if (index !== -1) {
                store.matches[index] = newMatch;
            } else {
                store.matches.push(newMatch);
            }
            db.prepare('INSERT OR REPLACE INTO matches (id, data) VALUES (?, ?)').run(newMatch.id, JSON.stringify(newMatch));
        });
    });
    insertMany(newMatches);
    dataVersion++;
    
    res.json(newMatches);
  });

  app.put('/api/matches/:id', (req, res) => {
    const { id } = req.params;
    const updatedMatch = req.body;
    store.matches = store.matches.map(m => m.id === id ? updatedMatch : m);
    upsert('matches', id, updatedMatch);
    res.json(updatedMatch);
  });

  // Groups
  app.post('/api/groups', (req, res) => {
    const newGroups = req.body;
    store.groups = newGroups;
    
    const insertMany = db.transaction((groups) => {
        db.prepare('DELETE FROM groups').run();
        for (const group of groups) {
            db.prepare('INSERT INTO groups (id, data) VALUES (?, ?)').run(group.id, JSON.stringify(group));
        }
    });
    insertMany(newGroups);
    dataVersion++;
    
    res.json(store.groups);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
