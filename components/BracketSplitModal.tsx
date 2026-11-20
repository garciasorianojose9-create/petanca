import React, { useEffect, useMemo, useState } from "react";
import { Competition, Team } from "../types";
import { sortSwissStandings } from "../utils/tournamentUtils";
import { generateSeededKnockoutFirstRound } from "../utils/knockoutUtils";

type AssignmentTarget = "GENERAL" | "CONSOLACION" | "NONE";

interface BracketSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  competition: Competition;
  teams: Team[];
  onConfirm: (
    generalTeams: Team[],
    consolationTeams: Team[],
    generalCount: number,
    consolationCount: number,
  ) => Promise<void> | void;
}

export const BracketSplitModal: React.FC<BracketSplitModalProps> = ({
  isOpen,
  onClose,
  competition,
  teams,
  onConfirm,
}) => {
  const sortedSwiss = useMemo(() => sortSwissStandings(teams), [teams]);

  const [generalCountInput, setGeneralCountInput] = useState<number>(8);
  const [consolationCountInput, setConsolationCountInput] = useState<number>(8);
  const [assignments, setAssignments] = useState<Record<string, AssignmentTarget>>({});
  const [generalOrder, setGeneralOrder] = useState<string[]>([]);
  const [consolationOrder, setConsolationOrder] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"assign" | "preview">("assign");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyCountsFromRanking = (genCount: number, conCount: number) => {
    const safeGen = Math.max(0, Math.min(genCount, sortedSwiss.length));
    const safeCon = Math.max(0, Math.min(conCount, sortedSwiss.length - safeGen));
    const nextMap: Record<string, AssignmentTarget> = {};
    const nextGenOrder: string[] = [];
    const nextConOrder: string[] = [];

    sortedSwiss.forEach((team, idx) => {
      if (idx < safeGen) {
        nextMap[team.id] = "GENERAL";
        nextGenOrder.push(team.id);
      } else if (idx < safeGen + safeCon) {
        nextMap[team.id] = "CONSOLACION";
        nextConOrder.push(team.id);
      } else {
        nextMap[team.id] = "NONE";
      }
    });

    setGeneralCountInput(safeGen);
    setConsolationCountInput(safeCon);
    setAssignments(nextMap);
    setGeneralOrder(nextGenOrder);
    setConsolationOrder(nextConOrder);
  };

  useEffect(() => {
    if (!isOpen) return;
    const total = sortedSwiss.length;
    const defaultGen =
      typeof competition.mainBracketCount === "number"
        ? Math.min(competition.mainBracketCount, total)
        : Math.min(total >= 16 ? 8 : Math.max(2, Math.floor(total / 2)), total);
    const defaultCon =
      typeof competition.consolationBracketCount === "number"
        ? Math.min(competition.consolationBracketCount, Math.max(0, total - defaultGen))
        : Math.min(defaultGen, Math.max(0, total - defaultGen));

    applyCountsFromRanking(defaultGen, defaultCon);
    setActiveSubTab("assign");
    setIsSubmitting(false);
  }, [isOpen, competition.id, sortedSwiss.length]);

  const handleSetTeamTarget = (teamId: string, target: AssignmentTarget) => {
    setAssignments((prev) => ({ ...prev, [teamId]: target }));

    setGeneralOrder((prev) => {
      const filtered = prev.filter((id) => id !== teamId);
      if (target === "GENERAL") {
        // Insert preserving Swiss order if newly added
        const withNew = [...filtered, teamId];
        return withNew.sort(
          (a, b) =>
            sortedSwiss.findIndex((t) => t.id === a) -
            sortedSwiss.findIndex((t) => t.id === b),
        );
      }
      return filtered;
    });

    setConsolationOrder((prev) => {
      const filtered = prev.filter((id) => id !== teamId);
      if (target === "CONSOLACION") {
        const withNew = [...filtered, teamId];
        return withNew.sort(
          (a, b) =>
            sortedSwiss.findIndex((t) => t.id === a) -
            sortedSwiss.findIndex((t) => t.id === b),
        );
      }
      return filtered;
    });
  };

  const moveWithinBracket = (
    bracket: "GENERAL" | "CONSOLACION",
    index: number,
    direction: -1 | 1,
  ) => {
    const updater = (list: string[]) => {
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
      return copy;
    };
    if (bracket === "GENERAL") setGeneralOrder(updater);
    else setConsolationOrder(updater);
  };

  const generalTeams = useMemo(
    () =>
      generalOrder
        .map((id) => sortedSwiss.find((t) => t.id === id))
        .filter((t): t is Team => Boolean(t)),
    [generalOrder, sortedSwiss],
  );

  const consolationTeams = useMemo(
    () =>
      consolationOrder
        .map((id) => sortedSwiss.find((t) => t.id === id))
        .filter((t): t is Team => Boolean(t)),
    [consolationOrder, sortedSwiss],
  );

  const previewGeneralMatches = useMemo(() => {
    if (generalTeams.length < 2) return [];
    const courts = Array.from({ length: Math.max(1, generalTeams.length) }, (_, i) => i + 1);
    return generateSeededKnockoutFirstRound(generalTeams, competition.id, courts, "DIRECTA");
  }, [generalTeams, competition.id]);

  const previewConsolationMatches = useMemo(() => {
    if (consolationTeams.length < 2) return [];
    const courts = Array.from({ length: Math.max(1, consolationTeams.length) }, (_, i) => i + 1);
    return generateSeededKnockoutFirstRound(consolationTeams, competition.id, courts, "CONSOLACION");
  }, [consolationTeams, competition.id]);

  const validationError = useMemo(() => {
    if (generalTeams.length === 1) {
      return "Cuadro General necesita al menos 2 equipos (o 0 si no se juega).";
    }
    if (consolationTeams.length === 1) {
      return "Cuadro Consolación necesita al menos 2 equipos (o 0 si no se juega).";
    }
    if (generalTeams.length < 2 && consolationTeams.length < 2) {
      return "Selecciona al menos 2 equipos en General o en Consolación.";
    }
    return null;
  }, [generalTeams.length, consolationTeams.length]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (validationError || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(
        generalTeams,
        consolationTeams,
        generalTeams.length,
        consolationTeams.length,
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1b0f0d] border border-slate-200 dark:border-[#3a201d] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#3a201d] bg-slate-50 dark:bg-[#251614] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Configurar Cuadros: General y Consolación
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define cuántos equipos pasan desde el Suizo Internacional y ajusta manualmente cualquier plaza antes de generar los cruces (1.º vs último).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#3a201d] transition-colors"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Numeric Split Controls */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] flex flex-col lg:flex-row lg:items-end justify-between gap-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Plazas Cuadro General (Principal)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={sortedSwiss.length}
                  value={generalCountInput}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    applyCountsFromRanking(val, consolationCountInput);
                  }}
                  className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-[#3a201d] bg-slate-50 dark:bg-[#251614] text-slate-900 dark:text-white font-mono tabular-nums text-sm font-bold focus:outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  {[4, 8, 16].map((preset) => (
                    <button
                      key={`g-${preset}`}
                      type="button"
                      disabled={preset > sortedSwiss.length}
                      onClick={() => applyCountsFromRanking(preset, consolationCountInput)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-[#3a201d] text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary disabled:opacity-40 transition-colors font-mono tabular-nums"
                    >
                      Top {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Plazas Cuadro Consolación
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, sortedSwiss.length - generalCountInput)}
                  value={consolationCountInput}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    applyCountsFromRanking(generalCountInput, val);
                  }}
                  className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-[#3a201d] bg-slate-50 dark:bg-[#251614] text-slate-900 dark:text-white font-mono tabular-nums text-sm font-bold focus:outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  {[4, 8, 16].map((preset) => (
                    <button
                      key={`c-${preset}`}
                      type="button"
                      disabled={generalCountInput + preset > sortedSwiss.length}
                      onClick={() => applyCountsFromRanking(generalCountInput, preset)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-[#3a201d] text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-600 disabled:opacity-40 transition-colors font-mono tabular-nums"
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      applyCountsFromRanking(
                        generalCountInput,
                        Math.max(0, sortedSwiss.length - generalCountInput),
                      )
                    }
                    className="px-2.5 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-[#3a201d] text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-600 transition-colors whitespace-nowrap"
                  >
                    Resto
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-view Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#251614] rounded-lg border border-slate-200 dark:border-[#3a201d] shrink-0 self-start lg:self-end">
            <button
              type="button"
              onClick={() => setActiveSubTab("assign")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                activeSubTab === "assign"
                  ? "bg-white dark:bg-[#1b0f0d] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              1. Asignación ({generalTeams.length} Gen / {consolationTeams.length} Con)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("preview")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                activeSubTab === "preview"
                  ? "bg-white dark:bg-[#1b0f0d] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              2. Ver Cruces (1.º vs Último)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60 dark:bg-[#150b0a]">
          {sortedSwiss.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No hay equipos inscritos en esta competición.
            </div>
          ) : activeSubTab === "assign" ? (
            <div className="bg-white dark:bg-[#1b0f0d] border border-slate-200 dark:border-[#3a201d] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-[#251614] border-b border-slate-200 dark:border-[#3a201d] text-xs font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">#</th>
                      <th className="px-4 py-3">Equipo / Jugadores</th>
                      <th className="px-3 py-3 text-center">Pts</th>
                      <th className="px-3 py-3 text-center">BH</th>
                      <th className="px-3 py-3 text-center">FBH</th>
                      <th className="px-3 py-3 text-center">+-</th>
                      <th className="px-4 py-3 text-right">Destino en Fase Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2e1917]">
                    {sortedSwiss.map((team, idx) => {
                      const target = assignments[team.id] || "NONE";
                      return (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-[#251614]/60 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-center font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-slate-900 dark:text-white leading-tight">
                              {team.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {team.players.join(" · ")}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {team.pts || 0}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {team.bh || 0}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {team.fbh || 0}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                            {(team.diff || 0) > 0 ? `+${team.diff}` : team.diff || 0}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#251614] border border-slate-200 dark:border-[#3a201d]">
                              <button
                                type="button"
                                onClick={() => handleSetTeamTarget(team.id, "GENERAL")}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap ${
                                  target === "GENERAL"
                                    ? "bg-emerald-600 text-white"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                General
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetTeamTarget(team.id, "CONSOLACION")}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap ${
                                  target === "CONSOLACION"
                                    ? "bg-amber-600 text-white"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                Consolación
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetTeamTarget(team.id, "NONE")}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap ${
                                  target === "NONE"
                                    ? "bg-slate-600 text-white"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                Fuera
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Preview & Seed Ordering */}
              <div className="bg-white dark:bg-[#1b0f0d] border border-slate-200 dark:border-[#3a201d] rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-[#3a201d] bg-slate-50 dark:bg-[#251614] flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Cuadro General ({generalTeams.length} equipos)
                  </h4>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {previewGeneralMatches.length} cruces R1
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {generalTeams.length < 2 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No se generará Cuadro General (menos de 2 equipos).
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {previewGeneralMatches.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#3a201d] bg-slate-50/70 dark:bg-[#251614]/60 text-xs"
                          >
                            <span className="font-mono tabular-nums text-slate-400 w-16 shrink-0">
                              {m.customLabel || `Cruce ${idx + 1}`}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white truncate flex-1">
                              {m.team1.name}
                            </span>
                            <span className="text-slate-400 font-mono">vs</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate flex-1 text-right">
                              {m.team2.name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-[#2e1917]">
                        <p className="text-xs font-bold text-slate-500 mb-2">
                          Ajustar orden de cabezas de serie (General):
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {generalTeams.map((team, idx) => (
                            <div
                              key={team.id}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 dark:bg-[#251614] text-xs"
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                <span className="font-mono tabular-nums font-bold text-emerald-600 mr-2">
                                  #{idx + 1}
                                </span>
                                {team.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveWithinBracket("GENERAL", idx, -1)}
                                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                  title="Subir cabeza de serie"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    arrow_upward
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === generalTeams.length - 1}
                                  onClick={() => moveWithinBracket("GENERAL", idx, 1)}
                                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                  title="Bajar cabeza de serie"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    arrow_downward
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Consolation Preview & Seed Ordering */}
              <div className="bg-white dark:bg-[#1b0f0d] border border-slate-200 dark:border-[#3a201d] rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-[#3a201d] bg-slate-50 dark:bg-[#251614] flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Cuadro Consolación ({consolationTeams.length} equipos)
                  </h4>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {previewConsolationMatches.length} cruces R1
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {consolationTeams.length < 2 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No se generará Cuadro de Consolación (menos de 2 equipos).
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {previewConsolationMatches.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#3a201d] bg-slate-50/70 dark:bg-[#251614]/60 text-xs"
                          >
                            <span className="font-mono tabular-nums text-slate-400 w-16 shrink-0">
                              {m.customLabel || `Cruce ${idx + 1}`}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white truncate flex-1">
                              {m.team1.name}
                            </span>
                            <span className="text-slate-400 font-mono">vs</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate flex-1 text-right">
                              {m.team2.name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-[#2e1917]">
                        <p className="text-xs font-bold text-slate-500 mb-2">
                          Ajustar orden de cabezas de serie (Consolación):
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {consolationTeams.map((team, idx) => (
                            <div
                              key={team.id}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 dark:bg-[#251614] text-xs"
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                <span className="font-mono tabular-nums font-bold text-amber-600 mr-2">
                                  #{idx + 1}
                                </span>
                                {team.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveWithinBracket("CONSOLACION", idx, -1)}
                                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                  title="Subir cabeza de serie"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    arrow_upward
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === consolationTeams.length - 1}
                                  onClick={() => moveWithinBracket("CONSOLACION", idx, 1)}
                                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                                  title="Bajar cabeza de serie"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    arrow_downward
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs">
            {validationError ? (
              <span className="text-red-600 dark:text-red-400 font-bold">
                {validationError}
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                General: <strong className="text-slate-900 dark:text-white">{generalTeams.length}</strong> · Consolación:{" "}
                <strong className="text-slate-900 dark:text-white">{consolationTeams.length}</strong> · Fuera:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {Math.max(0, sortedSwiss.length - generalTeams.length - consolationTeams.length)}
                </strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#3a201d] text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-[#251614] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={Boolean(validationError) || isSubmitting}
              onClick={handleConfirmClick}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">account_tree</span>
              {isSubmitting ? "Generando..." : "Confirmar y Generar Cuadros"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
