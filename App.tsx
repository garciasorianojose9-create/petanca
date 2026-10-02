import React, { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Login } from "./views/Login";
import { Dashboard } from "./views/Dashboard";
import { MatchCenter } from "./views/MatchCenter";
import { Bracket } from "./views/Bracket";
import { Poules } from "./views/Poules";
import { CheckIn } from "./views/CheckIn";
import { CreateCompetition } from "./views/CreateCompetition";
import { CompetitionsList } from "./views/CompetitionsList";
import { PlayerDatabase } from "./views/PlayerDatabase";
import { AdminRegistrations } from "./views/AdminRegistrations";
import { AdminCards } from "./views/AdminCards";
import { Standings } from "./views/Standings";
import {
  AppView,
  UserRole,
  Competition,
  PlayerRegistry,
  Team,
  Match,
  Group,
  PlayerCard,
} from "./types";
import {
  generatePoules,
  generateSwissPairings,
  generateInitialPouleMatches,
  generatePouleRoundMatches,
  generateNextPouleMatches,
} from "./utils/tournamentUtils";
import {
  generateKnockoutFirstRound,
  generateNextKnockoutRound,
} from "./utils/knockoutUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocalStorage } from "./src/hooks/useLocalStorage";
import { api } from "./src/services/api";
import {
  addProfessionalHeader,
  addProfessionalFooter,
  getProfessionalTableStyles,
} from "./src/utils/pdfUtils";

function App() {
  // --- AUTH STATE ---
  const [users, setUsers] = useState<PlayerRegistry[]>([]);
  // TEMPORARY: Use useState instead of useLocalStorage to debug persistence issues
  const [currentUser, setCurrentUser] = useState<PlayerRegistry | null>(null);
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- APP STATE ---
  const [currentView, setView] = useLocalStorage<AppView>(
    "petanca_current_view",
    AppView.DASHBOARD,
  );
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>(
    "petanca_dark_mode",
    false,
  );

  // State for Competitions
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  // State for the currently active/selected competition context
  // Store ID only to prevent stale state issues
  const [selectedCompetitionId, setSelectedCompetitionId] = useLocalStorage<
    string | null
  >("petanca_selected_competition_id", null);

  const selectedCompetition =
    competitions.find((c) => c.id === selectedCompetitionId) || null;

  // State for Registered Teams
  const [registeredTeams, setRegisteredTeams] = useState<Team[]>([]);

  // State for Matches
  const [matches, setMatches] = useState<Match[]>([]);

  // State for Groups
  const [groups, setGroups] = useState<Group[]>([]);

  // Fetch initial data from API and poll
  const dataVersionRef = React.useRef<number>(-1);

  const fetchData = async (force = false) => {
    try {
      // Check version first to save bandwidth
      const { version } = await api.getDataVersion();
      if (!force && version === dataVersionRef.current) {
        return; // No changes
      }

      const data = await api.getAllData();
      if (data) {
        setUsers(data.users || []);
        setCompetitions(data.competitions || []);
        setRegisteredTeams(data.teams || []);
        setMatches(data.matches || []);
        setGroups(data.groups || []);
        dataVersionRef.current = version;
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData(true); // Force first fetch
    const interval = setInterval(() => fetchData(false), 5000); // Poll every 5 seconds, but only fetch full data if version changed
    return () => clearInterval(interval);
  }, []);

  // Fix stale admin role on mount/update
  useEffect(() => {
    if (
      currentUser &&
      currentUser.username === "admin" &&
      currentUser.role !== "ADMIN"
    ) {
      console.log("Auto-fixing admin role");
      const fixedUser = { ...currentUser, role: "ADMIN" as UserRole };
      setCurrentUser(fixedUser);
      // Also force view to dashboard if they were stuck
      setView(AppView.DASHBOARD);
    }
  }, [currentUser, setCurrentUser, setView]);

  // Apply theme on mount/change
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // --- AUTH HANDLERS ---
  const handleLogin = async (username: string, pass: string) => {
    setIsLoading(true);
    try {
      console.log("Attempting login for:", username);
      let apiResponse: any = await api.login(username, pass);
      console.log("Raw API response:", apiResponse);

      // FIX 1: Handle nested response structure ({ success: true, user: {...} })
      let user = apiResponse;
      if (apiResponse && apiResponse.user && apiResponse.token) {
        console.log("Detected wrapper object, extracting user data...");
        user = apiResponse.user;
      }

      // FIX 2: Normalize role to uppercase (admin -> ADMIN)
      if (user.role) {
        user.role = user.role.toUpperCase();
      }

      // Safety override: Ensure admin user always has ADMIN role
      if (user.username === "admin") {
        console.log("Forcing ADMIN role for user: admin");
        user.role = "ADMIN";
      }

      if (!user || Object.keys(user).length === 0) {
        console.error("Login returned empty object!");
        setLoginError("Error del servidor: Respuesta vacía.");
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);
      setLoginError("");

      // Redirect based on role
      if (user.role === "ADMIN") {
        setView(AppView.DASHBOARD);
      } else {
        setView(AppView.MATCH_CENTER);
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Credenciales incorrectas. Intente de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView(AppView.DASHBOARD); // Reset view for next login
    setLoginError("");
  };

  // --- USER MANAGEMENT HANDLERS ---
  const generateUniqueCredentials = (name: string) => {
    const baseUser =
      name.split(" ")[0].toLowerCase() +
      (name.split(" ")[1]?.substring(0, 1).toLowerCase() || "");
    let username = baseUser;
    let counter = 1;

    // Ensure uniqueness
    while (users.some((u) => u.username === username)) {
      username = `${baseUser}${counter}`;
      counter++;
    }

    // Generate random password (immutable per requirements)
    const password = Math.random().toString(36).slice(-8);

    return { username, password };
  };

  const handleAddPlayer = async (
    playerData: Omit<PlayerRegistry, "id" | "username" | "password" | "avatar">,
  ) => {
    const { username, password } = generateUniqueCredentials(playerData.name);

    const newUser: PlayerRegistry = {
      ...playerData,
      id: `usr-${Date.now()}`,
      username,
      password,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(playerData.name)}&background=random`,
    };

    try {
      const createdUser = await api.createUser(newUser);
      setUsers((prev) => [createdUser, ...prev]);
      return createdUser;
    } catch (error: any) {
      console.error("Failed to create user", error);
      alert(
        error.message ||
          "Error al crear usuario en el servidor. Verifique la conexión.",
      );
      throw error; // Throw so the UI knows it failed
    }
  };

  const handleUpdatePlayer = async (updatedPlayer: PlayerRegistry) => {
    try {
      const updated = await api.updateUser(updatedPlayer);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (error: any) {
      console.error("Failed to update user", error);
      alert(error.message || "Error al actualizar usuario.");
    }
  };

  const handleDeletePlayer = async (id: string) => {
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (error: any) {
      console.error("Failed to delete user", error);
      alert(error.message || "Error al eliminar usuario.");
    }
  };

  // --- REGISTRATION HANDLERS ---
  const handleRegisterTeam = async (competitionId: string, team: Team) => {
    try {
      const comp = competitions.find((c) => c.id === competitionId);
      if (comp && comp.registeredCount >= comp.maxTeams) {
        alert(
          "Lo sentimos, esta competición ha alcanzado el límite máximo de inscripciones.",
        );
        return;
      }

      const newTeam = await api.createTeam(team);
      setRegisteredTeams((prev) => [...prev, newTeam]);

      // Update registered count on competition
      if (comp) {
        const updatedComp = {
          ...comp,
          registeredCount: (comp.registeredCount || 0) + 1,
        };
        await api.updateCompetition(updatedComp);
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competitionId ? updatedComp : c)),
        );
      }
    } catch (error) {
      console.error("Failed to register team", error);
    }
  };

  const handleRegisterTeamsBatch = async (
    competitionId: string,
    teams: Team[],
  ) => {
    try {
      const newTeams = await api.createTeamsBatch(teams);
      setRegisteredTeams((prev) => [...prev, ...newTeams]);

      // Update registered count on competition
      const comp = competitions.find((c) => c.id === competitionId);
      if (comp) {
        const updatedComp = {
          ...comp,
          registeredCount: (comp.registeredCount || 0) + newTeams.length,
        };
        await api.updateCompetition(updatedComp);
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competitionId ? updatedComp : c)),
        );
      }
    } catch (error) {
      console.error("Failed to register teams batch", error);
      alert("Error al importar equipos.");
    }
  };

  const handleDeleteRegistration = async (teamId: string) => {
    const teamToDelete = registeredTeams.find((t) => t.id === teamId);
    if (teamToDelete && teamToDelete.competitionId) {
      try {
        await api.deleteTeam(teamId);
        setRegisteredTeams((prev) => prev.filter((t) => t.id !== teamId));

        // Decrease count
        const comp = competitions.find(
          (c) => c.id === teamToDelete.competitionId,
        );
        if (comp) {
          const updatedComp = {
            ...comp,
            registeredCount: Math.max(0, (comp.registeredCount || 0) - 1),
          };
          await api.updateCompetition(updatedComp);
          setCompetitions((prev) =>
            prev.map((c) => (c.id === updatedComp.id ? updatedComp : c)),
          );
        }
      } catch (error) {
        console.error("Failed to delete registration", error);
      }
    }
  };

  // --- THEME & VIEW HANDLERS ---
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleCreateCompetition = async (newCompetition: Competition) => {
    const compWithToken = {
      ...newCompetition,
      checkinToken: `checkin-${newCompetition.id}-${Math.random().toString(36).substring(2, 15)}`,
      currentPhase: "Registration",
      status: "UPCOMING" as const,
    };

    try {
      const createdComp = await api.createCompetition(compWithToken);
      setCompetitions((prev) => [createdComp, ...prev]);
      setView(AppView.COMPETITIONS_LIST);
    } catch (error) {
      console.error("Failed to create competition", error);
    }
  };

  const handleDeleteCompetition = async (id: string) => {
    try {
      await api.deleteCompetition(id);
      setCompetitions((prev) => prev.filter((c) => c.id !== id));
      if (selectedCompetitionId === id) {
        setSelectedCompetitionId(null);
      }
    } catch (error) {
      console.error("Failed to delete competition", error);
    }
  };

  const handleSelectCompetition = (comp: Competition) => {
    setSelectedCompetitionId(comp.id);
    // Redirect based on role
    if (currentUser?.role === "ADMIN") {
      setView(AppView.DASHBOARD);
    } else {
      setView(AppView.POULES);
    }
  };

  const handleUpdateCompetition = async (updatedComp: Competition) => {
    try {
      const result = await api.updateCompetition(updatedComp);
      setCompetitions((prev) =>
        prev.map((c) => (c.id === result.id ? result : c)),
      );
      // No need to update selectedCompetition explicitly as it is derived from ID
    } catch (error) {
      console.error("Failed to update competition", error);
    }
  };

  const handleCheckIn = async (teamId: string) => {
    console.log("Checking in team:", teamId);
    const team = registeredTeams.find((t) => t.id === teamId);
    if (team) {
      try {
        const updatedTeam = await api.updateTeam({ ...team, checkedIn: true });
        console.log("Team checked in successfully:", updatedTeam);
        setRegisteredTeams((prev) =>
          prev.map((t) => (t.id === teamId ? updatedTeam : t)),
        );
      } catch (error) {
        console.error("Failed to check in team", error);
        alert("Error al realizar el check-in.");
      }
    } else {
      console.warn("Team not found for check-in:", teamId);
    }
  };

  const handleStartCompetition = async (competitionId: string) => {
    console.log("Starting competition:", competitionId);
    const comp = competitions.find((c) => c.id === competitionId);
    if (comp) {
      if (comp.status !== "UPCOMING") {
        console.warn("Competition already started or completed:", comp.status);
        alert("La competición ya ha comenzado.");
        return;
      }

      // Reset team statuses to 'playing' to clean up any 'qualified' markers remaining from manual tests or old defaults
      const resetTeams = registeredTeams.map(t => {
          if (t.competitionId === competitionId) {
              return { ...t, status: 'playing' as const, pts: 0, diff: 0, bh: 0, fbh: 0 };
          }
          return t;
      });
      setRegisteredTeams(resetTeams);
      await api.updateTeamsBatch(resetTeams.filter(t => t.competitionId === competitionId));

      const compTeams = resetTeams.filter(
        (t) => t.competitionId === competitionId,
      );
      if (compTeams.length < 2) {
        alert("Necesitas al menos 2 equipos para comenzar la competición.");
        return;
      }

      const initialPhase =
        comp.type === "KNOCKOUT" ? "Knockout Round 1" : "Swiss Round 1";
      const updatedComp: Competition = {
        ...comp,
        status: "LIVE",
        currentPhase: initialPhase,
      };

      try {
        console.log("Updating competition status to LIVE...");
        await api.updateCompetition(updatedComp);
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competitionId ? updatedComp : c)),
        );

        // Generate Round 1 - Pass the updated competition explicitly to avoid stale state issues
        console.log("Triggering round generation...");
        await handleGenerateRound(competitionId, updatedComp);
      } catch (error) {
        console.error("Failed to start competition", error);
        alert("Error al iniciar la competición.");
      }
    }
  };

  const handleGenerateRound = async (
    competitionId: string,
    compOverride?: Competition,
  ) => {
    console.log("Generating round for competition:", competitionId);
    const comp =
      compOverride || competitions.find((c) => c.id === competitionId);
    if (!comp) {
      console.error(
        "Competition not found for round generation:",
        competitionId,
      );
      return;
    }

    console.log("Competition state for pairings:", {
      type: comp.type,
      phase: comp.currentPhase,
      status: comp.status,
    });

    const compMatches = matches.filter(
      (m) => m.competitionId === competitionId,
    );
    const compTeams = registeredTeams.filter(
      (t) => t.competitionId === competitionId,
    );

    console.log(
      `Found ${compTeams.length} teams and ${compMatches.length} existing matches.`,
    );

    let availableCourts: number[] = [];
    const numMatches = Math.floor(compTeams.length / 2);
    if (
      typeof comp.courtStart === "number" &&
      typeof comp.courtEnd === "number" &&
      comp.courtEnd >= comp.courtStart
    ) {
      availableCourts = Array.from(
        { length: comp.courtEnd - comp.courtStart + 1 },
        (_, i) => comp.courtStart! + i,
      );
    } else {
      availableCourts = Array.from({ length: numMatches }, (_, i) => i + 1);
    }

    let newPairings: Match[] = [];
    let nextPhaseName = "";

    if (
      comp.type === "KNOCKOUT" ||
      (comp.type === "STANDARD" && comp.currentPhase?.includes("Knockout"))
    ) {
      const koMatches = compMatches.filter((m) =>
        m.round.startsWith("Knockout Round"),
      );
      if (koMatches.length === 0) {
        // First round
        let teamsToUse = compTeams;
        if (comp.type === "STANDARD") {
          teamsToUse = compTeams.filter(t => t.status === "qualified");
          if (teamsToUse.length === 0) {
             alert(
                "No hay equipos clasificados para la Fase Final. Finaliza los grupos primero (Clasifica a los equipos en el cuadro General o en los Grupos)."
             );
             return;
          }
        }
        newPairings = generateKnockoutFirstRound(
          teamsToUse,
          competitionId,
          availableCourts,
        );
        nextPhaseName = "Knockout Round 1";
      } else {
        // Next round
        newPairings = generateNextKnockoutRound(
          comp,
          compMatches,
          availableCourts,
        );
        if (newPairings.length > 0) {
          nextPhaseName = newPairings[0].round;
        }
      }
    } else {
      // Standard Swiss
      const swissMatches = compMatches.filter((m) =>
        m.round.startsWith("Swiss Round"),
      );
      const rounds = new Set(swissMatches.map((m) => m.round));
      const nextRoundNum = rounds.size + 1;

      const limitRounds = comp.totalRounds || 4;
      if (nextRoundNum > limitRounds) {
        alert("Max rounds reached for this format");
        return;
      }

      newPairings = generateSwissPairings(
        compTeams,
        compMatches,
        nextRoundNum,
        availableCourts,
      );
      nextPhaseName = `Swiss Round ${nextRoundNum}`;
    }

    if (newPairings.length === 0) {
      if (compTeams.length < 2) {
        alert("Necesitas al menos 2 equipos para comenzar.");
        return;
      }
      console.warn("No pairings generated");
      return;
    }

    try {
      await api.updateMatches(newPairings);
      setMatches((prev) => [...prev, ...newPairings]);

      const updatedComp = { ...comp, currentPhase: nextPhaseName };
      await api.updateCompetition(updatedComp);
      setCompetitions((prev) =>
        prev.map((c) => (c.id === competitionId ? updatedComp : c)),
      );
    } catch (error) {
      console.error("Failed to generate round", error);
    }
  };

  const handleUpdateMatches = async (updatedMatchesInput: Match[]) => {
    try {
      await api.updateMatches(updatedMatchesInput);
      let newMatches = [...matches];
      let newTeams = [...registeredTeams];

      updatedMatchesInput.forEach((um) => {
        const idx = newMatches.findIndex((m) => m.id === um.id);
        if (idx !== -1) {
          newMatches[idx] = um;
        }
      });
      setMatches(newMatches);

      // Extract unique competition IDs from finished matches
      const compIdsToRecalculate = new Set<string>();
      updatedMatchesInput.forEach(um => {
          if (um.status === 'finished' && um.competitionId) {
             compIdsToRecalculate.add(um.competitionId);
          }
      });

      compIdsToRecalculate.forEach(compId => {
          newTeams = recalculateStandings(compId, newMatches, newTeams);
      });

      if (compIdsToRecalculate.size > 0) {
          setRegisteredTeams(newTeams);
          const changedPropsTeams = newTeams.filter(t => t.competitionId && compIdsToRecalculate.has(t.competitionId));
          if (changedPropsTeams.length > 0) {
              api.updateTeamsBatch(changedPropsTeams).catch(e => console.error(e));
          }
      }
    } catch (error) {
      console.error("Failed to update matches", error);
    }
  };

  const handleGenerateManualRepesca = async (
    competitionId: string,
    teamIds: string[],
  ) => {
    const comp = competitions.find((c) => c.id === competitionId);
    if (!comp) return;

    const compTeams = registeredTeams.filter((t) => teamIds.includes(t.id));
    const numCourts = Math.floor(compTeams.length / 2);
    const availableCourts = Array.from({ length: numCourts }, (_, i) => i + 1);

    const newPairings = generateKnockoutFirstRound(
      compTeams,
      competitionId,
      availableCourts,
      "REPESCA",
    );

    if (newPairings.length > 0) {
      try {
        await api.updateMatches(newPairings);
        setMatches((prev) => [...prev, ...newPairings]);
      } catch (error) {
        console.error("Failed to generate manual repesca", error);
      }
    }
  };

  const handleIssueCard = async (card: PlayerCard) => {
    try {
      const comp = competitions.find((c) => c.id === card.competitionId);
      if (comp) {
        const updatedCards = [...(comp.cards || []), card];
        const updatedComp = { ...comp, cards: updatedCards };
        await api.updateCompetition(updatedComp);
        setCompetitions((prev) =>
          prev.map((c) => (c.id === comp.id ? updatedComp : c)),
        );
      }
    } catch (error) {
      console.error("Failed to issue card", error);
    }
  };

  const recalculateStandings = (compId: string, currentMatches: Match[], currentTeams: Team[]): Team[] => {
      const compTeams = currentTeams.filter((t) => t.competitionId === compId);
      const phase1Matches = currentMatches.filter(
        (m) => m.competitionId === compId && m.status === "finished" && m.round.startsWith("Swiss"),
      );

      // Reset stats
      const teamStats = new Map<
        string,
        {
          pts: number;
          diff: number;
          bh: number;
          fbh: number;
          opponents: Set<string>;
          opponentsPts: number[];
        }
      >();
      compTeams.forEach((t) => {
        teamStats.set(t.id, { pts: 0, diff: 0, bh: 0, fbh: 0, opponents: new Set(), opponentsPts: [] });
      });

      // Calculate Pts and Diff
      phase1Matches.forEach((m) => {
        const stats1 = teamStats.get(m.team1.id);
        const stats2 = teamStats.get(m.team2.id);

        if (stats1 && stats2 && m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined) {
          stats1.diff += m.score1 - m.score2;
          stats2.diff += m.score2 - m.score1;

          if (m.score1 > m.score2) {
            stats1.pts += 1;
          } else if (m.score2 > m.score1) {
            stats2.pts += 1;
          } else {
            stats1.pts += 0.5;
            stats2.pts += 0.5;
          }
          stats1.opponents.add(m.team2.id);
          stats2.opponents.add(m.team1.id);
        }
      });

      // Calculate BH
      teamStats.forEach((stats, teamId) => {
        stats.opponents.forEach((oppId) => {
          const oppStats = teamStats.get(oppId);
          if (oppStats) {
            stats.bh += oppStats.pts;
            stats.opponentsPts.push(oppStats.pts);
          }
        });
      });

      // Calculate fBH
      teamStats.forEach((stats, teamId) => {
        stats.opponents.forEach((oppId) => {
          const oppStats = teamStats.get(oppId);
          if (oppStats) {
            stats.fbh += oppStats.bh;
          }
        });
      });

      // Apply updates to teams
      return currentTeams.map((t) => {
        if (t.competitionId === compId) {
          const stats = teamStats.get(t.id);
          if (stats) {
            return {
              ...t,
              pts: stats.pts,
              diff: stats.diff,
              bh: stats.bh,
              fbh: stats.fbh,
            };
          }
        }
        return t;
      });
  };

  const handleUpdateMatch = async (
    matchId: string,
    updates: Partial<Match>,
  ) => {
    try {
      // 1. Update the match locally and in API
      const updatedMatches = matches.map((m) => {
        if (m.id === matchId) {
          return { ...m, ...updates };
        }
        return m;
      });
      setMatches(updatedMatches);

      const matchToUpdate = updatedMatches.find((m) => m.id === matchId);
      if (matchToUpdate) {
        await api.updateMatches([matchToUpdate]);
      }

      // 2. Recalculate Standings for the competition (only if finished)
      if (updates.status !== "finished") return;

      const compId = matchToUpdate?.competitionId;
      if (!compId) return;

      const updatedTeams = recalculateStandings(compId, updatedMatches, registeredTeams);

      setRegisteredTeams(updatedTeams);
      const changedPropsTeams = updatedTeams.filter(t => t.competitionId === compId);
      if (changedPropsTeams.length > 0) {
          api.updateTeamsBatch(changedPropsTeams).catch(e => console.error(e));
      }

      // 3. Check for Poule Progression
      if (matchToUpdate && matchToUpdate.round.startsWith("Poule")) {
        // Find the group this match belongs to
        const group = groups.find(
          (g) =>
            g.competitionId === compId &&
            g.teams.some((t) => t.id === matchToUpdate.team1.id),
        );

        if (group) {
          const groupMatches = updatedMatches.filter(
            (m) =>
              m.competitionId === compId &&
              m.id.startsWith(`match-${group.id}`),
          );

          // Update Team Status for Poules
          // If all matches of the group are finished, we determine qualification based on rankings.
          const allGroupMatchesFinished = groupMatches.every(m => m.status === 'finished');
          
          const updatedGroupTeams = group.teams.map((t) => {
            const teamMatches = groupMatches.filter(
              (m) =>
                m.status === "finished" &&
                (m.team1.id === t.id || m.team2.id === t.id),
            );
            const wins = teamMatches.filter((m) => {
              if (m.team1.id === t.id) return (m.score1 || 0) > (m.score2 || 0);
              return (m.score2 || 0) > (m.score1 || 0);
            }).length;
            const losses = teamMatches.length - wins;

            let newStatus = t.status;
            // GSL/Poules qualification logic:
            // In a group of 4, usually 2 advancing.
            // If we use the GSL style (m1, m2, winners, losers, repechage):
            // Winners of Winners match -> Qualified
            // Winners of Repechage match -> Qualified
            // Losers of Losers match -> Eliminated
            // Loser of Repechage match -> Eliminated
            
            // Quick heuristic: if you have 2 wins, you are definitely qualified in GSL or Round Robin of 4.
            if (wins >= 2) newStatus = "qualified";
            else if (losses >= 2) newStatus = "eliminated";
            else newStatus = "playing";

            return { ...t, status: newStatus, pts: wins };
          });

          // Update Groups local and API state
          const updatedGroups = groups.map(g => g.id === group.id ? { ...g, teams: updatedGroupTeams } : g);
          setGroups(updatedGroups);
          api.updateGroups(updatedGroups).catch(err => console.error("Failed to update Groups:", err));

          // Sync back to Registered Teams state
          const changedPropsTeams: Team[] = [];
          setRegisteredTeams((prev) =>
            prev.map((t) => {
              const updated = updatedGroupTeams.find((ut) => ut.id === t.id);
              if (updated && updated.status !== t.status) {
                  const newT = { ...t, status: updated.status };
                  changedPropsTeams.push(newT);
                  return newT;
              }
              return t;
            }),
          );
          if (changedPropsTeams.length > 0) {
              api.updateTeamsBatch(changedPropsTeams).catch(e => console.error(e));
          }
        }
      }
    } catch (error) {
      console.error("Failed to update match results", error);
    }
  };

  const handleStartPhase2 = async (competitionId: string) => {
    // 1. Get teams for this competition
    const compTeams = registeredTeams.filter(
      (t) => t.competitionId === competitionId,
    );
    const comp = competitions.find((c) => c.id === competitionId);

    // 2. Generate Poules using config
    const newGroups = generatePoules(
      compTeams,
      competitionId,
      comp?.qualifiersCount || 16,
    );

    // Get the IDs of the teams that actually made it into the Poules
    const pouleTeamIds = new Set<string>();
    newGroups.forEach(g => g.teams.forEach(t => pouleTeamIds.add(t.id)));

    // Sync registeredTeams globally: set Poule teams to 'playing' and others to 'eliminated'
    setRegisteredTeams(prev => prev.map(t => {
      if (t.competitionId === competitionId) {
        if (pouleTeamIds.has(t.id)) {
           return { ...t, status: 'playing', pts: 0, diff: 0, bh: 0, fbh: 0 };
        } else {
           return { ...t, status: 'eliminated' };
        }
      }
      return t;
    }));

    // 3. Update Groups State (append new groups, removing old ones for this comp if any)
    const updatedGroups = [
      ...groups.filter((g) => g.competitionId !== competitionId),
      ...newGroups,
    ];

    try {
      await api.updateGroups(updatedGroups);
      setGroups(updatedGroups);

      let availableCourts: number[] = [];
      if (
        comp &&
        typeof comp.courtStart === "number" &&
        typeof comp.courtEnd === "number" &&
        comp.courtEnd >= comp.courtStart
      ) {
        availableCourts = Array.from(
          { length: comp.courtEnd - comp.courtStart + 1 },
          (_, i) => comp.courtStart! + i,
        );
      } else {
        availableCourts = Array.from({ length: 64 }, (_, i) => i + 1);
      }
      const scheduledR1 = generatePouleRoundMatches(
        newGroups,
        [],
        1,
        availableCourts,
        "scheduled",
      );
      if (scheduledR1.length > 0) {
        await api.updateMatches(scheduledR1);
        setMatches((prev) => [...prev, ...scheduledR1]);
      }

      // 4. Update Competition Phase
      if (comp) {
        const updatedComp = { ...comp, currentPhase: "Grupos" };
        await api.updateCompetition(updatedComp);
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competitionId ? updatedComp : c)),
        );
      }
    } catch (error) {
      console.error("Failed to start Phase 2", error);
    }
  };

  const handleStartPhase3 = async (competitionId: string) => {
    const comp = competitions.find((c) => c.id === competitionId);
    if (!comp) return;

    let compTeams = registeredTeams.filter(
      (t) => t.competitionId === competitionId,
    );
    
    // Check for teams that are already marked as 'qualified'
    let qualifiedTeams = compTeams.filter((t) => t.status === "qualified");

    // FALLBACK: If we are in Phase 2 (Groups) and NO ONE is marked qualified, 
    // we take the top 2 from each group automatically to avoid blocking the tournament.
    if (qualifiedTeams.length === 0 && comp.currentPhase === "Grupos") {
        const compGroups = groups.filter(g => g.competitionId === competitionId);
        const autoQuals: Team[] = [];
        
        compGroups.forEach(g => {
            const sorted = [...g.teams].sort((a, b) => (b.pts || 0) - (a.pts || 0));
            // Top 2 qualify
            autoQuals.push(...sorted.slice(0, 2).map(t => ({ ...t, status: 'qualified' as const })));
        });

        if (autoQuals.length > 0) {
            qualifiedTeams = autoQuals;
            const newRegistered = registeredTeams.map(rt => {
                const q = autoQuals.find(aq => aq.id === rt.id);
                if (q) return q;
                // If not qualified and it was in groups, it's eliminated
                if (rt.competitionId === competitionId && compGroups.some(g => g.teams.some(gt => gt.id === rt.id))) {
                    return { ...rt, status: 'eliminated' as const };
                }
                return rt;
            });
            setRegisteredTeams(newRegistered);
            await api.updateTeamsBatch(newRegistered.filter(t => t.competitionId === competitionId));
        }
    }

    if (qualifiedTeams.length === 0) {
      alert(
        "No hay equipos clasificados para la Fase Final. Finaliza los grupos primero (Clasifica a los equipos en el cuadro General o en los Grupos).",
      );
      return;
    }

    let availableCourts: number[] = [];
    if (
      typeof comp.courtStart === "number" &&
      typeof comp.courtEnd === "number" &&
      comp.courtEnd >= comp.courtStart
    ) {
      availableCourts = Array.from(
        { length: comp.courtEnd - comp.courtStart + 1 },
        (_, i) => comp.courtStart! + i,
      );
    } else {
      availableCourts = Array.from({ length: 64 }, (_, i) => i + 1);
    }

    const newPairings = generateKnockoutFirstRound(
      qualifiedTeams,
      competitionId,
      availableCourts,
      "DIRECTA",
    );

    try {
      await api.updateCompetition({
        ...comp,
        currentPhase: "Knockout Round 1",
        status: "LIVE",
      });
      if (newPairings.length > 0) {
        await api.updateMatches(newPairings);
        setMatches((prev) => [...prev, ...newPairings]);
      }
      setCompetitions((prev) =>
        prev.map((c) =>
          c.id === competitionId
            ? { ...c, currentPhase: "Knockout Round 1", status: "LIVE" }
            : c,
        ),
      );
    } catch (err) {
      console.error("Failed to start Phase 3", err);
    }
  };

  const handleGenerateGroupRound = async (
    competitionId: string,
    round: number,
  ) => {
    const compGroups = groups.filter((g) => g.competitionId === competitionId);
    const comp = competitions.find((c) => c.id === competitionId);

    if (round === 1) {
      const scheduledMatches = matches.filter(
        (m) =>
          m.competitionId === competitionId &&
          m.round === "Poule Round 1" &&
          m.status === "scheduled",
      );
      if (scheduledMatches.length > 0) {
        const matchesToLive = scheduledMatches.map((m) => ({
          ...m,
          status: "live" as const,
        }));
        try {
          await api.updateMatches(matchesToLive);
          setMatches((prev) =>
            prev.map((m) => {
              const updated = matchesToLive.find((l) => l.id === m.id);
              return updated ? updated : m;
            }),
          );
        } catch (err) {
          console.error(err);
        }
        return;
      }
    }

    let availableCourts: number[] = [];
    if (
      comp &&
      typeof comp.courtStart === "number" &&
      typeof comp.courtEnd === "number" &&
      comp.courtEnd >= comp.courtStart
    ) {
      availableCourts = Array.from(
        { length: comp.courtEnd - comp.courtStart + 1 },
        (_, i) => comp.courtStart! + i,
      );
    } else {
      availableCourts = Array.from({ length: 64 }, (_, i) => i + 1);
    }

    // Generate round robin matches dynamically
    const newMatches = generatePouleRoundMatches(
      compGroups,
      matches,
      round,
      availableCourts,
    );

    if (newMatches.length > 0) {
      try {
        await api.updateMatches(newMatches);
        setMatches((prev) => [...prev, ...newMatches]);
      } catch (err) {
        console.error("Failed to save new group matches", err);
      }
    }
  };

  const handleToggleStandings = async (
    competitionId: string,
    show: boolean,
  ) => {
    const comp = competitions.find((c) => c.id === competitionId);
    if (comp) {
      const updatedComp = { ...comp, showStandings: show };
      // Optimistic update
      setCompetitions((prev) =>
        prev.map((c) => (c.id === competitionId ? updatedComp : c)),
      );
      try {
        await api.updateCompetition(updatedComp);
      } catch (error) {
        console.error("Failed to update standings visibility", error);
        // Revert on error
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competitionId ? comp : c)),
        );
      }
    }
  };

  const handlePrintActs = (competitionId: string) => {
    const comp = competitions.find((c) => c.id === competitionId);
    if (!comp) return;

    const currentRoundMatches = matches.filter(
      (m) => m.competitionId === competitionId && m.status === "live",
    );

    if (currentRoundMatches.length === 0) {
      alert("No hay partidas activas para imprimir.");
      return;
    }

    const doc = new jsPDF();
    addProfessionalHeader(
      doc,
      comp.name,
      `Actas - Ronda ${comp.currentPhase || "Fase Actual"}`,
    );

    autoTable(doc, {
      ...getProfessionalTableStyles(),
      startY: 50,
      head: [["Pista", "Equipo 1", "Equipo 2", "Resultado"]],
      body: currentRoundMatches.map((m) => [
        `Pista ${m.court}`,
        m.team1.name,
        m.team2.name,
        "       -       ",
      ]),
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 },
        3: { cellWidth: 30, halign: "center" },
      },
    });

    addProfessionalFooter(doc, "Actas de Partidas");
    doc.save(`Actas_${comp.name.replace(/\s+/g, "_")}.pdf`);
  };

  const handleExportStandings = (competitionId: string) => {
    const comp = competitions.find((c) => c.id === competitionId);
    if (!comp) return;

    const compTeams = registeredTeams.filter(
      (t) => t.competitionId === competitionId,
    );
    const sortedTeams = [...compTeams].sort((a, b) => {
      if ((b.pts || 0) !== (a.pts || 0)) return (b.pts || 0) - (a.pts || 0);
      if ((b.bh || 0) !== (a.bh || 0)) return (b.bh || 0) - (a.bh || 0);
      if ((b.fbh || 0) !== (a.fbh || 0)) return (b.fbh || 0) - (a.fbh || 0);
      return (b.diff || 0) - (a.diff || 0);
    });

    const doc = new jsPDF();
    addProfessionalHeader(doc, comp.name, "Clasificación General");

    autoTable(doc, {
      ...getProfessionalTableStyles(),
      startY: 50,
      head: [["Pos", "Equipo", "Pts", "SI", "fSI", "Dif"]],
      body: sortedTeams.map((t, i) => [
        i + 1,
        t.name,
        t.pts || 0,
        t.bh || 0,
        t.fbh || 0,
        t.diff || 0,
      ]),
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 15, halign: "center" },
        1: { cellWidth: 80, halign: "left" },
        2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 20, halign: "center" },
      },
    });

    addProfessionalFooter(doc, "Clasificación General");
    doc.save(`Clasificacion_${comp.name.replace(/\s+/g, "_")}.pdf`);
  };

  const handleManualPairing = (competitionId: string) => {
    alert(
      "Funcionalidad de ajuste manual en desarrollo. Por favor, utilice la generación automática por ahora.",
    );
  };

  const handleEnterResults = (competitionId: string) => {
    setView(AppView.MATCH_CENTER);
  };

  const handleWhatsAppShare = (message: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // --- RENDER LOGIC ---

  if (
    !currentUser ||
    Object.keys(currentUser).length === 0 ||
    !currentUser.username
  ) {
    if (currentUser && Object.keys(currentUser).length === 0) {
      console.warn("Detected empty currentUser object, forcing logout");
      setCurrentUser(null);
    }
    return (
      <Login onLogin={handleLogin} error={loginError} isLoading={isLoading} />
    );
  }

  // Force effective role for rendering logic
  const effectiveRole =
    currentUser.username === "admin" ? "ADMIN" : currentUser.role;

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return effectiveRole === "ADMIN" ? (
          <Dashboard
            competition={selectedCompetition}
            allCompetitions={competitions}
            teams={registeredTeams.filter(
              (t) => t.competitionId === selectedCompetition?.id,
            )}
            matches={matches.filter(
              (m) => m.competitionId === selectedCompetition?.id,
            )}
            players={users}
            onSelectCompetition={handleSelectCompetition}
            onStartPhase2={handleStartPhase2}
            onStartPhase3={handleStartPhase3}
            onGenerateGroupRound={handleGenerateGroupRound}
            onStartCompetition={handleStartCompetition}
            onDeleteTeam={handleDeleteRegistration}
            onGenerateRound={handleGenerateRound}
            onToggleStandings={handleToggleStandings}
            onPrintActs={handlePrintActs}
            onExportStandings={handleExportStandings}
            onManualPairing={handleManualPairing}
            onEnterResults={handleEnterResults}
            onUpdateMatches={handleUpdateMatches}
            groups={groups.filter(
              (g) => g.competitionId === selectedCompetition?.id,
            )}
            onCreateNew={() => setView(AppView.CREATE_COMPETITION)}
            onDeleteCompetition={handleDeleteCompetition}
            onRefresh={fetchData}
          />
        ) : (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            selectedCompetition={selectedCompetition}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
          />
        );
      case AppView.STANDINGS:
        return (
          <Standings
            competition={selectedCompetition}
            teams={registeredTeams.filter(
              (t) => t.competitionId === selectedCompetition?.id,
            )}
            matches={matches.filter(
              (m) => m.competitionId === selectedCompetition?.id && m.round.startsWith("Swiss"),
            )}
          />
        );
      case AppView.COMPETITIONS_LIST:
        return (
          <CompetitionsList
            competitions={competitions}
            onSelect={handleSelectCompetition}
            currentUser={currentUser}
            teams={registeredTeams}
            onCreateNew={() => setView(AppView.CREATE_COMPETITION)}
            onDelete={handleDeleteCompetition}
          />
        );
      case AppView.MATCH_CENTER:
        return (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            selectedCompetition={selectedCompetition}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
            onWhatsAppShare={handleWhatsAppShare}
          />
        );
      case AppView.BRACKET:
        return (
          <Bracket
            competition={selectedCompetition}
            matches={matches.filter(
              (m) => m.competitionId === selectedCompetition?.id,
            )}
            currentUser={currentUser}
            onGenerateManualRepesca={(teamIds) =>
              selectedCompetition &&
              handleGenerateManualRepesca(selectedCompetition.id, teamIds)
            }
          />
        );
      case AppView.POULES:
        return (
          <Poules
            competition={selectedCompetition}
            groups={groups.filter(
              (g) => g.competitionId === selectedCompetition?.id,
            )}
            currentUser={currentUser}
            matches={matches.filter(
              (m) => m.competitionId === selectedCompetition?.id,
            )}
          />
        );
      case AppView.CHECK_IN:
        return (
          <CheckIn
            competition={selectedCompetition}
            currentUser={currentUser}
            teams={registeredTeams.filter(
              (t) => t.competitionId === selectedCompetition?.id,
            )}
            players={users}
            onUpdateCompetition={handleUpdateCompetition}
            onCheckIn={handleCheckIn}
          />
        );
      case AppView.CREATE_COMPETITION:
        return effectiveRole === "ADMIN" ? (
          <CreateCompetition onCreate={handleCreateCompetition} />
        ) : (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
          />
        );
      case AppView.PLAYER_DATABASE:
        return effectiveRole === "ADMIN" ? (
          <PlayerDatabase
            players={users}
            competitions={competitions}
            onAddPlayer={handleAddPlayer}
            onUpdatePlayer={handleUpdatePlayer}
            onDeletePlayer={handleDeletePlayer}
          />
        ) : (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
          />
        );
      case AppView.REGISTRATIONS:
        return effectiveRole === "ADMIN" ||
          (effectiveRole === "CLUB_ADMIN" &&
            currentUser.canRegisterClubMembers) ? (
          <AdminRegistrations
            competitions={competitions}
            players={users} // Using users as the player pool (excluding admins ideally, but handling inside)
            registeredTeams={registeredTeams}
            currentUser={currentUser}
            onRegister={handleRegisterTeam}
            onRegisterBatch={handleRegisterTeamsBatch}
            onDeleteRegistration={handleDeleteRegistration}
          />
        ) : (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
          />
        );
      case AppView.ADMIN_CARDS:
        return effectiveRole === "ADMIN" ? (
          <AdminCards
            competitions={competitions}
            players={users}
            teams={registeredTeams}
            matches={matches}
          />
        ) : (
          <MatchCenter
            currentUser={currentUser}
            competitions={competitions}
            matches={matches}
            players={users}
            onUpdateMatch={handleUpdateMatch}
            onIssueCard={handleIssueCard}
          />
        );
      default:
        return (
          <Dashboard
            competition={selectedCompetition}
            allCompetitions={competitions}
            teams={registeredTeams.filter(
              (t) => t.competitionId === selectedCompetition?.id,
            )}
            matches={matches.filter(
              (m) => m.competitionId === selectedCompetition?.id,
            )}
            players={users}
            onSelectCompetition={handleSelectCompetition}
            onDeleteCompetition={handleDeleteCompetition}
          />
        );
    }
  };

  return (
    <Layout
      currentView={currentView}
      setView={setView}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
      currentUser={{ ...currentUser, role: effectiveRole }} // Pass effective role to layout
      onLogout={handleLogout}
      onUpdateUser={setCurrentUser}
      selectedCompetition={selectedCompetition}
      matches={matches}
    >
      {renderView()}

      {/* Emergency Reset Button (Only visible if something is likely wrong) */}
      {currentUser.username === "admin" &&
        effectiveRole !== currentUser.role && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white p-4 rounded-lg shadow-xl flex flex-col gap-2">
            <p className="text-xs font-bold">Role Mismatch Detected</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold uppercase"
            >
              Hard Reset App
            </button>
          </div>
        )}
    </Layout>
  );
}

export default App;
