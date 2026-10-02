
import React, { useState } from 'react';

interface LoginProps {
    onLogin: (username: string, pass: string) => void;
    error?: string;
    isLoading?: boolean;
    isOffline?: boolean;
}

import { FPRM_LOGO_BASE64 } from '../src/constants';

export const Login: React.FC<LoginProps> = ({ onLogin, error, isLoading, isOffline }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] flex flex-col items-center justify-center bg-[#221210] relative overflow-hidden font-display">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="w-full max-w-md px-6 relative z-10 animate-fade-in flex flex-col justify-center">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center size-20 bg-[#2c1515] rounded-2xl mb-4 shadow-2xl border border-[#3a201d] group overflow-hidden">
                        <img src={FPRM_LOGO_BASE64} alt="FPRM Logo" className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class="material-symbols-outlined text-5xl text-primary group-hover:scale-110 transition-transform">sports_baseball</span>'; }} />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight mb-1">Fed. Petanca Murcia</h1>
                    <p className="text-sm text-[#cb9090]">Sistema de Gestión de Competiciones</p>
                </div>

                <div className="bg-[#2c1515]/80 backdrop-blur-md border border-[#3a201d] rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#cb9090] uppercase tracking-wider ml-1">Usuario</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 text-xl">person</span>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#1b0f0d] border border-[#3a201d] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder="Ingrese su usuario"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#cb9090] uppercase tracking-wider ml-1">Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 text-xl">lock</span>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#1b0f0d] border border-[#3a201d] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder="Ingrese su contraseña"
                                />
                            </div>
                        </div>

                        {isOffline && (
                            <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-3 flex items-center gap-2 text-yellow-400 text-xs font-medium">
                                <span className="material-symbols-outlined text-base">wifi_off</span>
                                Modo sin conexión activado.
                            </div>
                        )}

                        {error && !isOffline && (
                            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-center gap-2 text-red-400 text-xs font-medium animate-pulse">
                                <span className="material-symbols-outlined text-base">error</span>
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className={`mt-2 w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'CONECTANDO...' : 'INICIAR SESIÓN'}
                            {!isLoading && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
                        </button>
                    </form>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[10px] text-[#cb9090]/60">
                        ID de Sesión: {Math.random().toString(36).substring(7).toUpperCase()}
                    </p>
                </div>
            </div>
        </div>
    );
};
