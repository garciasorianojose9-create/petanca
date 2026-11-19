import React, { useState, useRef, useMemo } from 'react';
import { PlayerRegistry, PlayerCategory, UserRole, Competition, CardColor } from '../types';
import * as XLSX from 'xlsx';
import { exportClubCredentialsPDF } from '../src/utils/pdfUtils';

interface PlayerDatabaseProps {
    players: PlayerRegistry[];
    competitions?: Competition[];
    onAddPlayer: (player: Omit<PlayerRegistry, 'id' | 'username' | 'password' | 'avatar'>) => Promise<PlayerRegistry> | PlayerRegistry;
    onUpdatePlayer: (player: PlayerRegistry) => Promise<any> | void;
    onDeletePlayer: (id: string) => Promise<any> | void;
}

const safeStr = (val: unknown, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    return String(val);
};

export const PlayerDatabase: React.FC<PlayerDatabaseProps> = ({
    players = [],
    competitions = [],
    onAddPlayer,
    onUpdatePlayer,
    onDeletePlayer
}) => {
    const [filterCategory, setFilterCategory] = useState<'ALL' | PlayerCategory>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPasswords, setShowPasswords] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        password?: string;
    }>({
        license: '',
        name: '',
        club: '',
        category: 'SENIOR 1',
        role: 'PLAYER',
        canRegisterClubMembers: false,
        phone: '',
        password: ''
    });

    const safePlayers = useMemo(() => {
        if (!Array.isArray(players)) return [];
        return players.filter((p): p is PlayerRegistry => Boolean(p && typeof p === 'object' && p.id));
    }, [players]);

    const filteredPlayers = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return safePlayers.filter(p => {
            const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
            if (!matchesCategory) return false;
            if (!q) return true;
            const name = safeStr(p.name).toLowerCase();
            const license = safeStr(p.license).toLowerCase();
            const club = safeStr(p.club).toLowerCase();
            const username = safeStr(p.username).toLowerCase();
            return name.includes(q) || license.includes(q) || club.includes(q) || username.includes(q);
        });
    }, [safePlayers, filterCategory, searchQuery]);

    const handleOpenCreate = () => {
        setModalError('');
        setEditingPlayerId(null);
        setNewPlayerData({
            license: '',
            name: '',
            club: '',
            category: 'SENIOR 1',
            role: 'PLAYER',
            canRegisterClubMembers: false,
            phone: '',
            password: ''
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (player: PlayerRegistry) => {
        setModalError('');
        setEditingPlayerId(player.id);
        setNewPlayerData({
            license: safeStr(player.license),
            name: safeStr(player.name),
            club: safeStr(player.club),
            category: (player.category || 'SENIOR 1') as PlayerCategory,
            role: (player.role || 'PLAYER') as UserRole,
            canRegisterClubMembers: Boolean(player.canRegisterClubMembers),
            phone: safeStr(player.phone),
            password: ''
        });
        setIsCreateModalOpen(true);
    };

    const handleDelete = () => {
        if (editingPlayerId) {
            setIsDeleteModalOpen(true);
        }
    };

    const confirmDelete = async () => {
        if (editingPlayerId) {
            await onDeletePlayer(editingPlayerId);
            setIsDeleteModalOpen(false);
            setIsCreateModalOpen(false);
        }
    };

    const handleSavePlayer = async () => {
        setModalError('');
        if (!newPlayerData.license.trim() || !newPlayerData.name.trim() || !newPlayerData.club.trim()) {
            setModalError('Nombre, licencia y club son obligatorios.');
            return;
        }
        if (editingPlayerId && newPlayerData.password && newPlayerData.password.trim().length < 4) {
            setModalError('La nueva contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingPlayerId) {
                const original = safePlayers.find(p => p.id === editingPlayerId);
                if (original) {
                    await onUpdatePlayer({
                        ...original,
                        license: newPlayerData.license.trim(),
                        name: newPlayerData.name.trim(),
                        club: newPlayerData.club.trim(),
                        category: newPlayerData.category,
                        role: newPlayerData.role,
                        canRegisterClubMembers: newPlayerData.canRegisterClubMembers,
                        phone: newPlayerData.phone?.trim() || undefined,
                        password: newPlayerData.password?.trim() ? newPlayerData.password.trim() : original.password
                    });
                }
            } else {
                const createdUser = await onAddPlayer({
                    license: newPlayerData.license.trim(),
                    name: newPlayerData.name.trim(),
                    club: newPlayerData.club.trim(),
                    category: newPlayerData.category,
                    role: newPlayerData.role,
                    canRegisterClubMembers: newPlayerData.canRegisterClubMembers,
                    phone: newPlayerData.phone?.trim() || undefined
                });

                setNewlyCreatedUser(createdUser);
                setIsCredentialModalOpen(true);
            }
            setIsCreateModalOpen(false);
        } catch (err: any) {
            setModalError(err?.message || 'Error al guardar el usuario.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleExportClick = () => {
        const dataToExport = safePlayers.map(p => ({
            Nombre: safeStr(p.name),
            Licencia: safeStr(p.license),
            Club: safeStr(p.club),
            Categoria: safeStr(p.category, 'SENIOR 1'),
            Telefono: safeStr(p.phone),
            Usuario: safeStr(p.username),
            Contrasena: safeStr(p.password),
            Rol: safeStr(p.role, 'PLAYER')
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
        XLSX.writeFile(wb, 'Base_Datos_Usuarios_Petanca.xlsx');
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
                    alert('El archivo Excel está vacío.');
                    return;
                }

                const firstRow = data[0] as any;
                const keys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
                const requiredColumns = ['nombre', 'licencia', 'club'];
                const missingColumns = requiredColumns.filter(col => !keys.includes(col));

                if (missingColumns.length > 0) {
                    alert(`Error: Faltan las siguientes columnas obligatorias: ${missingColumns.join(', ').toUpperCase()}.`);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                let importedCount = 0;
                let updatedCount = 0;
                for (const row of data as any[]) {
                    const normalizedRow: Record<string, any> = {};
                    for (const k in row) {
                        normalizedRow[k.toLowerCase().trim()] = row[k];
                    }

                    const name = safeStr(normalizedRow['nombre']).trim();
                    const cleanLicense = safeStr(normalizedRow['licencia']).trim();
                    const club = safeStr(normalizedRow['club']).trim();
                    let category = safeStr(normalizedRow['categoria'] || normalizedRow['categoría'], 'SENIOR 1');
                    const phone = safeStr(normalizedRow['telefono'] || normalizedRow['teléfono'] || normalizedRow['phone']).trim();
                    const role = safeStr(normalizedRow['rol'] || normalizedRow['role'], 'PLAYER');

                    if (name && cleanLicense && club) {
                        const catUpper = category.toUpperCase();
                        if (catUpper.includes('SENIOR 1')) category = 'SENIOR 1';
                        else if (catUpper.includes('SENIOR 2')) category = 'SENIOR 2';
                        else if (catUpper.includes('JUVENIL') || catUpper.includes('JUVENILE')) category = 'JUVENILE';
                        else if (catUpper.includes('FEMINA') || catUpper.includes('FEMININE')) category = 'FEMININE';
                        else if (catUpper.includes('ADMIN')) category = 'ADMIN';
                        else category = 'SENIOR 1';

                        const roleUpper = role.toUpperCase();
                        let parsedRole: UserRole = 'PLAYER';
                        let canRegister = false;

                        if (roleUpper === 'ADMIN') {
                            parsedRole = 'ADMIN';
                        } else if (roleUpper === 'CLUB_ADMIN' || roleUpper === 'ADMIN CLUB' || roleUpper === 'ADMIN_CLUB') {
                            parsedRole = 'CLUB_ADMIN';
                            canRegister = true;
                        } else if (roleUpper === 'REFEREE' || roleUpper === 'ARBITRO' || roleUpper === 'ÁRBITRO') {
                            parsedRole = 'REFEREE';
                        }

                        const existingPlayer = safePlayers.find(p => safeStr(p.license).trim() === cleanLicense);

                        if (existingPlayer) {
                            await onUpdatePlayer({
                                ...existingPlayer,
                                name,
                                club,
                                category: category as PlayerCategory,
                                phone: phone || undefined,
                                role: parsedRole,
                                canRegisterClubMembers: parsedRole === 'CLUB_ADMIN' ? canRegister : false
                            });
                            updatedCount++;
                        } else {
                            await onAddPlayer({
                                name,
                                license: cleanLicense,
                                club,
                                category: category as PlayerCategory,
                                phone: phone || undefined,
                                role: parsedRole,
                                canRegisterClubMembers: parsedRole === 'CLUB_ADMIN' ? canRegister : false
                            });
                            importedCount++;
                        }
                    }
                }
                alert(`Importación completada:\n- ${importedCount} usuarios nuevos añadidos.\n- ${updatedCount} usuarios existentes actualizados.`);
            } catch (error) {
                console.error('Error importing Excel:', error);
                alert('Hubo un error al procesar el archivo Excel. Asegúrese de que el formato sea correcto.');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const getPlayerCards = (playerId: string, playerName: string) => {
        if (!Array.isArray(competitions)) return [];
        const cards: { color: CardColor; competitionName: string }[] = [];
        competitions.forEach(comp => {
            if (Array.isArray(comp?.cards)) {
                comp.cards.forEach(card => {
                    if ((card.playerId === playerId || card.playerId === playerName) && card.scope === 'CHAMPIONSHIP') {
                        cards.push({ color: card.color, competitionName: safeStr(comp.name) });
                    }
                });
            }
        });
        return cards;
    };

    const renderCardIcon = (color: CardColor) => {
        switch (color) {
            case 'YELLOW': return <span className="inline-block w-3 h-4 bg-yellow-400 rounded-sm border border-yellow-500" title="Tarjeta Amarilla"></span>;
            case 'ORANGE': return <span className="inline-block w-3 h-4 bg-orange-500 rounded-sm border border-orange-600" title="Tarjeta Naranja"></span>;
            case 'RED': return <span className="inline-block w-3 h-4 bg-red-600 rounded-sm border border-red-700" title="Tarjeta Roja"></span>;
            default: return null;
        }
    };

    const roleLabel = (player: PlayerRegistry) => {
        switch (player.role) {
            case 'ADMIN':
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                        <span className="material-symbols-outlined text-[16px]">shield_person</span>
                        Admin
                    </span>
                );
            case 'CLUB_ADMIN':
                return (
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                        title={player.canRegisterClubMembers ? 'Puede inscribir' : 'Sin permisos de inscripción'}
                    >
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        Admin Club
                    </span>
                );
            case 'REFEREE':
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <span className="material-symbols-outlined text-[16px]">gavel</span>
                        Árbitro
                    </span>
                );
            default:
                return <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Jugador</span>;
        }
    };

    const categoryOptions: { value: 'ALL' | PlayerCategory; label: string }[] = [
        { value: 'ALL', label: 'Todos' },
        { value: 'SENIOR 1', label: 'Senior 1' },
        { value: 'SENIOR 2', label: 'Senior 2' },
        { value: 'JUVENILE', label: 'Juvenil' },
        { value: 'FEMININE', label: 'Féminas' },
        { value: 'ADMIN', label: 'Admin' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fade-in font-sans pb-32">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Base de Datos de Usuarios
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">
                        Gestiona licencias, roles y credenciales cifradas (visibles y editables solo por Administrador).
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <button
                        type="button"
                        onClick={() => exportClubCredentialsPDF(safePlayers)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] border border-gray-200 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] hover:bg-gray-50 dark:hover:bg-[#251614] text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px] text-red-600">picture_as_pdf</span>
                        Exportar PDF
                    </button>
                    <button
                        type="button"
                        onClick={handleExportClick}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] border border-gray-200 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] hover:bg-gray-50 dark:hover:bg-[#251614] text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px] text-blue-600">download</span>
                        Exportar Excel
                    </button>
                    <button
                        type="button"
                        onClick={handleImportClick}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] border border-gray-200 dark:border-[#3a201d] bg-white dark:bg-[#1b0f0d] hover:bg-gray-50 dark:hover:bg-[#251614] text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">upload_file</span>
                        Importar Excel
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d]">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Usuarios</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums mt-1">{safePlayers.length}</p>
                </div>
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d]">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Admins</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums mt-1">
                        {safePlayers.filter(p => p.role === 'ADMIN').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d]">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Árbitros</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                        {safePlayers.filter(p => p.role === 'REFEREE').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d]">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Jugadores</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">
                        {safePlayers.filter(p => p.role === 'PLAYER').length}
                    </p>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white dark:bg-[#1b0f0d] p-4 rounded-xl border border-gray-200 dark:border-[#3a201d]">
                <div className="flex-1 relative min-w-0">
                    <span className="material-symbols-outlined text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, licencia, usuario o club..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#2c1515] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm dark:text-white"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#251614] rounded-lg overflow-x-auto">
                        {categoryOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFilterCategory(opt.value)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                    filterCategory === opt.value
                                        ? 'bg-white dark:bg-[#1b0f0d] text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPasswords(v => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a201d] text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#251614] whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {showPasswords ? 'visibility_off' : 'visibility'}
                        </span>
                        {showPasswords ? 'Ocultar claves' : 'Ver claves'}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1b0f0d] rounded-xl border border-gray-200 dark:border-[#3a201d] overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-[#251614] text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#3a201d]">
                            <tr>
                                <th className="px-5 py-3.5">Rol</th>
                                <th className="px-5 py-3.5">Nombre / Licencia</th>
                                <th className="px-5 py-3.5">Tarjetas</th>
                                <th className="px-5 py-3.5">Credenciales (Solo Admin)</th>
                                <th className="px-5 py-3.5">Categoría</th>
                                <th className="px-5 py-3.5">Club / Teléfono</th>
                                <th className="px-5 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2c1515]">
                            {filteredPlayers.length > 0 ? (
                                filteredPlayers.map((player) => {
                                    const pName = safeStr(player.name, 'Sin nombre');
                                    const pLicense = safeStr(player.license, '-');
                                    const pUsername = safeStr(player.username, '-');
                                    const pPassword = safeStr(player.password);
                                    const pClub = safeStr(player.club, 'Sin Club');
                                    const pCategory = safeStr(player.category, 'SENIOR 1');
                                    const cards = getPlayerCards(player.id, pName);

                                    return (
                                        <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-[#251614] transition-colors">
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                {roleLabel(player)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white">{pName}</div>
                                                <div className="font-mono text-xs text-gray-500 dark:text-gray-400 tabular-nums">{pLicense}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {cards.length > 0 ? cards.map((card, idx) => (
                                                        <div key={idx} className="flex items-center" title={`Campeonato: ${card.competitionName}`}>
                                                            {renderCardIcon(card.color)}
                                                        </div>
                                                    )) : <span className="text-xs text-gray-400">—</span>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col text-xs font-mono tabular-nums">
                                                    <span className="text-gray-500 dark:text-gray-400">
                                                        Usr: <span className="text-gray-900 dark:text-white font-semibold">{pUsername}</span>
                                                    </span>
                                                    <span className="text-gray-500 dark:text-gray-400">
                                                        Pwd: <span className="text-gray-900 dark:text-white font-semibold">
                                                            {showPasswords ? (pPassword || '••••••') : '••••••••'}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {pCategory}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">
                                                <div>{pClub}</div>
                                                {player.phone && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 tabular-nums">
                                                        <span className="material-symbols-outlined text-[14px]">call</span>
                                                        {safeStr(player.phone)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(player)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-[#2c1515] transition-colors"
                                                    title="Editar Usuario o Cambiar Contraseña"
                                                >
                                                    <span className="material-symbols-outlined text-[17px]">edit</span>
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                                            No se encontraron usuarios con ese filtro.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setFilterCategory('ALL');
                                            }}
                                            className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#3a201d] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#251614]"
                                        >
                                            Limpiar filtros
                                        </button>
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
                    <div className="bg-white dark:bg-[#1b0f0d] rounded-2xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col border border-gray-200 dark:border-[#3a201d] overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3a201d] flex justify-between items-center bg-gray-50 dark:bg-[#251614] flex-shrink-0">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    {editingPlayerId ? 'edit' : 'person_add'}
                                </span>
                                {editingPlayerId ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-white p-1"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            {modalError && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">error</span>
                                    {modalError}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nombre Completo</label>
                                <input
                                    type="text"
                                    placeholder="ej. Juan Pérez"
                                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                                    value={newPlayerData.name}
                                    onChange={(e) => setNewPlayerData({ ...newPlayerData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Número de Licencia</label>
                                    <input
                                        type="text"
                                        placeholder="ej. MU-1234"
                                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-mono"
                                        value={newPlayerData.license}
                                        onChange={(e) => setNewPlayerData({ ...newPlayerData, license: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Teléfono (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="ej. 600123456"
                                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-mono"
                                        value={newPlayerData.phone}
                                        onChange={(e) => setNewPlayerData({ ...newPlayerData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Club</label>
                                <input
                                    type="text"
                                    placeholder="ej. Club Petanca Murcia"
                                    className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                                    value={newPlayerData.club}
                                    onChange={(e) => setNewPlayerData({ ...newPlayerData, club: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Categoría</label>
                                    <select
                                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                                        value={newPlayerData.category}
                                        onChange={(e) => setNewPlayerData({ ...newPlayerData, category: e.target.value as PlayerCategory })}
                                    >
                                        <option value="SENIOR 1">SENIOR 1</option>
                                        <option value="SENIOR 2">SENIOR 2</option>
                                        <option value="JUVENILE">JUVENIL</option>
                                        <option value="FEMININE">FÉMINAS</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Rol del Sistema</label>
                                    <select
                                        value={newPlayerData.role}
                                        onChange={(e) => setNewPlayerData({ ...newPlayerData, role: e.target.value as UserRole })}
                                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                                    >
                                        <option value="PLAYER">Jugador</option>
                                        <option value="CLUB_ADMIN">Admin de Club</option>
                                        <option value="REFEREE">Árbitro</option>
                                        <option value="ADMIN">Admin Global</option>
                                    </select>
                                </div>
                            </div>

                            {newPlayerData.role === 'CLUB_ADMIN' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Permisos de Club</label>
                                    <label className="inline-flex items-center cursor-pointer gap-3 pt-1">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={Boolean(newPlayerData.canRegisterClubMembers)}
                                            onChange={(e) => setNewPlayerData({ ...newPlayerData, canRegisterClubMembers: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-300">
                                            Puede inscribir jugadores de su club
                                        </span>
                                    </label>
                                </div>
                            )}

                            {editingPlayerId ? (
                                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-[#3a201d]">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Nueva Contraseña (Solo Admin — dejar vacío para mantener la actual)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Escribir nueva contraseña (mín. 4 caracteres)"
                                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] bg-white dark:bg-[#2c1515] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-mono"
                                        value={newPlayerData.password || ''}
                                        onChange={(e) => setNewPlayerData({ ...newPlayerData, password: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300 flex gap-2">
                                    <span className="material-symbols-outlined text-sm mt-0.5">key</span>
                                    <p>Las credenciales (Usuario y Contraseña) se generarán automáticamente y quedarán cifradas de forma segura.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#3a201d] bg-gray-50 dark:bg-[#251614] flex items-center justify-between gap-3 flex-shrink-0">
                            {editingPlayerId ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 font-semibold text-sm transition flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                    Eliminar
                                </button>
                            ) : (
                                <div></div>
                            )}
                            <div className="flex gap-3 ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a201d] text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-[#35201d] transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePlayer}
                                    disabled={isSaving || !newPlayerData.license.trim() || !newPlayerData.name.trim() || !newPlayerData.club.trim()}
                                    className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'Guardando...' : editingPlayerId ? 'Guardar Cambios' : 'Crear y Generar'}
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
                        <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Usuario Creado con Éxito!</h2>
                        <p className="text-sm text-gray-500 mb-6">Credenciales listas para entregar al jugador.</p>

                        <div className="bg-gray-100 dark:bg-[#2c1515] p-5 rounded-xl border border-gray-200 dark:border-[#3a201d] mb-6">
                            <div className="grid grid-cols-1 gap-4 text-left">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Usuario</p>
                                    <div className="text-lg font-mono font-bold text-primary bg-white dark:bg-black p-2.5 rounded border border-gray-200 dark:border-[#3a201d] tabular-nums">
                                        {newlyCreatedUser.username}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Contraseña</p>
                                    <div className="text-lg font-mono font-bold text-primary bg-white dark:bg-black p-2.5 rounded border border-gray-200 dark:border-[#3a201d] tabular-nums">
                                        {newlyCreatedUser.password}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsCredentialModalOpen(false)}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-lg transition"
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
                        <div className="size-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-3xl text-red-600">warning</span>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Eliminar usuario?</h2>
                        <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer. Se perderán todos los datos asociados a este usuario.</p>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#3a201d] text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-[#35201d] transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
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
