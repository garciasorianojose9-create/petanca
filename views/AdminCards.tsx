
import React, { useState } from 'react';
import { Competition, PlayerCard, PlayerRegistry, Team, Match } from '../types';
import { motion } from 'motion/react';

interface AdminCardsProps {
    competitions: Competition[];
    players: PlayerRegistry[];
    teams: Team[];
    matches: Match[];
}

export const AdminCards: React.FC<AdminCardsProps> = ({ competitions, players, teams, matches }) => {
    const [filterColor, setFilterColor] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Flatten all cards from all competitions
    const allCards: (PlayerCard & { competitionName: string })[] = competitions.flatMap(comp => 
        (comp.cards || []).map(card => ({ ...card, competitionName: comp.name }))
    ).sort((a, b) => b.timestamp - a.timestamp);

    const filteredCards = allCards.filter(card => {
        const player = players.find(p => p.id === card.playerId || p.name === card.playerId); // Handle both ID and name if needed
        const playerName = player ? player.name : card.playerId;
        const matchesSearch = playerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              card.competitionName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesColor = filterColor === 'ALL' || card.color === filterColor;
        return matchesSearch && matchesColor;
    });

    const getPlayerDetails = (playerId: string) => {
        return players.find(p => p.id === playerId || p.name === playerId);
    };

    const getTeamForPlayer = (playerId: string, competitionId: string) => {
        const player = getPlayerDetails(playerId);
        if (!player) return null;
        return teams.find(t => t.competitionId === competitionId && t.players.includes(player.name));
    };

    const getMatchDetails = (matchId: string) => {
        return matches.find(m => m.id === matchId);
    };

    const cardStyles: Record<string, string> = {
        'YELLOW': 'bg-yellow-400 text-yellow-950 border-yellow-500',
        'ORANGE': 'bg-orange-500 text-white border-orange-600',
        'RED': 'bg-red-600 text-white border-red-700'
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Registro Disciplinario</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Seguimiento de tarjetas amarillas, naranjas y rojas emitidas por los árbitros.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar jugador o competición..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm dark:text-white"
                    />
                </div>
                <div className="flex gap-2">
                    <select 
                        value={filterColor}
                        onChange={(e) => setFilterColor(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm dark:text-white"
                    >
                        <option value="ALL">Todas las Tarjetas</option>
                        <option value="YELLOW">Amarillas</option>
                        <option value="ORANGE">Naranjas</option>
                        <option value="RED">Rojas</option>
                    </select>
                </div>
            </div>

            {/* Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCards.length > 0 ? (
                    filteredCards.map((card, idx) => {
                        const player = getPlayerDetails(card.playerId);
                        const team = getTeamForPlayer(card.playerId, card.competitionId);
                        const match = getMatchDetails(card.matchId);
                        const date = new Date(card.timestamp).toLocaleString();

                        return (
                            <motion.div 
                                key={card.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
                            >
                                <div className={`h-1.5 ${cardStyles[card.color].split(' ')[0]}`}></div>
                                <div className="p-6 space-y-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-10 rounded-sm border-2 shadow-sm flex items-center justify-center ${cardStyles[card.color]}`}>
                                                <span className="material-symbols-outlined text-sm font-bold">priority_high</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">
                                                    {player ? player.name : 'Jugador Desconocido'}
                                                </h3>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">
                                                    {player ? player.license : card.playerId}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${card.scope === 'CHAMPIONSHIP' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                            {card.scope === 'CHAMPIONSHIP' ? 'Toda Competición' : 'Solo Partido'}
                                        </span>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="material-symbols-outlined text-[18px]">groups</span>
                                            <span className="font-medium">{team ? team.name : 'Sin Equipo'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="material-symbols-outlined text-[18px]">sports_handball</span>
                                            <span>
                                                Partida: {match ? `${match.team1.name} vs ${match.team2.name}` : 'Desconocida'}
                                                {match && <span className="text-xs ml-1 text-gray-400">({match.round.replace('Poule', 'Grupo')})</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="material-symbols-outlined text-[18px]">emoji_events</span>
                                            <span>{card.competitionName}</span>
                                        </div>
                                    </div>

                                    {card.reason && (
                                        <div className="mt-4 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-gray-800 italic text-sm text-gray-600 dark:text-gray-400">
                                            "{card.reason}"
                                        </div>
                                    )}
                                </div>
                                <div className="px-6 py-4 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-gray-800 flex justify-between items-center mt-auto">
                                    <span className="text-[10px] text-gray-500 font-mono">{date}</span>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                        <span className="material-symbols-outlined text-[14px]">shield</span>
                                        OFICIAL
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-20">style</span>
                        <p className="text-xl font-medium">No se han emitido tarjetas todavía.</p>
                        <p className="text-sm">Las tarjetas emitidas por los árbitros aparecerán aquí.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
