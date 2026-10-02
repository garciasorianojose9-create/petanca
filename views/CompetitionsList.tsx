import React, { useState } from 'react';
import { Competition, PlayerRegistry, Team } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

interface CompetitionsListProps {
    competitions: Competition[];
    onSelect: (comp: Competition) => void;
    currentUser?: PlayerRegistry | null;
    teams?: Team[];
    onCreateNew?: () => void;
    onDelete?: (id: string) => void;
}

export const CompetitionsList: React.FC<CompetitionsListProps> = ({ competitions, onSelect, currentUser, teams = [], onCreateNew, onDelete }) => {
    const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED' | 'MY'>('ALL');
    const [competitionToDelete, setCompetitionToDelete] = useState<string | null>(null);

    const filteredCompetitions = competitions.filter(comp => {
        if (filter === 'ALL') return true;
        if (filter === 'MY') {
            if (!currentUser) return false;
            // Find teams where the user is a player
            const myTeams = teams.filter(t => t.players.includes(currentUser.name));
            // Check if any of my teams are in this competition
            return myTeams.some(t => t.competitionId === comp.id);
        }
        return comp.status === filter;
    });

    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.username?.toLowerCase().trim() === 'admin';

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
             {/* Header */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Competiciones</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Selecciona una competición para ver detalles, cuadros y resultados.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-gray-700 dark:text-gray-300 font-medium">
                        <span className="material-symbols-outlined text-[20px]">filter_list</span>
                        Filtrar
                    </button>
                    {isAdmin && onCreateNew && (
                        <button 
                            onClick={onCreateNew}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors font-bold"
                        >
                            <span className="material-symbols-outlined text-[20px]">add_circle</span>
                            Nueva Competición
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto pb-1">
                {['ALL', 'MY', 'LIVE', 'UPCOMING', 'COMPLETED'].map((status) => {
                    if (status === 'MY' && !currentUser) return null;
                    
                    return (
                        <button
                            key={status}
                            onClick={() => setFilter(status as any)}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                                filter === status
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {status === 'ALL' ? 'Todas' : 
                             status === 'MY' ? 'Mis Competiciones' :
                             status === 'LIVE' ? 'En Vivo' :
                             status === 'UPCOMING' ? 'Próximas' : 'Finalizadas'}
                        </button>
                    );
                })}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompetitions.map((comp) => (
                    <div key={comp.id} className="group bg-white dark:bg-zinc-950 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col h-full">
                        {/* Image Header */}
                        <div className="h-48 bg-gray-200 relative overflow-hidden cursor-pointer" onClick={() => onSelect(comp)}>
                            {comp.image === 'LOGO' ? (
                                <div className="w-full h-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center p-8">
                                    <img 
                                        src="https://fprmut-federaciondepartamentaldepetancademurcia.com/wp-content/uploads/2021/04/cropped-LOGOTIPO-FPRM-1.png" 
                                        alt="Federación Petanca Murcia" 
                                        className="max-h-full max-w-full object-contain opacity-80"
                                    />
                                </div>
                            ) : (
                                <img 
                                    src={comp.image} 
                                    alt={comp.name} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            
                            {/* Delete Button (Admin only) */}
                            {currentUser?.role === 'ADMIN' && onDelete && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCompetitionToDelete(comp.id);
                                    }}
                                    className="absolute top-4 left-4 size-8 flex items-center justify-center bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors z-10"
                                    title="Eliminar competición"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            )}

                            {/* Status Badge */}
                            <div className="absolute top-4 right-4">
                                {comp.status === 'LIVE' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-primary shadow-sm animate-pulse">
                                        <span className="size-2 rounded-full bg-primary"></span>
                                        EN VIVO
                                    </span>
                                )}
                                {comp.status === 'UPCOMING' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/50 text-white backdrop-blur-sm border border-white/20">
                                        <span className="material-symbols-outlined text-sm">calendar_clock</span>
                                        PRÓXIMA
                                    </span>
                                )}
                                {comp.status === 'COMPLETED' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-900/80 text-gray-300 backdrop-blur-sm border border-white/10">
                                        FINALIZADA
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col gap-4">
                            <div>
                                <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">{comp.type}</div>
                                <h3 
                                    className="text-xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-primary transition-colors cursor-pointer"
                                    onClick={() => onSelect(comp)}
                                >
                                    {comp.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{comp.organizer}</p>
                            </div>

                            <div className="space-y-3 mt-auto">
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-gray-400">calendar_month</span>
                                    <span>{new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-gray-400">location_on</span>
                                    <span className="truncate">{comp.location}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500">Inscripciones</span>
                                    <span className="text-xs font-bold text-gray-900 dark:text-white">{comp.registeredCount} / {comp.maxTeams} Equipos</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-zinc-900 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(comp.registeredCount / comp.maxTeams) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ID: #{comp.id}</span>
                            <button 
                                onClick={() => onSelect(comp)}
                                className="text-sm font-bold text-primary flex items-center gap-1 group-hover:gap-2 transition-all"
                            >
                                {comp.status === 'LIVE' ? 'Entrar a la Competición' : 'Gestionar / Ver'}
                                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredCompetitions.length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-800">
                    <div className="inline-flex p-4 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-400 mb-4">
                        <span className="material-symbols-outlined text-4xl">event_busy</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">No se encontraron competiciones</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Crea tu primera competición en el panel de control.</p>
                </div>
            )}

            <ConfirmModal
                isOpen={!!competitionToDelete}
                title="Eliminar competición"
                message="¿Estás seguro de que quieres eliminar esta competición? Esta acción no se puede deshacer y se perderán todos los datos asociados (equipos, partidos, etc.)."
                confirmText="Eliminar"
                onConfirm={() => {
                    if (competitionToDelete && onDelete) {
                        onDelete(competitionToDelete);
                    }
                    setCompetitionToDelete(null);
                }}
                onCancel={() => setCompetitionToDelete(null)}
            />
        </div>
    );
};