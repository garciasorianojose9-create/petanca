import React from 'react';
import { Competition, Group, PlayerRegistry, Match } from '../types';
import { PouleSheet } from './PouleSheet';

interface PoulesProps {
    competition: Competition | null;
    groups: Group[];
    currentUser: PlayerRegistry | null;
    matches: Match[];
}

export const Poules: React.FC<PoulesProps> = ({ competition, groups, currentUser, matches }) => {
    
    if (!competition) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="bg-gray-100 dark:bg-zinc-900 p-6 rounded-full mb-6">
                    <span className="material-symbols-outlined text-5xl text-gray-400">grid_view</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Ninguna Competición Seleccionada</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                    Por favor, ve a la lista de Competiciones y selecciona un torneo activo para ver la fase de grupos.
                </p>
            </div>
        );
    }

    // Find user's group
    const userGroup = groups.find(g => 
        g.teams.some(t => t.players.some(p => currentUser && p.toLowerCase().includes(currentUser.name.toLowerCase())))
    );

    // Find matches for user's group (simplified logic: matches involving teams in the group)
    const userGroupMatches = userGroup 
        ? matches.filter(m => 
            userGroup.teams.some(t => t.id === m.team1.id) || 
            userGroup.teams.some(t => t.id === m.team2.id)
          )
        : [];

    const currentUserTeam = userGroup?.teams.find(t => 
        t.players.some(p => currentUser && p.toLowerCase().includes(currentUser.name.toLowerCase()))
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {competition.status === 'LIVE' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-500 dark:border-yellow-800">
                                 <span className="size-1.5 rounded-full bg-yellow-500 mr-1.5 animate-pulse"></span>
                                 EN VIVO
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                                 {competition.status}
                            </span>
                        )}
                        <span className="text-gray-500 text-sm font-medium">{competition.location}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{competition.name}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                        {competition.type} • Fase 2: Grupos
                    </p>
                </div>
                <div className="flex gap-2">
                     <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-900 transition shadow-sm text-gray-700 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[18px]">filter_list</span>
                        Filtrar
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90 transition shadow-md">
                        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                        Calendario
                    </button>
                </div>
            </div>

            {/* My Group Card */}
            {userGroup && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                         <span className="material-symbols-outlined text-primary">push_pin</span>
                         <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tu Grupo</h3>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-primary to-[#b01202] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-2xl font-black tracking-tight">{userGroup.name}</h4>
                                </div>
                            </div>
                             <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-lg backdrop-blur-md">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Tu Estado</p>
                                    <p className="font-bold text-sm leading-none">{currentUserTeam?.status === 'qualified' ? 'Clasificado' : currentUserTeam?.status === 'eliminated' ? 'Eliminado' : 'Jugando'}</p>
                                </div>
                                <div className="size-8 rounded-full bg-yellow-400 flex items-center justify-center text-[#b01202] font-black text-lg border-2 border-white/20">
                                    {currentUserTeam?.rank || '-'}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 bg-gray-50 dark:bg-zinc-900/50">
                            {userGroupMatches.length > 0 ? (
                                <PouleSheet group={userGroup} matches={matches} />
                            ) : (
                                <div className="text-center py-8 text-gray-500">No hay partidos programados para tu grupo todavía.</div>
                            )}
                        </div>
                        
                        <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                             <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Clasificación Grupo</h4>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900">
                                        <tr>
                                            <th className="px-4 py-2 font-bold w-12 text-center">Pos</th>
                                            <th className="px-4 py-2 font-bold">Equipo</th>
                                            <th className="px-4 py-2 font-bold text-center">Pts</th>
                                            <th className="px-4 py-2 font-bold text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {[...(userGroup?.teams || [])].sort((a,b) => (b.pts||0) - (a.pts||0)).map((team, idx) => (
                                            <tr key={team.id} className={team.id === currentUserTeam?.id ? 'bg-primary/5 dark:bg-primary/10' : ''}>
                                                <td className="px-4 py-3 text-center font-bold">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                    {team.name}
                                                    {team.id === currentUserTeam?.id && <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] rounded-sm font-bold uppercase">Tú</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center font-black bg-gray-50 dark:bg-zinc-900/50">{team.pts || 0}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {team.status === 'qualified' ? (
                                                        <span className="text-green-600 font-bold text-xs">Clasificado</span>
                                                    ) : team.status === 'eliminated' ? (
                                                        <span className="text-red-500 font-bold text-xs">Eliminado</span>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs">En juego</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    </div>
                </section>
            )}

             {/* All Groups */}
            <section>
                <div className="flex items-center justify-between mb-6">
                     <h3 className="text-xl font-bold text-gray-900 dark:text-white">Todos los Grupos</h3>
                     <div className="hidden sm:flex gap-2">
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"><span className="material-symbols-outlined">grid_view</span></button>
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"><span className="material-symbols-outlined">view_list</span></button>
                     </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groups.length > 0 ? groups.map((group, idx) => (
                        <div key={group.id} className={`bg-white dark:bg-zinc-950 rounded-xl shadow-sm border ${userGroup?.id === group.id ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-gray-200 dark:border-zinc-800'} hover:shadow-md transition-shadow duration-200 flex flex-col`}>
                            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900 rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-400">group</span>
                                    <h4 className="font-bold text-lg text-gray-900 dark:text-white">{group.name}</h4>
                                    {userGroup?.id === group.id && (
                                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded-full">Tu Grupo</span>
                                    )}
                                </div>
                                <span className="text-xs font-semibold text-gray-500 bg-white dark:bg-zinc-950 px-2 py-1 rounded border border-gray-200 dark:border-zinc-800">Pista {idx * 2 + 1}</span>
                            </div>
                            <div className="p-4 flex-1 space-y-4">
                                {group.teams.map((team, teamIdx) => (
                                    <div key={team.id} className="flex justify-between items-center text-sm">
                                        <div className="flex flex-col gap-1 w-full">
                                            <div className="flex justify-between">
                                                <span className={`font-medium truncate max-w-[180px] ${currentUser && team.players.includes(currentUser.name) ? 'text-yellow-600 dark:text-yellow-500 font-bold' : 'text-gray-900 dark:text-white'}`}>
                                                    {team.name}
                                                </span>
                                                <span className="font-bold text-gray-500 text-xs">Ranking {team.rank || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-zinc-900 rounded-b-xl border-t border-gray-100 dark:border-zinc-800 text-center">
                                <button className="text-xs font-bold text-gray-500 hover:text-primary transition uppercase tracking-wide">Ver Resultados</button>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-10 text-gray-500">
                            No se encontraron grupos para esta competición.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
