import { Team, Match, Competition } from '../types';

/**
 * Generates standard seeded bracket order for a power-of-2 bracket size.
 * E.g. 8 -> [1, 8, 4, 5, 2, 7, 3, 6] => R1 matches: 1v8, 4v5, 2v7, 3v6.
 */
export const buildSeededBracketSlots = (bracketSize: number): number[] => {
    let slots = [1, 2];
    while (slots.length < bracketSize) {
        const nextTotal = slots.length * 2 + 1;
        const expanded: number[] = [];
        for (const seed of slots) {
            expanded.push(seed, nextTotal - seed);
        }
        slots = expanded;
    }
    return slots;
};

export const generateSeededKnockoutFirstRound = (
    rankedTeams: Team[],
    competitionId: string,
    availableCourts: number[],
    bracket: 'DIRECTA' | 'CONSOLACION' | 'REPESCA' = 'DIRECTA'
): Match[] => {
    if (rankedTeams.length < 2) return [];

    let bracketSize = 2;
    while (bracketSize < rankedTeams.length) {
        bracketSize *= 2;
    }

    const seedSlots = buildSeededBracketSlots(bracketSize);
    const pairings: Match[] = [];
    const usedCourts = new Set<number>();
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    const pickCourt = () => {
        const c = shuffledCourts.find((court) => !usedCourts.has(court)) || shuffledCourts[0] || 0;
        if (c > 0) usedCourts.add(c);
        return c;
    };

    for (let i = 0; i < seedSlots.length; i += 2) {
        const seed1 = seedSlots[i];
        const seed2 = seedSlots[i + 1];
        const team1 = rankedTeams[seed1 - 1];
        const team2 = rankedTeams[seed2 - 1];

        if (!team1 && !team2) continue;

        if (team1 && team2) {
            pairings.push({
                id: `match-ko-r1-${bracket}-${team1.id}-${team2.id}-${Date.now()}-${i}`,
                competitionId,
                team1,
                team2,
                score1: null,
                score2: null,
                court: pickCourt(),
                status: 'scheduled',
                round: 'Knockout Round 1',
                bracket,
                customLabel: `#${seed1} vs #${seed2}`,
            });
        } else {
            const realTeam = team1 || team2!;
            const realSeed = team1 ? seed1 : seed2;
            pairings.push({
                id: `match-ko-r1-${bracket}-${realTeam.id}-BYE-${Date.now()}-${i}`,
                competitionId,
                team1: realTeam,
                team2: { id: 'bye', name: 'EXENTO (BYE)', players: [], avatar: '', status: 'eliminated' },
                score1: 13,
                score2: 0,
                court: 0,
                status: 'finished',
                round: 'Knockout Round 1',
                bracket,
                customLabel: `#${realSeed} Exento`,
            });
        }
    }

    return pairings;
};

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
        const team2 = shuffledTeams[i + 1];

        const assignedCourt = shuffledCourts.find(c => !usedCourts.has(c)) || shuffledCourts[0] || 0;
        usedCourts.add(assignedCourt);

        if (team2) {
            pairings.push({
                id: `match-ko-r1-${bracket}-${team1.id}-${team2.id}-${Date.now()}-${i}`,
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
                id: `match-ko-r1-${bracket}-${team1.id}-BYE-${Date.now()}-${i}`,
                competitionId,
                team1,
                team2: { id: 'bye', name: 'EXENTO (BYE)', players: [], avatar: '', status: 'eliminated' },
                score1: 13,
                score2: 0,
                court: 0,
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

    const hasPreSplitConsolacion = koMatches.some(
        (m) => m.round === 'Knockout Round 1' && m.bracket === 'CONSOLACION'
    );

    const newMatches: Match[] = [];
    const usedCourts = new Set<number>();
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    const getCourt = () => {
        const assignedCourt = shuffledCourts.find(c => !usedCourts.has(c)) || shuffledCourts[0] || 0;
        usedCourts.add(assignedCourt);
        return assignedCourt;
    };

    // Process each bracket
    const brackets = ['DIRECTA', 'CONSOLACION', 'REPESCA'] as const;

    for (const bracket of brackets) {
        const bracketMatches = currentRoundMatches.filter(m => (m.bracket || 'DIRECTA') === bracket);
        // If this bracket has no matches in the current round or just finished its Final (1 match), do not generate more matches for it
        if (bracketMatches.length <= 1) {
            continue;
        }
        
        const advancingTeams: Team[] = [];
        const losingTeams: Team[] = [];

        bracketMatches.forEach(m => {
            if (m.score1 !== null && m.score2 !== null) {
                if (m.score1 >= m.score2) {
                    advancingTeams.push(m.team1);
                    if (!m.team2.id.startsWith('bye')) losingTeams.push(m.team2);
                } else {
                    advancingTeams.push(m.team2);
                    if (!m.team1.id.startsWith('bye')) losingTeams.push(m.team1);
                }
            }
        });

        // Generate matches for advancing teams in the same bracket
        for (let i = 0; i < advancingTeams.length; i += 2) {
            const team1 = advancingTeams[i];
            const team2 = advancingTeams[i+1];
            
            if (team2) {
                newMatches.push({
                    id: `match-ko-r${nextRoundNum}-${bracket}-${team1.id}-${team2.id}-${Date.now()}-${i}`,
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
                    id: `match-ko-r${nextRoundNum}-${bracket}-${team1.id}-BYE-${Date.now()}-${i}`,
                    competitionId: competition.id,
                    team1,
                    team2: { id: 'bye', name: 'EXENTO (BYE)', players: [], avatar: '', status: 'eliminated' },
                    score1: 13,
                    score2: 0,
                    court: 0,
                    status: 'finished',
                    round: `Knockout Round ${nextRoundNum}`,
                    bracket: bracket
                });
            }
        }

        // Only send Directa R1 losers to Consolacion in pure KNOCKOUT mode when Consolacion wasn't pre-populated from Swiss
        if (currentRoundNum === 1 && bracket === 'DIRECTA' && competition.type === 'KNOCKOUT' && !hasPreSplitConsolacion) {
            for (let i = 0; i < losingTeams.length; i += 2) {
                const team1 = losingTeams[i];
                const team2 = losingTeams[i+1];
                
                if (team2) {
                    newMatches.push({
                        id: `match-ko-r${nextRoundNum}-CONSOLACION-${team1.id}-${team2.id}-${Date.now()}-${i}`,
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
                        id: `match-ko-r${nextRoundNum}-CONSOLACION-${team1.id}-BYE-${Date.now()}-${i}`,
                        competitionId: competition.id,
                        team1,
                        team2: { id: 'bye', name: 'EXENTO (BYE)', players: [], avatar: '', status: 'eliminated' },
                        score1: 13,
                        score2: 0,
                        court: 0,
                        status: 'finished',
                        round: `Knockout Round ${nextRoundNum}`,
                        bracket: 'CONSOLACION'
                    });
                }
            }
        } else if (competition.hasRepesca && bracket === 'DIRECTA') {
            let sendToRepesca = false;
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
                            id: `match-ko-r${nextRoundNum}-REPESCA-${team1.id}-${team2.id}-${Date.now()}-${i}`,
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
                            id: `match-ko-r${nextRoundNum}-REPESCA-${team1.id}-BYE-${Date.now()}-${i}`,
                            competitionId: competition.id,
                            team1,
                            team2: { id: 'bye', name: 'EXENTO (BYE)', players: [], avatar: '', status: 'eliminated' },
                            score1: 13,
                            score2: 0,
                            court: 0,
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
