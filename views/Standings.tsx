import React from 'react';
import { Competition, Team, Match } from '../types';
import { motion } from 'motion/react';

interface StandingsProps {
    competition: Competition | null;
    teams: Team[];
    matches: Match[];
}

export const Standings: React.FC<StandingsProps> = ({ competition, teams, matches }) => {
    if (!competition) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="bg-gray-100 dark:bg-zinc-900 p-6 rounded-full mb-6">
                    <span className="material-symbols-outlined text-5xl text-gray-400">leaderboard</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Ninguna Competición Seleccionada</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Selecciona una competición para ver la clasificación.
                </p>
            </div>
        );
    }

    const isKnockout = competition.type === 'KNOCKOUT';

    const sortedTeams = [...teams].sort((a, b) => {
        if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
        if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
        if ((b.fbh || 0) !== (a.fbh || 0)) return (b.fbh || 0) - (a.fbh || 0);
        return (b.diff || 0) - (a.diff || 0);
    });

    const renderKnockoutStandings = () => {
        const categories = [
            { id: 'DIRECTA', label: 'Eliminación Directa', color: 'text-primary' },
            { id: 'CONSOLACION', label: 'Consolación', color: 'text-orange-500' },
            { id: 'REPESCA', label: 'Repesca', color: 'text-blue-500' }
        ];

        return (
            <div className="space-y-8 pb-32">
                {categories.map(cat => {
                    const catTeams = teams.filter(team => {
                        const teamMatches = matches.filter(m => 
                            (m.team1.id === team.id || m.team2.id === team.id) && 
                            m.bracket === cat.id
                        );
                        return teamMatches.length > 0;
                    }).sort((a, b) => (a.rank || 99) - (b.rank || 99));

                    if (catTeams.length === 0) return null;

                    return (
                        <div key={cat.id} className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex items-center justify-between">
                                <h3 className={`text-xl font-black ${cat.color} flex items-center gap-2`}>
                                    <span className="material-symbols-outlined">emoji_events</span>
                                    {cat.label}
                                </h3>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full">Clasificación Final</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-zinc-900/50 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-8 py-4 w-24 text-center">Posición</th>
                                            <th className="px-6 py-4">Equipo / Participantes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {catTeams.map((team, idx) => {
                                            const rank = team.rank || idx + 1;
                                            return (
                                                <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors group">
                                                    <td className="px-8 py-5 text-center">
                                                        <div className={`size-10 rounded-full flex items-center justify-center font-black text-base mx-auto shadow-sm
                                                            ${rank === 1 ? 'bg-yellow-400 text-yellow-950 ring-4 ring-yellow-400/20' : 
                                                              rank === 2 ? 'bg-gray-300 text-gray-800' : 
                                                              rank === 3 ? 'bg-orange-400 text-orange-950' : 
                                                              'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}
                                                        >
                                                            {rank}º
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary transition-colors">{team.name}</div>
                                                        <div className="text-sm text-gray-500 mt-1">{team.players.join(' & ')}</div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Clasificación</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isKnockout ? 'Resultados finales por categorías.' : `${competition.name} • ${competition.currentPhase || 'Fase General'}`}
                    </p>
                </div>
            </div>

            {isKnockout ? renderKnockoutStandings() : (
                <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider border-b border-gray-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 w-12 text-center">#</th>
                                    <th className="px-4 py-3">Equipo</th>
                                    <th className="px-4 py-3 text-center" title="Partidas Jugadas">PJ</th>
                                    <th className="px-4 py-3 text-center" title="Partidas Ganadas">PG</th>
                                    <th className="px-4 py-3 text-center" title="Partidas Perdidas">PP</th>
                                    <th className="px-4 py-3 text-center bg-gray-100 dark:bg-zinc-900 font-black border-x border-gray-200 dark:border-zinc-800" title="Puntos Totales (Criterio 1)">Pts</th>
                                    <th className="px-4 py-3 text-center" title="Puntos Adversarios (Criterio 2)">Pts Adv</th>
                                    <th className="px-4 py-3 text-center" title="Pts Adv. del Adv. (Criterio 3)">Pts Adv Adv</th>
                                    <th className="px-4 py-3 text-center" title="+- Bolas (Criterio 4)">+- Bolas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {sortedTeams.map((team, idx) => {
                                    const teamMatches = matches.filter(m => 
                                        (m.team1.id === team.id || m.team2.id === team.id) && 
                                        m.status === 'finished'
                                    );
                                    
                                    const played = teamMatches.length;
                                    const won = teamMatches.filter(m => {
                                        if (m.team1.id === team.id) return (m.score1 || 0) > (m.score2 || 0);
                                        return (m.score2 || 0) > (m.score1 || 0);
                                    }).length;
                                    const lost = played - won;

                                    return (
                                        <React.Fragment key={team.id}>
                                            <motion.tr 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className={`
                                                    transition-colors
                                                    ${idx < 16 ? 'border-l-4 border-l-transparent hover:border-l-primary/30 dark:hover:bg-zinc-900 hover:bg-gray-50' : 'bg-gray-50 dark:bg-zinc-950 opacity-60 hover:opacity-100'}
                                                `}
                                            >
                                                <td className="px-4 py-3 font-bold text-center text-gray-900 dark:text-white">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    <div className="flex flex-col">
                                                        <span>{team.name}</span>
                                                        <span className="text-[10px] text-gray-500">{team.players.join(', ')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 font-medium">{played}</td>
                                                <td className="px-4 py-3 text-center text-green-600 dark:text-green-500 font-bold">{won}</td>
                                                <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-medium">{lost}</td>
                                                <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-900 border-x border-gray-100 dark:border-zinc-800">{team.pts || 0}</td>
                                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{team.bh || 0}</td>
                                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{team.fbh || 0}</td>
                                                <td className={`px-4 py-3 text-center font-medium ${team.diff && team.diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{team.diff && team.diff > 0 ? '+' : ''}{team.diff || 0}</td>
                                            </motion.tr>
                                            {idx === (competition.qualifiersCount || 16) - 1 && (
                                                <tr key="cutoff" className="bg-primary text-white text-xs font-bold uppercase tracking-wider">
                                                    <td className="px-4 py-1 text-center" colSpan={9}>Corte de Clasificación (Top {competition.qualifiersCount || 16})</td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
