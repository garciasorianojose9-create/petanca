import { Team, Group, Match } from '../types';

export const generatePoules = (teams: Team[], competitionId: string, qualifiersCount: number = 16): Group[] => {
    // 1. Sort teams by Points > Buchholz > Diff (Shuffle first to resolve ties randomly)
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const sortedTeams = shuffledTeams.sort((a, b) => {
        if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
        if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
        return (b.diff || 0) - (a.diff || 0);
    });

    // 2. Take top qualifiers
    const actualQualifiersCount = Math.min(qualifiersCount, sortedTeams.length);
    const qualifiedTeams = sortedTeams.slice(0, actualQualifiersCount);

    // 3. Calculate number of groups
    // Rule: minimum 3 and max 4 teams per group.
    // Optimal groups = Math.ceil(Total / 4)
    let numGroups = Math.ceil(actualQualifiersCount / 4);
    if (numGroups === 0) numGroups = 1;

    // Check if we conform to 3-4 teams rule. If not perfectly, it might require manual handling,
    // but the math: e.g., 14/4 = 3.5 -> 4 groups. 14 / 4 groups = 3 teams each with 2 remaining (so two with 4, two with 3).
    const groups: Group[] = Array.from({ length: numGroups }, (_, i) => ({
        id: `g-${competitionId}-${String.fromCharCode(65 + i)}`,
        competitionId,
        name: `Group ${String.fromCharCode(65 + i)}`,
        teams: []
    }));

    // 4. Distribute using Snake System for balance
    qualifiedTeams.forEach((team, index) => {
        const cycleLength = numGroups * 2;
        const position = index % cycleLength; 
        let groupIndex = 0;

        if (position < numGroups) {
            // Forward pass
            groupIndex = position;
        } else {
            // Backward pass
            groupIndex = (cycleLength - 1) - position;
        }

        groups[groupIndex].teams.push({
            ...team,
            status: 'playing',
            rank: index + 1, // Update rank based on seeding
            pts: 0,
            diff: 0,
            bh: 0,
            fbh: 0
        });
    });

    return groups;
};

export const generateInitialPouleMatches = (group: Group): Match[] => {
    // Deprecated for new dynamic generation, but kept so we don't break imports
    return [];
};

export const generatePouleRoundMatches = (groups: Group[], currentMatches: Match[], round: number, availableCourts: number[], statusFlag: 'scheduled' | 'live' = 'live'): Match[] => {
    const newMatches: Match[] = [];
    const usedCourtsInThisRound = new Set<number>();
    
    const getCourt = (teamA: Team, teamB: Team) => {
        if (teamA.id.startsWith('bye-') || teamB.id.startsWith('bye-')) return 0;
        
        const pastCourts = new Set<number>();
        currentMatches.forEach(m => {
            if (m.team1.id === teamA.id || m.team2.id === teamA.id || m.team1.id === teamB.id || m.team2.id === teamB.id) {
                if (m.court > 0) pastCourts.add(m.court);
            }
        });
        
        const idealCourts = availableCourts.filter(c => !usedCourtsInThisRound.has(c) && !pastCourts.has(c) && !pastCourts.has(c-1) && !pastCourts.has(c+1));
        
        let selectedCourt = 1;
        if (idealCourts.length > 0) {
            selectedCourt = idealCourts[Math.floor(Math.random() * idealCourts.length)];
        } else {
            const fallback = availableCourts.filter(c => !usedCourtsInThisRound.has(c));
            if (fallback.length > 0) {
                selectedCourt = fallback[Math.floor(Math.random() * fallback.length)];
            } else if (availableCourts.length > 0) {
                selectedCourt = availableCourts[0];
            }
        }
        
        usedCourtsInThisRound.add(selectedCourt);
        return selectedCourt;
    };

    const createMatch = (group: Group, team1: Team, team2: Team, roundLabel: string, typeDesc: string) => {
        const isBye = team1.id.startsWith('bye-') || team2.id.startsWith('bye-');
        let score1 = null;
        let score2 = null;
        
        if (isBye) {
            if (team1.id.startsWith('bye-') && team2.id.startsWith('bye-')) {
                score1 = 13; score2 = 0;
            } else if (team1.id.startsWith('bye-')) {
                score1 = 0; score2 = 13;
            } else {
                score1 = 13; score2 = 0;
            }
        }
        
        const matchStatus = isBye ? 'finished' : statusFlag;
        
        return {
            id: `match-${group.id}-${roundLabel.replace(/ /g, '')}-${typeDesc}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            competitionId: group.competitionId,
            team1,
            team2,
            score1,
            score2,
            court: getCourt(team1, team2),
            status: matchStatus as 'live' | 'scheduled' | 'finished',
            round: roundLabel
        };
    };

    groups.forEach(group => {
        const teams = [...group.teams].sort((a, b) => (a.rank || 0) - (b.rank || 0));
        
        while (teams.length < 4) {
            teams.push({
                id: `bye-${group.id}-${teams.length}`,
                name: 'LIBRA',
                players: [],
                status: 'eliminated',
                competitionId: group.competitionId,
                rank: 999,
                avatar: ''
            });
        }

        const groupMatches = currentMatches.filter(m => m.competitionId === group.competitionId && m.id.includes(group.id));

        const havePlayed = (tA: Team, tB: Team) => {
            if (tA.id.startsWith('bye-') || tB.id.startsWith('bye-')) return false;
            return currentMatches.some(m => 
                (m.team1.id === tA.id && m.team2.id === tB.id) ||
                (m.team1.id === tB.id && m.team2.id === tA.id)
            );
        };

        if (round === 1) {
            const hasBye = teams[3].id.startsWith('bye-');
            
            const config1 = [ [teams[0], teams[3]], [teams[1], teams[2]] ]; // default
            const config2 = [ [teams[0], teams[2]], [teams[1], teams[3]] ]; // swap 3,4
            const config3 = [ [teams[0], teams[1]], [teams[2], teams[3]] ]; // extreme
            
            const scoreConfig = (c: Team[][]) => {
                let col = 0;
                if (havePlayed(c[0][0], c[0][1])) col += 10;
                if (havePlayed(c[1][0], c[1][1])) col += 10;
                
                // Penalty for not giving BYE to the #1 seed (teams[0])
                if (hasBye) {
                    if (c[0][1].id !== teams[3].id && c[0][0].id !== teams[3].id) {
                        col += 100; // Strong penalty, do not steal bye from #1
                    }
                }
                return col;
            };

            let bestConfig = config1;
            let minScore = scoreConfig(config1);

            if (minScore >= 10) {
                const s2 = scoreConfig(config2);
                if (s2 < minScore) {
                    bestConfig = config2;
                    minScore = s2;
                }
                if (minScore >= 10) {
                    const s3 = scoreConfig(config3);
                    if (s3 < minScore) {
                        bestConfig = config3;
                        minScore = s3;
                    }
                }
            }

            newMatches.push(
                createMatch(group, bestConfig[0][0], bestConfig[0][1], 'Poule Round 1', 'r1-1'),
                createMatch(group, bestConfig[1][0], bestConfig[1][1], 'Poule Round 1', 'r1-2')
            );
        } else if (round === 2) {
            const r1Matches = groupMatches.filter(m => m.round === 'Poule Round 1' && m.status === 'finished');
            const m1 = r1Matches.find(m => m.id.includes('-r1-1-'));
            const m2 = r1Matches.find(m => m.id.includes('-r1-2-'));
            
            if (m1 && m2) {
                const w1 = (m1.score1 !== null && m1.score2 !== null && m1.score1 >= m1.score2) ? m1.team1 : m1.team2;
                const w2 = (m2.score1 !== null && m2.score2 !== null && m2.score1 >= m2.score2) ? m2.team1 : m2.team2;
                const l1 = (m1.score1 !== null && m1.score2 !== null && m1.score1 >= m1.score2) ? m1.team2 : m1.team1;
                const l2 = (m2.score1 !== null && m2.score2 !== null && m2.score1 >= m2.score2) ? m2.team2 : m2.team1;

                newMatches.push(
                    createMatch(group, w1, w2, 'Poule Round 2', 'winners'),
                    createMatch(group, l1, l2, 'Poule Round 2', 'losers')
                );
            }
        } else if (round === 3) {
            const winnersMatch = groupMatches.find(m => m.round === 'Poule Round 2' && m.id.includes('winners') && m.status === 'finished');
            const losersMatch = groupMatches.find(m => m.round === 'Poule Round 2' && m.id.includes('losers') && m.status === 'finished');
            
            if (winnersMatch && losersMatch) {
                const loserWinners = (winnersMatch.score1 !== null && winnersMatch.score2 !== null && winnersMatch.score1 >= winnersMatch.score2) ? winnersMatch.team2 : winnersMatch.team1;
                const winnerLosers = (losersMatch.score1 !== null && losersMatch.score2 !== null && losersMatch.score1 >= losersMatch.score2) ? losersMatch.team1 : losersMatch.team2;

                newMatches.push(
                    createMatch(group, loserWinners, winnerLosers, 'Poule Round 3', 'repechage')
                );
            }
        } else if (round > 3) {
            // Un par aleatorio de equipos que no se han enfrentado si es posible
            const unplayed: [Team, Team][] = [];
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    if (!havePlayed(teams[i], teams[j])) {
                        unplayed.push([teams[i], teams[j]]);
                    }
                }
            }
            if (unplayed.length > 0) {
                // Just take the first available pairing
                newMatches.push(
                    createMatch(group, unplayed[0][0], unplayed[0][1], `Poule Round ${round}`, `poule-${round}-0`)
                );
                if (unplayed.length > 1) {
                    // Try to find a disjoint pair
                    const firstPair = unplayed[0];
                    const secondPair = unplayed.find(p => p[0].id !== firstPair[0].id && p[0].id !== firstPair[1].id && p[1].id !== firstPair[0].id && p[1].id !== firstPair[1].id);
                    if (secondPair) {
                        newMatches.push(createMatch(group, secondPair[0], secondPair[1], `Poule Round ${round}`, `poule-${round}-1`));
                    }
                }
            } else {
                // Random pairings if all have played
                newMatches.push(
                    createMatch(group, teams[0], teams[1], `Poule Round ${round}`, `poule-${round}-0`),
                    createMatch(group, teams[2], teams[3], `Poule Round ${round}`, `poule-${round}-1`)
                );
            }
        }
    });

    return newMatches;
};

export const generateNextPouleMatches = (group: Group, groupMatches: Match[]): Match[] => {
    // Deprecated: No more automatic match generation. Groups are manual round robin.
    return [];
};

export const generateSwissPairings = (
    teams: Team[],
    previousMatches: Match[],
    roundNumber: number,
    availableCourts: number[]
): Match[] => {
    // 1. Sort teams by Points > Buchholz > Diff
    let sortedTeams = [...teams];
    if (roundNumber === 1) {
        // Sorteo real para la primera ronda
        sortedTeams = sortedTeams.sort(() => Math.random() - 0.5);
    } else {
        sortedTeams = sortedTeams.sort((a, b) => {
            if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
            if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
            return (b.diff || 0) - (a.diff || 0);
        });
    }

    const pairings: Match[] = [];
    const pairedTeamIds = new Set<string>();
    const usedCourts = new Set<number>();

    // Helper to check if played before
    const hasPlayed = (team1Id: string, team2Id: string) => {
        return previousMatches.some(m => 
            (m.team1.id === team1Id && m.team2.id === team2Id) ||
            (m.team1.id === team2Id && m.team2.id === team1Id)
        );
    };

    // Helper to check if played on court
    const countPlayedOnCourt = (teamId: string, court: number) => {
        return previousMatches.filter(m => 
            (m.team1.id === teamId || m.team2.id === teamId) && m.court === court
        ).length;
    };

    // Shuffle available courts to avoid deterministic bias
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    for (let i = 0; i < sortedTeams.length; i++) {
        const team1 = sortedTeams[i];
        if (pairedTeamIds.has(team1.id)) continue;

        let bestOpponent: Team | null = null;

        // Find best opponent
        for (let j = i + 1; j < sortedTeams.length; j++) {
            const team2 = sortedTeams[j];
            if (pairedTeamIds.has(team2.id)) continue;

            if (!hasPlayed(team1.id, team2.id)) {
                bestOpponent = team2;
                break;
            }
        }

        // Fallback: if everyone played everyone (rare in large Swiss), just take next available
        if (!bestOpponent) {
             for (let j = i + 1; j < sortedTeams.length; j++) {
                const team2 = sortedTeams[j];
                if (!pairedTeamIds.has(team2.id)) {
                    bestOpponent = team2;
                    break;
                }
            }
        }

        if (bestOpponent) {
            pairedTeamIds.add(team1.id);
            pairedTeamIds.add(bestOpponent.id);

            // Assign Court
            // Find court with minimum previous usage by these teams
            let assignedCourt = -1;
            let minUsage = Infinity;
            
            // Filter out already used courts for this round
            const availableForThisMatch = shuffledCourts.filter(c => !usedCourts.has(c));
            
            // If no courts left (shouldn't happen if courts >= matches), reuse used ones
            const candidateCourts = availableForThisMatch.length > 0 ? availableForThisMatch : shuffledCourts;

            // Find best court among candidates
            for (const court of candidateCourts) {
                const usage = countPlayedOnCourt(team1.id, court) + countPlayedOnCourt(bestOpponent.id, court);
                if (usage < minUsage) {
                    minUsage = usage;
                    assignedCourt = court;
                }
            }
            
            // If we somehow didn't pick one (e.g. empty candidates), pick random
            if (assignedCourt === -1) {
                assignedCourt = candidateCourts[0] || 0;
            }

            usedCourts.add(assignedCourt);

            pairings.push({
                id: `match-${roundNumber}-${team1.id}-${bestOpponent.id}-${Date.now()}`,
                competitionId: team1.competitionId || '',
                team1: team1,
                team2: bestOpponent,
                score1: null,
                score2: null,
                court: assignedCourt,
                status: 'scheduled',
                round: `Swiss Round ${roundNumber}`
            });
        }
    }

    return pairings;
};

export const generateBaseTorneoPairings = (teams: Team[], availableCourts: number[]): Match[] => {
    const pairings: Match[] = [];
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledTeams.length; i += 2) {
        if (i + 1 < shuffledTeams.length) {
            const team1 = shuffledTeams[i];
            const team2 = shuffledTeams[i + 1];
            const court = shuffledCourts[(i / 2) % shuffledCourts.length] || 0;
            
            pairings.push({
                id: `match-base-r1-${team1.id}-${team2.id}-${Date.now()}`,
                competitionId: team1.competitionId || '',
                team1: team1,
                team2: team2,
                score1: null,
                score2: null,
                court: court,
                status: 'scheduled',
                round: 'Ronda 1'
            });
        }
    }
    return pairings;
};

export const generateNextBaseTorneoRound = (matches: Match[], competitionId: string, availableCourts: number[], hasRepesca: boolean): Match[] => {
    const compMatches = matches.filter(m => m.competitionId === competitionId);
    const ronda1Matches = compMatches.filter(m => m.round === 'Ronda 1');
    const directaMatches = compMatches.filter(m => m.round.startsWith('Directa'));
    
    // If Ronda 1 is not finished, we can't generate the next round
    if (ronda1Matches.length > 0 && ronda1Matches.some(m => m.status !== 'finished')) {
        throw new Error("La Ronda 1 no ha finalizado.");
    }

    const newPairings: Match[] = [];
    const shuffledCourts = [...availableCourts].sort(() => Math.random() - 0.5);

    // If Directa hasn't started, generate Directa and Consolacion from Ronda 1
    if (directaMatches.length === 0 && ronda1Matches.length > 0) {
        const winners: Team[] = [];
        const losers: Team[] = [];

        ronda1Matches.forEach(m => {
            if ((m.score1 || 0) > (m.score2 || 0)) {
                winners.push(m.team1);
                losers.push(m.team2);
            } else {
                winners.push(m.team2);
                losers.push(m.team1);
            }
        });

        const getRoundName = (numTeams: number) => {
            if (numTeams === 2) return 'F';
            if (numTeams === 4) return 'SF';
            if (numTeams === 8) return 'QF';
            return `R${numTeams}`;
        };

        const directaRoundName = `Directa - ${getRoundName(winners.length)}`;
        const consolacionRoundName = `Consolacion - ${getRoundName(losers.length)}`;

        // Pair winners for Directa
        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                const court = shuffledCourts[(i / 2) % shuffledCourts.length] || 0;
                newPairings.push({
                    id: `match-directa-${winners[i].id}-${winners[i+1].id}-${Date.now()}`,
                    competitionId,
                    team1: winners[i],
                    team2: winners[i+1],
                    score1: null,
                    score2: null,
                    court,
                    status: 'scheduled',
                    round: directaRoundName
                });
            }
        }

        // Pair losers for Consolacion
        for (let i = 0; i < losers.length; i += 2) {
            if (i + 1 < losers.length) {
                const court = shuffledCourts[((i / 2) + winners.length / 2) % shuffledCourts.length] || 0;
                newPairings.push({
                    id: `match-consolacion-${losers[i].id}-${losers[i+1].id}-${Date.now()}`,
                    competitionId,
                    team1: losers[i],
                    team2: losers[i+1],
                    score1: null,
                    score2: null,
                    court,
                    status: 'scheduled',
                    round: consolacionRoundName
                });
            }
        }
        
        return newPairings;
    }

    // If Directa has started, we need to advance winners of the latest round
    // This is a simplified version. A full bracket system would need to track match dependencies.
    // For now, let's just find the latest round of Directa and Consolacion that are finished,
    // and pair their winners.
    
    const advanceBracket = (bracketPrefix: string) => {
        const bracketMatches = compMatches.filter(m => m.round.startsWith(bracketPrefix));
        if (bracketMatches.length === 0) return;

        // Find the latest round
        const rounds = Array.from(new Set(bracketMatches.map(m => m.round)));
        // Assuming rounds are ordered or we can just take the one with the fewest matches
        const latestRound = rounds.reduce((prev, current) => {
            const prevMatches = bracketMatches.filter(m => m.round === prev);
            const currentMatches = bracketMatches.filter(m => m.round === current);
            return currentMatches.length < prevMatches.length ? current : prev;
        });

        const latestMatches = bracketMatches.filter(m => m.round === latestRound);
        
        if (latestMatches.some(m => m.status !== 'finished')) {
            return; // Not finished yet
        }

        if (latestMatches.length === 1) {
            return; // Final already played
        }

        const winners: Team[] = [];
        const losers: Team[] = []; // For repesca

        latestMatches.forEach(m => {
            if ((m.score1 || 0) > (m.score2 || 0)) {
                winners.push(m.team1);
                losers.push(m.team2);
            } else {
                winners.push(m.team2);
                losers.push(m.team1);
            }
        });

        const getRoundName = (numTeams: number) => {
            if (numTeams === 2) return 'F';
            if (numTeams === 4) return 'SF';
            if (numTeams === 8) return 'QF';
            return `R${numTeams}`;
        };

        const nextRoundName = `${bracketPrefix} - ${getRoundName(winners.length)}`;

        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                const court = shuffledCourts[(i / 2) % shuffledCourts.length] || 0;
                newPairings.push({
                    id: `match-${bracketPrefix.toLowerCase()}-${winners[i].id}-${winners[i+1].id}-${Date.now()}`,
                    competitionId,
                    team1: winners[i],
                    team2: winners[i+1],
                    score1: null,
                    score2: null,
                    court,
                    status: 'scheduled',
                    round: nextRoundName
                });
            }
        }

        // Handle Repesca if enabled and we are advancing Directa
        if (hasRepesca && bracketPrefix === 'Directa' && losers.length > 0) {
            // Add losers to Repesca
            const repescaRoundName = `Repesca - ${getRoundName(losers.length)}`;
            for (let i = 0; i < losers.length; i += 2) {
                if (i + 1 < losers.length) {
                    const court = shuffledCourts[(i / 2) % shuffledCourts.length] || 0;
                    newPairings.push({
                        id: `match-repesca-${losers[i].id}-${losers[i+1].id}-${Date.now()}`,
                        competitionId,
                        team1: losers[i],
                        team2: losers[i+1],
                        score1: null,
                        score2: null,
                        court,
                        status: 'scheduled',
                        round: repescaRoundName
                    });
                }
            }
        }
    };

    advanceBracket('Directa');
    advanceBracket('Consolacion');
    if (hasRepesca) {
        advanceBracket('Repesca');
    }

    if (newPairings.length === 0) {
        throw new Error("No se pudieron generar más rondas. Asegúrate de que las rondas actuales hayan finalizado.");
    }

    return newPairings;
};
