import React, { useState, useEffect } from "react";
import { Competition, Team, Match } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addProfessionalHeader,
  addProfessionalFooter,
  getProfessionalTableStyles,
} from "../src/utils/pdfUtils";

interface FinalClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  competition: Competition;
  teams: Team[];
  matches: Match[];
}

// Helper to determine the latest round a team reached
const getTeamProgress = (teamId: string, bracketMatches: Match[]) => {
  const teamM = bracketMatches.filter(m => m.team1.id === teamId || m.team2.id === teamId);
  if (teamM.length === 0) return { maxRound: 0, wonLast: false, isWinner: false };
  
  const roundNums = teamM.map(m => parseInt(m.round.replace("Knockout Round ", "")) || 0);
  const maxRound = Math.max(...roundNums);
  
  const lastMatch = teamM.find(m => parseInt(m.round.replace("Knockout Round ", "")) === maxRound);
  if (!lastMatch || !lastMatch.score1 || !lastMatch.score2) return { maxRound, wonLast: false, isWinner: false };

  const wonLast = (lastMatch.team1.id === teamId && lastMatch.score1 > lastMatch.score2) ||
                  (lastMatch.team2.id === teamId && lastMatch.score2 > lastMatch.score1);

  // If they won their last match, and it's the absolute final of the bracket, they are the overall winner
  const allRounds = bracketMatches.map(m => parseInt(m.round.replace("Knockout Round ", "")) || 0);
  const maxOverallRound = Math.max(...allRounds);
  const isWinner = wonLast && maxRound === maxOverallRound;

  return { maxRound, wonLast, isWinner };
};

export const FinalClassificationModal: React.FC<FinalClassificationModalProps> = ({
  isOpen,
  onClose,
  competition,
  teams,
  matches,
}) => {
  const [sortedTeams, setSortedTeams] = useState<{ team: Team; label: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Separate teams by bracket or use overall points
    if (competition.type !== "KNOCKOUT") {
      const sorted = [...teams].sort((a, b) => {
          if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
          if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
          if ((b.fbh || 0) !== (a.fbh || 0)) return (b.fbh || 0) - (a.fbh || 0);
          return (b.diff || 0) - (a.diff || 0);
      });
      setSortedTeams(sorted.map(t => ({ team: t, label: "Fase 1" })));
    } else {
      let finalOrder: { team: Team; label: string; score: number }[] = [];
      const brackets = ['DIRECTA', 'CONSOLACION', 'REPESCA'];
      
      brackets.forEach((bracket, bIdx) => {
        const bMatches = matches.filter(m => m.bracket === bracket);
        if (bMatches.length === 0) return;
        
        const bTeams = teams.filter(t => bMatches.some(m => m.team1.id === t.id || m.team2.id === t.id));
        
        const scoredTeams = bTeams.map(t => {
          const prog = getTeamProgress(t.id, bMatches);
          // Score formula: bracket weight + round weight + win bonus
          // DIRECTA > CONSOLACION > REPESCA
          const bracketScore = (3 - bIdx) * 10000;
          const roundScore = prog.maxRound * 100;
          const winScore = prog.wonLast ? 50 : 0;
          return { team: t, label: bracket, score: bracketScore + roundScore + winScore, prog };
        });

        scoredTeams.sort((a, b) => b.score - a.score);
        finalOrder = [...finalOrder, ...scoredTeams];
      });

      // Find teams that didn't play in knockout
      const unplayedTeams = teams.filter(t => !finalOrder.some(f => f.team.id === t.id));
      const unplayedScored = unplayedTeams.map(t => ({ team: t, label: "No Clasificado", score: 0 }));

      setSortedTeams([...finalOrder, ...unplayedScored].map(item => ({ team: item.team, label: item.label })));
    }
  }, [isOpen, teams, matches, competition.type]);

  if (!isOpen) return null;

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...sortedTeams];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSortedTeams(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === sortedTeams.length - 1) return;
    const newOrder = [...sortedTeams];
    [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    setSortedTeams(newOrder);
  };

  const handleDownload = () => {
    const doc = new jsPDF();
    addProfessionalHeader(doc, competition.name, "Clasificación Final Definita");

    let currentY = 40;

    const hasCategories = sortedTeams.some(item => item.label && item.label !== "Fase 1");

    const head = hasCategories 
      ? [["Posición", "Equipo / Jugadores", "Categoría"]]
      : [["Posición", "Equipo / Jugadores"]];

    const formatTeamDisplay = (team: Team) => {
      if (competition.format === "INDIVIDUAL") {
        return team.players && team.players.length > 0 ? team.players[0] : team.name;
      }
      return team.name;
    };

    autoTable(doc, {
      startY: currentY,
      head: head,
      body: sortedTeams.map((item, idx) => {
        const base = [
          `${idx + 1}º`,
          formatTeamDisplay(item.team),
        ];
        if (hasCategories) {
          base.push(item.label === "Fase 1" ? "" : item.label);
        }
        return base;
      }),
      ...getProfessionalTableStyles(),
      columnStyles: hasCategories ? {
        0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 50, halign: 'center' }
      } : {
        0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 'auto' }
      }
    });

    addProfessionalFooter(doc, "Clasificación Oficial");
    doc.save(`Clasificacion_Final_${competition.name.replace(/\s+/g, "_")}.pdf`);
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
          className="bg-white dark:bg-zinc-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-zinc-800 shrink-0">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">military_tech</span>
                Clasificación Final (Ajuste Manual)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Ajusta el orden final de los equipos y descarga el PDF.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-zinc-950">
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {sortedTeams.map((item, idx) => {
                    const hasCategories = sortedTeams.some(i => i.label && i.label !== "Fase 1");
                    
                    const formatTeamDisplay = (team: Team) => {
                      if (competition.format === "INDIVIDUAL") {
                        return team.players && team.players.length > 0 ? team.players[0] : team.name;
                      }
                      return team.name;
                    };

                    return (
                    <div 
                        key={item.team.id}
                        className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
                                {idx + 1}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{formatTeamDisplay(item.team)}</div>
                                {hasCategories && item.label !== "Fase 1" && (
                                   <div className="text-[10px] text-gray-500">{item.label}</div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30"
                            >
                                <span className="material-symbols-outlined text-sm">arrow_upward</span>
                            </button>
                            <button 
                                onClick={() => moveDown(idx)}
                                disabled={idx === sortedTeams.length - 1}
                                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30"
                            >
                                <span className="material-symbols-outlined text-sm">arrow_downward</span>
                            </button>
                        </div>
                    </div>
                )})}
             </div>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
            <span className="text-xs text-gray-500">
               * Ordenado automáticamente basado en los resultados. Si hay empates (como 3º y 4º), ajústalos con las flechas.
            </span>
            <div className="flex gap-3">
                <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                Cerrar
                </button>
                <button
                onClick={handleDownload}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm"
                >
                <span className="material-symbols-outlined text-sm">download</span>
                Descargar PDF
                </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
