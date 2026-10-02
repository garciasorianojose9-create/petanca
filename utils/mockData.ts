
import { Team, Match, Group, Competition, PlayerRegistry } from '../types';

// Updated DEFAULT_TEAMS with names matching the Player Database for the demo
export const DEFAULT_TEAMS: Team[] = [
    { id: '1', name: 'Club Petanca Murcia A', players: ['Roberto Sanchez', 'Pedro Diaz'], avatar: 'https://ui-avatars.com/api/?name=Murcia+A&background=d42111&color=fff', rank: 1, pts: 5, bh: 15, diff: 32, status: 'qualified' },
    { id: '2', name: 'Cartagena Bochas', players: ['Miguel Oton', 'J. Garcia'], avatar: 'https://ui-avatars.com/api/?name=Cartagena&background=random', rank: 2, pts: 4, bh: 14, diff: 28, status: 'qualified' },
    { id: '3', name: 'Águilas Team 1', players: ['Sofia Fernandez', 'F. Lopez'], avatar: 'https://ui-avatars.com/api/?name=Aguilas&background=random', rank: 3, pts: 4, bh: 13, diff: 20, status: 'qualified' },
    { id: '4', name: 'Lorca Petanca', players: ['J. Martinez', 'A. Ruiz'], avatar: 'https://ui-avatars.com/api/?name=Lorca&background=random', rank: 4, pts: 3, bh: 12, diff: 15, status: 'qualified' },
    { id: '5', name: 'Mazarrón Club', players: ['D. Romero', 'K. Silva'], avatar: 'https://ui-avatars.com/api/?name=Mazarron&background=random', rank: 5, pts: 3, bh: 11, diff: 10, status: 'qualified' },
    { id: '6', name: 'San Javier B', players: ['Laura Gomez', 'L. Gomez'], avatar: 'https://ui-avatars.com/api/?name=San+Javier&background=random', rank: 6, pts: 3, bh: 10, diff: 8, status: 'qualified' },
    { id: '7', name: 'Torre Pacheco', players: ['A. Flores', 'B. Casas'], avatar: 'https://ui-avatars.com/api/?name=Torre+Pacheco&background=random', rank: 7, pts: 2, bh: 9, diff: -2, status: 'qualified' },
    { id: '8', name: 'Alcantarilla', players: ['V. Muñoz', 'G. Pardo'], avatar: 'https://ui-avatars.com/api/?name=Alcantarilla&background=random', rank: 8, pts: 2, bh: 8, diff: -4, status: 'qualified' },
    { id: '9', name: 'Yecla C.P.', players: ['S. Gil', 'M. Vega'], avatar: 'https://ui-avatars.com/api/?name=Yecla&background=random', rank: 9, pts: 2, bh: 8, diff: -5, status: 'qualified' },
    { id: '10', name: 'Archena Petanca', players: ['L. Royo', 'P. Saez'], avatar: 'https://ui-avatars.com/api/?name=Archena&background=random', rank: 10, pts: 2, bh: 7, diff: -6, status: 'qualified' },
    { id: '16', name: 'Totana Petanca', players: ['Carlos Soler', 'J. Soler'], avatar: 'https://ui-avatars.com/api/?name=Totana&background=random', rank: 16, pts: 2, bh: 6, diff: -8, status: 'qualified' },
    { id: '17', name: 'C.P. Las Torres', players: ['Alejandro Martínez', 'Juan Ruiz'], avatar: 'https://ui-avatars.com/api/?name=Las+Torres&background=random', rank: 17, pts: 1, bh: 11, diff: -12, status: 'eliminated' },
];

export const DEFAULT_GROUPS: Group[] = [
    { id: 'A', competitionId: '1', name: 'Poule A', teams: [DEFAULT_TEAMS[0], DEFAULT_TEAMS[7], DEFAULT_TEAMS[8], DEFAULT_TEAMS[10]] },
    { id: 'B', competitionId: '1', name: 'Poule B', teams: [DEFAULT_TEAMS[1], DEFAULT_TEAMS[6], DEFAULT_TEAMS[9], { ...DEFAULT_TEAMS[4], name: 'Molina Team B' }] },
    { id: 'C', competitionId: '1', name: 'Poule C', teams: [DEFAULT_TEAMS[2], DEFAULT_TEAMS[5], { ...DEFAULT_TEAMS[3], name: 'Lorquí Club' }, { ...DEFAULT_TEAMS[11], name: 'Cieza Petanca' }] },
    { id: 'D', competitionId: '1', name: 'Poule D', teams: [DEFAULT_TEAMS[3], DEFAULT_TEAMS[4], { ...DEFAULT_TEAMS[5], name: 'Caravaca B' }, { ...DEFAULT_TEAMS[0], name: 'Santomera' }] },
];

export const CURRENT_MATCH: Match = {
    id: 'm101',
    competitionId: '1',
    team1: DEFAULT_TEAMS[0], // Murcia A (Roberto, Pedro)
    team2: DEFAULT_TEAMS[1], // Cartagena (Miguel)
    score1: 9,
    score2: 7,
    court: 14,
    status: 'live',
    round: 'Swiss Round 3',
    startTime: '10:00'
};

// Simulation of multiple live matches
export const DEFAULT_MATCHES: Match[] = [
    CURRENT_MATCH,
    {
        id: 'm102',
        competitionId: '1',
        team1: DEFAULT_TEAMS[11], // Las Torres (Alejandro, Juan)
        team2: DEFAULT_TEAMS[5], // San Javier (Laura)
        score1: 0,
        score2: 0,
        court: 3,
        status: 'scheduled',
        round: 'Swiss Round 3',
        startTime: '10:45'
    },
    {
        id: 'm103',
        competitionId: '1',
        team1: DEFAULT_TEAMS[10], // Totana (Carlos)
        team2: DEFAULT_TEAMS[2], // Aguilas (Sofia)
        score1: 12,
        score2: 10,
        court: 8,
        status: 'live',
        round: 'Swiss Round 3',
        startTime: '10:15'
    },
    // Bracket Matches (QF)
    {
        id: 'qf1',
        competitionId: '1',
        team1: DEFAULT_TEAMS[0],
        team2: DEFAULT_TEAMS[7],
        score1: 13,
        score2: 5,
        court: 1,
        status: 'finished',
        round: 'QF',
        startTime: '12:00'
    },
    {
        id: 'qf2',
        competitionId: '1',
        team1: DEFAULT_TEAMS[1],
        team2: DEFAULT_TEAMS[6],
        score1: 13,
        score2: 11,
        court: 2,
        status: 'finished',
        round: 'QF',
        startTime: '12:00'
    },
    {
        id: 'qf3',
        competitionId: '1',
        team1: DEFAULT_TEAMS[2],
        team2: DEFAULT_TEAMS[5],
        score1: 8,
        score2: 13,
        court: 3,
        status: 'finished',
        round: 'QF',
        startTime: '12:00'
    },
    {
        id: 'qf4',
        competitionId: '1',
        team1: DEFAULT_TEAMS[3],
        team2: DEFAULT_TEAMS[4],
        score1: null,
        score2: null,
        court: 4,
        status: 'live',
        round: 'QF',
        startTime: '12:00'
    },
    // Bracket Matches (SF)
    {
        id: 'sf1',
        competitionId: '1',
        team1: DEFAULT_TEAMS[0],
        team2: DEFAULT_TEAMS[1],
        score1: null,
        score2: null,
        court: 1,
        status: 'scheduled',
        round: 'SF',
        startTime: '14:00'
    },
    {
        id: 'sf2',
        competitionId: '1',
        team1: DEFAULT_TEAMS[5],
        team2: { ...DEFAULT_TEAMS[3], name: 'Winner QF4' }, // Placeholder
        score1: null,
        score2: null,
        court: 2,
        status: 'scheduled',
        round: 'SF',
        startTime: '14:00'
    },
    // Bracket Matches (Final)
    {
        id: 'f1',
        competitionId: '1',
        team1: { ...DEFAULT_TEAMS[0], name: 'Winner SF1' },
        team2: { ...DEFAULT_TEAMS[5], name: 'Winner SF2' },
        score1: null,
        score2: null,
        court: 1,
        status: 'scheduled',
        round: 'F',
        startTime: '16:00'
    }
];

export const COMPETITIONS_DATA: Competition[] = [
    {
        id: '1',
        name: 'Campeonato Regional de Murcia 2024',
        organizer: 'Fed. Petanca Murcia',
        location: 'Club Petanca Murcia',
        startDate: '2024-03-10',
        endDate: '2024-03-12',
        status: 'LIVE',
        type: 'Dupletas Senior',
        registeredCount: 32,
        maxTeams: 64,
        image: 'https://picsum.photos/seed/comp1/600/300',
        currentPhase: 'Poules',
        checkinToken: 'crm2024-live-token'
    },
    {
        id: '2',
        name: 'Open Nacional "Ciudad del Sol"',
        organizer: 'CP Lorca',
        location: 'Lorca, Murcia',
        startDate: '2024-04-05',
        endDate: '2024-04-07',
        status: 'UPCOMING',
        type: 'Tripletas',
        registeredCount: 15,
        maxTeams: 48,
        image: 'https://picsum.photos/seed/comp2/600/300',
        currentPhase: 'Registration',
        checkinToken: 'open2024-upcoming-token'
    },
    {
        id: '3',
        name: 'Competición Nocturna de Verano',
        organizer: 'CP Águilas',
        location: 'Águilas Beach',
        startDate: '2024-07-20',
        endDate: '2024-07-20',
        status: 'UPCOMING',
        type: 'Dupletas Mixtas',
        registeredCount: 0,
        maxTeams: 32,
        image: 'https://picsum.photos/seed/comp3/600/300',
        currentPhase: 'Registration',
        checkinToken: 'nocturno2024-token'
    },
    {
        id: '4',
        name: 'Liga de Clubes 2023',
        organizer: 'Fed. Petanca Murcia',
        location: 'Multiple Venues',
        startDate: '2023-09-01',
        endDate: '2023-12-15',
        status: 'COMPLETED',
        type: 'Equipos',
        registeredCount: 12,
        maxTeams: 12,
        image: 'https://picsum.photos/seed/comp4/600/300',
        currentPhase: 'Finals',
        checkinToken: 'liga2023-completed-token'
    }
];

// Default seed data for the application
export const DEFAULT_PLAYERS: PlayerRegistry[] = [
    { id: '1', license: 'MU-1092', name: 'Alejandro Martínez', club: 'C.P. Las Torres', category: 'SENIOR 1', username: 'alejandro', password: 'password123', role: 'PLAYER' },
    { id: '2', license: 'MU-2938', name: 'Juan Ruiz', club: 'C.P. Las Torres', category: 'SENIOR 2', username: 'juan', password: 'password123', role: 'PLAYER' },
    { id: '3', license: 'MU-8831', name: 'María Gonzalez', club: 'Petanca Murcia', category: 'FEMININE', username: 'maria', password: 'password123', role: 'PLAYER' },
    { id: '4', license: 'MU-0021', name: 'Carlos Soler', club: 'CP Totana', category: 'JUVENILE', username: 'carlos', password: 'password123', role: 'PLAYER' },
    { id: '5', license: 'MU-4492', name: 'Pedro Diaz', club: 'C.P. Murcia A', category: 'SENIOR 1', username: 'pedro', password: 'password123', role: 'PLAYER' },
    { id: '6', license: 'MU-3321', name: 'Laura Gomez', club: 'San Javier', category: 'FEMININE', username: 'laura', password: 'password123', role: 'PLAYER' },
    { id: '7', license: 'MU-9912', name: 'Roberto Sanchez', club: 'C.P. Murcia A', category: 'SENIOR 1', username: 'roberto', password: 'password123', role: 'PLAYER' },
    { id: '8', license: 'MU-5521', name: 'Miguel Oton', club: 'Cartagena Bochas', category: 'SENIOR 2', username: 'miguel', password: 'password123', role: 'PLAYER' },
    { id: '9', license: 'MU-1234', name: 'Sofia Fernandez', club: 'Águilas', category: 'JUVENILE', username: 'sofia', password: 'password123', role: 'PLAYER' },
];
