import React, { useState, useEffect } from "react";
import { Match, Competition } from "../types";

interface MatchTimerProps {
  match: Match;
  competition: Competition;
  onTimeUp?: () => void;
}

export const MatchTimer: React.FC<MatchTimerProps> = ({
  match,
  competition,
  onTimeUp,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("--:--");
  const [isTimeUp, setIsTimeUp] = useState(false);

  useEffect(() => {
    if (match.status !== "live" || !match.startTime) {
      setTimeLeft("--:--");
      setIsTimeUp(false);
      return;
    }

    // Determine limit
    let timeLimit = 60; // default 60
    if (competition.phases && competition.phases.length > 0) {
      if (match.round.startsWith("Swiss") && competition.phases[0]) {
        timeLimit = competition.phases[0].timeLimit !== undefined ? competition.phases[0].timeLimit : 60;
      } else if (match.round.startsWith("Poule") && competition.phases[1]) {
        timeLimit = competition.phases[1].timeLimit !== undefined ? competition.phases[1].timeLimit : 60;
      } else if (match.round.startsWith("Knockout") && competition.phases[2]) {
        timeLimit = competition.phases[2].timeLimit !== undefined ? competition.phases[2].timeLimit : 60;
      }
    }

    const start = new Date(match.startTime).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      if (timeLimit === 0) {
        // No time limit, show elapsed time
        const elapsed = now - start;
        const m = Math.floor(elapsed / 1000 / 60);
        const s = Math.floor((elapsed / 1000) % 60);
        setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
      } else {
        const end = start + timeLimit * 60 * 1000;
        const remaining = end - now;

        if (remaining <= 0) {
          setTimeLeft("00:00");
          setIsTimeUp(true);
          if (onTimeUp) onTimeUp();
          clearInterval(interval);
        } else {
          const m = Math.floor(remaining / 1000 / 60);
          const s = Math.floor((remaining / 1000) % 60);
          setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [match.status, match.startTime, competition.phases, onTimeUp]);

  if (match.status === "scheduled") {
    return <span className="text-gray-400 font-bold">Pendiente</span>;
  }

  if (match.status === "finished") {
    return <span className="text-gray-400 font-bold">Finalizada</span>;
  }

  return (
    <div className={`font-mono font-bold px-2 py-1 flex items-center justify-center rounded-md ${isTimeUp ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"}`}>
      <span className="material-symbols-outlined text-sm mr-1">timer</span>
      {timeLeft}
    </div>
  );
};
