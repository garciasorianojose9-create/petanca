import React, { useState, useEffect } from 'react';
import { Match, Team } from '../types';
import { motion } from 'framer-motion';

interface ManualPairingModalProps {
    isOpen: boolean;
    onClose: () => void;
    matches: Match[];
    teams: Team[];
    onSave: (updatedMatches: Match[]) => void;
}

export const ManualPairingModal: React.FC<ManualPairingModalProps> = ({ isOpen, onClose, matches, teams, onSave }) => {
    const [localMatches, setLocalMatches] = useState<Match[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Deep copy matches to avoid mutating props directly
            setLocalMatches(JSON.parse(JSON.stringify(matches)));
        }
    }, [isOpen, matches]);

    const handleTeamChange = (matchId: string, teamKey: 'team1' | 'team2', teamId: string) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        setLocalMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return { ...m, [teamKey]: team };
            }
            return m;
        }));
    };

    const handleCourtChange = (matchId: string, court: number) => {
        setLocalMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return { ...m, court };
            }
            return m;
        }));
    };

    const handleSave = () => {
        onSave(localMatches);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajuste Manual de Emparejamientos</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {localMatches.length === 0 ? (
                        <p className="text-center text-gray-500">No hay partidas para ajustar en esta ronda.</p>
                    ) : (
                        localMatches.map((match, index) => (
                            <div key={match.id} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <span className="text-xs font-bold text-gray-500 uppercase w-16">Pista</span>
                                    <input 
                                        type="number" 
                                        value={match.court} 
                                        onChange={(e) => handleCourtChange(match.id, parseInt(e.target.value) || 0)}
                                        className="w-16 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#333] text-center font-bold"
                                    />
                                </div>

                                <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-4 items-center w-full">
                                    <select 
                                        value={match.team1.id} 
                                        onChange={(e) => handleTeamChange(match.id, 'team1', e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#333] text-sm"
                                    >
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>

                                    <span className="font-bold text-gray-400">VS</span>

                                    <select 
                                        value={match.team2.id} 
                                        onChange={(e) => handleTeamChange(match.id, 'team2', e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#333] text-sm"
                                    >
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined">save</span>
                        Guardar Cambios
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
