
import React, { useState, useEffect } from 'react';
import { AppView, PlayerRegistry, Competition, Match } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../src/services/api';

interface LayoutProps {
    children: React.ReactNode;
    currentView: AppView;
    setView: (view: AppView) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    currentUser: PlayerRegistry;
    onLogout: () => void;
    onUpdateUser?: (user: PlayerRegistry) => void;
    selectedCompetition?: Competition | null;
    matches?: Match[];
}

import { FPRM_LOGO_BASE64 } from '../src/constants';

export const Layout: React.FC<LayoutProps> = ({ 
    children, 
    currentView, 
    setView, 
    isDarkMode, 
    toggleTheme,
    currentUser,
    onLogout,
    onUpdateUser,
    selectedCompetition,
    matches = []
}) => {
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess(false);
        if (!newPassword || newPassword.length < 4) {
            setPasswordError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Las contraseñas no coinciden.');
            return;
        }

        try {
            const updatedUser = await api.updateUser({ ...currentUser, password: newPassword });
            if (onUpdateUser) {
                onUpdateUser(updatedUser);
            }
            setPasswordSuccess(true);
            setTimeout(() => {
                setIsPasswordModalOpen(false);
                setNewPassword('');
                setConfirmPassword('');
                setPasswordSuccess(false);
            }, 2000);
        } catch (error) {
            setPasswordError('Error al cambiar la contraseña. Inténtalo de nuevo.');
        }
    };
    
    // Filter Navigation based on Role
    const allNavItems = [
        { view: AppView.DASHBOARD, icon: 'dashboard', label: 'Panel', roles: ['ADMIN'] },
        { view: AppView.COMPETITIONS_LIST, icon: 'trophy', label: 'Competiciones', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
        { view: AppView.MATCH_CENTER, icon: 'sports_handball', label: 'Partidas', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
        { view: AppView.STANDINGS, icon: 'leaderboard', label: 'Clasificación', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
        { view: AppView.POULES, icon: 'grid_view', label: 'Grupos', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
        { view: AppView.BRACKET, icon: 'emoji_events', label: 'Cuadro', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
        { view: AppView.CHECK_IN, icon: 'qr_code_scanner', label: 'QR', roles: ['ADMIN', 'PLAYER', 'CLUB_ADMIN'] },
    ];

    // Fallback: If role is missing or invalid, default to showing PLAYER items (except Dashboard)
    const userRole = currentUser.role || 'PLAYER';
    
    // FORCE ADMIN: If username is 'admin', show ALL items regardless of role state
    const navItems = allNavItems.filter(item => {
        // Case insensitive check and trim
        const cleanUsername = currentUser.username?.toLowerCase().trim();
        const isAdmin = cleanUsername === 'admin' || userRole === 'ADMIN';

        // Visibility Rule: BRACKET
        if (item.view === AppView.BRACKET) {
            if (selectedCompetition?.type === 'STANDARD') {
                const hasFinalPhaseMatches = matches.some(m => m.competitionId === selectedCompetition.id && m.round.startsWith('Knockout'));
                if (!hasFinalPhaseMatches) return false;
            }
        }

        if (isAdmin) return true;

        // For players, check specific visibility rules
        if (item.view === AppView.STANDINGS) {
            // Only show if competition allows it
            return selectedCompetition?.showStandings === true;
        }

        return item.roles.includes(userRole);
    });

    // Add Registrations for Admin
    if (currentUser.role === 'ADMIN' || currentUser.username?.toLowerCase().trim() === 'admin') {
        navItems.push({ view: AppView.CREATE_COMPETITION, icon: 'add_circle', label: 'Nueva Competición', roles: ['ADMIN'] });
        navItems.push({ view: AppView.REGISTRATIONS, icon: 'how_to_reg', label: 'Regs', roles: ['ADMIN'] });
        navItems.push({ view: AppView.ADMIN_CARDS, icon: 'style', label: 'Tarjetas', roles: ['ADMIN'] });
        navItems.push({ view: AppView.PLAYER_DATABASE, icon: 'groups', label: 'Usuarios', roles: ['ADMIN'] });
    } else if (currentUser.role === 'CLUB_ADMIN' && currentUser.canRegisterClubMembers) {
        navItems.push({ view: AppView.REGISTRATIONS, icon: 'how_to_reg', label: 'Inscripciones', roles: ['CLUB_ADMIN'] });
    }

    // Mobile Nav Logic: Show max 4 items, then "More"
    const mobileMainItems = navItems.slice(0, 4);
    const mobileMoreItems = navItems.slice(4);

    // Live Status Logic
    const [liveStatus, setLiveStatus] = useState<{message: string, timestamp: Date}>({
        message: 'Buscando partidas en directo...',
        timestamp: new Date()
    });

    useEffect(() => {
        updateStatus();
    }, [matches, currentUser.role, selectedCompetition]);

    const updateStatus = () => {
        const liveMatches = matches.filter(m => m.status === 'live');
        let newMessage = 'No hay partidas en directo.';
        
        if (liveMatches.length > 0) {
            // Check if user is playing
            const userMatch = liveMatches.find(m => 
                m.team1.players.includes(currentUser.name) || 
                m.team2.players.includes(currentUser.name)
            );
            
            if (userMatch) {
                const isTeam1 = userMatch.team1.players.includes(currentUser.name);
                const opponent = isTeam1 ? userMatch.team2.name : userMatch.team1.name;
                newMessage = `Jugando vs ${opponent} (Pista ${userMatch.court})`;
            } else {
                const firstMatch = liveMatches[0];
                newMessage = `${firstMatch.team1.name} vs ${firstMatch.team2.name}`;
                if (liveMatches.length > 1) {
                    newMessage += ` y ${liveMatches.length - 1} más`;
                }
            }
        }
        
        setLiveStatus({
            message: newMessage,
            timestamp: new Date()
        });
    };

    return (
        <div className={`flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] ${isDarkMode ? 'dark' : ''} bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans`}>
             {/* Mobile/Tablet Top Bar */}
            <header className="flex-none flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="size-10 flex items-center justify-center">
                         <img src={FPRM_LOGO_BASE64} alt="FPRM Logo" className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<div class="size-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl text-white flex items-center justify-center shadow-lg shadow-primary/20"><span class="material-symbols-outlined text-2xl">sports_baseball</span></div>'; }} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold leading-none tracking-tight hidden sm:block">Fed. Petanca Murcia</h1>
                        <span className="text-xs text-primary font-semibold sm:hidden tracking-wide">F.P.R.M.</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                     <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleTheme} 
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                     >
                        <span className="material-symbols-outlined text-[20px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                    </motion.button>
                    <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-800">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-semibold leading-tight">
                                {currentUser.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider flex items-center justify-end gap-1">
                                {currentUser.role === 'ADMIN' && <span className="material-symbols-outlined text-[10px] text-primary">verified_user</span>}
                                {currentUser.category}
                            </div>
                        </div>
                        <div className="relative group cursor-pointer">
                            <motion.div 
                                whileHover={{ scale: 1.05 }}
                                className="size-9 rounded-full bg-gray-200 bg-cover bg-center border-2 border-white dark:border-gray-700 shadow-sm" 
                                style={{backgroundImage: `url(${currentUser.avatar})`}}
                            ></motion.div>
                            {/* Dropdown for logout */}
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-1.5 hidden group-hover:block hover:block z-50 origin-top-right transition-all">
                                <button 
                                    onClick={() => setIsPasswordModalOpen(true)}
                                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2 transition-colors mb-1"
                                >
                                    <span className="material-symbols-outlined text-sm">lock_reset</span>
                                    Cambiar Contraseña
                                </button>
                                <button 
                                    onClick={onLogout}
                                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">logout</span>
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-gray-800 flex-none z-40">
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                        {navItems.map((item, index) => {
                            const isAdminItem = [AppView.CREATE_COMPETITION, AppView.REGISTRATIONS, AppView.PLAYER_DATABASE, AppView.ADMIN_CARDS].includes(item.view);
                            const prevItem = navItems[index - 1];
                            const isFirstAdminItem = isAdminItem && prevItem && ![AppView.CREATE_COMPETITION, AppView.REGISTRATIONS, AppView.PLAYER_DATABASE, AppView.ADMIN_CARDS].includes(prevItem.view);

                            return (
                                <React.Fragment key={item.view}>
                                    {isFirstAdminItem && (
                                        <div className="my-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                            <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                {currentUser.role === 'CLUB_ADMIN' ? 'Gestión de Club' : 'Administración'}
                                            </span>
                                        </div>
                                    )}
                                    <motion.button
                                        onClick={() => setView(item.view)}
                                        whileHover={{ x: 4 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                                            currentView === item.view
                                                ? 'bg-primary/10 text-primary shadow-sm dark:bg-primary/20'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined ${currentView === item.view ? 'font-fill' : ''}`}>{item.icon}</span>
                                        {item.label}
                                    </motion.button>
                                </React.Fragment>
                            );
                        })}
                    </nav>
                    
                    {/* Active Match Indicator (Visible to all) */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a1a]/50 backdrop-blur-sm">
                        <motion.div 
                            whileHover={{ y: -2 }}
                            className="bg-white dark:bg-[#252525] rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:shadow-md transition-all group" 
                            onClick={() => setView(AppView.MATCH_CENTER)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {currentUser.role === 'ADMIN' ? 'En Directo' : 'Tu Partido'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                    {liveStatus.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors line-clamp-2">
                                {liveStatus.message}
                            </p>
                        </motion.div>
                        <div className="mt-3 text-center flex flex-col gap-1 opacity-40 hover:opacity-100 transition-opacity">
                            <span className="text-[9px] font-mono">v1.4-pro</span>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-[#121212] relative flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentView}
                            initial={{ opacity: 0, y: 10, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.99 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="flex-1 overflow-auto custom-scrollbar pb-24 md:pb-0 h-full w-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            
            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
                 <div className="flex items-center justify-around">
                    {mobileMainItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => {
                                setView(item.view);
                                setShowMobileMenu(false);
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] ${
                                currentView === item.view 
                                ? 'text-primary bg-primary/5 dark:bg-primary/10' 
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                        >
                            <motion.span 
                                whileTap={{ scale: 0.8 }}
                                className={`material-symbols-outlined text-2xl ${currentView === item.view ? 'font-fill' : ''}`}
                            >
                                {item.icon}
                            </motion.span>
                            <span className="text-[10px] font-medium truncate max-w-[64px]">{item.label}</span>
                        </button>
                    ))}
                    
                    {mobileMoreItems.length > 0 && (
                        <button
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] ${
                                showMobileMenu ? 'text-primary bg-primary/5' : 'text-gray-400'
                            }`}
                        >
                            <motion.span whileTap={{ scale: 0.8 }} className="material-symbols-outlined text-2xl">menu</motion.span>
                            <span className="text-[10px] font-medium">Más</span>
                        </button>
                    )}
                 </div>
            </div>

            {/* Mobile More Menu Overlay */}
            <AnimatePresence>
                {showMobileMenu && (
                    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end" onClick={() => setShowMobileMenu(false)}>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        ></motion.div>
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="relative w-full bg-white dark:bg-[#1e1e1e] rounded-t-3xl shadow-2xl border-t border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]" 
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-3"></div>
                            <div className="p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar pb-[calc(1rem+env(safe-area-inset-bottom))]">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 px-2">Menú Principal</h3>
                                {mobileMoreItems.map((item) => (
                                    <button
                                        key={item.view}
                                        onClick={() => {
                                            setView(item.view);
                                            setShowMobileMenu(false);
                                        }}
                                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                                            currentView === item.view
                                                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined text-[24px] ${currentView === item.view ? 'font-fill' : ''}`}>{item.icon}</span>
                                        {item.label}
                                    </button>
                                ))}
                                <div className="h-px bg-gray-200 dark:bg-gray-800 my-2 mx-2"></div>
                                <button 
                                    onClick={() => {
                                        setShowMobileMenu(false);
                                        setIsPasswordModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    <span className="material-symbols-outlined text-[24px]">lock_reset</span>
                                    Cambiar Contraseña
                                </button>
                                <button 
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                                >
                                    <span className="material-symbols-outlined text-[24px]">logout</span>
                                    Cerrar Sesión
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Password Change Modal */}
            <AnimatePresence>
                {isPasswordModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsPasswordModalOpen(false)}
                        ></motion.div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">lock_reset</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cambiar Contraseña</h2>
                                </div>

                                {passwordSuccess ? (
                                    <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        <p className="text-sm font-medium">¡Contraseña cambiada con éxito!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {passwordError && (
                                            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-base">error</span>
                                                {passwordError}
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nueva Contraseña</label>
                                            <input 
                                                type="password" 
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                placeholder="Mínimo 4 caracteres"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirmar Contraseña</label>
                                            <input 
                                                type="password" 
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                placeholder="Repite la nueva contraseña"
                                            />
                                        </div>
                                        <div className="flex gap-3 mt-6">
                                            <button 
                                                onClick={() => setIsPasswordModalOpen(false)}
                                                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={handleChangePassword}
                                                className="flex-1 py-3 px-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all"
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
