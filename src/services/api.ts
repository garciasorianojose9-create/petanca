import { PlayerRegistry, Competition, Team, Match, Group } from '../../types';

const API_URL = '/api';

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401 && !input.includes('/auth/login') && !input.includes('/auth/me')) {
    window.dispatchEvent(new CustomEvent('petanca:unauthorized'));
  }

  return response;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return new Error(parsed.error || parsed.message || fallback);
  } catch {
    return new Error(text || `${fallback} (${response.status})`);
  }
}

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<{ success: boolean; token: string; user: PlayerRegistry }> => {
    const response = await apiFetch(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw await parseError(response, 'Credenciales incorrectas.');
    }
    return response.json();
  },

  logout: async (): Promise<void> => {
    await apiFetch(`${API_URL}/auth/logout`, { method: 'POST' });
  },

  getMe: async (): Promise<PlayerRegistry | null> => {
    const response = await apiFetch(`${API_URL}/auth/me`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user || null;
  },

  changeOwnPassword: async (currentPassword: string, newPassword: string): Promise<PlayerRegistry> => {
    const response = await apiFetch(`${API_URL}/auth/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al cambiar la contraseña');
    }
    const data = await response.json();
    return data.user;
  },

  // Users
  getUsers: async (): Promise<PlayerRegistry[]> => {
    const response = await apiFetch(`${API_URL}/users?t=${Date.now()}`);
    if (!response.ok) throw await parseError(response, 'Error al cargar usuarios');
    return response.json();
  },

  createUser: async (user: PlayerRegistry): Promise<PlayerRegistry> => {
    const response = await apiFetch(`${API_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al crear usuario');
    }
    return response.json();
  },

  createUsersBatch: async (users: PlayerRegistry[]): Promise<any> => {
    const response = await apiFetch(`${API_URL}/users/batch`, {
      method: 'POST',
      body: JSON.stringify(users),
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al importar usuarios');
    }
    return response.json();
  },

  updateUser: async (user: PlayerRegistry): Promise<PlayerRegistry> => {
    const response = await apiFetch(`${API_URL}/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al actualizar usuario');
    }
    return response.json();
  },

  updateUserPassword: async (id: string, password: string): Promise<PlayerRegistry> => {
    const response = await apiFetch(`${API_URL}/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al cambiar contraseña');
    }
    return response.json();
  },

  deleteUser: async (id: string): Promise<void> => {
    const response = await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw await parseError(response, 'Error al eliminar usuario');
    }
  },

  // Competitions
  getCompetitions: async (): Promise<Competition[]> => {
    const response = await apiFetch(`${API_URL}/competitions?t=${Date.now()}`);
    if (!response.ok) throw await parseError(response, 'Error al cargar competiciones');
    return response.json();
  },

  createCompetition: async (comp: Competition): Promise<Competition> => {
    const response = await apiFetch(`${API_URL}/competitions`, {
      method: 'POST',
      body: JSON.stringify(comp),
    });
    if (!response.ok) throw await parseError(response, 'Error al crear competición');
    return response.json();
  },

  updateCompetition: async (comp: Competition): Promise<Competition> => {
    const response = await apiFetch(`${API_URL}/competitions/${comp.id}`, {
      method: 'PUT',
      body: JSON.stringify(comp),
    });
    if (!response.ok) throw await parseError(response, 'Error al actualizar competición');
    return response.json();
  },

  deleteCompetition: async (id: string): Promise<void> => {
    const response = await apiFetch(`${API_URL}/competitions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await parseError(response, 'Error al eliminar competición');
    }
  },

  // Teams
  getTeams: async (): Promise<Team[]> => {
    const response = await apiFetch(`${API_URL}/teams?t=${Date.now()}`);
    if (!response.ok) throw await parseError(response, 'Error al cargar equipos');
    return response.json();
  },

  createTeam: async (team: Team): Promise<Team> => {
    const response = await apiFetch(`${API_URL}/teams`, {
      method: 'POST',
      body: JSON.stringify(team),
    });
    if (!response.ok) throw await parseError(response, 'Error al inscribir equipo');
    return response.json();
  },

  createTeamsBatch: async (teams: Team[]): Promise<any> => {
    const response = await apiFetch(`${API_URL}/teams/batch`, {
      method: 'POST',
      body: JSON.stringify(teams),
    });
    if (!response.ok) throw await parseError(response, 'Error al importar equipos');
    return response.json();
  },

  updateTeamsBatch: async (teams: Team[]): Promise<any> => {
    const response = await apiFetch(`${API_URL}/teams/update-batch`, {
      method: 'POST',
      body: JSON.stringify(teams),
    });
    if (!response.ok) throw await parseError(response, 'Error al actualizar equipos');
    return response.json();
  },

  updateTeam: async (team: Team): Promise<Team> => {
    const response = await apiFetch(`${API_URL}/teams/${team.id}`, {
      method: 'PUT',
      body: JSON.stringify(team),
    });
    if (!response.ok) throw await parseError(response, 'Error al actualizar equipo');
    return response.json();
  },

  deleteTeam: async (id: string): Promise<void> => {
    const response = await apiFetch(`${API_URL}/teams/${id}`, { method: 'DELETE' });
    if (!response.ok) throw await parseError(response, 'Error al eliminar equipo');
  },

  // Matches
  getMatches: async (): Promise<Match[]> => {
    const response = await apiFetch(`${API_URL}/matches?t=${Date.now()}`);
    if (!response.ok) throw await parseError(response, 'Error al cargar partidas');
    return response.json();
  },

  updateMatches: async (matches: Match[]): Promise<Match[]> => {
    const response = await apiFetch(`${API_URL}/matches`, {
      method: 'POST',
      body: JSON.stringify(matches),
    });
    if (!response.ok) throw await parseError(response, 'Error al guardar partidas');
    return response.json();
  },

  // Groups
  getGroups: async (): Promise<Group[]> => {
    const response = await apiFetch(`${API_URL}/groups?t=${Date.now()}`);
    if (!response.ok) throw await parseError(response, 'Error al cargar grupos');
    return response.json();
  },

  updateGroups: async (groups: Group[]): Promise<Group[]> => {
    const response = await apiFetch(`${API_URL}/groups`, {
      method: 'POST',
      body: JSON.stringify(groups),
    });
    if (!response.ok) throw await parseError(response, 'Error al guardar grupos');
    return response.json();
  },

  // Sync All Data
  getDataVersion: async (): Promise<{ version: number }> => {
    const response = await apiFetch(`${API_URL}/data/version?t=${Date.now()}`);
    if (!response.ok) {
      throw await parseError(response, 'Failed to fetch data version');
    }
    return response.json();
  },

  getAllData: async (): Promise<any> => {
    const response = await apiFetch(`${API_URL}/data?t=${Date.now()}`);
    if (!response.ok) {
      throw await parseError(response, 'Failed to fetch data');
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
    }
  },
};
