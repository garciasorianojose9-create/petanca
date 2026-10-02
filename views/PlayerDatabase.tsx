
import React, { useState, useRef } from 'react';
import { PlayerRegistry, PlayerCategory, UserRole, Competition, CardColor } from '../types';
import * as XLSX from 'xlsx';
import { exportClubCredentialsPDF } from '../src/utils/pdfUtils';

interface PlayerDatabaseProps {
    players: PlayerRegistry[];
    competitions?: Competition[];
    onAddPlayer: (player: Omit<PlayerRegistry, 'id' | 'username' | 'password' | 'avatar'>) => Promise<PlayerRegistry> | PlayerRegistry;
    onUpdatePlayer: (player: PlayerRegistry) => void;
    onDeletePlayer: (id: string) => void;
}

export const PlayerDatabase: React.FC<PlayerDatabaseProps> = ({ 
    players, 
    competitions,
    onAddPlayer, 
    onUpdatePlayer, 
    onDeletePlayer 
}) => {
    const [filterCategory, setFilterCategory] = useState<'ALL' | PlayerCategory>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Create/Edit Player State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
    const [newlyCreatedUser, setNewlyCreatedUser] = useState<PlayerRegistry | null>(null);

    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [newPlayerData, setNewPlayerData] = useState<{
        license: string;
        name: string;
        club: string;
        category: PlayerCategory;
        role: UserRole;
        canRegisterClubMembers?: boolean;
        phone?: string;
    }>({
        license: '',
        name: '',
        club: '',
        category: 'SENIOR 1',
        role: 'PLAYER',
        canRegisterClubMembers: false,
        phone: ''
    });

    const filteredPlayers = players.filter(p => {
        const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              p.license.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              p.club.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categoryColors: Record<string, string> = {
        'SENIOR 1': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        'SENIOR 2': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        'JUVENILE': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        'FEMININE': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
        'ADMIN': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    };

    const handleOpenCreate = () => {
        setEditingPlayerId(null);
        setNewPlayerData({
            license: '',
            name: '',
            club: '',
            category: 'SENIOR 1',
            role: 'PLAYER',
            canRegisterClubMembers: false,
            phone: ''
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (player: PlayerRegistry) => {
        setEditingPlayerId(player.id);
        setNewPlayerData({
            license: player.license,
            name: player.name,
            club: player.club,
            category: player.category,
            role: player.role,
            canRegisterClubMembers: player.canRegisterClubMembers || false,
            phone: player.phone || ''
        });
        setIsCreateModalOpen(true);
    };

    const handleDelete = () => {
        if (editingPlayerId) {
            setIsDeleteModalOpen(true);
        }
    };

    const confirmDelete = () => {
        if (editingPlayerId) {
            onDeletePlayer(editingPlayerId);
            setIsDeleteModalOpen(false);
            setIsCreateModalOpen(false);
        }
    };

    const handleSavePlayer = async () => {
        if (!newPlayerData.license || !newPlayerData.name || !newPlayerData.club) {
            return;
        }

        if (editingPlayerId) {
            // Update existing player
            const original = players.find(p => p.id === editingPlayerId);
            if (original) {
                onUpdatePlayer({
                    ...original,
                    license: newPlayerData.license,
                    name: newPlayerData.name,
                    club: newPlayerData.club,
                    category: newPlayerData.category,
                    role: newPlayerData.role,
                    canRegisterClubMembers: newPlayerData.canRegisterClubMembers,
                    phone: newPlayerData.phone
                });
            }
        } else {
            // Create new player & Generate Credentials
            const createdUser = await onAddPlayer({
                license: newPlayerData.license,
                name: newPlayerData.name,
                club: newPlayerData.club,
                category: newPlayerData.category,
                role: newPlayerData.role,
                canRegisterClubMembers: newPlayerData.canRegisterClubMembers,
                phone: newPlayerData.phone
            });
            
            setNewlyCreatedUser(createdUser);
            setIsCredentialModalOpen(true); // Show credentials immediately
        }
        setIsCreateModalOpen(false);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleExportClick = () => {
        const dataToExport = players.map(p => ({
            Nombre: p.name,
            Licencia: p.license,
            Club: p.club,
            Categoria: p.category,
            Telefono: p.phone || '',
            Usuario: p.username,
            Contrasena: p.password,
            Rol: p.role
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
        XLSX.writeFile(wb, "Base_Datos_Usuarios_Petanca.xlsx");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert("El archivo Excel está vacío.");
                    return;
                }

                // Validation: Check for required columns in the first row
                const firstRow = data[0] as any;
                const keys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
                const requiredColumns = ['nombre', 'licencia', 'club']; // 'categoria' and 'telefono' are optional
                
                const missingColumns = requiredColumns.filter(col => !keys.includes(col));

                if (missingColumns.length > 0) {
                    alert(`Error: El archivo Excel tiene un formato incorrecto.\nFaltan las siguientes columnas obligatorias: ${missingColumns.join(', ').toUpperCase()}.\n\nAsegúrese de que la primera fila contenga los encabezados exactos.`);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                // Process data
                let importedCount = 0;
                let updatedCount = 0;
                for (const row of data as any[]) {
                    // Normalize row keys
                    const normalizedRow: Record<string, any> = {};
                    for (const k in row) {
                        normalizedRow[k.toLowerCase().trim()] = row[k];
                    }

                    const name = normalizedRow['nombre'];
                    const license = normalizedRow['licencia'];
                    const club = normalizedRow['club'];
                    let category = normalizedRow['categoria'] || normalizedRow['categoría'] || 'SENIOR 1';
                    const phone = normalizedRow['telefono'] || normalizedRow['teléfono'] || normalizedRow['phone'] || '';
                    const role = normalizedRow['rol'] || normalizedRow['role'] || 'PLAYER';

                    if (name && license && club) {
                        // Normalize category
                        const catUpper = category.toString().toUpperCase();
                        if (catUpper.includes('SENIOR 1')) category = 'SENIOR 1';
                        else if (catUpper.includes('SENIOR 2')) category = 'SENIOR 2';
                        else if (catUpper.includes('JUVENIL')) category = 'JUVENILE';
                        else if (catUpper.includes('FEMINA')) category = 'FEMININE';
                        else if (catUpper.includes('ADMIN')) category = 'ADMIN';
                        else category = 'SENIOR 1';

                        const roleUpper = role.toString().toUpperCase();
                        let parsedRole: UserRole = 'PLAYER';
                        let canRegister = false;
                        
                        if (roleUpper === 'ADMIN') {
                            parsedRole = 'ADMIN';
                        } else if (roleUpper === 'CLUB_ADMIN' || roleUpper === 'ADMIN CLUB' || roleUpper === 'ADMIN_CLUB') {
                            parsedRole = 'CLUB_ADMIN';
                            canRegister = true; // Default to true for imported club admins
                        } else if (roleUpper === 'REFEREE' || roleUpper === 'ARBITRO' || roleUpper === 'ÁRBITRO') {
                            parsedRole = 'REFEREE';
                        }

                        const cleanLicense = license.toString().trim();

                        // Check if player already exists by license
                        const existingPlayer = players.find(p => p.license === cleanLicense);

                        if (existingPlayer) {
                            // Update existing player
                            onUpdatePlayer({
                                ...existingPlayer,
                                name: name.toString().trim(),
                                club: club.toString().trim(),
                                category: category as PlayerCategory,
                                phone: phone ? phone.toString().trim() : undefined,
                                role: parsedRole,
                                canRegisterClubMembers: parsedRole === 'CLUB_ADMIN' ? canRegister : undefined
                            });
                            updatedCount++;
                        } else {
                            // Add new player
                            await onAddPlayer({
                                name: name.toString().trim(),
                                license: cleanLicense,
                                club: club.toString().trim(),
                                category: category as PlayerCategory,
                                phone: phone ? phone.toString().trim() : undefined,
                                role: parsedRole,
                                canRegisterClubMembers: parsedRole === 'CLUB_ADMIN' ? canRegister : undefined
                            });
                            importedCount++;
                        }
                    }
                }
                alert(`Importación completada:\n- ${importedCount} usuarios nuevos añadidos.\n- ${updatedCount} usuarios existentes actualizados.`);
            } catch (error) {
                console.error("Error importing Excel:", error);
                alert("Hubo un error al procesar el archivo Excel. Asegúrese de que el formato sea correcto.");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
            }
        };
        reader.readAsBinaryString(file);
    };

    const getPlayerCards = (playerId: string, playerName: string) => {
        if (!competitions) return [];
        const cards: { color: CardColor, competitionName: string }[] = [];
        competitions.forEach(comp => {
            if (comp.cards) {
                comp.cards.forEach(card => {
                    if ((card.playerId === playerId || card.playerId === playerName) && card.scope === 'CHAMPIONSHIP') {
                        cards.push({ color: card.color, competitionName: comp.name });
                    }
                });
            }
        });
        return cards;
    };

    const renderCardIcon = (color: CardColor) => {
        switch (color) {
            case 'YELLOW': return <span className="inline-block w-3 h-4 bg-yellow-400 rounded-sm shadow-sm border border-yellow-500"></span>;
            case 'ORANGE': return <span className="inline-block w-3 h-4 bg-orange-500 rounded-sm shadow-sm border border-orange-600"></span>;
            case 'RED': return <span className="inline-block w-3 h-4 bg-red-600 rounded-sm shadow-sm border border-red-700"></span>;
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in font-display pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Base de Datos de Usuarios</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Gestiona usuarios, licencias, roles y ver credenciales generadas.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".xlsx, .xls" 
                    />
                    <button 
                         onClick={() => exportClubCredentialsPDF(players)}
                         className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors font-bold whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                        Exportar PDF
                    </button>
                    <button 
                         onClick={handleExportClick}
                         className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors font-bold whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">download</span>
                        Exportar Excel
                    </button>
                    <button 
                         onClick={handleImportClick}
                         className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors font-bold whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">upload_file</span>
                        Importar Excel
                    </button>
                    <button 
                         onClick={handleOpenCreate}
                         className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md transition-colors font-bold whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">person_add</span>
                        Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Usuarios</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{players.length}</p>
                </div>
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border-l-4 border-purple-500 shadow-sm border-y border-r border-gray-200 dark:border-y-[#3a201d] dark:border-r-[#3a201d]">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Admins</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {players.filter(p => p.role === 'ADMIN').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border-l-4 border-orange-500 shadow-sm border-y border-r border-gray-200 dark:border-y-[#3a201d] dark:border-r-[#3a201d]">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Árbitros</p>
                    <p className="text-2xl font-bold text-orange-600">
                        {players.filter(p => p.role === 'REFEREE').length}
                    </p>
                </div>
                 <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border-l-4 border-blue-500 shadow-sm border-y border-r border-gray-200 dark:border-y-[#3a201d] dark:border-r-[#3a201d]">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Jugadores</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {players.filter(p => p.role === 'PLAYER').length}
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, licencia, usuario o club..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#2c1515] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm dark:text-white"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-[#251614] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-[#3a201d]">
                            <tr>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Nombre / Licencia</th>
                                <th className="px-6 py-4">Tarjetas</th>
                                <th className="px-6 py-4">Credenciales (Solo Vista)</th>
                                <th className="px-6 py-4">Categoría</th>
                                <th className="px-6 py-4">Club / Teléfono</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2c1515]">
                            {filteredPlayers.length > 0 ? (
                                filteredPlayers.map((player) => (
                                    <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-[#251614] transition-colors group">
                                        <td className="px-6 py-4">
                                            {player.role === 'ADMIN' ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded w-fit">
                                                    <span className="material-symbols-outlined text-sm">shield_person</span>
                                                    ADMIN
                                                </span>
                                            ) : player.role === 'CLUB_ADMIN' ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded w-fit" title={player.canRegisterClubMembers ? "Puede inscribir" : "Sin permisos de inscripción"}>
                                                    <span className="material-symbols-outlined text-sm">group</span>
                                                    ADMIN CLUB
                                                </span>
                                            ) : player.role === 'REFEREE' ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-1 rounded w-fit">
                                                    <span className="material-symbols-outlined text-sm">gavel</span>
                                                    ÁRBITRO
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-[#2c1515] px-2 py-1 rounded w-fit">JUGADOR</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white">{player.name}</div>
                                            <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{player.license}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {getPlayerCards(player.id, player.name).map((card, idx) => (
                                                    <div key={idx} className="flex items-center gap-1" title={`Campeonato: ${card.competitionName}`}>
                                                        {renderCardIcon(card.color)}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-xs font-mono bg-gray-100 dark:bg-[#2c1515] p-2 rounded border border-gray-200 dark:border-[#3a201d] max-w-[150px]">
                                                <span className="text-gray-500">Usr: <span className="text-gray-900 dark:text-white font-bold">{player.username}</span></span>
                                                <span className="text-gray-500">Pwd: <span className="text-gray-900 dark:text-white font-bold">{player.password}</span></span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-black/5 ${categoryColors[player.category] || categoryColors['SENIOR 1']}`}>
                                                {player.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>{player.club}</div>
                                            {player.phone && <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span>{player.phone}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleOpenEdit(player)}
                                                className="text-gray-400 hover:text-primary transition-colors p-1"
                                                title="Editar Usuario"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron usuarios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit User Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-gray-200 dark:border-[#3a201d] overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3a201d] flex justify-between items-center bg-gray-50 dark:bg-[#251614] flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    {editingPlayerId ? 'edit' : 'person_add'}
                                </span>
                                {editingPlayerId ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nombre Completo</label>
                                <input 
                                    type="text" 
                                    placeholder="ej. Juan Pérez"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={newPlayerData.name}
                                    onChange={(e) => setNewPlayerData({...newPlayerData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Número de Licencia</label>
                                <input 
                                    type="text" 
                                    placeholder="ej. MU-1234"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={newPlayerData.license}
                                    onChange={(e) => setNewPlayerData({...newPlayerData, license: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Club</label>
                                <input 
                                    type="text" 
                                    placeholder="ej. Club Petanca Murcia"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={newPlayerData.club}
                                    onChange={(e) => setNewPlayerData({...newPlayerData, club: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Categoría</label>
                                    <select 
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        value={newPlayerData.category}
                                        onChange={(e) => setNewPlayerData({...newPlayerData, category: e.target.value as PlayerCategory})}
                                    >
                                        <option value="SENIOR 1">SENIOR 1</option>
                                        <option value="SENIOR 2">SENIOR 2</option>
                                        <option value="JUVENILE">JUVENIL</option>
                                        <option value="FEMININE">FÉMINAS</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Rol del Sistema</label>
                                    <select 
                                        value={newPlayerData.role}
                                        onChange={(e) => setNewPlayerData({...newPlayerData, role: e.target.value as UserRole})}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    >
                                        <option value="PLAYER">Jugador</option>
                                        <option value="CLUB_ADMIN">Admin de Club</option>
                                        <option value="REFEREE">Árbitro</option>
                                        <option value="ADMIN">Admin Global</option>
                                    </select>
                                </div>
                                {newPlayerData.role === 'CLUB_ADMIN' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Permisos de Club</label>
                                        <div className="flex items-center h-[42px] px-2">
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={newPlayerData.canRegisterClubMembers}
                                                    onChange={(e) => setNewPlayerData({...newPlayerData, canRegisterClubMembers: e.target.checked})}
                                                />
                                                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Puede inscribir jugadores de su club</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {!editingPlayerId && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300 flex gap-2">
                                    <span className="material-symbols-outlined text-sm mt-0.5">key</span>
                                    <p>Las credenciales (Usuario y Contraseña) se generarán automáticamente y serán permanentes.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#251614] flex items-center justify-between gap-3 flex-shrink-0">
                            {editingPlayerId ? (
                                <button 
                                    onClick={handleDelete}
                                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 font-bold transition flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                    Eliminar
                                </button>
                            ) : (
                                <div></div>
                            )}
                            <div className="flex gap-3 ml-auto">
                                <button 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-[#35201d] transition"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSavePlayer}
                                    disabled={!newPlayerData.license || !newPlayerData.name || !newPlayerData.club}
                                    className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingPlayerId ? 'Guardar Cambios' : 'Crear y Generar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generated Credentials Modal */}
            {isCredentialModalOpen && newlyCreatedUser && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-2xl shadow-2xl max-w-md w-full border border-primary overflow-hidden text-center p-8">
                        <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                        </div>
                        
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">¡Usuario Creado con Éxito!</h2>
                        <p className="text-gray-500 mb-6">Por favor, proporcione estas credenciales al usuario. No se podrán cambiar más tarde.</p>

                        <div className="bg-gray-100 dark:bg-[#2c1515] p-6 rounded-xl border border-dashed border-gray-300 dark:border-[#3a201d] mb-6">
                            <div className="grid grid-cols-1 gap-4 text-left">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Usuario</p>
                                    <div className="text-xl font-mono font-bold text-primary bg-white dark:bg-black p-2 rounded border border-gray-200 dark:border-[#3a201d]">
                                        {newlyCreatedUser.username}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contraseña</p>
                                    <div className="text-xl font-mono font-bold text-primary bg-white dark:bg-black p-2 rounded border border-gray-200 dark:border-[#3a201d]">
                                        {newlyCreatedUser.password}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsCredentialModalOpen(false)}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg shadow-md transition"
                        >
                            Hecho
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-2xl shadow-2xl max-w-sm w-full border border-red-500 overflow-hidden text-center p-8">
                        <div className="size-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-red-600">warning</span>
                        </div>
                        
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">¿Eliminar usuario?</h2>
                        <p className="text-gray-500 mb-6">Esta acción no se puede deshacer. Se perderán todos los datos asociados a este usuario.</p>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-[#3a201d] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-[#35201d] transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
