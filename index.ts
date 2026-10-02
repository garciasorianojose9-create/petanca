import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlayerRegistry, Competition, Team, Match, Group, UserRole } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// In-memory storage
let users: PlayerRegistry[] = [...INITIAL_USERS];
let competitions: Competition[] = [];
let teams: Team[] = [];
let matches: Match[] = [];
let groups: Group[] = [];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/data', (req, res) => {
    res.json({
      users,
      competitions,
      teams,
      matches,
      groups
    });
  });

  // Users
  app.post('/api/users', (req, res) => {
    const newUser = req.body;
    users.push(newUser);
    res.json(newUser);
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updatedUser = req.body;
    users = users.map(u => u.id === id ? updatedUser : u);
    res.json(updatedUser);
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    users = users.filter(u => u.id !== id);
    res.json({ success: true });
  });

  // Competitions
  app.post('/api/competitions', (req, res) => {
    const newComp = req.body;
    competitions.unshift(newComp); // Add to beginning
    res.json(newComp);
  });

  app.put('/api/competitions/:id', (req, res) => {
    const { id } = req.params;
    const updatedComp = req.body;
    competitions = competitions.map(c => c.id === id ? updatedComp : c);
    res.json(updatedComp);
  });

  // Teams
  app.post('/api/teams', (req, res) => {
    const newTeam = req.body;
    teams.push(newTeam);
    // Update competition registered count if needed
    if (newTeam.competitionId) {
        competitions = competitions.map(c => {
            if (c.id === newTeam.competitionId) {
                return { ...c, registeredCount: (c.registeredCount || 0) + 1 };
            }
            return c;
        });
    }
    res.json(newTeam);
  });

  app.delete('/api/teams/:id', (req, res) => {
    const { id } = req.params;
    const teamToDelete = teams.find(t => t.id === id);
    if (teamToDelete && teamToDelete.competitionId) {
        competitions = competitions.map(c => {
            if (c.id === teamToDelete.competitionId) {
                return { ...c, registeredCount: Math.max(0, (c.registeredCount || 0) - 1) };
            }
            return c;
        });
    }
    teams = teams.filter(t => t.id !== id);
    res.json({ success: true });
  });
  
  app.put('/api/teams', (req, res) => {
      // Bulk update teams (e.g. for ranking updates)
      const updatedTeams = req.body;
      teams = updatedTeams;
      res.json(teams);
  });

  // Matches
  app.post('/api/matches', (req, res) => {
    const newMatches = req.body; // Expecting array
    matches.push(...newMatches);
    res.json(newMatches);
  });

  app.put('/api/matches/:id', (req, res) => {
    const { id } = req.params;
    const updatedMatch = req.body;
    matches = matches.map(m => m.id === id ? updatedMatch : m);
    res.json(updatedMatch);
  });

  // Groups
  app.post('/api/groups', (req, res) => {
    const newGroups = req.body; // Expecting array
    groups = newGroups;
    res.json(groups);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production (if built)
    app.use(express.static(path.join(__dirname, 'dist')));

    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
