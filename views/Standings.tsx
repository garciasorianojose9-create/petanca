import React from 'react';
import { Competition, Team, Match } from '../types';
import { motion } from 'motion/react';
import { sortSwissStandings } from '../utils/tournamentUtils';

interface StandingsProps {
    competition: Competition | null;
    teams: Team[];
    matches: Match[];
}

const getBracketScore = (teamId: string, bracketMatches: Match[]): number => {
    const teamM = bracketMatches.filter(m => m.team1.id === teamId || m.team2.id === teamId);
    if (teamM.length === 0) return 0;

    const getRoundNum = (roundStr: string) => {
        if (roundStr.startsWith('Knockout Round ')) {
            return parseInt(roundStr.replace('Knockout Round ', '')) || 0;
        }
        const map: Record<string, number> = { QF: 1, SF: 2, F: 3 };
        return map[roundStr] || 0;
    };

    const maxRound = Math.max(...teamM.map(m => getRoundNum(m.round)));
    const lastMatch = teamM.find(m => getRoundNum(m.round) === maxRound);
    const hasScore =
        lastMatch &&
        lastMatch.score1 !== null &&
        lastMatch.score1 !== undefined &&
        lastMatch.score2 !== null &&
        lastMatch.score2 !== undefined;

    const wonLast = hasScore
        ? (lastMatch!.team1.id === teamId && lastMatch!.score1! > lastMatch!.score2!) ||
          (lastMatch!.team2.id === teamId && lastMatch!.score2! > lastMatch!.score1!)
        : false;

    return maxRound * 100 + (wonLast ? 50 : 0);
};

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
    const knockoutMatches = matches.filter(
        m => m.round.startsWith('Knockout') || m.round === 'QF' || m.round === 'SF' || m.round === 'F'
    );
    const hasKnockoutMatches = knockoutMatches.length > 0;
    const swissMatches = matches.filter(m => m.round.startsWith('Swiss'));

    const sortedTeams = sortSwissStandings(teams);
    const generalCut = competition.mainBracketCount ?? competition.qualifiersCount ?? 16;
    const consolationCut = competition.consolationBracketCount ?? 0;

    const renderKnockoutStandings = () => {
        const categories = [
            { id: 'DIRECTA', label: isKnockout ? 'Eliminación Directa' : 'Cuadro General (Principal)', color: 'text-primary' },
            { id: 'CONSOLACION', label: 'Cuadro Consolación', color: 'text-orange-500' },
            { id: 'REPESCA', label: 'Repesca', color: 'text-blue-500' }
        ];

        return (
            <div className={`space-y-6 ${isKnockout ? 'pb-32' : ''}`}>
                {categories.map(cat => {
                    const catMatches = knockoutMatches.filter(m => (m.bracket || 'DIRECTA') === cat.id);
                    if (catMatches.length === 0) return null;

                    const catTeams = teams
                        .filter(team => catMatches.some(m => m.team1.id === team.id || m.team2.id === team.id))
                        .sort((a, b) => {
                            const scoreDiff = getBracketScore(b.id, catMatches) - getBracketScore(a.id, catMatches);
                            if (scoreDiff !== 0) return scoreDiff;
                            if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
                            if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
                            if ((b.fbh || 0) !== (a.fbh || 0)) return (b.fbh || 0) - (a.fbh || 0);
                            if ((b.diff || 0) !== (a.diff || 0)) return (b.diff || 0) - (a.diff || 0);
                            return (a.rank || 9999) - (b.rank || 9999);
                        });

                    if (catTeams.length === 0) return null;

                    return (
                        <div key={cat.id} className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex items-center justify-between">
                                <h3 className={`text-xl font-black ${cat.color} flex items-center gap-2`}>
                                    <span className="material-symbols-outlined">emoji_events</span>
                                    {cat.label}
                                </h3>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                    {catTeams.length} equipos
                                </span>
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
                                            const pos = idx + 1;
                                            return (
                                                <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors group">
                                                    <td className="px-8 py-4 text-center">
                                                        <div className={`size-9 rounded-full flex items-center justify-center font-black text-sm mx-auto shadow-sm
                                                            ${pos === 1 ? 'bg-yellow-400 text-yellow-950 ring-4 ring-yellow-400/20' : 
                                                              pos === 2 ? 'bg-gray-300 text-gray-800' : 
                                                              pos === 3 ? 'bg-orange-400 text-orange-950' : 
                                                              'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}
                                                        >
                                                            {pos}º
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900 dark:text-white text-base group-hover:text-primary transition-colors">{team.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{team.players.join(' & ')}</div>
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
                        {isKnockout
                            ? 'Resultados finales por categorías.'
                            : `${competition.name} • ${competition.currentPhase || 'Suizo Internacional'}`}
                    </p>
                </div>
            </div>

            {hasKnockoutMatches && renderKnockoutStandings()}

            {!isKnockout && (
                <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                            Clasificación Suizo Internacional (Pts → BH → FBH → Dif)
                        </span>
                    </div>
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
                                    <th className="px-4 py-3 text-center" title="Buchholz / Puntos Adversarios (Criterio 2)">BH</th>
                                    <th className="px-4 py-3 text-center" title="Buchholz Fino (Criterio 3)">FBH</th>
                                    <th className="px-4 py-3 text-center" title="Diferencia de Tantos (Criterio 4)">Dif</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {sortedTeams.map((team, idx) => {
                                    const sourceMatches = swissMatches.length > 0 ? swissMatches : matches.filter(m => !m.round.startsWith('Knockout'));
                                    const teamMatches = sourceMatches.filter(m => 
                                        (m.team1.id === team.id || m.team2.id === team.id) && 
                                        m.status === 'finished'
                                    );
                                    
                                    const played = teamMatches.length;
                                    const won = teamMatches.filter(m => {
                                        if (m.team1.id === team.id) return (m.score1 || 0) > (m.score2 || 0);
                                        return (m.score2 || 0) > (m.score1 || 0);
                                    }).length;
                                    const lost = played - won;

                                    const inGeneral = idx < generalCut;
                                    const inConsolacion = !inGeneral && consolationCut > 0 && idx < generalCut + consolationCut;

                                    return (
                                        <React.Fragment key={team.id}>
                                            <motion.tr 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                                                className={`
                                                    transition-colors
                                                    ${inGeneral
                                                        ? 'border-l-4 border-l-emerald-500 hover:bg-gray-50 dark:hover:bg-zinc-900'
                                                        : inConsolacion
                                                            ? 'border-l-4 border-l-amber-500 hover:bg-gray-50 dark:hover:bg-zinc-900'
                                                            : 'bg-gray-50 dark:bg-zinc-950 opacity-65 hover:opacity-100'}
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
                                                <td className={`px-4 py-3 text-center font-medium ${(team.diff || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                    {(team.diff || 0) > 0 ? '+' : ''}{team.diff || 0}
                                                </td>
                                            </motion.tr>
                                            {idx === generalCut - 1 && generalCut > 0 && (
                                                <tr key="cutoff-general" className="bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider">
                                                    <td className="px-4 py-1 text-center" colSpan={9}>
                                                        Corte Cuadro General (Top {generalCut})
                                                    </td>
                                                </tr>
                                            )}
                                            {consolationCut > 0 && idx === generalCut + consolationCut - 1 && (
                                                <tr key="cutoff-consolacion" className="bg-amber-600 text-white text-xs font-bold uppercase tracking-wider">
                                                    <td className="px-4 py-1 text-center" colSpan={9}>
                                                        Corte Consolación (+{consolationCut} equipos)
                                                    </td>
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
