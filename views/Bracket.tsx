import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Competition, Match, PlayerRegistry, Team } from '../types';

interface BracketProps {
    competition: Competition | null;
    matches: Match[];
    currentUser?: PlayerRegistry | null;
    onGenerateManualRepesca?: (teamIds: string[]) => void;
    embedded?: boolean;
}

export const Bracket: React.FC<BracketProps> = ({ competition, matches, currentUser, onGenerateManualRepesca, embedded = false }) => {
    const [selectedBracket, setSelectedBracket] = useState<'DIRECTA' | 'CONSOLACION' | 'REPESCA'>('DIRECTA');
    const [showManualRepescaModal, setShowManualRepescaModal] = useState(false);
    const [selectedRepescaTeams, setSelectedRepescaTeams] = useState<Set<string>>(new Set());

    if (!competition) {
        return (
            <div className="min-h-screen bg-[#221010] flex flex-col items-center justify-center text-center p-8">
                <div className="bg-[#2c1515] p-6 rounded-full mb-6 border border-[#492222]">
                    <span className="material-symbols-outlined text-5xl text-[#cb9090]">emoji_events</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Ninguna Competición Seleccionada</h2>
                <p className="text-[#cb9090] max-w-md">
                    Por favor, ve a la lista de Competiciones y selecciona un torneo activo para ver los cuadros.
                </p>
            </div>
        );
    }

    const isKnockout = competition.type === 'KNOCKOUT';
    
    // Filter matches for the selected bracket
    let bracketMatches = matches.filter(m => {
        // ALWAYS restrict bracket view to Knockout-type rounds (ignore Swiss/Poules)
        const isFinalPhaseRound = m.round.startsWith('Knockout') || m.round === 'QF' || m.round === 'SF' || m.round === 'F';
        if (!isKnockout && !isFinalPhaseRound) return false;

        // Apply bracket selection (DIRECTA by default if undefined)
        const matchBracket = m.bracket || 'DIRECTA';
        return matchBracket === selectedBracket || (m.round === 'Knockout Round 1' && selectedBracket === 'DIRECTA');
    });

    // Group matches by round
    const roundsMap = new Map<string, Match[]>();
    bracketMatches.forEach(m => {
        if (!roundsMap.has(m.round)) {
            roundsMap.set(m.round, []);
        }
        roundsMap.get(m.round)!.push(m);
    });

    // Sort rounds
    const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => {
        if (a.startsWith('Knockout Round') && b.startsWith('Knockout Round')) {
            return parseInt(a.replace('Knockout Round ', '')) - parseInt(b.replace('Knockout Round ', ''));
        }
        // Fallback for QF, SF, F
        const order = { 'QF': 1, 'SF': 2, 'F': 3 };
        return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
    });

    const isUserInMatch = (match: Match) => {
        if (!currentUser) return false;
        return match.team1.players.includes(currentUser.name) || match.team2.players.includes(currentUser.name);
    };

    const getEligibleRepescaTeams = (): Team[] => {
        if (!competition || competition.type !== 'KNOCKOUT') return [];
        
        const eligibleTeams: Team[] = [];
        const directaMatches = matches.filter(m => m.bracket === 'DIRECTA' && m.status === 'finished');
        
        // Find all losers in Directa
        directaMatches.forEach(m => {
            if (m.score1 !== null && m.score2 !== null) {
                if (m.score1 < m.score2) eligibleTeams.push(m.team1);
                else if (m.score2 < m.score1) eligibleTeams.push(m.team2);
            }
        });

        // Filter out teams already in Repesca or Consolacion
        const teamsInOtherBrackets = new Set<string>();
        matches.filter(m => m.bracket === 'REPESCA' || m.bracket === 'CONSOLACION').forEach(m => {
            teamsInOtherBrackets.add(m.team1.id);
            teamsInOtherBrackets.add(m.team2.id);
        });

        return eligibleTeams.filter(t => !teamsInOtherBrackets.has(t.id));
    };

    const renderMatchCard = (match: Match, isFinal: boolean = false) => {
        const highlight = isUserInMatch(match);
        
        return (
            <div key={match.id} className="relative group w-full">
                <div className={`bg-[#2c1515] border ${match.status === 'live' ? 'border-primary' : (highlight ? 'border-yellow-500' : 'border-[#492222]')} rounded-lg overflow-hidden shadow-lg relative z-10 ${highlight ? 'ring-2 ring-yellow-500/50' : ''}`}>
                    <div className={`px-4 py-2 ${match.status === 'live' ? 'bg-primary' : 'bg-[#361a1a]'} flex justify-between items-center border-b border-[#492222]`}>
                        {match.status === 'live' ? (
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <span className="text-xs font-bold text-white">EN VIVO</span>
                            </div>
                        ) : (
                            <span className="text-xs text-[#cb9090]">{match.id.substring(0, 8).toUpperCase()}</span>
                        )}
                        <span className={`text-[10px] font-bold ${match.status === 'live' ? 'text-white/90' : 'text-[#cb9090]'}`}>
                            {match.status === 'finished' ? 'FINALIZADO' : match.status === 'live' ? `PISTA ${match.court}` : match.startTime || 'TBD'}
                        </span>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                        {/* Team 1 */}
                        <div className={`flex justify-between items-center ${match.score1 !== null && match.score2 !== null && match.score1 < match.score2 ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                                <div className="size-6 bg-gray-600 rounded-full overflow-hidden">
                                    {match.team1.avatar && <img src={match.team1.avatar} alt={match.team1.name} className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm font-bold ${match.status === 'live' ? 'text-white' : 'text-gray-400'} ${currentUser && match.team1.players.includes(currentUser.name) ? 'text-yellow-400' : ''}`}>
                                    {match.team1.name}
                                </span>
                            </div>
                            <span className={`font-bold ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>{match.score1 ?? '-'}</span>
                        </div>
                        {/* Team 2 */}
                        <div className={`flex justify-between items-center ${match.score1 !== null && match.score2 !== null && match.score2 < match.score1 ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                                <div className="size-6 bg-gray-600 rounded-full overflow-hidden">
                                    {match.team2.avatar && <img src={match.team2.avatar} alt={match.team2.name} className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm font-bold ${match.status === 'live' ? 'text-white' : 'text-gray-400'} ${currentUser && match.team2.players.includes(currentUser.name) ? 'text-yellow-400' : ''}`}>
                                    {match.team2.name}
                                </span>
                            </div>
                            <span className={`font-bold ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>{match.score2 ?? '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`flex-1 bg-[#221010] relative text-white font-display ${embedded ? 'rounded-xl overflow-auto h-full custom-scrollbar' : 'min-h-full'}`}>
             {/* Nav specific for this view */}
             {!embedded && (
                 <div className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-[#492222] bg-[#221010] px-10 py-4 z-20 sticky top-0">
                    <div className="flex items-center gap-4 text-white">
                        <div className="size-8 flex items-center justify-center rounded bg-primary/20 text-primary">
                            <span className="material-symbols-outlined">emoji_events</span>
                        </div>
                        <div>
                            <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">{competition.organizer}</h2>
                            <p className="text-[#cb9090] text-xs font-normal">{competition.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2 bg-[#2c1515] rounded-full pl-3 pr-1 py-1 border border-[#492222]">
                            <span className="text-xs text-[#cb9090] font-medium">Categoría:</span>
                            <span className="text-sm font-bold text-white pr-2">{competition.type}</span>
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                        </div>
                    </div>
                </div>
             )}

            <div className={`w-full min-h-full p-4 md:p-12 ${embedded ? 'mt-0' : 'mt-8'}`}>
                 <div className="mb-12 flex flex-col items-center justify-between w-full max-w-[1200px] mx-auto gap-6 md:flex-row">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Fase Eliminatoria</h1>
                        <p className="text-[#cb9090] text-sm md:text-base">Fase Final - Eliminatoria Directa</p>
                    </div>
                    
                    {isKnockout && (
                        <div className="flex flex-wrap justify-center gap-1 bg-[#2c1515] rounded-lg p-1 border border-[#492222]">
                            <button 
                                onClick={() => setSelectedBracket('DIRECTA')}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-bold transition-colors ${selectedBracket === 'DIRECTA' ? 'bg-primary text-white' : 'text-[#cb9090] hover:text-white'}`}
                            >
                                Directa
                            </button>
                            <button 
                                onClick={() => setSelectedBracket('CONSOLACION')}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-bold transition-colors ${selectedBracket === 'CONSOLACION' ? 'bg-primary text-white' : 'text-[#cb9090] hover:text-white'}`}
                            >
                                Consolación
                            </button>
                            {competition.hasRepesca && (
                                <button 
                                    onClick={() => setSelectedBracket('REPESCA')}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-bold transition-colors ${selectedBracket === 'REPESCA' ? 'bg-primary text-white' : 'text-[#cb9090] hover:text-white'}`}
                                >
                                    Repesca
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#2c1515] border border-[#492222] rounded-full">
                            <div className="size-2 rounded-full bg-primary animate-pulse"></div>
                            <span className="text-xs font-bold text-white">ACTUALIZACIONES EN VIVO</span>
                        </div>
                         <button className="p-2 text-[#cb9090] hover:text-white transition-colors">
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    </div>
                </div>

                {/* Bracket Grid */}
                <div className="w-full max-w-[1200px] mx-auto relative pb-12 min-h-[700px] border border-[#492222] rounded-xl bg-[#1a0c0c] overflow-hidden flex flex-col">
                    <div className="p-4 bg-[#261212] border-b border-[#492222] flex items-center justify-between text-xs text-[#cb9090] font-bold">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">pinch</span>
                            <span>PINCHA Y ARRASTRA PARA DESPLAZARTE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">zoom_in</span>
                            <span>USA LA RUEDA PARA HACER ZOOM</span>
                        </div>
                    </div>
                    <div className="flex-1 w-full cursor-move overflow-auto custom-scrollbar">
                        <TransformWrapper
                            initialScale={0.8}
                            minScale={0.1}
                            maxScale={3}
                            centerOnInit={true}
                            limitToBounds={false}
                            wheel={{ step: 0.1 }}
                            pinch={{ step: 5 }}
                        >
                            <TransformComponent wrapperStyle={{ width: "100%", height: "100%", minHeight: "800px" }} contentStyle={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
                                {sortedRounds.length > 0 ? (
                                (() => {
                                    const maxMatches = Math.max(...Array.from(roundsMap.values()).map(matches => matches.length));
                                    const totalRounds = Math.ceil(Math.log2(maxMatches * 2));

                                    return (
                                        <div className="flex gap-0 min-w-max p-8">
                                            {sortedRounds.map((round, index) => {
                                                const roundMatches = roundsMap.get(round) || [];
                                                const isFinalRound = index === sortedRounds.length - 1;
                                                const numMatches = roundMatches.length;
                                                
                                                // Determine Spanish round name based on calculated total rounds
                                                const roundsFromFinal = totalRounds - 1 - index;
                                                let roundNameEs = `Ronda ${index + 1}`;
                                                if (roundsFromFinal === 0) roundNameEs = "Final";
                                                else if (roundsFromFinal === 1) roundNameEs = "Semifinal";
                                                else if (roundsFromFinal === 2) roundNameEs = "Cuartos de Final";
                                                else if (roundsFromFinal === 3) roundNameEs = "Octavos de Final";
                                                else if (roundsFromFinal === 4) roundNameEs = "Dieciseisavos de Final";
                                                else if (roundsFromFinal === 5) roundNameEs = "Treintaidosavos de Final";

                                                return (
                                                    <React.Fragment key={round}>
                                                        {/* Matches Column */}
                                                        <div className={`flex flex-col relative z-10 shrink-0 ${isFinalRound ? 'w-72' : 'w-64'}`}>
                                                            <div className="text-center mb-6 text-[#cb9090] font-bold tracking-widest text-sm uppercase h-6">
                                                                {roundNameEs}
                                                            </div>
                                                            <div className="flex flex-col flex-1">
                                                                {roundMatches.map(m => (
                                                                    <div key={m.id} className="flex-1 flex flex-col justify-center py-4">
                                                                        {renderMatchCard(m, isFinalRound)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Connectors Column */}
                                                        {!isFinalRound && (
                                                            <div className="flex flex-col w-8 shrink-0">
                                                                <div className="h-6 mb-6"></div> {/* Empty header */}
                                                                <div className="flex flex-col flex-1">
                                                                    {Array.from({ length: Math.max(1, Math.floor(numMatches / 2)) }).map((_, i) => (
                                                                        <div key={i} className="flex-1 flex flex-col justify-center">
                                                                            <div className="relative w-full border-t-2 border-r-2 border-b-2 border-[#492222] rounded-r-md h-1/2">
                                                                                <div className="absolute top-1/2 right-0 w-8 h-[2px] bg-[#492222] translate-x-full"></div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Spacer for the horizontal line */}
                                                        {!isFinalRound && <div className="w-8 shrink-0"></div>}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex flex-col items-center justify-center w-full py-12">
                                    <p className="text-[#cb9090] text-center mb-4">No hay partidos programados en este cuadro.</p>
                                    {selectedBracket === 'REPESCA' && competition.repescaOrigin === 'MANUAL' && currentUser?.role === 'ADMIN' && (
                                        <button 
                                            onClick={() => setShowManualRepescaModal(true)}
                                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg"
                                        >
                                            Seleccionar Equipos Manualmente
                                        </button>
                                    )}
                                </div>
                            )}
                        </TransformComponent>
                    </TransformWrapper>
                    </div>
                </div>
            </div>

            {/* Manual Repesca Modal */}
            {showManualRepescaModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-[#2c1515] border border-[#492222] rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Seleccionar Equipos para Repesca</h3>
                            <button onClick={() => setShowManualRepescaModal(false)} className="text-[#cb9090] hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 mb-6">
                            <p className="text-sm text-[#cb9090] mb-4">
                                Selecciona los equipos que participarán en la Repesca. Solo se muestran los equipos eliminados de la Directa que no están en otro cuadro.
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {getEligibleRepescaTeams().map(team => (
                                    <label key={team.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedRepescaTeams.has(team.id) ? 'bg-primary/20 border-primary' : 'bg-[#361a1a] border-[#492222] hover:border-[#cb9090]'}`}>
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary focus:ring-2"
                                            checked={selectedRepescaTeams.has(team.id)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedRepescaTeams);
                                                if (e.target.checked) newSet.add(team.id);
                                                else newSet.delete(team.id);
                                                setSelectedRepescaTeams(newSet);
                                            }}
                                        />
                                        <div className="flex items-center gap-2">
                                            <div className="size-8 bg-gray-600 rounded-full overflow-hidden">
                                                {team.avatar && <img src={team.avatar} alt={team.name} className="w-full h-full object-cover" />}
                                            </div>
                                            <span className="font-bold text-white text-sm">{team.name}</span>
                                        </div>
                                    </label>
                                ))}
                                {getEligibleRepescaTeams().length === 0 && (
                                    <div className="col-span-full text-center py-8 text-[#cb9090]">
                                        No hay equipos elegibles disponibles.
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-[#492222]">
                            <span className="text-sm text-[#cb9090]">
                                Seleccionados: <strong className="text-white">{selectedRepescaTeams.size}</strong>
                            </span>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowManualRepescaModal(false)}
                                    className="px-4 py-2 rounded-lg font-bold text-[#cb9090] hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => {
                                        if (onGenerateManualRepesca) {
                                            onGenerateManualRepesca(Array.from(selectedRepescaTeams));
                                        }
                                        setShowManualRepescaModal(false);
                                    }}
                                    disabled={selectedRepescaTeams.size < 2}
                                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg"
                                >
                                    Generar Cuadro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};