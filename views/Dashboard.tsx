import React, { useState, useEffect } from "react";
import { Competition, Team, Match, Group, PlayerRegistry } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FPRM_LOGO_BASE64 } from "../src/constants";
import {
  addProfessionalHeader,
  addProfessionalFooter,
  getProfessionalTableStyles,
} from "../src/utils/pdfUtils";

import { ManualPairingModal } from "./ManualPairingModal";
import { AddManualMatchModal } from "./AddManualMatchModal";
import { FinalClassificationModal } from "./FinalClassificationModal";
import { PouleSheet } from "./PouleSheet";
import { Bracket } from "./Bracket";
import { MatchTimer } from "../components/MatchTimer";
import { ConfirmModal } from "../components/ConfirmModal";

interface DashboardProps {
  competition: Competition | null;
  allCompetitions: Competition[];
  teams: Team[];
  matches?: Match[];
  groups?: Group[];
  players?: PlayerRegistry[];
  onSelectCompetition: (comp: Competition) => void;
  onStartPhase2?: (competitionId: string) => void;
  onStartPhase3?: (competitionId: string) => void;
  onStartCompetition?: (competitionId: string) => void;
  onUpdateCompetition?: (comp: Competition) => void;
  onDeleteTeam?: (teamId: string) => void;
  onGenerateRound?: (competitionId: string) => void;
  onGenerateGroupRound?: (competitionId: string, round: number) => void;
  onToggleStandings?: (competitionId: string, show: boolean) => void;
  onPrintActs?: (competitionId: string) => void;
  onExportStandings?: (competitionId: string) => void;
  onManualPairing?: (competitionId: string) => void;
  onEnterResults?: (competitionId: string) => void;
  onUpdateMatches?: (matches: Match[]) => void;
  onCreateNew?: () => void;
  onDeleteCompetition?: (competitionId: string) => void;
  onRefresh?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export const Dashboard: React.FC<DashboardProps> = ({
  competition,
  allCompetitions,
  teams,
  matches,
  groups = [],
  players = [],
  onSelectCompetition,
  onStartPhase2,
  onStartPhase3,
  onStartCompetition,
  onUpdateCompetition,
  onDeleteTeam,
  onGenerateRound,
  onGenerateGroupRound,
  onToggleStandings,
  onPrintActs,
  onExportStandings,
  onManualPairing,
  onEnterResults,
  onUpdateMatches,
  onCreateNew,
  onDeleteCompetition,
  onRefresh,
}) => {
  const [selectedMatchFilter, setSelectedMatchFilter] = useState("CURRENT_ROUND");
  const [activeTab, setActiveTab] = useState<
    "overview" | "phase1" | "phase2" | "phase3"
  >("overview");
  const [isManualPairingOpen, setIsManualPairingOpen] = useState(false);

  // Phase Management State
  const [currentRound, setCurrentRound] = useState(1);
  const totalRounds = competition?.totalRounds || 4;
  const [phase1Status, setPhase1Status] = useState<
    "PENDING" | "LIVE" | "COMPLETED"
  >("PENDING");
  const [isPhase2Started, setIsPhase2Started] = useState(false);
  const [isPhase3Started, setIsPhase3Started] = useState(false);
  const [checkInAlertTeams, setCheckInAlertTeams] = useState<Team[]>([]);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [showDeleteCompetitionConfirm, setShowDeleteCompetitionConfirm] =
    useState(false);
  const [whatsappMessagePreview, setWhatsappMessagePreview] = useState<
    string | null
  >(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [customRoundGen, setCustomRoundGen] = useState<number>(4);
  const [localCourtStart, setLocalCourtStart] = useState<number | "">("");
  const [localCourtEnd, setLocalCourtEnd] = useState<number | "">("");
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [showFinalClassificationModal, setShowFinalClassificationModal] = useState(false);

  // Sync courts
  useEffect(() => {
    if (competition) {
      setLocalCourtStart(competition.courtStart || 1);
      setLocalCourtEnd(competition.courtEnd || 16);
    }
  }, [competition?.id]);

  const handleSaveCourts = () => {
    if (
      competition &&
      onUpdateCompetition &&
      localCourtStart !== "" &&
      localCourtEnd !== ""
    ) {
      onUpdateCompetition({
        ...competition,
        courtStart: localCourtStart,
        courtEnd: localCourtEnd,
      });
      alert("Pistas actualizadas correctamente para la siguiente fase.");
    }
  };

  // Sync state with competition currentPhase
  useEffect(() => {
    if (competition) {
      const phase = competition.currentPhase || "";
      if (
        competition.type !== "KNOCKOUT" &&
        (phase.includes("Knockout") || phase.includes("Phase 3"))
      ) {
        setIsPhase2Started(true);
        setIsPhase3Started(true);
        setPhase1Status("COMPLETED");
        const roundMatch = phase.match(/Round (\d+)/);
        if (roundMatch) setCurrentRound(parseInt(roundMatch[1]));
        // Set tab to phase3 if we are on generic overview tab and it just upgraded
        setActiveTab((prev) =>
          prev === "overview" || prev === "phase2" ? "phase3" : prev,
        );
      } else if (
        phase.includes("Poules") ||
        phase.includes("Grupos") ||
        phase.includes("Finals") ||
        phase.includes("Bracket")
      ) {
        setIsPhase2Started(true);
        setIsPhase3Started(false);
        setPhase1Status("COMPLETED");
        // Only force tab change if we are not already on a valid tab for this phase
        setActiveTab((prev) => (prev === "overview" ? "phase2" : prev));
      } else if (
        phase.includes("Swiss") ||
        phase.includes("Knockout") ||
        phase.includes("Round")
      ) {
        setIsPhase2Started(false);
        setIsPhase3Started(false);
        setPhase1Status("LIVE");
        // Try to extract round number if format is "Swiss Round X" or "Knockout Round X"
        const roundMatch = phase.match(/Round (\d+)/);
        if (roundMatch) {
          setCurrentRound(parseInt(roundMatch[1]));
        } else if (phase.includes("Round 1")) {
          setCurrentRound(1);
        }
      } else if (phase === "Registration") {
        setIsPhase2Started(false);
        setPhase1Status("PENDING"); // Changed from LIVE to PENDING
        setCurrentRound(0); // Set to 0 to indicate not started
      } else {
        // Default
        setIsPhase2Started(false);
        setPhase1Status("LIVE");
        setCurrentRound(1);
      }
    }
  }, [competition?.id, competition?.currentPhase]);

  const handleCompetitionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = allCompetitions.find((c) => c.id === selectedId);
    if (selected) {
      onSelectCompetition(selected);
      // Reset local state on change (optional)
      setPhase1Status("LIVE");
      setCurrentRound(1);
      setIsPhase2Started(false);
    }
  };

  if (!competition) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-8 text-center animate-fade-in relative overflow-hidden">
        {/* Decorative background elements */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"
        ></motion.div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 bg-white dark:bg-[#2c1515] p-6 md:p-12 rounded-2xl shadow-xl border border-gray-100 dark:border-[#3a201d] max-w-lg w-full my-auto"
        >
          <div className="bg-gray-100 dark:bg-[#221210] size-16 sm:size-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl sm:text-5xl text-gray-400">
              space_dashboard
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2">
            Bienvenido, Director
          </h2>

          {allCompetitions.length > 0 ? (
            <>
              <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed">
                Para acceder al panel de gestión, por favor selecciona una
                competición activa de la base de datos.
              </p>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-primary">
                    trophy
                  </span>
                </div>
                <select
                  onChange={handleCompetitionChange}
                  defaultValue=""
                  className="block w-full pl-10 pr-10 py-3 sm:py-4 text-sm sm:text-base border-gray-300 dark:border-[#3a201d] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl bg-gray-50 dark:bg-[#1b0f0d] dark:text-white transition-all cursor-pointer hover:bg-white dark:hover:bg-[#221210] font-bold shadow-sm appearance-none"
                >
                  <option value="" disabled>
                    Selecciona una Competición...
                  </option>
                  {allCompetitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400">
                    expand_more
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed">
                No se encontraron competiciones en la base de datos. Necesitas
                crear un nuevo torneo para comenzar.
              </p>
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-primary text-xs sm:text-sm font-medium flex flex-col gap-4">
                <span>
                  Ve a <strong>Nueva Competición</strong> en la barra lateral
                  para crear tu primer evento.
                </span>
                {onCreateNew && (
                  <button
                    onClick={onCreateNew}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 mx-auto w-full"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Crear Primera Competición
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const handleNextRound = () => {
    if (competition?.type === "KNOCKOUT" || isPhase3Started) {
      if (onGenerateRound && competition) {
        onGenerateRound(competition.id);
      }
    } else {
      if (currentRound < totalRounds) {
        if (onGenerateRound && competition) {
          onGenerateRound(competition.id);
        }
      } else {
        setPhase1Status("COMPLETED");
      }
    }
  };

  const handleStartPhase2 = () => {
    if (onStartPhase2 && competition) {
      onStartPhase2(competition.id);
    }
    setIsPhase2Started(true);
    setActiveTab("phase2");
  };

  const handleWhatsAppNotification = () => {
    if (!competition) return;

    const currentRoundMatches =
      matches?.filter(
        (m) =>
          m.competitionId === competition.id &&
          m.round === competition.currentPhase,
      ) || [];

    if (currentRoundMatches.length === 0) {
      setWhatsappError("No hay partidas en la ronda actual para notificar.");
      return;
    }

    // Generate PDF
    const doc = new jsPDF();

    addProfessionalHeader(
      doc,
      competition.name,
      `Emparejamientos - Ronda ${competition.currentPhase}`,
    );

    // Prepare table data
    const tableData = currentRoundMatches
      .filter((match) => match.team1.id !== "bye" && match.team2.id !== "bye")
      .map((match) => [
        match.court ? `Pista ${match.court}` : "Por asignar",
        match.team1.name,
        "vs",
        match.team2.name,
      ]);

    autoTable(doc, {
      ...getProfessionalTableStyles(),
      startY: 50,
      head: [["Pista", "Equipo 1", "", "Equipo 2"]],
      body: tableData,
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 40 },
        1: { cellWidth: 60 },
        2: { cellWidth: 10, fontStyle: "italic", textColor: [150, 150, 150] },
        3: { cellWidth: 60 },
      },
    });

    addProfessionalFooter(doc, "Emparejamientos");

    // Download PDF
    doc.save(
      `Emparejamientos_${competition.name.replace(/\s+/g, "_")}_Ronda_${competition.currentPhase}.pdf`,
    );

    // Prepare WhatsApp message
    const loginUrl = window.location.origin;
    const message = `Siguiente sorteo de partidas ya listo, aqui lo teneis!!.\n\n👉 Ver todos los detalles y clasificación en directo:\n${loginUrl}`;

    setWhatsappMessagePreview(message);
  };

  const confirmWhatsAppNotification = () => {
    if (whatsappMessagePreview) {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(whatsappMessagePreview)}`,
        "_blank",
      );
    }
    setWhatsappMessagePreview(null);
  };

  const handleStartCompetition = (force = false) => {
    // Check for check-ins
    const notCheckedInTeams = teams.filter((t) => !t.checkedIn);

    if (!force && notCheckedInTeams.length > 0) {
      setCheckInAlertTeams(notCheckedInTeams);
      return;
    }

    if (onStartCompetition && competition) {
      onStartCompetition(competition.id);
      setCheckInAlertTeams([]); // Clear alert
    }
  };

  const handleManualPairingClick = () => {
    setIsManualPairingOpen(true);
  };

  const handleSavePairings = (updatedMatches: Match[]) => {
    if (onUpdateMatches) {
      onUpdateMatches(updatedMatches);
    }
    setIsManualPairingOpen(false);
  };

  // Filter matches for current round
  const currentRoundMatches =
    matches?.filter(
      (m) =>
        m.competitionId === competition?.id &&
        m.round === competition?.currentPhase,
    ) || [];

  const handleDeleteTeam = (teamId: string) => {
    setTeamToDelete(teamId);
  };

  // Sort teams strictly by federative rules for Phase 1: Points > Buchholz (SI) > Fine Buchholz (FSI) > Diff
  const sortedTeams = [...teams].sort((a, b) => {
    if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
    if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
    if ((b.fbh || 0) !== (a.fbh || 0)) return (b.fbh || 0) - (a.fbh || 0);
    return (b.diff || 0) - (a.diff || 0);
  });

  const activeMatchesCount =
    matches?.filter(
      (m) =>
        m.competitionId === competition.id &&
        (m.status === "live" ||
          (competition.status === "LIVE" &&
            m.status === "scheduled" &&
            m.round.includes(currentRound.toString()))),
    ).length || 0;

  const currentViewMatches = matches?.filter(
    (m) =>
      selectedMatchFilter === "ALL" 
        ? true 
        : selectedMatchFilter !== "CURRENT_ROUND" 
          ? m.round === selectedMatchFilter
          : m.round ===
            (competition.type === "KNOCKOUT" || activeTab === "phase3"
              ? `Knockout Round ${currentRound}`
              : `Swiss Round ${currentRound}`)
  ) || [];

  return (
    <div className="flex flex-col h-full max-w-[1600px] mx-auto w-full px-4 md:px-8 py-6 gap-6 relative">
      {/* Check-in Alert Modal */}
      <AnimatePresence>
        {checkInAlertTeams.length > 0 && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#221210] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-red-200 dark:border-red-900/50"
            >
              <div className="bg-red-500 text-white p-4 flex items-center gap-3">
                <span className="material-symbols-outlined">warning</span>
                <h3 className="font-bold text-lg">Check-in Incompleto</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Los siguientes equipos no han escaneado el código QR de
                  registro. ¿Deseas iniciar la competición de todos modos?
                </p>
                <div className="bg-gray-50 dark:bg-[#1b0f0d] rounded-lg border border-gray-200 dark:border-[#3a201d] max-h-60 overflow-y-auto mb-6">
                  <ul className="divide-y divide-gray-200 dark:divide-[#3a201d]">
                    {checkInAlertTeams.map((team) => (
                      <li
                        key={team.id}
                        className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white flex items-center justify-between"
                      >
                        <span>{team.name}</span>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Pendiente
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setCheckInAlertTeams([])}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-[#3a201d] dark:hover:bg-[#4a2b28] text-gray-800 dark:text-white rounded-lg font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleStartCompetition(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">
                      warning
                    </span>
                    Ignorar e Iniciar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-4">
          {/* Top Bar with Context Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#3a201d] pb-4">
            <div className="flex flex-wrap gap-2 text-sm items-center">
              <span className="text-primary font-bold tracking-wide uppercase text-xs">
                Contexto del Panel
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>

              {/* Embedded Selector */}
              <div className="flex items-center gap-1 group">
                <button
                  onClick={() => onRefresh && onRefresh()}
                  className="p-1.5 text-gray-400 hover:text-primary transition-colors flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a201d]"
                  title="Actualizar datos"
                >
                  <span className="material-symbols-outlined text-lg">
                    refresh
                  </span>
                </button>
                <div className="relative">
                  <select
                    value={competition.id}
                    onChange={handleCompetitionChange}
                    className="appearance-none bg-transparent border-none py-0 pl-0 pr-8 text-sm font-bold text-gray-900 dark:text-white cursor-pointer focus:ring-0 hover:text-primary transition-colors truncate max-w-[200px] sm:max-w-xs"
                  >
                    {allCompetitions.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        className="text-gray-900 dark:text-black"
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-sm text-primary pointer-events-none">
                    swap_vert
                  </span>
                </div>
              </div>

              <span className="text-gray-400">/</span>
              <span className="text-gray-500 dark:text-gray-400 font-medium">
                {competition.status === "UPCOMING"
                  ? "Registro"
                  : competition.type === "KNOCKOUT"
                    ? "Eliminatorias"
                    : isPhase2Started
                      ? "Fase 2: Grupos"
                      : "Fase 1: Sistema Suizo"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* Standings Toggle */}
              {onToggleStandings && (
                <button
                  onClick={() =>
                    onToggleStandings(
                      competition.id,
                      !competition.showStandings,
                    )
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    competition.showStandings
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                  title={
                    competition.showStandings
                      ? "Ocultar Clasificación a Jugadores"
                      : "Mostrar Clasificación a Jugadores"
                  }
                >
                  <span className="material-symbols-outlined text-sm">
                    {competition.showStandings
                      ? "visibility"
                      : "visibility_off"}
                  </span>
                  {competition.showStandings
                    ? "Clasificación Visible"
                    : "Clasificación Oculta"}
                </button>
              )}

              <button
                onClick={handleWhatsAppNotification}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors bg-green-500 text-white hover:bg-green-600 shadow-sm"
                title="Enviar notificación por WhatsApp"
              >
                <svg
                  className="w-4 h-4 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Notificar
              </button>

              {onDeleteCompetition && (
                <button
                  onClick={() => setShowDeleteCompetitionConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  title="Eliminar competición"
                >
                  <span className="material-symbols-outlined text-sm">
                    delete
                  </span>
                  Eliminar
                </button>
              )}

              <div className="flex items-center gap-2">
                <div
                  className={`size-2 rounded-full ${competition.status === "LIVE" ? "bg-green-500 animate-pulse" : competition.status === "UPCOMING" ? "bg-blue-500" : "bg-gray-400"}`}
                ></div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                  {competition.status === "LIVE"
                    ? "EN DIRECTO"
                    : competition.status === "UPCOMING"
                      ? "REGISTRO"
                      : competition.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                {competition.status === "UPCOMING" ? (
                  <>
                    Registro <span className="text-blue-500">Abierto</span>
                  </>
                ) : competition.type === "KNOCKOUT" ? (
                  <>
                    Eliminatorias <span className="text-primary">En Juego</span>
                  </>
                ) : isPhase2Started ? (
                  <>
                    Fase 2 <span className="text-primary">En Curso</span>
                  </>
                ) : (
                  <>
                    {competition.type === "KNOCKOUT"
                      ? "Cuadro de Eliminación"
                      : "Fase 1"}
                    {competition.type !== "KNOCKOUT" &&
                      phase1Status === "LIVE" &&
                      currentRound > 0 && (
                        <span className="text-xl align-middle text-gray-400 font-medium ml-2">
                          (Ronda {currentRound}/{totalRounds})
                        </span>
                      )}
                    <span className="material-symbols-outlined text-3xl text-gray-300 mx-2">
                      arrow_right_alt
                    </span>
                    Fase 2
                  </>
                )}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
                {competition.status === "UPCOMING"
                  ? "La competición está en fase de registro. Espera a que todos los equipos hagan check-in antes de comenzar."
                  : competition.type === "KNOCKOUT"
                    ? "El cuadro de eliminatorias está activo. Los resultados se actualizan en tiempo real."
                    : isPhase2Started
                      ? "La fase de grupos está activa. Los resultados de la Fase 1 siguen disponibles para consulta."
                      : phase1Status === "COMPLETED"
                        ? "Fase 1 finalizada. Revisa la clasificación final y confirma los grupos para comenzar la Fase 2."
                        : "Competición en curso. Gestiona los emparejamientos y resultados de la ronda actual antes de avanzar."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {competition.status === "UPCOMING" ? (
                <button
                  onClick={() => handleStartCompetition()}
                  disabled={competition.status !== "UPCOMING"}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg transition-all transform hover:-translate-y-0.5 ${competition.status !== "UPCOMING" ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white hover:shadow-green-500/30 font-bold"}`}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  {competition.status === "UPCOMING"
                    ? "Iniciar Competición"
                    : "Competición Iniciada"}
                </button>
              ) : (
                <>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                      phase1Status === "COMPLETED"
                        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                        : "bg-white text-gray-500 border-gray-200 dark:bg-[#1b0f0d] dark:text-gray-400 dark:border-[#3a201d]"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-sm ${phase1Status === "COMPLETED" ? "" : phase1Status === "PENDING" ? "" : "animate-spin"}`}
                    >
                      {phase1Status === "COMPLETED"
                        ? "check_circle"
                        : phase1Status === "PENDING"
                          ? "pending"
                          : "sync"}
                    </span>
                    {phase1Status === "COMPLETED"
                      ? "Fase 1 Completada"
                      : phase1Status === "PENDING"
                        ? "Fase 1 Pendiente"
                        : "Fase 1 Activa"}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                      isPhase2Started
                        ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                        : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-[#1b0f0d] dark:text-gray-600 dark:border-[#3a201d]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isPhase2Started ? "play_circle" : "pending"}
                    </span>
                    {isPhase2Started ? "Fase 2 En Vivo" : "Fase 2 Pendiente"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto pb-1 gap-2 border-b border-gray-200 dark:border-[#3a201d]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              dashboard
            </span>
            Vista General
          </button>
          <button
            onClick={() => setActiveTab("phase1")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "phase1"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              account_tree
            </span>
            {competition.type === "KNOCKOUT"
              ? "Cuadro"
              : `Fase 1: Suizo ${phase1Status === "COMPLETED" ? "(Final)" : phase1Status === "PENDING" ? "(Preparación)" : "(En Juego)"}`}
          </button>
          {competition.type !== "KNOCKOUT" && (
            <button
              onClick={() => setActiveTab("phase2")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "phase2"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                grid_view
              </span>
              Fase 2: Grupos{" "}
              {isPhase2Started && !isPhase3Started
                ? "(Activa)"
                : isPhase3Started
                  ? "(Completada)"
                  : ""}
            </button>
          )}
          {competition.type !== "KNOCKOUT" && (
            <button
              onClick={() => setActiveTab("phase3")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "phase3"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                account_tree
              </span>
              Fase 3: Cuadro Final {isPhase3Started && "(Activa)"}
            </button>
          )}
        </div>
      </motion.div>

      {/* Metrics (Only show in overview or appropriate phase) */}
      {activeTab === "overview" && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Equipos
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {competition.registeredCount}
            </p>
          </motion.div>
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border-l-4 border-primary shadow-sm border-y border-r border-gray-200 dark:border-y-[#3a201d] dark:border-r-[#3a201d] hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Estado de Fase
            </p>
            <p className="text-2xl font-bold text-primary">
              {competition.type === "KNOCKOUT"
                ? competition.status === "LIVE"
                  ? "Eliminatorias"
                  : "Preparación"
                : phase1Status === "LIVE"
                  ? currentRound > 0
                    ? `Ronda ${currentRound}`
                    : "No Iniciado"
                  : phase1Status === "PENDING"
                    ? "Registro"
                    : "Hecho"}
            </p>
          </motion.div>
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {competition.type === "KNOCKOUT" ? "Formato" : "Grupos a Crear"}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {competition.type === "KNOCKOUT"
                ? "Eliminatoria"
                : Math.ceil((competition.qualifiersCount || 16) / 4)}
            </p>
          </motion.div>
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Sistema
            </p>
            <div className="flex items-center gap-1 text-primary font-bold">
              <span className="material-symbols-outlined text-lg">schema</span>
              {competition.type === "KNOCKOUT"
                ? "Eliminatoria Directa"
                : `Suizo (${totalRounds} Rondas)`}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px] pb-24">
        {/* Left: Standings (Show if Overview or Phase 1 or Phase 2, but NOT for KNOCKOUT unless UPCOMING) */}
        {(activeTab === "overview" ||
          activeTab === "phase1" ||
          activeTab === "phase2") &&
          (competition.type !== "KNOCKOUT" ||
            competition.status === "UPCOMING") && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`flex flex-col bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm overflow-hidden h-full ${activeTab === "phase1" ? "w-full" : "flex-1"}`}
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3a201d] flex justify-between items-center bg-gray-50 dark:bg-[#251614]">
                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                  <span className="material-symbols-outlined text-primary">
                    {competition.status === "UPCOMING"
                      ? "group"
                      : "leaderboard"}
                  </span>
                  {competition.status === "UPCOMING"
                    ? "Equipos Inscritos"
                    : competition.type === "KNOCKOUT"
                      ? "Ranking del Torneo"
                      : phase1Status === "LIVE"
                        ? currentRound > 0
                          ? `Clasificación en Vivo (R${currentRound})`
                          : "Clasificación Preparada"
                        : "Clasificación Final Fase 1"}
                </h3>
                {competition.status !== "UPCOMING" && (
                  <div className="text-xs font-medium text-gray-500">
                    Ordenado por Pts &gt; Pts Adv &gt; Pts Adv Adv &gt; +- Bolas
                  </div>
                )}
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left min-w-[800px]">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-[#251614] dark:text-gray-400 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3">Equipo</th>
                      {competition.status !== "UPCOMING" && (
                        <>
                          <th
                            className="px-4 py-3 text-center"
                            title="Partidas Jugadas"
                          >
                            PJ
                          </th>
                          <th
                            className="px-4 py-3 text-center"
                            title="Partidas Ganadas"
                          >
                            PG
                          </th>
                          <th
                            className="px-4 py-3 text-center"
                            title="Partidas Perdidas"
                          >
                            PP
                          </th>
                          <th
                            className="px-4 py-3 text-center bg-gray-100 dark:bg-[#2a1a18] font-black border-x border-gray-200 dark:border-[#3a201d]"
                            title="Puntos Totales (Criterio 1)"
                          >
                            Pts
                          </th>
                          <th
                            className="px-4 py-3 text-center"
                            title="Puntos Adversarios (Criterio 2)"
                          >
                            Pts Adv
                          </th>
                          <th
                            className="px-4 py-3 text-center"
                            title="Pts Adv Adv (Criterio 3)"
                          >
                            Pts Adv Adv
                          </th>
                          <th
                            className="px-4 py-3 text-center"
                            title="+- Bolas (Criterio 4)"
                          >
                            +- Bolas
                          </th>
                        </>
                      )}
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#3a201d]">
                    {sortedTeams.map((team, idx) => {
                      const teamMatches =
                        matches?.filter(
                          (m) =>
                            (m.team1.id === team.id ||
                              m.team2.id === team.id) &&
                            m.status === "finished",
                        ) || [];

                      const played = teamMatches.length;
                      const won = teamMatches.filter((m) => {
                        if (m.team1.id === team.id)
                          return (m.score1 || 0) > (m.score2 || 0);
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
                                                transition-colors group cursor-pointer
                                                ${idx < 16 ? "border-l-4 border-l-transparent hover:border-l-primary/30 dark:hover:bg-[#2a1a18] hover:bg-gray-50" : "bg-gray-50 dark:bg-[#1a100f] opacity-60 hover:opacity-100"}
                                                ${team.id === "1" ? "bg-primary/5 dark:bg-primary/10 border-l-primary" : ""}
                                            `}
                          >
                            <td className="px-4 py-3 font-bold text-center text-gray-900 dark:text-white">
                              {team.rank}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              <div className="flex flex-col">
                                <span>{team.name}</span>
                                <span className="text-[10px] text-gray-500">
                                  {team.players.join(", ")}
                                </span>
                              </div>
                            </td>
                            {competition.status !== "UPCOMING" && (
                              <>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 font-medium">
                                  {played}
                                </td>
                                <td className="px-4 py-3 text-center text-green-600 dark:text-green-500 font-bold">
                                  {won}
                                </td>
                                <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-medium">
                                  {lost}
                                </td>
                                <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-[#2a1a18] border-x border-gray-100 dark:border-[#3a201d]">
                                  {team.pts}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                                  {team.bh}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                                  {team.fbh || 0}
                                </td>
                                <td
                                  className={`px-4 py-3 text-center font-medium ${team.diff && team.diff > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
                                >
                                  {team.diff && team.diff > 0 ? "+" : ""}
                                  {team.diff}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center">
                              {competition.status === "UPCOMING" ? (
                                <span
                                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${team.checkedIn ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}
                                >
                                  {team.checkedIn ? "Check-in OK" : "Pendiente"}
                                </span>
                              ) : activeTab === "phase2" ? (
                                team.status === "qualified" ? (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    Clasificado
                                  </span>
                                ) : team.status === "eliminated" ? (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    Eliminado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    En Juego
                                  </span>
                                )
                              ) : idx < 16 ? (
                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                                  <span className="material-symbols-outlined text-sm">
                                    check
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                  <span className="material-symbols-outlined text-sm">
                                    close
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTeam(team.id);
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Eliminar Equipo"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  delete
                                </span>
                              </button>
                            </td>
                          </motion.tr>
                          {idx === (competition.qualifiersCount || 16) - 1 && competition.status !== "UPCOMING" && (
                            <tr
                              key="cutoff"
                              className="bg-primary text-white text-xs font-bold uppercase tracking-wider"
                            >
                              <td
                                className="px-4 py-1 text-center"
                                colSpan={11}
                              >
                                Corte de Clasificación (Top {competition.qualifiersCount || 16})
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        {/* Center Actions (Only in Overview) */}
        {activeTab === "overview" && !isPhase2Started && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4 lg:w-64 shrink-0 py-0"
          >
            {/* Phase 1 Management Card */}
            <div className="bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent">
                    sports_score
                  </span>
                  Control de Partidas
                </h4>
                {phase1Status === "LIVE" && competition.status === "LIVE" && (
                  <span className="text-xs bg-accent text-gray-900 px-2 py-0.5 rounded font-bold">
                    Ronda {currentRound}
                  </span>
                )}
              </div>

              {competition.status === "UPCOMING" ? (
                <div className="p-8 flex flex-col items-center text-center gap-4">
                  <div className="size-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">
                      timer
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-gray-900 dark:text-white">
                      Esperando Inicio
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      La competición aún no ha comenzado. Utiliza el botón{" "}
                      <strong>Iniciar Competición</strong> para generar los
                      primeros emparejamientos.
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartCompetition()}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-600/20"
                  >
                    Iniciar Ahora
                  </button>
                </div>
              ) : phase1Status === "LIVE" ? (
                <div className="p-4 flex flex-col gap-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Partidas Activas:{" "}
                    <span className="font-bold text-gray-900 dark:text-white">
                      {activeMatchesCount}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      onEnterResults && onEnterResults(competition.id)
                    }
                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#2c1515] dark:hover:bg-[#3a201d] rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      edit_note
                    </span>
                    Introducir Resultados
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onPrintActs && onPrintActs(competition.id)}
                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#2c1515] dark:hover:bg-[#3a201d] rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      print
                    </span>
                    Imprimir Actas
                  </motion.button>
                  <div className="h-px bg-gray-100 dark:bg-[#3a201d] my-1"></div>
                  <div className="flex gap-2">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleNextRound}
                        className="flex-1 py-3 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                        <span className="material-symbols-outlined">
                        {competition.type === "KNOCKOUT"
                            ? "skip_next"
                            : currentRound < totalRounds
                            ? "skip_next"
                            : "flag"}
                        </span>
                        {competition.type === "KNOCKOUT"
                        ? `Generar Siguiente Ronda`
                        : currentRound < totalRounds
                            ? `Finalizar Ronda ${currentRound} y Emparejar R${currentRound + 1}`
                            : "Finalizar Fase 1"}
                    </motion.button>
                    {(competition.type === "KNOCKOUT") && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowFinalClassificationModal(true)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-4 flex items-center justify-center transition-colors shadow-md"
                            title="Clasificación Final (PDF)"
                        >
                            <span className="material-symbols-outlined">military_tech</span>
                        </motion.button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="size-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">
                      check
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">
                    Fase 1 Completada
                  </h4>
                  <p className="text-xs text-gray-500">
                    Todos los resultados validados. Ahora puedes proceder a la
                    configuración de la Fase 2.
                  </p>
                </div>
              )}
            </div>

            {/* Extra Tools */}
            <div className="flex flex-col gap-2">
              <motion.button
                whileHover={{ x: 2 }}
                onClick={handleManualPairingClick}
                className="w-full py-2 px-3 bg-white dark:bg-[#1b0f0d] border border-gray-200 dark:border-[#3a201d] hover:border-primary rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-3 transition-colors"
              >
                <span className="material-symbols-outlined">shuffle</span>
                Ajuste Manual de Emparejamientos
              </motion.button>
              <motion.button
                whileHover={{ x: 2 }}
                onClick={() =>
                  onExportStandings && onExportStandings(competition.id)
                }
                className="w-full py-2 px-3 bg-white dark:bg-[#1b0f0d] border border-gray-200 dark:border-[#3a201d] hover:border-primary rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-3 transition-colors"
              >
                <span className="material-symbols-outlined">download</span>
                Exportar Clasificación CSV
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Bracket View (Show if Phase 1 for KNOCKOUT, or if Phase 3 for STANDARD) */}
        {((activeTab === "phase1" &&
          competition.type === "KNOCKOUT" &&
          competition.status !== "UPCOMING") ||
          activeTab === "phase3") && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={`w-full h-[calc(100vh-200px)] md:h-full min-h-[500px] ${activeTab === "phase3" ? "flex-1" : ""}`}
          >
            <Bracket
              competition={competition}
              matches={matches || []}
              embedded={true}
            />
          </motion.div>
        )}

        {/* Right: Poule Preview / Matches (Show if Overview, Phase 2, or Phase 3) */}
        {(activeTab === "overview" ||
          activeTab === "phase2" ||
          activeTab === "phase3") && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={`flex flex-col bg-[#fcf8f8] dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm h-full ${activeTab === "phase2" || (competition.type === "KNOCKOUT" && competition.status !== "UPCOMING") || activeTab === "phase3" ? "w-full" : "flex-1"} ${activeTab === "phase3" ? "xl:w-1/3 xl:min-w-[400px]" : ""}`}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3a201d] flex justify-between items-center bg-gray-50 dark:bg-[#251614] rounded-t-xl">
              <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">
                  {competition.type === "KNOCKOUT" || activeTab === "phase3"
                    ? "sports_handball"
                    : "grid_view"}
                </span>
                {competition.type === "KNOCKOUT" || activeTab === "phase3"
                  ? "Partidas"
                  : isPhase2Started
                    ? "Grupos Activos"
                    : "Vista Previa de Grupos"}
              </h3>
              <div className="flex items-center gap-2">
                {!isPhase2Started &&
                  competition.type !== "KNOCKOUT" &&
                  activeTab !== "phase3" && (
                    <>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Arrastrar para Mover
                      </span>
                      <span className="material-symbols-outlined text-sm text-primary">
                        drag_indicator
                      </span>
                    </>
                  )}
                {(isPhase2Started || activeTab === "phase3") &&
                  competition.type !== "KNOCKOUT" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      En Vivo
                    </span>
                  )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {competition.type === "KNOCKOUT" || activeTab !== "phase2" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <select
                        value={selectedMatchFilter}
                        onChange={(e) => setSelectedMatchFilter(e.target.value)}
                        className="font-bold text-gray-900 dark:text-white bg-transparent border-none p-0 cursor-pointer outline-none focus:ring-0"
                    >
                        <option value="CURRENT_ROUND">Ronda Actual ({currentRound})</option>
                        <option value="ALL">Todas las rondas</option>
                        {Array.from(new Set(matches?.map(m => m.round) || [])).filter(Boolean).map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                        {(() => {
                            const scheduledMatches = currentViewMatches.filter(m => m.status === "scheduled");
                            return (
                                <>
                                    {scheduledMatches.length > 0 && onUpdateMatches && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`¿Iniciar las ${scheduledMatches.length} partidas programadas ahora?`)) {
                                                    onUpdateMatches(
                                                        scheduledMatches.map((m) => ({
                                                            ...m,
                                                            status: "live",
                                                            startTime: new Date().toISOString(),
                                                        }))
                                                    );
                                                }
                                            }}
                                            className="text-xs py-1 px-2.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors shadow-sm"
                                        >
                                            Iniciar Todas
                                        </button>
                                    )}
                                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                                        {currentViewMatches.length} Partidas
                                    </span>
                                    {(competition.type === "KNOCKOUT" || activeTab === "phase3") && matches && onUpdateMatches && (
                                        <button
                                            onClick={() => setShowAddMatchModal(true)}
                                            className="text-xs py-1 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded font-bold transition-colors shadow-sm flex items-center gap-1"
                                            title="Añadir partido manual (Ej. 3º y 4º puesto)"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                            Añadir Partido
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                  </div>
                  {currentViewMatches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No hay partidas generadas para esta ronda.</p>
                    </div>
                  ) : (
                    currentViewMatches.map((match) => (
                        <div
                          key={match.id}
                          className="bg-white dark:bg-[#221210] p-3 rounded-lg border border-gray-200 dark:border-[#3a201d] shadow-sm flex flex-col gap-2 relative"
                        >
                          <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                            <button 
                              onClick={() => {
                                const newP = prompt("Cambiar Pista:", match.court?.toString());
                                if (newP && onUpdateMatches) {
                                  onUpdateMatches([{ ...match, court: parseInt(newP) || 0 }]);
                                }
                              }}
                              className="hover:text-primary transition-colors flex flex-col items-start gap-0 group/court"
                            >
                              <div className="flex items-center gap-1">
                                <span>Pista {match.court}</span>
                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/court:opacity-100 transition-opacity">edit</span>
                              </div>
                              {match.customLabel && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 normal-case">{match.customLabel}</span>
                              )}
                            </button>
                            <MatchTimer match={match} competition={competition} />
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                {match.team1.name}
                              </p>
                            </div>
                            <div className="px-3 font-mono font-bold text-lg text-gray-400">
                              vs
                            </div>
                            <div className="flex-1 text-right">
                              <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                {match.team2.name}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center text-sm font-bold mt-1">
                            {match.status === "scheduled" && onUpdateMatches ? (
                              <button
                                onClick={() => {
                                  onUpdateMatches([
                                    {
                                      ...match,
                                      status: "live",
                                      startTime: new Date().toISOString(),
                                    },
                                  ]);
                                }}
                                className="w-full py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold transition-colors"
                              >
                                Iniciar Partida
                              </button>
                            ) : (
                              <div className="w-full flex justify-center gap-4 text-primary">
                                <span>{match.score1 ?? "-"}</span>
                                <span className="text-gray-300">|</span>
                                <span>{match.score2 ?? "-"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                  {(matches?.filter(
                    (m) =>
                      m.round ===
                      (competition.type === "KNOCKOUT" || activeTab === "phase3"
                        ? `Knockout Round ${currentRound}`
                        : `Swiss Round ${currentRound}`),
                  ).length || 0) > 0 &&
                    (competition.type === "KNOCKOUT" ||
                      activeTab === "phase3") && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-2">
                        <button
                          onClick={handleNextRound}
                          className="w-full py-2 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined">
                            skip_next
                          </span>
                          Generar Siguiente Ronda
                        </button>
                        <button
                          onClick={() => setShowFinalClassificationModal(true)}
                          className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined">
                            military_tech
                          </span>
                          Clasificación Final (PDF)
                        </button>
                      </div>
                    )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {isPhase2Started && (
                    <div className="p-4 bg-white dark:bg-[#1b0f0d] border border-gray-200 dark:border-[#3a201d] rounded-xl flex flex-col gap-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                            Gestor de Partidas Rápidas
                          </h4>
                          <p className="text-xs text-gray-500">
                            Lanza las partidas para todos los grupos. Se
                            publicarán en el MatchCenter al instante.
                          </p>
                        </div>
                        <div className="flex gap-2 self-start md:self-auto flex-wrap">
                          <button
                            onClick={() =>
                              onGenerateGroupRound?.(competition.id, 1)
                            }
                            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded hover:bg-primary-hover shadow-sm"
                          >
                            Lanzar R. Inicial
                          </button>
                          <button
                            onClick={() =>
                              onGenerateGroupRound?.(competition.id, 2)
                            }
                            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded hover:bg-primary-hover shadow-sm"
                          >
                            Lanzar W/L
                          </button>
                          <button
                            onClick={() =>
                              onGenerateGroupRound?.(competition.id, 3)
                            }
                            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded hover:bg-primary-hover shadow-sm"
                          >
                            Lanzar Repesca
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
                        <div className="flex flex-col md:flex-row gap-2 items-end">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <label className="text-xs font-bold text-gray-500 uppercase">
                                Pista Inicio
                              </label>
                              <input
                                type="number"
                                value={localCourtStart}
                                onChange={(e) =>
                                  setLocalCourtStart(
                                    parseInt(e.target.value) || "",
                                  )
                                }
                                className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-white"
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs font-bold text-gray-500 uppercase">
                                Pista Fin
                              </label>
                              <input
                                type="number"
                                value={localCourtEnd}
                                onChange={(e) =>
                                  setLocalCourtEnd(
                                    parseInt(e.target.value) || "",
                                  )
                                }
                                className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-white"
                              />
                            </div>
                            <button
                              onClick={handleSaveCourts}
                              className="px-3 py-1 self-end text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
                            >
                              Aplicar Rango
                            </button>
                          </div>
                        </div>

                        <div className="flex items-end gap-2 ml-auto">
                          <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                              Añadir Fase/Rbld
                            </label>
                            <input
                              type="number"
                              value={customRoundGen}
                              onChange={(e) =>
                                setCustomRoundGen(parseInt(e.target.value) || 4)
                              }
                              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-white"
                            />
                          </div>
                          <button
                            onClick={() =>
                              onGenerateGroupRound?.(
                                competition.id,
                                customRoundGen,
                              )
                            }
                            className="px-3 py-1.5 text-xs font-bold text-white bg-[#cb9090] rounded hover:bg-primary shadow-sm"
                            title="Puedes usar este botón para lanzar rondas personalizadas"
                          >
                            Generar Extra
                          </button>
                        </div>
                      </div>
                      {competition.type === "STANDARD" && (
                        <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "¿Seguro que quieres cerrar los Grupos y generar el Cuadro Final Eliminatorio? (Asegúrate de haber marcado el status de clasificado / eliminado en los equipos)",
                                )
                              ) {
                                onStartPhase3?.(competition.id);
                              }
                            }}
                            className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-amber-600 shadow transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined">
                              account_tree
                            </span>
                            Iniciar Fase 3: Cuadro Final
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`grid gap-4 ${activeTab === "phase2" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}
                  >
                    {groups && groups.length > 0 ? (
                      groups.map((group, i) => (
                        <motion.div
                          key={group.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className="flex flex-col"
                        >
                          {isPhase2Started ? (
                            <PouleSheet
                              group={group}
                              matches={
                                matches?.filter(
                                  (m) =>
                                    m.competitionId === competition.id &&
                                    m.id.includes(group.id),
                                ) || []
                              }
                              onUpdateMatch={(m) => onUpdateMatches?.([m])}
                            />
                          ) : (
                            <div className="flex flex-col bg-white dark:bg-[#221210] rounded-lg border border-gray-200 dark:border-[#3a201d] shadow-sm group hover:border-primary/50 transition-colors">
                              <div className="px-4 py-2 border-b border-gray-200 dark:border-[#3a201d] bg-primary/5 flex justify-between items-center">
                                <h4 className="font-bold text-primary">
                                  {group.name.replace("Group ", "Grupo ")}
                                </h4>
                                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">
                                  {group.teams.length} Equipos
                                </span>
                              </div>
                              <div className="p-2 flex flex-col gap-1">
                                {group.teams.map((team, idx) => (
                                  <div
                                    key={team.id}
                                    className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-[#2a1a18] hover:bg-gray-100 dark:hover:bg-[#35201d] border border-transparent hover:border-primary/20"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <span className="text-xs font-bold text-primary w-4">
                                        {idx + 1}
                                      </span>
                                      <span
                                        className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate"
                                        title={team.name}
                                      >
                                        {team.name}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-xs font-bold ${team.status === "qualified" ? "text-green-600" : team.status === "eliminated" ? "text-red-600" : "text-gray-400"}`}
                                    >
                                      {team.status === "qualified"
                                        ? "Q"
                                        : team.status === "eliminated"
                                          ? "E"
                                          : "-"}
                                    </span>
                                  </div>
                                ))}
                                {group.teams.length === 0 && (
                                  <span className="text-xs text-gray-400 italic p-2">
                                    Sin equipos asignados
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    ) : competition.status === "UPCOMING" ||
                      phase1Status === "PENDING" ? (
                      <div className="col-span-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-[#1b0f0d] rounded-lg border border-dashed border-gray-300 dark:border-[#3a201d]">
                        <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">
                          pending
                        </span>
                        <p className="text-gray-500 font-medium">
                          La competición aún no ha comenzado.
                        </p>
                        <p className="text-sm text-gray-400">
                          Los grupos se generarán en la Fase 2.
                        </p>
                      </div>
                    ) : (
                      ["A", "B", "C", "D"].map((group, i) => (
                        <motion.div
                          key={group}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className="flex flex-col bg-white dark:bg-[#221210] rounded-lg border border-gray-200 dark:border-[#3a201d] shadow-sm group hover:border-primary/50 transition-colors"
                        >
                          <div className="px-4 py-2 border-b border-gray-200 dark:border-[#3a201d] bg-primary/5 flex justify-between items-center">
                            <h4 className="font-bold text-primary">
                              Grupo {group}
                            </h4>
                            <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">
                              Grupo {group.charCodeAt(0) - 64}
                            </span>
                          </div>
                          <div className="p-2 flex flex-col gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-[#2a1a18] hover:bg-gray-100 dark:hover:bg-[#35201d] border border-transparent hover:border-primary/20 ${!isPhase2Started ? "cursor-move" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-primary w-4">
                                    {i + (group.charCodeAt(0) - 65) * 4}
                                  </span>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Equipo Placeholder
                                  </span>
                                </div>
                                {!isPhase2Started && (
                                  <span className="material-symbols-outlined text-gray-300 text-sm">
                                    drag_handle
                                  </span>
                                )}
                                {isPhase2Started && (
                                  <span className="text-xs font-bold text-gray-400">
                                    0-0
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {isPhase2Started && (
                            <div className="px-2 pb-2">
                              <button className="w-full py-1 text-xs font-bold text-primary bg-primary/5 rounded hover:bg-primary/10">
                                Ver Partidas
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer Action */}
      {phase1Status === "COMPLETED" && !isPhase2Started && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-[72px] md:bottom-0 right-0 left-0 md:left-64 bg-white/95 dark:bg-[#1b0f0d]/95 backdrop-blur border-t border-gray-200 dark:border-[#3a201d] px-8 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex flex-col sm:flex-row justify-between items-center gap-4 z-40"
        >
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="material-symbols-outlined text-amber-500">
              warning
            </span>
            <span>
              La Fase 1 está oficialmente cerrada. Al proceder se generarán las
              asignaciones de Grupos basadas en la clasificación.
            </span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-gray-200 dark:border-[#3a201d] text-gray-900 dark:text-white font-bold hover:bg-gray-50 dark:hover:bg-[#251614] transition-colors">
              Guardar Borrador
            </button>
            <button
              onClick={handleStartPhase2}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              <span>Confirmar e Iniciar Fase de Grupos</span>
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </button>
          </div>
        </motion.div>
      )}
      {/* Add Manual Match Modal */}
      {showAddMatchModal && competition && (
        <AddManualMatchModal
          isOpen={showAddMatchModal}
          onClose={() => setShowAddMatchModal(false)}
          teams={teams}
          competition={competition}
          currentRoundNum={currentRound}
          onAddMatch={(newMatch) => {
             if (onUpdateMatches) {
               onUpdateMatches([...(matches || []), newMatch]);
             }
          }}
        />
      )}
      
      {/* Final Classification Modal */}
      {showFinalClassificationModal && competition && (
        <FinalClassificationModal
          isOpen={showFinalClassificationModal}
          onClose={() => setShowFinalClassificationModal(false)}
          competition={competition}
          teams={teams}
          matches={matches || []}
        />
      )}

      {/* Manual Pairing Modal */}
      {isManualPairingOpen && competition && (
        <ManualPairingModal
          isOpen={isManualPairingOpen}
          onClose={() => setIsManualPairingOpen(false)}
          matches={currentRoundMatches}
          teams={teams}
          onSave={handleSavePairings}
        />
      )}

      <ConfirmModal
        isOpen={!!teamToDelete}
        title="Eliminar equipo"
        message="¿Estás seguro de que quieres eliminar este equipo? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={() => {
          if (teamToDelete && onDeleteTeam) {
            onDeleteTeam(teamToDelete);
          }
          setTeamToDelete(null);
        }}
        onCancel={() => setTeamToDelete(null)}
      />

      <ConfirmModal
        isOpen={showDeleteCompetitionConfirm}
        title="Eliminar competición"
        message="¿Estás seguro de que quieres eliminar esta competición? Esta acción no se puede deshacer y se perderán todos los datos asociados."
        confirmText="Eliminar"
        onConfirm={() => {
          if (competition && onDeleteCompetition) {
            onDeleteCompetition(competition.id);
          }
          setShowDeleteCompetitionConfirm(false);
        }}
        onCancel={() => setShowDeleteCompetitionConfirm(false)}
      />

      <ConfirmModal
        isOpen={!!whatsappMessagePreview}
        title="PDF Generado y Descargado"
        message={`El PDF con los emparejamientos se ha descargado en tu dispositivo.\n\nAhora haz clic en "Abrir WhatsApp" para enviar el siguiente mensaje al grupo del torneo y recuerda ADJUNTAR EL PDF que se acaba de descargar:\n\n────────────────\n${whatsappMessagePreview}\n────────────────`}
        confirmText="Abrir WhatsApp"
        onConfirm={confirmWhatsAppNotification}
        onCancel={() => setWhatsappMessagePreview(null)}
        isDestructive={false}
      />

      <ConfirmModal
        isOpen={!!whatsappError}
        title="Aviso"
        message={whatsappError || ""}
        confirmText="Aceptar"
        onConfirm={() => setWhatsappError(null)}
        onCancel={() => setWhatsappError(null)}
        isDestructive={false}
      />
    </div>
  );
};
