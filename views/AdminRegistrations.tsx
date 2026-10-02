
import React, { useState, useMemo, useRef } from 'react';
import { Competition, PlayerRegistry, Team } from '../types';
import * as XLSX from 'xlsx';

interface AdminRegistrationsProps {
    competitions: Competition[];
    players: PlayerRegistry[];
    registeredTeams: Team[];
    currentUser?: PlayerRegistry;
    onRegister: (competitionId: string, team: Team) => void;
    onRegisterBatch?: (competitionId: string, teams: Team[]) => void;
    onDeleteRegistration?: (teamId: string) => void;
}

export const AdminRegistrations: React.FC<AdminRegistrationsProps> = ({ 
    competitions, 
    players, 
    registeredTeams,
    currentUser,
    onRegister,
    onRegisterBatch,
    onDeleteRegistration
}) => {
    const [selectedCompId, setSelectedCompId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Form State
    const [teamName, setTeamName] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>(['', '', '']); // Up to 3 slots
    const [error, setError] = useState<string>('');
    const [successMsg, setSuccessMsg] = useState<string>('');

    // Derived State
    const selectedComp = competitions.find(c => c.id === selectedCompId);
    
    // Determine Format based on Competition Type string (Simple logic for demo)
    const format = useMemo(() => {
        if (!selectedComp) return 'unknown';
        
        if (selectedComp.format) {
            return selectedComp.format.toLowerCase();
        }

        const type = (selectedComp.type || '').toLowerCase();
        const name = (selectedComp.name || '').toLowerCase();
        
        if (type.includes('individual') || type.includes('single') || name.includes('individual')) return 'individual';
        if (type.includes('tripleta') || type.includes('triples') || name.includes('tripleta')) return 'tripletas';
        if (type.includes('dupleta') || type.includes('doubles') || name.includes('dupleta')) return 'dupletas';
        
        return 'dupletas'; // Default to doubles
    }, [selectedComp]);

    const numPlayersRequired = format === 'individual' ? 1 : (format === 'tripletas' ? 3 : 2);

    // Filter registered teams for the selected competition
    const competitionRegistrations = registeredTeams.filter(t => t.competitionId === selectedCompId);

    const availablePlayers = useMemo(() => {
        if (currentUser?.role === 'CLUB_ADMIN' && currentUser?.canRegisterClubMembers) {
            return players.filter(p => p.club === currentUser.club);
        }
        return players;
    }, [players, currentUser]);

    const canDeleteTeam = (team: Team) => {
        if (currentUser?.role === 'ADMIN' || currentUser?.username?.toLowerCase().trim() === 'admin') return true;
        if (currentUser?.role === 'CLUB_ADMIN' && currentUser?.canRegisterClubMembers) {
            const clubPlayerNames = players.filter(p => p.club === currentUser.club).map(p => p.name);
            return team.players.every(name => clubPlayerNames.includes(name));
        }
        return false;
    };

    const handleRegister = () => {
        setError('');
        setSuccessMsg('');

        if (!selectedCompId) {
            setError('Por favor, selecciona una competición primero.');
            return;
        }

        // Check capacity
        if (selectedComp && competitionRegistrations.length >= (selectedComp.maxTeams || 16)) {
            setError('La competición ha alcanzado el límite máximo de inscripciones.');
            return;
        }

        // Validate Team Name (if not individual)
        if (format !== 'individual' && !teamName.trim()) {
            setError('El nombre del equipo es obligatorio para este formato.');
            return;
        }

        // Validate Players
        const playersToRegister = selectedPlayers.slice(0, numPlayersRequired).filter(id => id !== '');
        
        if (playersToRegister.length !== numPlayersRequired) {
            setError(`Debes seleccionar exactamente ${numPlayersRequired} jugador(es).`);
            return;
        }

        // Check for duplicates within the team
        const uniquePlayers = new Set(playersToRegister);
        if (uniquePlayers.size !== playersToRegister.length) {
            setError('No puedes seleccionar al mismo jugador dos veces.');
            return;
        }

        // Check if players are already registered in this competition
        // In a real app, you'd check backend. Here we check the current list.
        const allRegisteredPlayerNames = competitionRegistrations.flatMap(t => t.players);
        const playerObjects = playersToRegister.map(id => players.find(p => p.id === id));
        
        for (const p of playerObjects) {
            if (p && allRegisteredPlayerNames.includes(p.name)) {
                setError(`El jugador ${p.name} ya está inscrito en esta competición.`);
                return;
            }
        }

        // Create Team Object
        const newTeam: Team = {
            id: `team-${Date.now()}`,
            name: format === 'individual' ? (playerObjects[0]?.name || 'Desconocido') : teamName,
            players: playerObjects.map(p => p?.name || 'Desconocido'),
            representative: playerObjects[0]?.name || 'Desconocido', // First player is representative
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(format === 'individual' ? (playerObjects[0]?.name || 'U') : teamName)}&background=random`,
            status: 'pending', // Default status for registration
            competitionId: selectedCompId,
            rank: competitionRegistrations.length + 1,
            pts: 0,
            bh: 0,
            diff: 0
        };

        onRegister(selectedCompId, newTeam);
        setSuccessMsg('¡Inscripción exitosa!');
        
        // Reset Form
        setTeamName('');
        setSelectedPlayers(['', '', '']);
    };

    const handlePlayerSelectChange = (index: number, value: string) => {
        const newSelection = [...selectedPlayers];
        newSelection[index] = value;
        setSelectedPlayers(newSelection);
    };

    const handleImportClick = () => {
        if (!selectedCompId) {
            alert('Por favor, selecciona una competición primero.');
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleExportClick = () => {
        if (!selectedCompId) {
            alert('Por favor, selecciona una competición primero.');
            return;
        }
        
        const dataToExport = competitionRegistrations.map(t => ({
            NombreEquipo: t.name,
            Jugadores: t.players.join(', '),
            Estado: t.status,
            Puntos: t.pts
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inscripciones");
        XLSX.writeFile(wb, `Inscripciones_${selectedComp?.name || 'Competicion'}.xlsx`);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCompId || !onRegisterBatch) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) {
                alert("El archivo Excel está vacío.");
                return;
            }

            // Validation: Check for required columns
            const firstRow = data[0] as any;
            const keys = Object.keys(firstRow).map(k => k.toLowerCase());
            
            // We need at least 'Jugador 1' or 'Player 1'
            const hasPlayer1 = keys.some(k => k.includes('jugador 1') || k.includes('player 1') || k === 'jugador' || k === 'player');
            
            if (!hasPlayer1) {
                alert(`Error: El archivo Excel tiene un formato incorrecto.\nFalta la columna 'Jugador 1' (o 'Player 1').\n\nAsegúrese de que la primera fila contenga los encabezados correctos.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            const teamsToImport: Team[] = [];
            let importedCount = 0;

            // Get existing player names to check for duplicates
            const allRegisteredPlayerNames = competitionRegistrations.flatMap(t => t.players);

            for (const row of data as any[]) {
                // Check overall capacity first
                if (selectedComp && (competitionRegistrations.length + importedCount) >= (selectedComp.maxTeams || 16)) {
                    continue;
                }

                // Expected columns: Nombre Equipo, Jugador 1, Jugador 2, Jugador 3
                const teamNameRaw = row['Nombre Equipo'] || row['Team Name'] || row['Equipo'];
                const p1 = row['Jugador 1'] || row['Player 1'] || row['Jugador'];
                const p2 = row['Jugador 2'] || row['Player 2'];
                const p3 = row['Jugador 3'] || row['Player 3'];

                const playersList: string[] = [];
                if (p1) playersList.push(p1);
                if (p2) playersList.push(p2);
                if (p3) playersList.push(p3);

                // Validation
                if (playersList.length === 0) continue;
                if (format === 'individual' && playersList.length !== 1) continue;
                if (format === 'dupletas' && playersList.length !== 2) continue;
                if (format === 'tripletas' && playersList.length !== 3) continue;

                // Check duplicates
                const hasDuplicate = playersList.some(p => allRegisteredPlayerNames.includes(p));
                if (hasDuplicate) continue;

                // Check club permissions
                if (currentUser?.role === 'CLUB_ADMIN' && currentUser?.canRegisterClubMembers) {
                    const availablePlayerNames = availablePlayers.map(p => p.name);
                    const allFromClub = playersList.every(p => availablePlayerNames.includes(p));
                    if (!allFromClub) continue;
                }

                const name = format === 'individual' ? playersList[0] : (teamNameRaw || `Equipo ${playersList[0]}`);

                const newTeam: Team = {
                    id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    players: playersList,
                    representative: playersList[0],
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                    status: 'pending',
                    competitionId: selectedCompId,
                    rank: competitionRegistrations.length + importedCount + 1,
                    pts: 0,
                    bh: 0,
                    diff: 0
                };
                
                teamsToImport.push(newTeam);
                importedCount++;
            }

            if (teamsToImport.length > 0) {
                onRegisterBatch(selectedCompId, teamsToImport);
                alert(`Se han importado ${importedCount} equipos correctamente.`);
            } else {
                alert('No se encontraron equipos válidos o todos los jugadores ya están inscritos.');
            }
            
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in font-display h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Inscripciones a la Competición</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Gestiona las inscripciones para equipos y jugadores individuales.
                    </p>
                </div>
                <div className="flex gap-3">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".xlsx, .xls" 
                    />
                    <button 
                         onClick={handleImportClick}
                         disabled={!selectedCompId}
                         className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">upload_file</span>
                        Importar Excel
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT: Registration Form */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-[#3a201d] bg-gray-50 dark:bg-[#251614] flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">edit_document</span>
                                Nueva Inscripción
                            </h3>
                            {format !== 'unknown' && (
                                <span className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded">
                                    Formato: {format}
                                </span>
                            )}
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Competition Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Seleccionar Competición</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">emoji_events</span>
                                    <select 
                                        value={selectedCompId}
                                        onChange={(e) => {
                                            setSelectedCompId(e.target.value);
                                            setError('');
                                            setSuccessMsg('');
                                        }}
                                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none"
                                    >
                                        <option value="" disabled>-- Elige una Competición --</option>
                                        {competitions.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.status})
                                            </option>
                                        ))}
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {selectedCompId && (
                                <div className="space-y-6 animate-fade-in">
                                    <hr className="border-gray-100 dark:border-[#3a201d]" />

                                    {/* Team Name Input (Only if not individual) */}
                                    {format !== 'individual' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nombre del Equipo</label>
                                            <input 
                                                type="text" 
                                                value={teamName}
                                                onChange={(e) => setTeamName(e.target.value)}
                                                placeholder="ej. Los Invencibles"
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    )}

                                    {/* Player Selectors */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                            Seleccionar {format === 'individual' ? 'Jugador' : 'Miembros del Equipo'}
                                        </label>
                                        
                                        {Array.from({ length: numPlayersRequired }).map((_, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <div className="bg-gray-100 dark:bg-[#2c1515] size-8 flex items-center justify-center rounded-full text-xs font-bold text-gray-500">
                                                    {idx + 1}
                                                </div>
                                                <div className="relative flex-1">
                                                     <select 
                                                        value={selectedPlayers[idx]}
                                                        onChange={(e) => handlePlayerSelectChange(idx, e.target.value)}
                                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none text-sm"
                                                    >
                                                        <option value="">-- Seleccionar Jugador --</option>
                                                        {availablePlayers.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} ({p.license}) - {p.club}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Messages */}
                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">error</span>
                                            {error}
                                        </div>
                                    )}
                                    {successMsg && (
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">check_circle</span>
                                            {successMsg}
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleRegister}
                                        disabled={selectedComp ? competitionRegistrations.length >= (selectedComp.maxTeams || 16) : false}
                                        className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-md transition-all flex justify-center items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined">person_add</span>
                                        {selectedComp && competitionRegistrations.length >= (selectedComp.maxTeams || 16) 
                                            ? 'Cupo Completo' 
                                            : 'Confirmar Inscripción'}
                                    </button>
                                </div>
                            )}

                            {!selectedCompId && (
                                <div className="text-center py-8 text-gray-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">arrow_upward</span>
                                    <p className="text-sm">Selecciona una competición para comenzar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Registered List */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                        <div className="p-6 border-b border-gray-100 dark:border-[#3a201d] bg-gray-50 dark:bg-[#251614] flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">list</span>
                                    Entidades Inscritas
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {competitionRegistrations.length} {format === 'individual' ? 'Jugadores' : 'Equipos'} en lista
                                </p>
                            </div>
                            <button 
                                onClick={handleExportClick}
                                className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                            >
                                <span className="material-symbols-outlined">download</span>
                                Exportar Excel
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {competitionRegistrations.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {competitionRegistrations.map((team, idx) => (
                                        <div key={team.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#221210] border border-gray-200 dark:border-[#3a201d] rounded-lg hover:border-primary/30 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="font-bold text-gray-400 w-6 text-center">{idx + 1}</div>
                                                <img src={team.avatar} alt={team.name} className="size-10 rounded-full bg-gray-100 object-cover" />
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{team.name}</h4>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                        <span className="material-symbols-outlined text-[14px]">groups</span>
                                                        {team.players.join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                            {canDeleteTeam(team) && (
                                                <button 
                                                    onClick={() => onDeleteRegistration && onDeleteRegistration(team.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                                                    title="Eliminar Inscripción"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                    <span className="material-symbols-outlined text-6xl mb-4">app_registration</span>
                                    <p className="text-lg font-medium">No hay inscripciones aún</p>
                                    <p className="text-sm">Selecciona una competición y añade participantes.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-[#251614] border-t border-gray-100 dark:border-[#3a201d] text-xs text-center text-gray-500">
                             Capacidad Total: {selectedComp?.maxTeams || '-'} • Plazas Restantes: {selectedComp ? selectedComp.maxTeams - competitionRegistrations.length : '-'}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
