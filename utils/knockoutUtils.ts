import { Team, Match, Competition } from '../types';

export const generateKnockoutFirstRound = (
    teams: Team[],
    competitionId: string,
    availableCourts: number[],
    bracket: 'DIRECTA' | 'CONSOLACION' | 'REPESCA' = 'DIRECTA'
): Match[] => {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const pairings: Match[] = [];
    const usedCourts = new Set<number>();
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledTeams.length; i += 2) {
        const team1 = shuffledTeams[i];
        let team2 = shuffledTeams[i + 1];

        let assignedCourt = shuffledCourts.find(c => !usedCourts.has(c)) || shuffledCourts[0] || 0;
        usedCourts.add(assignedCourt);

        if (team2) {
            pairings.push({
                id: `match-ko-r1-${bracket}-${team1.id}-${team2.id}-${Date.now()}`,
                competitionId,
                team1,
                team2,
                score1: null,
                score2: null,
                court: assignedCourt,
                status: 'scheduled',
                round: 'Knockout Round 1',
                bracket: bracket
            });
        } else {
            // BYE
            pairings.push({
                id: `match-ko-r1-${bracket}-${team1.id}-BYE-${Date.now()}`,
                competitionId,
                team1,
                team2: { id: 'bye', name: 'BYE', players: [], avatar: '', status: 'eliminated' },
                score1: 13,
                score2: 0,
                court: assignedCourt,
                status: 'finished',
                round: 'Knockout Round 1',
                bracket: bracket
            });
        }
    }
    return pairings;
};

export const generateNextKnockoutRound = (
    competition: Competition,
    matches: Match[],
    availableCourts: number[]
): Match[] => {
    // Determine the current round number based on existing matches
    const koMatches = matches.filter(m => m.competitionId === competition.id && m.round.startsWith('Knockout Round'));
    if (koMatches.length === 0) return [];

    const rounds = new Set(koMatches.map(m => parseInt(m.round.replace('Knockout Round ', ''))));
    const currentRoundNum = Math.max(...Array.from(rounds));
    const nextRoundNum = currentRoundNum + 1;

    // Get matches from the current round
    const currentRoundMatches = koMatches.filter(m => m.round === `Knockout Round ${currentRoundNum}`);
    
    // Check if all current round matches are finished
    if (!currentRoundMatches.every(m => m.status === 'finished')) {
        return []; // Cannot generate next round until current is finished
    }

    const newMatches: Match[] = [];
    const usedCourts = new Set<number>();
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    const getCourt = () => {
        let assignedCourt = shuffledCourts.find(c => !usedCourts.has(c)) || shuffledCourts[0] || 0;
        usedCourts.add(assignedCourt);
        return assignedCourt;
    };

    // Process each bracket
    const brackets = ['DIRECTA', 'CONSOLACION', 'REPESCA'] as const;

    for (const bracket of brackets) {
        const bracketMatches = currentRoundMatches.filter(m => m.bracket === bracket);
        
        const advancingTeams: Team[] = [];
        const losingTeams: Team[] = [];

        bracketMatches.forEach(m => {
            if (m.score1 !== null && m.score2 !== null) {
                if (m.score1 > m.score2) {
                    advancingTeams.push(m.team1);
                    losingTeams.push(m.team2);
                } else {
                    advancingTeams.push(m.team2);
                    losingTeams.push(m.team1);
                }
            }
        });

        // Generate matches for advancing teams in the same bracket
        for (let i = 0; i < advancingTeams.length; i += 2) {
            const team1 = advancingTeams[i];
            const team2 = advancingTeams[i+1];
            
            if (team2) {
                newMatches.push({
                    id: `match-ko-r${nextRoundNum}-${bracket}-${team1.id}-${team2.id}-${Date.now()}`,
                    competitionId: competition.id,
                    team1,
                    team2,
                    score1: null,
                    score2: null,
                    court: getCourt(),
                    status: 'scheduled',
                    round: `Knockout Round ${nextRoundNum}`,
                    bracket: bracket
                });
            } else {
                newMatches.push({
                    id: `match-ko-r${nextRoundNum}-${bracket}-${team1.id}-BYE-${Date.now()}`,
                    competitionId: competition.id,
                    team1,
                    team2: { id: 'bye', name: 'BYE', players: [], avatar: '', status: 'eliminated' },
                    score1: 13,
                    score2: 0,
                    court: getCourt(),
                    status: 'finished',
                    round: `Knockout Round ${nextRoundNum}`,
                    bracket: bracket
                });
            }
        }

        // Handle losers based on the bracket and round
        if (currentRoundNum === 1 && bracket === 'DIRECTA') {
            // Losers of Round 1 go to Consolación
            for (let i = 0; i < losingTeams.length; i += 2) {
                const team1 = losingTeams[i];
                const team2 = losingTeams[i+1];
                
                if (team2) {
                    newMatches.push({
                        id: `match-ko-r${nextRoundNum}-CONSOLACION-${team1.id}-${team2.id}-${Date.now()}`,
                        competitionId: competition.id,
                        team1,
                        team2,
                        score1: null,
                        score2: null,
                        court: getCourt(),
                        status: 'scheduled',
                        round: `Knockout Round ${nextRoundNum}`,
                        bracket: 'CONSOLACION'
                    });
                } else {
                    newMatches.push({
                        id: `match-ko-r${nextRoundNum}-CONSOLACION-${team1.id}-BYE-${Date.now()}`,
                        competitionId: competition.id,
                        team1,
                        team2: { id: 'bye', name: 'BYE', players: [], avatar: '', status: 'eliminated' },
                        score1: 13,
                        score2: 0,
                        court: getCourt(),
                        status: 'finished',
                        round: `Knockout Round ${nextRoundNum}`,
                        bracket: 'CONSOLACION'
                    });
                }
            }
        } else if (competition.hasRepesca && bracket === 'DIRECTA') {
            // Check if these losers go to Repesca
            let sendToRepesca = false;
            // "1ª ronda de Directa" means Round 2 of the tournament (since Round 1 was the qualifier)
            // "2ª ronda de Directa" means Round 3 of the tournament
            if (competition.repescaOrigin === 'ROUND_1' && currentRoundNum === 2) {
                sendToRepesca = true;
            } else if (competition.repescaOrigin === 'ROUND_2' && currentRoundNum === 3) {
                sendToRepesca = true;
            }

            if (sendToRepesca) {
                for (let i = 0; i < losingTeams.length; i += 2) {
                    const team1 = losingTeams[i];
                    const team2 = losingTeams[i+1];
                    
                    if (team2) {
                        newMatches.push({
                            id: `match-ko-r${nextRoundNum}-REPESCA-${team1.id}-${team2.id}-${Date.now()}`,
                            competitionId: competition.id,
                            team1,
                            team2,
                            score1: null,
                            score2: null,
                            court: getCourt(),
                            status: 'scheduled',
                            round: `Knockout Round ${nextRoundNum}`,
                            bracket: 'REPESCA'
                        });
                    } else {
                        newMatches.push({
                            id: `match-ko-r${nextRoundNum}-REPESCA-${team1.id}-BYE-${Date.now()}`,
                            competitionId: competition.id,
                            team1,
                            team2: { id: 'bye', name: 'BYE', players: [], avatar: '', status: 'eliminated' },
                            score1: 13,
                            score2: 0,
                            court: getCourt(),
                            status: 'finished',
                            round: `Knockout Round ${nextRoundNum}`,
                            bracket: 'REPESCA'
                        });
                    }
                }
            }
        }
    }

    return newMatches;
};
