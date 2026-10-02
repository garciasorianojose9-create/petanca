import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Team, Competition } from '../types';

interface AddManualMatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    teams: Team[];
    competition: Competition;
    onAddMatch: (match: Match) => void;
    currentRoundNum: number;
}

export const AddManualMatchModal: React.FC<AddManualMatchModalProps> = ({ isOpen, onClose, teams, competition, onAddMatch, currentRoundNum }) => {
    const [team1Id, setTeam1Id] = useState<string>('');
    const [team2Id, setTeam2Id] = useState<string>('');
    const [roundName, setRoundName] = useState<string>('3º y 4º Puesto');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!team1Id || !team2Id || team1Id === team2Id) {
            alert("Selecciona dos equipos distintos.");
            return;
        }

        const team1 = teams.find(t => t.id === team1Id)!;
        const team2 = teams.find(t => t.id === team2Id)!;

        const newMatch: Match = {
            id: `manual-match-${Date.now()}`,
            competitionId: competition.id,
            team1,
            team2,
            score1: null,
            score2: null,
            court: 1, // Default, admin can change later
            status: 'scheduled',
            round: `Knockout Round ${currentRoundNum}`, // So it shows up in current round
            bracket: 'DIRECTA', // Or maybe we add a 'PLACEMENT' bracket?
            customLabel: roundName
        };

        onAddMatch(newMatch);
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white dark:bg-zinc-950 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800"
                >
                    <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-zinc-800">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">add_circle</span>
                            Añadir Partido (Ej. 3º y 4º Puesto)
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre/Etiqueta (Opcional)</label>
                            <input
                                type="text"
                                value={roundName}
                                onChange={(e) => setRoundName(e.target.value)}
                                placeholder="Ej: 3º y 4º Puesto"
                                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Equipo 1</label>
                                <select 
                                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                                    value={team1Id}
                                    onChange={(e) => setTeam1Id(e.target.value)}
                                >
                                    <option value="">Selecciona un equipo</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Equipo 2</label>
                                <select 
                                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
                                    value={team2Id}
                                    onChange={(e) => setTeam2Id(e.target.value)}
                                >
                                    <option value="">Selecciona un equipo</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            Añadir Partido
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
