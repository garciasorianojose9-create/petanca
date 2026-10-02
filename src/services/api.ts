import { PlayerRegistry, Competition, Team, Match, Group } from '../../types';

const API_URL = '/api';

export const api = {
    // Auth
    login: async (username: string, password: string): Promise<PlayerRegistry> => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            throw new Error('Login failed');
        }
        return response.json();
    },

    // Users
    getUsers: async (): Promise<PlayerRegistry[]> => {
        const response = await fetch(`${API_URL}/users?t=${Date.now()}`);
        return response.json();
    },
    createUser: async (user: PlayerRegistry): Promise<PlayerRegistry> => {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error al crear usuario');
        }
        return response.json();
    },
    createUsersBatch: async (users: PlayerRegistry[]): Promise<any> => {
        const response = await fetch(`${API_URL}/users/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error al importar usuarios');
        }
        return response.json();
    },
    updateUser: async (user: PlayerRegistry): Promise<PlayerRegistry> => {
        const response = await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        if (!response.ok) {
            const text = await response.text();
            try {
                const err = JSON.parse(text);
                throw new Error(err.error || 'Error al actualizar usuario');
            } catch {
                throw new Error(`Error ${response.status}: ${text}`);
            }
        }
        return response.json();
    },
    deleteUser: async (id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const text = await response.text();
            try {
                const err = JSON.parse(text);
                throw new Error(err.error || 'Error al eliminar usuario');
            } catch {
                throw new Error(`Error ${response.status}: ${text}`);
            }
        }
    },

    // Competitions
    getCompetitions: async (): Promise<Competition[]> => {
        const response = await fetch(`${API_URL}/competitions?t=${Date.now()}`);
        return response.json();
    },
    createCompetition: async (comp: Competition): Promise<Competition> => {
        const response = await fetch(`${API_URL}/competitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comp)
        });
        return response.json();
    },
    updateCompetition: async (comp: Competition): Promise<Competition> => {
        const response = await fetch(`${API_URL}/competitions/${comp.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comp)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    deleteCompetition: async (id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/competitions/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete competition');
        }
    },

    // Teams
    getTeams: async (): Promise<Team[]> => {
        const response = await fetch(`${API_URL}/teams?t=${Date.now()}`);
        return response.json();
    },
    createTeam: async (team: Team): Promise<Team> => {
        const response = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(team)
        });
        return response.json();
    },
    createTeamsBatch: async (teams: Team[]): Promise<any> => {
        const response = await fetch(`${API_URL}/teams/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teams)
        });
        return response.json();
    },
    updateTeamsBatch: async (teams: Team[]): Promise<any> => {
        const response = await fetch(`${API_URL}/teams/update-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teams)
        });
        return response.json();
    },
    updateTeam: async (team: Team): Promise<Team> => {
        const response = await fetch(`${API_URL}/teams/${team.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(team)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },
    deleteTeam: async (id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(await response.text());
    },

    // Matches
    getMatches: async (): Promise<Match[]> => {
        const response = await fetch(`${API_URL}/matches?t=${Date.now()}`);
        return response.json();
    },
    updateMatches: async (matches: Match[]): Promise<Match[]> => {
        const response = await fetch(`${API_URL}/matches`, {
            method: 'POST', // Using POST for bulk update/replace
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(matches)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Groups
    getGroups: async (): Promise<Group[]> => {
        const response = await fetch(`${API_URL}/groups?t=${Date.now()}`);
        return response.json();
    },
    updateGroups: async (groups: Group[]): Promise<Group[]> => {
        const response = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groups)
        });
        return response.json();
    },

    // Sync All (for initial load)
    syncAll: async (data: any): Promise<void> => {
        await fetch(`${API_URL}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    // Fetch All Data
    getDataVersion: async (): Promise<{ version: number }> => {
        const response = await fetch(`${API_URL}/data/version?t=${Date.now()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch data version');
        }
        return response.json();
    },
    getAllData: async (): Promise<any> => {
        const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText} - ${text.substring(0, 100)}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
    }
};
