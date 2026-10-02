

export enum AppView {
    DASHBOARD = 'DASHBOARD',
    MATCH_CENTER = 'MATCH_CENTER',
    BRACKET = 'BRACKET',
    POULES = 'POULES',
    CHECK_IN = 'CHECK_IN',
    STANDINGS = 'STANDINGS',
    CREATE_COMPETITION = 'CREATE_COMPETITION',
    COMPETITIONS_LIST = 'COMPETITIONS_LIST',
    PLAYER_DATABASE = 'PLAYER_DATABASE',
    REGISTRATIONS = 'REGISTRATIONS',
    ADMIN_CARDS = 'ADMIN_CARDS'
}

export type UserRole = 'ADMIN' | 'PLAYER' | 'CLUB_ADMIN' | 'REFEREE';

export type CardColor = 'YELLOW' | 'ORANGE' | 'RED';
export type CardScope = 'MATCH' | 'CHAMPIONSHIP';

export interface PlayerCard {
    id: string;
    playerId: string;
    matchId: string;
    competitionId: string;
    color: CardColor;
    scope: CardScope;
    reason?: string;
    timestamp: number;
}

export interface Team {
    id: string;
    name: string;
    players: string[];
    avatar: string;
    representative?: string;
    rank?: number;
    pts?: number;
    bh?: number;
    fbh?: number; // Fine Buchholz (Sum of opponents' Buchholz)
    diff?: number;
    status: 'qualified' | 'pending' | 'eliminated' | 'playing';
    competitionId?: string; // Optional link to competition
    checkedIn?: boolean;
}

export interface Match {
    id: string;
    competitionId: string; // Link to competition
    team1: Team;
    team2: Team;
    score1: number | null;
    score2: number | null;
    court: number;
    status: 'scheduled' | 'live' | 'pending_validation' | 'finished';
    round: string; // e.g., 'QF', 'SF', 'F', 'Group'
    startTime?: string;
    bracket?: 'DIRECTA' | 'CONSOLACION' | 'REPESCA';
    customLabel?: string;
    proposedScore1?: number;
    proposedScore2?: number;
    proposedByTeamId?: string;
}

export interface Group {
    id: string;
    competitionId: string; // Link to competition
    name: string;
    teams: Team[];
}

export interface CompetitionPhase {
    id: string;
    name: string;
    type: 'SWISS' | 'POULES' | 'KNOCKOUT';
    status: 'PENDING' | 'LIVE' | 'COMPLETED';
    totalRounds?: number;
    swissTiebreaker?: string;
    qualifiersCount?: number;
    courtStart?: number;
    courtEnd?: number;
    timeLimit?: number; // Time limit in minutes for matches in this phase
}

export interface Competition {
    id: string;
    name: string;
    organizer: string;
    location: string;
    startDate: string;
    endDate: string;
    status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
    type: string; // 'STANDARD' | 'KNOCKOUT' or 'CUSTOM'
    registeredCount: number;
    maxTeams: number;
    image: string;
    currentPhase?: string; // e.g., 'Swiss Round 1', 'Poules', 'Quarter Finals'
    phases?: CompetitionPhase[];
    activePhaseId?: string;
    checkinToken?: string; // Unique token for check-in QR code
    format?: 'INDIVIDUAL' | 'DUPLETA' | 'TRIPLETA';
    courtStart?: number; // Starting court number
    courtEnd?: number; // Ending court number
    totalRounds?: number; // Number of swiss rounds for STANDARD tournaments
    swissTiebreaker?: string;
    showStandings?: boolean; // Controls visibility of standings for players
    hasRepesca?: boolean;
    repescaOrigin?: 'ROUND_1' | 'ROUND_2' | 'MANUAL';
    cards?: PlayerCard[];
    qualifiersCount?: number;
    qualificationRule?: 'top2' | 'top2_thirds';
    bestThirdsCount?: number;
}

export type PlayerCategory = 'SENIOR 1' | 'SENIOR 2' | 'JUVENILE' | 'FEMININE' | 'ADMIN';

export interface PlayerRegistry {
    id: string;
    license: string;
    name: string;
    club: string;
    category: PlayerCategory;
    
    // Auth Data
    username: string;
    password: string;
    role: UserRole;
    avatar?: string;
    phone?: string;
    canRegisterClubMembers?: boolean;
}
