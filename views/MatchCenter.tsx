
import React, { useState, useEffect, useMemo } from 'react';
import { PlayerRegistry, Match, Competition, PlayerCard, CardColor, CardScope, Team } from '../types';

interface MatchCenterProps {
    currentUser?: PlayerRegistry | null;
    competitions: Competition[];
    matches: Match[];
    selectedCompetition?: Competition | null;
    players?: PlayerRegistry[];
    onUpdateMatch?: (matchId: string, updates: Partial<Match>) => void;
    onIssueCard?: (card: PlayerCard) => void;
    onWhatsAppShare?: (message: string) => void;
}

type MatchStep = 'alert' | 'scoring' | 'validation';

export const MatchCenter: React.FC<MatchCenterProps> = ({ currentUser, competitions, matches, selectedCompetition, players, onUpdateMatch, onIssueCard, onWhatsAppShare }) => {
    const [step, setStep] = useState<MatchStep>('alert');
    const [myScore, setMyScore] = useState<string>('');
    const [oppScore, setOppScore] = useState<string>('');
    
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [selectedPlayerForCard, setSelectedPlayerForCard] = useState<{name: string, teamId: string} | null>(null);
    const [cardColor, setCardColor] = useState<CardColor>('YELLOW');
    const [cardScope, setCardScope] = useState<CardScope>('MATCH');
    const [cardReason, setCardReason] = useState('');

    const isAdminOrReferee = currentUser?.role === 'ADMIN' || currentUser?.role === 'REFEREE';

    // Admin specific state: Which match are they supervising?
    const [adminSelectedMatch, setAdminSelectedMatch] = useState<Match | null>(null);

    // Filter matches by selected competition if available
    const relevantMatches = selectedCompetition 
        ? matches.filter(m => m.competitionId === selectedCompetition.id)
        : matches;

    // Verify if there are any competitions in the system
    const hasCompetitions = competitions && competitions.length > 0;

    // For Player: Find the most relevant match for the current user
    const userMatches = useMemo(() => {
        if (!hasCompetitions || !currentUser || isAdminOrReferee) return [];
        return relevantMatches.filter(m => 
            m.team1.players.some(p => p.toLowerCase() === currentUser.name.toLowerCase()) || 
            m.team2.players.some(p => p.toLowerCase() === currentUser.name.toLowerCase())
        );
    }, [relevantMatches, currentUser, hasCompetitions, isAdminOrReferee]);

    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    const sortedUserMatches = useMemo(() => {
        if (!userMatches.length) return [];
        
        return [...userMatches].sort((a, b) => {
            const statusWeight = {
                'live': 4,
                'scheduled': 3,
                'pending_validation': 2,
                'finished': 1
            };
            
            const weightA = statusWeight[a.status as keyof typeof statusWeight] || 0;
            const weightB = statusWeight[b.status as keyof typeof statusWeight] || 0;
            
            if (weightA !== weightB) return weightB - weightA;
            
            // Secondary sort: Reverse chronological (latest based on ID or string comparison of round)
            return b.id.localeCompare(a.id); 
        });
    }, [userMatches]);

    const userMatch = (sortedUserMatches.length > 0 && currentMatchIndex < sortedUserMatches.length) 
        ? sortedUserMatches[currentMatchIndex] 
        : (sortedUserMatches[0] || null);

    // Reset index if matches change significantly
    useEffect(() => {
        if (currentMatchIndex >= sortedUserMatches.length && sortedUserMatches.length > 0) {
            setCurrentMatchIndex(0);
        }
    }, [sortedUserMatches.length, currentMatchIndex]);

    // Determine the active match to show in the detailed view
    // If ADMIN/REFEREE: Show the one they clicked on.
    // If PLAYER: Show their assigned match.
    const activeMatch: Match | undefined = isAdminOrReferee 
        ? (adminSelectedMatch || undefined)
        : (userMatch || undefined);

    // Determine perspective (Who is "My Team")
    // For Admin/Referee, we default Team 1 as "My Team" for UI structure, but labels will change
    const isTeam1 = activeMatch && currentUser && !isAdminOrReferee 
        ? activeMatch.team1.players.includes(currentUser.name)
        : true; // Admin/Referee defaults to Team 1 perspective layout
    
    // Set teams based on perspective
    const myTeam = isTeam1 ? activeMatch?.team1 : activeMatch?.team2;
    const oppTeam = isTeam1 ? activeMatch?.team2 : activeMatch?.team1;

    const myRepresentative = myTeam?.representative || myTeam?.players[0];
    const oppRepresentative = oppTeam?.representative || oppTeam?.players[0];

    const isMyRepresentative = currentUser?.name === myRepresentative;

    // Initialize scores when entering a match
    useEffect(() => {
        if (activeMatch) {
            if (activeMatch.status === 'scheduled') {
                setStep('alert');
            } else {
                setStep('scoring');
            }

            // Sync scores
            const s1 = activeMatch.proposedScore1 !== undefined ? activeMatch.proposedScore1 : (activeMatch.status === 'finished' ? activeMatch.score1 : '');
            const s2 = activeMatch.proposedScore2 !== undefined ? activeMatch.proposedScore2 : (activeMatch.status === 'finished' ? activeMatch.score2 : '');
            
            setMyScore(s1 !== null && s1 !== undefined ? s1.toString() : '');
            setOppScore(s2 !== null && s2 !== undefined ? s2.toString() : '');
        }
    }, [activeMatch?.id, isTeam1, activeMatch?.proposedScore1, activeMatch?.proposedScore2, activeMatch?.score1, activeMatch?.score2, activeMatch?.status]);

    const handleConfirm = () => {
        if (myScore === '' || oppScore === '') {
            alert("Por favor, introduce un resultado válido.");
            return;
        }
        setStep('validation');
    };

    const handleFinalize = () => {
        if (activeMatch && onUpdateMatch) {
            const finalScore1 = isTeam1 ? parseInt(myScore) : parseInt(oppScore);
            const finalScore2 = isTeam1 ? parseInt(oppScore) : parseInt(myScore);
            
            if (isAdminOrReferee) {
                onUpdateMatch(activeMatch.id, { score1: finalScore1, score2: finalScore2, status: 'finished' });
                alert("Resultado confirmado y finalizado.");
                setAdminSelectedMatch(null);
            } else {
                onUpdateMatch(activeMatch.id, { 
                    proposedScore1: finalScore1, 
                    proposedScore2: finalScore2, 
                    proposedByTeamId: myTeam?.id,
                    status: 'pending_validation' 
                });
                alert("Resultado propuesto. Esperando validación del rival.");
            }
        }
        setStep('scoring'); 
    };

    const handleAcceptResult = () => {
        if (activeMatch && onUpdateMatch) {
            onUpdateMatch(activeMatch.id, { 
                score1: activeMatch.proposedScore1, 
                score2: activeMatch.proposedScore2, 
                status: 'finished' 
            });
            alert("Resultado validado y finalizado.");
        }
    };

    const handleRejectResult = () => {
        if (activeMatch && onUpdateMatch) {
            onUpdateMatch(activeMatch.id, { 
                proposedScore1: undefined, 
                proposedScore2: undefined, 
                proposedByTeamId: undefined,
                status: 'live' 
            });
            alert("Resultado rechazado. La partida vuelve a estar en curso.");
        }
    };

    const handleAdminBack = () => {
        setAdminSelectedMatch(null);
    };

    const handleIssueCardSubmit = () => {
        if (activeMatch && selectedPlayerForCard && onIssueCard) {
            const player = players?.find(p => p.name === selectedPlayerForCard.name);
            onIssueCard({
                id: `card-${Date.now()}`,
                playerId: player?.id || selectedPlayerForCard.name,
                matchId: activeMatch.id,
                competitionId: activeMatch.competitionId,
                color: cardColor,
                scope: cardScope,
                reason: cardReason,
                timestamp: Date.now()
            });
            setIsCardModalOpen(false);
            setSelectedPlayerForCard(null);
            setCardReason('');
        }
    };

    const getPlayerPhone = (playerName: string) => {
        const player = players?.find(p => p.name === playerName);
        return player?.phone;
    };

    const getTeamCards = (team: Team | undefined) => {
        if (!team || !selectedCompetition?.cards) return [];
        return selectedCompetition.cards.filter(card => {
            const player = players?.find(p => p.id === card.playerId || p.name === card.playerId);
            if (!player || !team.players.includes(player.name)) return false;
            
            if (card.scope === 'MATCH' && card.matchId !== activeMatch?.id) return false;
            return true;
        });
    };

    const renderCardIcon = (color: CardColor) => {
        switch (color) {
            case 'YELLOW': return <span className="inline-block w-3 h-4 bg-yellow-400 rounded-sm shadow-sm border border-yellow-500" title="Tarjeta Amarilla"></span>;
            case 'ORANGE': return <span className="inline-block w-3 h-4 bg-orange-500 rounded-sm shadow-sm border border-orange-600" title="Tarjeta Naranja"></span>;
            case 'RED': return <span className="inline-block w-3 h-4 bg-red-600 rounded-sm shadow-sm border border-red-700" title="Tarjeta Roja"></span>;
        }
    };

    const generateWhatsAppLink = (phone: string, match: Match, teamName: string, opponentName: string) => {
        // Sanitize phone number: remove spaces, dashes, parentheses
        const sanitizedPhone = phone.replace(/[\s\-()]/g, '');
        const loginUrl = window.location.origin;
        const compName = selectedCompetition?.name || match.competitionId;
        const message = `¡Hola!\n\nTienes una nueva partida en *${compName}*.\n\nTu equipo: ${teamName}\nRival: ${opponentName}\nPista: ${match.court || 'Por asignar'}\nRonda: ${match.round.replace('Poule', 'Grupo')}\n\nPuedes ver todos los detalles y clasificaciones accediendo a la app:\n${loginUrl}`;
        return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
    };

    // --- VIEW: EMPTY STATE (NO COMPETITIONS) ---
    if (!hasCompetitions) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                 <div className="bg-gray-100 dark:bg-[#2c1515] p-6 rounded-full mb-6">
                    <span className="material-symbols-outlined text-5xl text-gray-400">emoji_events</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No Hay Competiciones Activas</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    {currentUser?.role === 'ADMIN' 
                        ? "Aún no has creado ninguna competición. Las partidas aparecerán aquí una vez creada la competición."
                        : "No hay competiciones activas en este momento. Las partidas aparecerán aquí cuando un administrador cree una competición."}
                </p>
            </div>
        );
    }

    // --- VIEW: ADMIN DASHBOARD (NO MATCH SELECTED) ---
    if (isAdminOrReferee && !activeMatch) {
        return (
            <div className="flex flex-col min-h-full max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 dark:border-[#3a201d] pb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <span className="bg-primary/10 text-primary p-2 rounded-lg">
                                <span className="material-symbols-outlined text-xl">sports_baseball</span>
                             </span>
                             <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Consola Admin</span>
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Supervisión de Partidas</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {selectedCompetition 
                                ? `Gestionando: ${selectedCompetition.name} (${selectedCompetition.currentPhase || 'Fase General'})`
                                : 'Selecciona una partida para gestionar el marcador o resolver incidencias.'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                         <div className="bg-white dark:bg-[#1b0f0d] border border-gray-200 dark:border-[#3a201d] px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2">
                            <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
                            {relevantMatches.filter(m => m.status === 'live').length} En Juego
                         </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {relevantMatches.length > 0 ? relevantMatches.map(match => (
                        <div 
                            key={match.id} 
                            onClick={() => setAdminSelectedMatch(match)} 
                            className="bg-white dark:bg-[#221210] border border-gray-200 dark:border-[#3a201d] rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all group relative"
                        >
                            {/* Status Header */}
                            <div className={`px-4 py-2 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-white ${match.status === 'live' ? 'bg-primary' : 'bg-gray-600'}`}>
                                <span>{match.status === 'live' ? 'En Vivo' : match.status}</span>
                                <span>{match.startTime}</span>
                            </div>

                            <div className="p-5 flex flex-col gap-6 relative">
                                {/* Round Info */}
                                <div className="absolute top-4 right-4 text-[10px] font-bold text-gray-400 border border-gray-100 dark:border-[#3a201d] px-2 py-1 rounded bg-gray-50 dark:bg-[#2c1515]">
                                    {match.round.replace('Poule', 'Grupo').replace('Round', 'Ronda')}
                                </div>

                                {/* Teams */}
                                <div className="flex flex-col gap-4 mt-4">
                                    <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-3">
                                             <img src={match.team1.avatar} className="size-10 rounded-full bg-gray-200 object-cover" alt={match.team1.name} />
                                             <div>
                                                 <p className="font-bold text-gray-900 dark:text-white leading-tight">{match.team1.name}</p>
                                                 <p className="text-[10px] text-gray-500">{match.team1.players.join(' / ')}</p>
                                             </div>
                                         </div>
                                         <span className="text-2xl font-black text-gray-900 dark:text-white">{match.score1}</span>
                                    </div>
                                    <div className="w-full h-px bg-gray-100 dark:bg-[#3a201d]"></div>
                                    <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-3">
                                             <img src={match.team2.avatar} className="size-10 rounded-full bg-gray-200 object-cover" alt={match.team2.name} />
                                             <div>
                                                 <p className="font-bold text-gray-900 dark:text-white leading-tight">{match.team2.name}</p>
                                                 <p className="text-[10px] text-gray-500">{match.team2.players.join(' / ')}</p>
                                             </div>
                                         </div>
                                         <span className="text-2xl font-black text-gray-900 dark:text-white">{match.score2}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 bg-gray-50 dark:bg-[#251614] border-t border-gray-100 dark:border-[#3a201d] flex justify-between items-center">
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-lg">location_on</span>
                                    <span className="text-xs font-bold uppercase">Pista {match.court}</span>
                                </div>
                                <span className="text-primary text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    Gestionar
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400">
                            No se encontraron partidas para esta competición.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW: NO MATCH (PLAYER) ---
    if (!activeMatch) {
        return (
             <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="bg-gray-100 dark:bg-[#2c1515] p-6 rounded-full mb-6 animate-pulse">
                    <span className="material-symbols-outlined text-5xl text-gray-400">sports_handball</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No se encontró partida activa</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Hola, <span className="font-bold text-gray-700 dark:text-white">{currentUser?.name}</span>. 
                    {selectedCompetition 
                        ? ` Actualmente no tienes partidas programadas o en curso para ${selectedCompetition.name} (${selectedCompetition.currentPhase || 'General'}).`
                        : " Actualmente no tienes partidas programadas. Revisa los Grupos o el Cuadro para ver tu próximo horario de juego."}
                </p>
            </div>
        );
    }

    // --- VIEW: SINGLE MATCH DETAIL (PLAYER OR ADMIN-SELECTED) ---
    return (
        <div className="h-full flex flex-col relative overflow-auto custom-scrollbar">
            {/* Player Match Selector */}
            {!isAdminOrReferee && sortedUserMatches.length > 1 && (
                <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#1a0d0d]/80 backdrop-blur-md border-b border-gray-200 dark:border-[#3a201d] px-4 py-3">
                    <div className="flex flex-col gap-2 max-w-lg mx-auto">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tus Partidas ({sortedUserMatches.length})</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {sortedUserMatches.map((m, idx) => (
                                <button
                                    key={m.id}
                                    onClick={() => setCurrentMatchIndex(idx)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                                        currentMatchIndex === idx 
                                            ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' 
                                            : 'bg-white dark:bg-[#221210] border-gray-200 dark:border-[#3a201d] text-gray-500 hover:border-primary/50'
                                    }`}
                                >
                                    {m.round.includes('Round') ? `Ronda ${m.round.split('Round ')[1]}` : m.round}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-10 bg-repeat bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
            
            {/* Admin Back Button */}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'REFEREE') && (
                <div className="absolute top-4 left-4 z-40">
                    <button 
                        onClick={handleAdminBack}
                        className="flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full text-sm font-bold transition-all shadow-lg border border-white/20"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Volver al Panel
                    </button>
                </div>
            )}

            {/* ALERT MODAL VIEW */}
            {step === 'alert' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-md bg-white dark:bg-[#221210] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[#3a201d] overflow-hidden flex flex-col">
                        <div className="h-2 w-full bg-primary"></div>
                        <div className="p-8 flex flex-col items-center text-center gap-6">
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 animate-bounce">
                                <span className="material-symbols-outlined text-[32px] font-bold">sports_handball</span>
                            </div>
                            <div className="space-y-2">
                                <p className="text-primary text-sm font-bold tracking-widest uppercase">Alerta de Partida</p>
                                <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                                    {isAdminOrReferee ? 'Partida Lista' : '¡Nueva Partida Asignada!'}
                                </h1>
                            </div>
                            <div className="w-16 h-1 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                            
                            <div className="w-full flex flex-col gap-4">
                                <div className="bg-gray-50 dark:bg-[#2c1515] rounded-lg p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white dark:bg-[#221210] p-2 rounded-lg text-primary shadow-sm border border-gray-100 dark:border-[#3a201d]">
                                            <span className="material-symbols-outlined">location_on</span>
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ubicación</span>
                                            <span className="text-xl font-bold text-gray-900 dark:text-white">Pista {activeMatch.court}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 dark:bg-[#2c1515] rounded-lg p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white dark:bg-[#221210] p-2 rounded-lg text-primary shadow-sm border border-gray-100 dark:border-[#3a201d]">
                                            <span className="material-symbols-outlined">groups</span>
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {isAdminOrReferee ? 'Enfrentamiento' : 'Tu Rival'}
                                            </span>
                                            <span className="text-lg font-bold text-gray-900 dark:text-white text-left">
                                                {isAdminOrReferee ? `${activeMatch.team1.name} vs ${activeMatch.team2.name}` : oppTeam?.name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => setStep('scoring')}
                                    className="w-full mt-4 bg-primary hover:bg-primary-dark text-white font-bold py-4 px-6 rounded-lg shadow-lg shadow-primary/30 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
                                >
                                    <span className="text-lg uppercase tracking-wide">
                                        {isAdminOrReferee ? 'Gestionar Marcador' : 'Ir a la Partida'}
                                    </span>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>

                                {/* WhatsApp Notifications */}
                                {isAdminOrReferee && players && (
                                    <div className="mt-2 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30 w-full text-left">
                                        <h4 className="text-sm font-bold text-green-800 dark:text-green-400 mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined">chat</span>
                                            Notificar por WhatsApp
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[...activeMatch.team1.players, ...activeMatch.team2.players].map(playerName => {
                                                const phone = getPlayerPhone(playerName);
                                                if (!phone) return null;
                                                
                                                const teamName = activeMatch.team1.players.includes(playerName) ? activeMatch.team1.name : activeMatch.team2.name;
                                                const opponentName = activeMatch.team1.players.includes(playerName) ? activeMatch.team2.name : activeMatch.team1.name;
                                                
                                                const link = generateWhatsAppLink(phone, activeMatch, teamName, opponentName);
                                                
                                                return (
                                                    <a 
                                                        key={playerName}
                                                        href={link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#2c1515] rounded-lg border border-green-200 dark:border-green-900/50 hover:bg-green-50 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
                                                    >
                                                        <span>{playerName}</span>
                                                        <span className="material-symbols-outlined text-green-600 text-sm">send</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SCORING VIEW */}
            {step === 'scoring' && (
                <div className="flex flex-col items-center justify-center min-h-full py-8 px-4 gap-8 w-full max-w-2xl mx-auto z-10">
                    <div className="bg-white dark:bg-[#221210] rounded-2xl shadow-xl border border-gray-200 dark:border-[#3a201d] w-full p-6 flex flex-col gap-6">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-[#3a201d] pb-4">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{activeMatch.round.replace('Poule', 'Grupo').replace('Round', 'Ronda')}</h2>
                                <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-primary dark:text-red-400 text-xs font-bold mt-1">
                                    <span className="size-2 bg-primary rounded-full animate-pulse"></span>
                                    {isAdminOrReferee ? 'SUPERVISANDO EN VIVO' : 'PARTIDA ACTIVA'}
                                </span>
                            </div>
                             <div className="text-right flex flex-col items-end gap-2">
                                <div className="text-right">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Tiempo Restante</span>
                                    <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-widest">00:45:00</div>
                                </div>
                                {isAdminOrReferee && (
                                    <button 
                                        onClick={() => setIsCardModalOpen(true)}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-3 rounded-lg shadow flex items-center gap-1 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">style</span>
                                        Sacar Tarjeta
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-primary to-[#b01202] rounded-xl p-6 md:p-8 text-center text-white relative overflow-hidden shadow-lg">
                            <div className="absolute -right-8 -top-8 size-32 bg-white/10 rounded-full blur-2xl"></div>
                            <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1 md:mb-2 text-white/80">Asignación de Pista</h3>
                            <div className="text-4xl md:text-6xl font-black mb-2">PISTA {activeMatch.court}</div>
                            <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs md:text-sm font-medium">
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                Zona B, Campo Norte
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-6 items-start">
                            {/* Team 1 (My Team) */}
                            <div className="flex flex-col items-center text-center gap-2 md:gap-3">
                                <div className="size-16 md:size-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl md:text-2xl font-black border-4 border-white dark:border-[#3a201d] shadow-sm overflow-hidden relative">
                                    {myTeam?.avatar && !myTeam.avatar.includes('ui-avatars') ? (
                                        <img src={myTeam.avatar} alt={myTeam.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{myTeam?.name.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">{isAdminOrReferee ? 'Equipo 1' : 'Mi Equipo'}</span>
                                    <h4 className="font-bold text-sm md:text-lg text-gray-900 dark:text-white leading-tight max-w-[150px] mx-auto">{myTeam?.name}</h4>
                                    <div className="flex justify-center gap-1 mt-1">
                                        {getTeamCards(myTeam).map(card => (
                                            <React.Fragment key={card.id}>
                                                {renderCardIcon(card.color)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-col gap-1 w-full max-w-[100px]">
                                    {(!isAdminOrReferee && (activeMatch.status === 'finished' || activeMatch.status === 'pending_validation')) ? (
                                        <div className={`text-center text-3xl md:text-4xl font-bold p-2 md:p-4 rounded-xl border-2 ${activeMatch.status === 'finished' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#1a0d0d] text-gray-900 dark:text-white'} w-full`}>
                                            {myScore}
                                        </div>
                                    ) : (
                                        <input 
                                            type="number" 
                                            value={myScore} 
                                            onChange={(e) => setMyScore(e.target.value)}
                                            disabled={!isAdminOrReferee && !isMyRepresentative}
                                            className="text-center text-3xl md:text-4xl font-bold p-2 md:p-4 rounded-xl border-2 border-gray-200 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] text-gray-900 dark:text-white focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-center pt-8 md:pt-10">
                                <span className="size-8 md:size-10 rounded-full bg-gray-100 dark:bg-[#3a201d] flex items-center justify-center font-bold text-gray-500 text-[10px] md:text-xs">VS</span>
                            </div>

                            {/* Team 2 (Opponent) */}
                             <div className="flex flex-col items-center text-center gap-2 md:gap-3">
                                <div className="size-16 md:size-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl md:text-2xl font-black border-4 border-white dark:border-[#3a201d] shadow-sm overflow-hidden relative">
                                   {oppTeam?.avatar && !oppTeam.avatar.includes('ui-avatars') ? (
                                        <img src={oppTeam.avatar} alt={oppTeam.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{oppTeam?.name.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">{isAdminOrReferee ? 'Equipo 2' : 'Rival'}</span>
                                    <h4 className="font-bold text-sm md:text-lg text-gray-900 dark:text-white leading-tight max-w-[150px] mx-auto">{oppTeam?.name}</h4>
                                    <div className="flex justify-center gap-1 mt-1">
                                        {getTeamCards(oppTeam).map(card => (
                                            <React.Fragment key={card.id}>
                                                {renderCardIcon(card.color)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-col gap-1 w-full max-w-[100px]">
                                    {(!isAdminOrReferee && (activeMatch.status === 'finished' || activeMatch.status === 'pending_validation')) ? (
                                        <div className={`text-center text-3xl md:text-4xl font-bold p-2 md:p-4 rounded-xl border-2 ${activeMatch.status === 'finished' ? 'border-gray-400 bg-gray-50 dark:bg-[#1a0d0d] text-gray-400' : 'border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#1a0d0d] text-gray-900 dark:text-white'} w-full`}>
                                            {oppScore}
                                        </div>
                                    ) : (
                                        <input 
                                            type="number" 
                                            value={oppScore}
                                            onChange={(e) => setOppScore(e.target.value)}
                                            onFocus={(e) => e.target.value === '0' && setOppScore('')}
                                            disabled={!isAdminOrReferee && !isMyRepresentative}
                                            className="text-center text-3xl md:text-4xl font-bold p-2 md:p-4 rounded-xl border-2 border-gray-200 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] text-gray-900 dark:text-white focus:ring-4 focus:ring-gray-200 focus:border-gray-400 transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {activeMatch.status === 'finished' && (
                            <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/50 flex flex-col items-center gap-4 animate-fade-in">
                                <div className="size-12 rounded-full bg-green-500 text-white flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl">check</span>
                                </div>
                                <div className="text-center">
                                    <h4 className="text-xl font-black text-green-900 dark:text-green-400">¡Partida Finalizada!</h4>
                                    <p className="text-sm text-green-700 dark:text-green-600 mt-1">
                                        El resultado ha sido enviado y confirmado correctamente.
                                    </p>
                                </div>
                                {onWhatsAppShare && (
                                    <button
                                        onClick={() => {
                                            const winner = parseInt(myScore) > parseInt(oppScore) ? myTeam?.name : oppTeam?.name;
                                            const msg = `📢 Resultado Match Center:\n🏆 ${selectedCompetition?.name}\n📍 Pista ${activeMatch.court}\n\n⚔️ ${myTeam?.name} (${myScore}) - (${oppScore}) ${oppTeam?.name}\n\n✅ Ganador: ${winner}`;
                                            onWhatsAppShare(msg);
                                        }}
                                        className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-green-500/20 active:scale-95 mt-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">share</span>
                                        Compartir en WhatsApp
                                    </button>
                                )}
                            </div>
                        )}

                        {!isAdminOrReferee && activeMatch.status !== 'pending_validation' && (
                            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                                {isMyRepresentative ? (
                                    <span className="font-bold text-primary">Eres el representante de tu equipo. Introduce el resultado.</span>
                                ) : (
                                    <span>El representante de tu equipo es <span className="font-bold">{myRepresentative}</span>. Solo él puede introducir el resultado.</span>
                                )}
                            </div>
                        )}

                        {activeMatch.status === 'pending_validation' && (
                            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700/50 text-center">
                                <h4 className="font-bold text-yellow-800 dark:text-yellow-500 mb-2">Resultado Pendiente de Validación</h4>
                                {activeMatch.proposedByTeamId === myTeam?.id ? (
                                    <p className="text-sm text-yellow-700 dark:text-yellow-600">
                                        Has propuesto este resultado. Esperando a que el equipo rival lo valide.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-sm text-yellow-700 dark:text-yellow-600">
                                            El equipo rival ha propuesto este resultado.
                                            {!isMyRepresentative && !isAdminOrReferee && ` El representante (${myRepresentative}) debe validarlo.`}
                                        </p>
                                        {(isMyRepresentative || isAdminOrReferee) && (
                                            <div className="flex gap-2 justify-center mt-2">
                                                <button 
                                                    onClick={handleAcceptResult}
                                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                    Aceptar
                                                </button>
                                                <button 
                                                    onClick={handleRejectResult}
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                    Rechazar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {(isAdminOrReferee || isMyRepresentative) && (activeMatch.status === 'live' || activeMatch.status === 'scheduled' || isAdminOrReferee) && (
                            <button 
                                onClick={handleConfirm}
                                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 mt-6"
                            >
                                <span>{isAdminOrReferee ? 'Actualizar y Finalizar' : 'Enviar Resultados'}</span>
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        )}

                        {/* WhatsApp Notifications */}
                        {currentUser?.role === 'ADMIN' && players && (
                            <div className="mt-2 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
                                <h4 className="text-sm font-bold text-green-800 dark:text-green-400 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined">chat</span>
                                    Notificar por WhatsApp
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[...activeMatch.team1.players, ...activeMatch.team2.players].map(playerName => {
                                        const phone = getPlayerPhone(playerName);
                                        if (!phone) return null;
                                        
                                        const teamName = activeMatch.team1.players.includes(playerName) ? activeMatch.team1.name : activeMatch.team2.name;
                                        const opponentName = activeMatch.team1.players.includes(playerName) ? activeMatch.team2.name : activeMatch.team1.name;
                                        
                                        const link = generateWhatsAppLink(phone, activeMatch, teamName, opponentName);
                                        
                                        return (
                                            <a 
                                                key={playerName}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#2c1515] rounded-lg border border-green-200 dark:border-green-900/50 hover:bg-green-50 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
                                            >
                                                <span>{playerName}</span>
                                                <span className="material-symbols-outlined text-green-600 text-sm">send</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VALIDATION VIEW */}
            {step === 'validation' && (
                <div className="flex items-center justify-center min-h-full p-4 z-10">
                     <div className="bg-[#fffdf0] dark:bg-[#2c2a20] w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-yellow-200 dark:border-yellow-900/50 relative">
                        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 to-orange-500"></div>
                        <div className="p-6">
                            <div className="flex gap-4 items-start mb-6">
                                <span className="material-symbols-outlined text-yellow-600 text-3xl">hourglass_top</span>
                                <div>
                                    <h3 className="font-bold text-yellow-800 dark:text-yellow-500 text-lg">ACCIÓN REQUERIDA</h3>
                                    <p className="text-yellow-700 dark:text-yellow-600 text-sm">
                                        {isAdminOrReferee ? 'Confirmar este resultado finalizará la partida.' : 'Confirma el resultado para finalizar.'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-6 border border-yellow-100 dark:border-yellow-900/30 mb-6">
                                <div className="text-center text-xs font-medium text-gray-500 mb-4">{activeMatch.round.replace('Poule', 'Grupo').replace('Round', 'Ronda')} • Pista {activeMatch.court}</div>
                                <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white mb-6">Validación de Partida</h2>
                                
                                <div className="flex justify-between items-center px-4">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">{isAdminOrReferee ? 'Equipo 1' : 'Tu Equipo'}</p>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm mb-2 max-w-[100px] truncate">{myTeam?.name}</p>
                                        <div className="flex justify-center gap-1 mb-2">
                                            {getTeamCards(myTeam).map(card => (
                                                <React.Fragment key={card.id}>
                                                    {renderCardIcon(card.color)}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <span className="text-5xl font-black text-primary">{myScore}</span>
                                    </div>
                                    <div className="text-3xl font-black text-gray-300 italic">VS</div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">{isAdminOrReferee ? 'Equipo 2' : 'Rival'}</p>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm mb-2 max-w-[100px] truncate">{oppTeam?.name}</p>
                                        <div className="flex justify-center gap-1 mb-2">
                                            {getTeamCards(oppTeam).map(card => (
                                                <React.Fragment key={card.id}>
                                                    {renderCardIcon(card.color)}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <span className="text-5xl font-black text-gray-400">{oppScore}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={handleFinalize}
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {isAdminOrReferee ? 'Cerrar Partida' : `Confirmar Resultado (${myScore} - ${oppScore})`}
                                </button>
                                <button 
                                    onClick={() => setStep('scoring')}
                                    className="w-full bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-primary dark:text-primary-light font-bold py-3.5 rounded-xl border border-gray-200 dark:border-[#4a3535] flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">edit</span>
                                    Editar Marcador
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {/* CARD MODAL */}
            {isCardModalOpen && activeMatch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#221210] rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-[#3a201d] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3a201d] flex justify-between items-center bg-gray-50 dark:bg-[#2c1515]">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-500">style</span>
                                Sacar Tarjeta
                            </h2>
                            <button onClick={() => setIsCardModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Jugador</label>
                                <select 
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    value={selectedPlayerForCard?.name || ''}
                                    onChange={(e) => {
                                        const playerName = e.target.value;
                                        const teamId = activeMatch.team1.players.includes(playerName) ? activeMatch.team1.id : activeMatch.team2.id;
                                        setSelectedPlayerForCard({ name: playerName, teamId });
                                    }}
                                >
                                    <option value="" disabled>Selecciona un jugador...</option>
                                    <optgroup label={activeMatch.team1.name}>
                                        {activeMatch.team1.players.map(p => <option key={p} value={p}>{p}</option>)}
                                    </optgroup>
                                    <optgroup label={activeMatch.team2.name}>
                                        {activeMatch.team2.players.map(p => <option key={p} value={p}>{p}</option>)}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Color de Tarjeta</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setCardColor('YELLOW')}
                                        className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${cardColor === 'YELLOW' ? 'bg-yellow-400 border-yellow-500 text-yellow-900 shadow-inner' : 'bg-transparent border-gray-200 dark:border-[#3a201d] text-gray-500 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}`}
                                    >
                                        Amarilla
                                    </button>
                                    <button 
                                        onClick={() => setCardColor('ORANGE')}
                                        className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${cardColor === 'ORANGE' ? 'bg-orange-500 border-orange-600 text-white shadow-inner' : 'bg-transparent border-gray-200 dark:border-[#3a201d] text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                                    >
                                        Naranja
                                    </button>
                                    <button 
                                        onClick={() => setCardColor('RED')}
                                        className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${cardColor === 'RED' ? 'bg-red-600 border-red-700 text-white shadow-inner' : 'bg-transparent border-gray-200 dark:border-[#3a201d] text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                    >
                                        Roja
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Persistencia</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setCardScope('MATCH')}
                                        className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${cardScope === 'MATCH' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-gray-200 dark:border-[#3a201d] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#3a201d]'}`}
                                    >
                                        Solo Partida
                                    </button>
                                    <button 
                                        onClick={() => setCardScope('CHAMPIONSHIP')}
                                        className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${cardScope === 'CHAMPIONSHIP' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-gray-200 dark:border-[#3a201d] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#3a201d]'}`}
                                    >
                                        Todo el Campeonato
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Motivo (Opcional)</label>
                                <textarea 
                                    value={cardReason}
                                    onChange={(e) => setCardReason(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                                    rows={3}
                                    placeholder="Describe el motivo de la sanción..."
                                ></textarea>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#2c1515] flex justify-end gap-3">
                            <button 
                                onClick={() => setIsCardModalOpen(false)}
                                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3a201d] rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleIssueCardSubmit}
                                disabled={!selectedPlayerForCard}
                                className="px-4 py-2 text-sm font-bold bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirmar Tarjeta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
