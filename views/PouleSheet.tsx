import React from 'react';
import { Group, Match, Team } from '../types';

interface PouleSheetProps {
    group: Group;
    matches: Match[];
    onUpdateMatch?: (match: Match) => void;
}

export const PouleSheet: React.FC<PouleSheetProps> = ({ group, matches, onUpdateMatch }) => {
    // Collect all matches strictly tied to this group's teams
    const groupMatches = matches.filter(m => m.competitionId === group.competitionId && m.id.includes(`match-${group.id}`));

    const getTeamName = (team?: Team) => team ? team.name : 'TBD';
    const getScore = (score: number | null) => score !== null ? score : '-';

    // Rondas (Poule Round 1, Poule Round 2, Poule Round 3)
    const round1Matches = groupMatches.filter(m => m.round === 'Poule Round 1');
    const winnersMatch = groupMatches.find(m => m.round === 'Poule Round 2' && m.id.includes('winners'));
    const losersMatch = groupMatches.find(m => m.round === 'Poule Round 2' && m.id.includes('losers'));
    const repechageMatch = groupMatches.find(m => m.round === 'Poule Round 3');

    // Qualification statuses for flow visualization
    let qualifier1: Team | null = null;
    let qualifier2: Team | null = null;
    let eliminated1: Team | null = null;
    let eliminated2: Team | null = null;

    if (winnersMatch && winnersMatch.status === 'finished') {
        qualifier1 = (winnersMatch.score1 || 0) > (winnersMatch.score2 || 0) ? winnersMatch.team1 : winnersMatch.team2;
    }
    if (repechageMatch && repechageMatch.status === 'finished') {
        qualifier2 = (repechageMatch.score1 || 0) > (repechageMatch.score2 || 0) ? repechageMatch.team1 : repechageMatch.team2;
        eliminated1 = (repechageMatch.score1 || 0) > (repechageMatch.score2 || 0) ? repechageMatch.team2 : repechageMatch.team1;
    }
    if (losersMatch && losersMatch.status === 'finished' && group.teams.length === 4) {
        eliminated2 = (losersMatch.score1 || 0) > (losersMatch.score2 || 0) ? losersMatch.team2 : losersMatch.team1;
    }

    const MatchCard = ({ match, title, bgClassName = 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800' }: { match?: Match, title: string, bgClassName?: string }) => (
        <div className={`p-3 rounded-lg border shadow-sm flex flex-col gap-2 ${bgClassName}`}>
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{title}</span>
                {match && (
                    <div className="flex items-center gap-1 group/court">
                        <span>{match.status === 'finished' ? 'Finalizado' : match.status === 'live' ? 'En Vivo' : 'Pista ' + match.court}</span>
                        {onUpdateMatch && (
                            <button 
                                onClick={() => {
                                    const newP = prompt("Cambiar Pista:", match.court?.toString());
                                    if (newP) {
                                        onUpdateMatch({ ...match, court: parseInt(newP) || 0 });
                                    }
                                }}
                                className="material-symbols-outlined text-[12px] opacity-0 group-hover/court:opacity-100 transition-opacity cursor-pointer hover:text-primary"
                            >
                                edit
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {match ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className={`text-sm truncate w-32 ${match.status === 'finished' && (match.score1||0) > (match.score2||0) ? 'font-bold text-green-600 dark:text-green-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                            {getTeamName(match.team1)}
                        </span>
                        <div className="font-bold text-sm bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            {getScore(match.score1)} - {getScore(match.score2)}
                        </div>
                        <span className={`text-sm truncate w-32 text-right ${match.status === 'finished' && (match.score2||0) > (match.score1||0) ? 'font-bold text-green-600 dark:text-green-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                            {getTeamName(match.team2)}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-300 dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-950">
                    A la espera
                </div>
            )}
        </div>
    );

    return (
        <div className="bg-white dark:bg-[#1b0f0d] p-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-[#3a201d] mb-6 flex flex-col">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex justify-between items-center">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">account_tree</span>
                    {group.name.replace('Group', 'Grupo')}
                </h3>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                    Doble Eliminación (GSL)
                </span>
            </div>
            
            <div className="p-5 overflow-x-auto">
                <div className="min-w-[600px] flex gap-4">
                    
                    {/* Column 1: Initial Round */}
                    <div className="flex-1 flex flex-col gap-4 relative">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Ronda Inicial</h4>
                        {round1Matches.length > 0 ? (
                            round1Matches.map((m, i) => <MatchCard key={m.id} match={m} title={`Partido ${i + 1}`} />)
                        ) : (
                            group.teams.length === 4 ? (
                                <>
                                    <MatchCard title="Partido 1 (E1 vs E4)" />
                                    <MatchCard title="Partido 2 (E2 vs E3)" />
                                </>
                            ) : (
                                <MatchCard title="Partido 1 (E2 vs E3)" />
                            )
                        )}
                    </div>

                    {/* Arrow Connections (Optional/Implicit layout via columns) */}

                    {/* Column 2: Winners & Losers */}
                    <div className="flex-1 flex flex-col gap-4 relative">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Ganadores / Perdedores</h4>
                        
                        <MatchCard match={winnersMatch} title="Ganadores (P1 vs P2)" bgClassName="bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30" />
                        
                        {group.teams.length === 4 && (
                            <MatchCard match={losersMatch} title="Perdedores (P1 vs P2)" bgClassName="bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30" />
                        )}
                    </div>

                    {/* Column 3: Repesca */}
                    <div className="flex-1 flex flex-col relative">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Repesca (Decider)</h4>
                        <div className="flex-1 flex items-center">
                            <div className="w-full">
                                <MatchCard match={repechageMatch} title="Repesca (L-Win vs W-Los)" bgClassName="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30" />
                            </div>
                        </div>
                    </div>
                    
                    {/* Column 4: Outcomes */}
                    <div className="w-[180px] flex flex-col gap-2 justify-center pl-4 border-l border-gray-200 dark:border-zinc-800">
                        <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 p-2 rounded border border-green-200 dark:border-green-800 text-sm font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">looks_one</span>
                            <span className="truncate">{qualifier1 ? qualifier1.name : '1º Clasificado'}</span>
                        </div>
                        <div className="bg-primary/20 text-primary-dark dark:text-primary p-2 rounded border border-primary/30 text-sm font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">looks_two</span>
                            <span className="truncate">{qualifier2 ? qualifier2.name : '2º Clasificado'}</span>
                        </div>
                        {eliminated1 && (
                            <div className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 p-2 rounded text-xs font-bold flex items-center gap-2 mt-4">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                <span className="truncate">3º {eliminated1.name}</span>
                            </div>
                        )}
                        {eliminated2 && (
                            <div className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 p-2 rounded text-xs font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                <span className="truncate">4º {eliminated2.name}</span>
                            </div>
                        )}
                    </div>

                </div>
            </div>
            
            {/* Seed list reference */}
            <div className="px-5 py-2 bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex gap-4 text-[10px] font-bold text-gray-500 items-center overflow-x-auto">
                <span className="uppercase">Seeds Iniciales:</span>
                {group.teams.sort((a,b)=>(a.rank||0)-(b.rank||0)).map((t, i) => (
                    <span key={t.id} className="flex gap-1 items-center">
                        <span className="bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-1 rounded">{i+1}</span>
                        {t.name}
                    </span>
                ))}
            </div>
        </div>
    );
};
