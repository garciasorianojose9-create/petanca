import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Html5Qrcode } from 'html5-qrcode';
import { Competition, PlayerRegistry, Team } from '../types';

interface CheckInProps {
    competition: Competition | null;
    currentUser: PlayerRegistry;
    teams: Team[];
    players: PlayerRegistry[];
    onUpdateCompetition: (comp: Competition) => void;
    onCheckIn: (teamId: string) => void;
}

const qrcodeRegionId = "html5qr-code-full-region";

const Html5QrcodePlugin = (props: any) => {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Create the instance
        const html5QrCode = new Html5Qrcode(qrcodeRegionId);
        html5QrCodeRef.current = html5QrCode;
        
        const config = {
            fps: props.fps || 10,
            qrbox: props.qrbox || 250,
        };

        const startScanner = async () => {
            try {
                // Ensure the element exists in DOM before starting
                const element = document.getElementById(qrcodeRegionId);
                if (!element) return;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText, decodedResult) => {
                        props.qrCodeSuccessCallback(decodedText, decodedResult);
                    },
                    (errorMessage) => {
                        // Suppress "NotFound" errors as they are noisy
                        if (!errorMessage.includes("NotFound")) {
                            props.qrCodeErrorCallback(errorMessage);
                        }
                    }
                );
            } catch (err) {
                console.error("Unable to start scanning.", err);
                if (props.onError) props.onError(err);
            }
        };

        startScanner();

        // cleanup function when component will unmount
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop()
                    .then(() => {
                        html5QrCodeRef.current?.clear();
                    })
                    .catch(error => {
                        console.error("Failed to stop html5Qrcode. ", error);
                    });
            }
        };
    }, []);

    return <div id={qrcodeRegionId} className="w-full h-full bg-black flex items-center justify-center overflow-hidden" />;
};

export const CheckIn: React.FC<CheckInProps> = ({ competition, currentUser, teams, players, onUpdateCompetition, onCheckIn }) => {
    const [scanned, setScanned] = useState(false);
    const [manualLicense, setManualLicense] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [activeTab, setActiveTab] = useState<'scanner' | 'manual'>('scanner');

    useEffect(() => {
        if (currentUser.role === 'ADMIN' && competition && !competition.checkinToken) {
            // Generate initial token if missing
            const newToken = `checkin-${competition.id}-${Math.random().toString(36).substring(2, 15)}`;
            onUpdateCompetition({ ...competition, checkinToken: newToken });
        }
    }, [currentUser, competition, onUpdateCompetition]);

    const handleRegenerateQR = () => {
        if (competition) {
            const newToken = `checkin-${competition.id}-${Math.random().toString(36).substring(2, 15)}`;
            onUpdateCompetition({ ...competition, checkinToken: newToken });
        }
    };

    if (!competition) {
        return (
            <div className="min-h-full flex flex-col items-center justify-center p-8 bg-zinc-950 text-white animate-fade-in">
                <div className="bg-zinc-900 p-6 rounded-full mb-6 border border-zinc-800">
                    <span className="material-symbols-outlined text-5xl text-zinc-400">qr_code_scanner</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">No Competition Selected</h2>
                <p className="text-zinc-400 text-center max-w-sm">
                    Select a competition from the list to perform Check-in.
                </p>
            </div>
        );
    }

    // --- ADMIN VIEW: DISPLAY QR CODE ---
    if (currentUser.role === 'ADMIN') {
        return (
            <div className="min-h-full flex flex-col items-center justify-center p-4 bg-zinc-950 relative text-white animate-fade-in">
                <div className="max-w-4xl w-full flex flex-col items-center gap-8 z-10">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold">Check-in QR Code</h1>
                        <p className="text-zinc-400">Display this code for players to scan upon arrival.</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-zinc-800">
                        {competition.checkinToken ? (
                            <QRCode 
                                value={JSON.stringify({ 
                                    action: 'check-in', 
                                    competitionId: competition.id, 
                                    token: competition.checkinToken 
                                })} 
                                size={256}
                                level="H"
                            />
                        ) : (
                            <div className="size-64 flex items-center justify-center text-gray-400">Generating QR...</div>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-zinc-900 px-6 py-3 rounded-xl border border-zinc-800 flex items-center gap-3">
                            <span className="material-symbols-outlined text-yellow-500">vpn_key</span>
                            <div className="text-left">
                                <p className="text-xs text-zinc-400 uppercase font-bold">Current Token</p>
                                <p className="font-mono text-sm text-white truncate max-w-[200px]">{competition.checkinToken || '...'}</p>
                            </div>
                        </div>

                        <button 
                            onClick={handleRegenerateQR}
                            className="flex items-center gap-2 px-6 py-3 bg-[#3a201d] hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-700"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                            Regenerate QR Code
                        </button>
                        <p className="text-xs text-zinc-400/60 max-w-md text-center">
                            Warning: Regenerating the code will invalidate any previous QR codes printed or shared.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleCheckInAttempt = (license: string) => {
        setErrorMsg('');
        
        // Find if the current user has this license
        if (currentUser.license.toLowerCase().trim() !== license.toLowerCase().trim()) {
            // Check if it's another player in the same team
            // Find the team the current user belongs to
            const userTeam = teams.find(t => t.players.some(p => p.toLowerCase().trim() === currentUser.name.toLowerCase().trim()));
            
            // Find the player with the given license
            const scannedPlayer = players.find(p => p.license.toLowerCase().trim() === license.toLowerCase().trim());
            
            if (!scannedPlayer || !userTeam || !userTeam.players.some(p => p.toLowerCase().trim() === scannedPlayer.name.toLowerCase().trim())) {
                setErrorMsg('La licencia no pertenece a tu equipo o no es válida.');
                return;
            }
        }

        // Find the team the current user belongs to
        const userTeam = teams.find(t => t.players.some(p => p.toLowerCase().trim() === currentUser.name.toLowerCase().trim()));
        
        if (!userTeam) {
            setErrorMsg('No estás inscrito en esta competición.');
            return;
        }

        if (userTeam.checkedIn) {
            setErrorMsg('Tu equipo ya ha realizado el check-in.');
            return;
        }

        // Perform check-in
        onCheckIn(userTeam.id);
        setScanned(true);
        setTimeout(() => setScanned(false), 5000);
    };

    const handleScan = (decodedText: string) => {
        if (scanned) return; // Ignore if already scanned successfully recently
        
        if (decodedText) {
            try {
                const data = JSON.parse(decodedText);
                if (data.action === 'check-in' && data.competitionId === competition?.id && data.token === competition?.checkinToken) {
                    // Check if already checked in to avoid error message spam
                    const userTeam = teams.find(t => t.players.some(p => p.toLowerCase().trim() === currentUser.name.toLowerCase().trim()));
                    if (userTeam && userTeam.checkedIn) {
                        setScanned(true);
                        setTimeout(() => setScanned(false), 5000);
                        return;
                    }
                    handleCheckInAttempt(currentUser.license);
                } else {
                    setErrorMsg('Código QR no válido para esta competición.');
                }
            } catch (e) {
                setErrorMsg('Formato de código QR inválido.');
            }
        }
    };

    // --- PLAYER VIEW: SCAN QR CODE ---
    return (
        <div className="min-h-full flex flex-col items-center justify-start sm:justify-center p-4 bg-zinc-950 relative text-white animate-fade-in pb-20">
            <div className="max-w-4xl w-full flex flex-col items-center gap-4 sm:gap-8 z-10">
                
                <div className="text-center space-y-1 sm:space-y-2 mt-2 sm:mt-0">
                    <h1 className="text-2xl sm:text-3xl font-bold">Control de Asistencia</h1>
                    <p className="text-sm sm:text-base text-zinc-400">Escanea el código QR de <strong className="text-white">{competition.name}</strong> para confirmar tu llegada.</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 w-full justify-center items-center lg:items-stretch">
                    
                    {/* Mobile Tabs */}
                    <div className="flex lg:hidden w-full max-w-sm bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button 
                            onClick={() => setActiveTab('scanner')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'scanner' ? 'bg-[#3a201d] text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                            Escanear QR
                        </button>
                        <button 
                            onClick={() => setActiveTab('manual')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'bg-[#3a201d] text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">keyboard</span>
                            Ingreso Manual
                        </button>
                    </div>

                    {/* Scanner UI */}
                    <div className={`relative w-full max-w-[350px] sm:max-w-[400px] bg-white dark:bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-zinc-800 ${activeTab === 'scanner' ? 'block' : 'hidden'} lg:block`}>
                        {!window.isSecureContext ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900 gap-4">
                                <span className="material-symbols-outlined text-5xl text-red-400">no_photography</span>
                                <h3 className="text-lg font-bold text-white">Cámara no disponible</h3>
                                <p className="text-sm text-zinc-400">
                                    El navegador bloquea la cámara porque la conexión no es segura (requiere HTTPS).<br/><br/>
                                    Por favor, utiliza el <strong>Ingreso Manual</strong>.
                                </p>
                            </div>
                        ) : cameraError ? (
                            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-red-400 bg-zinc-900">
                                <p>{cameraError}</p>
                            </div>
                        ) : (
                            <Html5QrcodePlugin
                                fps={10}
                                qrbox={250}
                                disableFlip={false}
                                qrCodeSuccessCallback={handleScan}
                                qrCodeErrorCallback={(error: any) => {
                                    // Only log actual errors, not "not found" which happens every frame
                                    if (error?.message && !error.message.includes("NotFound")) {
                                        console.warn(error);
                                    }
                                }}
                            />
                        )}
                        {window.isSecureContext && !cameraError && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 z-10 pointer-events-none">
                                <span className="material-symbols-outlined text-white">qr_code_scanner</span>
                                <span className="text-sm font-medium text-white whitespace-nowrap">Enfoca el código QR</span>
                            </div>
                        )}
                    </div>

                    {/* Manual Entry */}
                    <div className={`w-full max-w-sm bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex-col gap-6 ${activeTab === 'manual' ? 'flex' : 'hidden'} lg:flex`}>
                        <div className="flex items-start gap-4">
                            <div className="bg-[#3a201d] p-3 rounded-xl text-primary">
                                <span className="material-symbols-outlined">keyboard</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Ingreso Manual</h3>
                                <p className="text-sm text-zinc-400">¿No funciona la cámara? Introduce tu código de licencia manualmente.</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Número de Licencia</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={manualLicense}
                                    onChange={(e) => setManualLicense(e.target.value)}
                                    placeholder="Ej: MU-8492" 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-white placeholder-[#4a3535] focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                />
                                <span className="material-symbols-outlined absolute right-3 top-3 text-[#4a3535]">badge</span>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="text-red-500 text-sm font-bold text-center bg-red-500/10 p-2 rounded">
                                {errorMsg}
                            </div>
                        )}

                        <button 
                            onClick={() => handleCheckInAttempt(manualLicense)}
                            disabled={!manualLicense.trim()}
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            VALIDAR CÓDIGO
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-4">
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-start gap-3">
                         <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
                         <div>
                             <h4 className="font-bold text-sm">Reglamento</h4>
                             <p className="text-xs text-zinc-400">Ver normas del torneo</p>
                         </div>
                    </div>
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-start gap-3">
                         <span className="material-symbols-outlined text-yellow-500">location_on</span>
                         <div>
                             <h4 className="font-bold text-sm">Sede Actual</h4>
                             <p className="text-xs text-zinc-400">{competition.location}</p>
                         </div>
                    </div>
                </div>
            </div>

            {/* Success Toast */}
            {scanned && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#22c55e] text-white p-6 rounded-2xl shadow-[0_0_50px_rgba(34,197,94,0.5)] border-2 border-white/20 flex flex-col items-center gap-4 animate-[slideIn_0.3s_ease-out] w-[90%] max-w-sm z-[100]">
                    <div className="size-16 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold uppercase opacity-80 mb-1">Check-in Exitoso</p>
                        <h4 className="font-black text-3xl mb-2">¡Presente!</h4>
                        <p className="text-lg">{currentUser.name}</p>
                    </div>
                    <button 
                        onClick={() => setScanned(false)}
                        className="mt-4 px-8 py-3 bg-white/20 hover:bg-white/30 rounded-full font-bold transition-colors w-full"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            <footer className="absolute bottom-4 text-center w-full text-[10px] text-zinc-400 opacity-50">
                © 2024 Federación de Petanca de la Región de Murcia. Todos los derechos reservados.
            </footer>
        </div>
    );
};