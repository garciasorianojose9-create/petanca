import React, { useState, useEffect } from "react";
import { Competition } from "../types";

interface CreateCompetitionProps {
  onCreate: (comp: Competition) => void;
}

export const CreateCompetition: React.FC<CreateCompetitionProps> = ({
  onCreate,
}) => {
  const [isPhase2Expanded, setIsPhase2Expanded] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [maxTeams, setMaxTeams] = useState("64");
  const [teamFormat, setTeamFormat] = useState<
    "INDIVIDUAL" | "DUPLETA" | "TRIPLETA"
  >("DUPLETA");
  const [tournamentType, setTournamentType] = useState<"STANDARD" | "KNOCKOUT">(
    "STANDARD",
  );
  const [hasRepesca, setHasRepesca] = useState(false);
  const [repescaOrigin, setRepescaOrigin] = useState<
    "ROUND_1" | "ROUND_2" | "MANUAL"
  >("ROUND_1");
  const [courtStart, setCourtStart] = useState<number | "">(1);
  const [courtEnd, setCourtEnd] = useState<number | "">(64);

  // Swiss Config
  const [totalRounds, setTotalRounds] = useState<number>(4);
  const [swissTiebreaker, setSwissTiebreaker] = useState<string>("Buchholz");

  // Group Phase Config
  const [qualifiersCount, setQualifiersCount] = useState<number>(16);
  const [qualificationRule, setQualificationRule] = useState<
    "top2" | "top2_thirds"
  >("top2");
  const [bestThirdsCount, setBestThirdsCount] = useState<number>(2);

  // Phases
  const [phases, setPhases] = useState<any[]>([
    {
      id: "1",
      type: "SWISS",
      totalRounds: 4,
      swissTiebreaker: "Buchholz",
      status: "PENDING",
    },
    {
      id: "2",
      type: "POULES",
      qualifiersCount: 16,
      qualificationRule: "top2",
      status: "PENDING",
    },
    { id: "3", type: "KNOCKOUT", status: "PENDING" },
  ]);

  const handleAddPhase = (type: "SWISS" | "POULES" | "KNOCKOUT") => {
    const id = (phases.length + 1).toString();
    const newPhase: any =
      type === "SWISS"
        ? {
            id,
            type,
            totalRounds: 4,
            swissTiebreaker: "Buchholz",
            status: "PENDING",
            timeLimit: 60,
          }
        : type === "POULES"
          ? {
              id,
              type,
              qualifiersCount: 16,
              qualificationRule: "top2",
              status: "PENDING",
              timeLimit: 45,
            }
          : { id, type, status: "PENDING", timeLimit: 60 };
    setPhases([...phases, newPhase]);
  };

  const handleUpdatePhase = (id: string, updates: any) => {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleRemovePhase = (id: string) => {
    setPhases(phases.filter((p) => p.id !== id));
  };

  // Map State
  const [locationQuery, setLocationQuery] = useState(
    "Gran Vía Escultor Salzillo, Murcia",
  );
  const [coordinates, setCoordinates] = useState({ lat: 37.987, lng: -1.13 }); // Default to Murcia Center
  const [isSearching, setIsSearching] = useState(false);

  const [imageType, setImageType] = useState<
    "RANDOM" | "CUSTOM" | "LOGO" | "NONE"
  >("RANDOM");
  const [customImageUrl, setCustomImageUrl] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!locationQuery) {
        return;
      }

      setIsSearching(true);
      try {
        // Use OpenStreetMap Nominatim API for real geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}`,
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const firstResult = data[0];
          setCoordinates({
            lat: parseFloat(firstResult.lat),
            lng: parseFloat(firstResult.lon),
          });
        }
      } catch (error) {
        console.error("Failed to geocode address:", error);
      } finally {
        setIsSearching(false);
      }
    }, 1000); // 1s debounce to be gentle on the free API

    return () => clearTimeout(timer);
  }, [locationQuery]);

  // Construct OpenStreetMap Embed URL
  // bbox = min_lon,min_lat,max_lon,max_lat
  // We use a small delta to zoom in closely for specific addresses
  const delta = 0.005; // ~500m radius roughly
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - delta},${coordinates.lat - delta},${coordinates.lng + delta},${coordinates.lat + delta}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`;

  const handlePublish = () => {
    if (!name || !startDate) {
      alert(
        "Por favor, introduce al menos un nombre para la competición y una fecha de inicio.",
      );
      return;
    }

    const newComp: Competition = {
      id: Date.now().toString(),
      name: name,
      organizer: "Fed. Petanca Murcia", // Default
      location: venue || locationQuery.split(",")[0] || "Murcia",
      startDate: startDate,
      endDate: endDate || startDate,
      status: "UPCOMING",
      type: tournamentType,
      registeredCount: 0,
      maxTeams: parseInt(maxTeams) || 64,
      image:
        imageType === "RANDOM"
          ? `https://picsum.photos/seed/${Date.now()}/600/300`
          : imageType === "CUSTOM"
            ? customImageUrl
            : imageType === "NONE"
              ? ""
              : "LOGO",
      format: teamFormat,
      phases:
        tournamentType === "STANDARD"
          ? phases.map((p, i) => ({
              ...p,
              id: `phase-${i + 1}`,
              name: `Fase ${i + 1}: ${p.type === "SWISS" ? "Suizo" : p.type === "POULES" ? "Grupos" : "Cuadro"}`,
            }))
          : undefined,
      courtStart: typeof courtStart === "number" ? courtStart : undefined,
      courtEnd: typeof courtEnd === "number" ? courtEnd : undefined,
      totalRounds: tournamentType === "STANDARD" ? totalRounds : undefined,
      swissTiebreaker:
        tournamentType === "STANDARD" ? swissTiebreaker : undefined,
      hasRepesca: tournamentType === "KNOCKOUT" ? hasRepesca : undefined,
      repescaOrigin:
        tournamentType === "KNOCKOUT" && hasRepesca ? repescaOrigin : undefined,
      qualifiersCount: qualifiersCount,
      qualificationRule: qualificationRule,
      bestThirdsCount:
        qualificationRule === "top2_thirds" ? bestThirdsCount : undefined,
    };

    onCreate(newComp);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-6 md:p-10 font-display text-slate-800 dark:text-slate-100 animate-fade-in">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center gap-2 text-sm font-medium">
          <button className="text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">dashboard</span>
            Panel
          </button>
          <span className="material-symbols-outlined text-slate-400 text-base">
            chevron_right
          </span>
          <span className="text-primary font-bold">Crear Competición</span>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Crear Nueva Competición
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Configura la estructura, reglas y detalles para el próximo evento.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePublish}
              className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined">publish</span>
              Crear y Publicar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL: General Info */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          {/* Card */}
          <div className="bg-surface dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  info
                </span>
                Información General
              </h3>
              <span className="text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
                Paso 1/2
              </span>
            </div>
            <div className="p-6 space-y-6">
              {/* Tournament Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Nombre de la Competición
                </label>
                <input
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 transition-shadow bg-slate-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 placeholder:text-slate-400 font-medium dark:text-white"
                  placeholder="ej., Campeonato Regional de Murcia 2024"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Fecha de Inicio
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-lg">
                      calendar_today
                    </span>
                    <input
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 font-medium text-slate-600 dark:text-white"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Fecha de Fin
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-lg">
                      event
                    </span>
                    <input
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 font-medium text-slate-600 dark:text-white"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {/* Address & Map */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Dirección de la Competición
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined">
                    location_on
                  </span>
                  <input
                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 font-medium dark:text-white transition-all"
                    placeholder="Introduce la dirección exacta (ej. Calle Mayor, 12, Murcia)..."
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                  {isSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  )}
                </div>
                {/* Interactive Map (OpenStreetMap) */}
                <div className="relative w-full h-56 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 mt-2 group shadow-inner bg-slate-100 dark:bg-zinc-900">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    title="Location Map"
                    src={mapUrl}
                    className="grayscale hover:grayscale-0 transition-all duration-500 opacity-90 hover:opacity-100 dark:invert-[.85] dark:hover:invert-0"
                  ></iframe>
                  <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/80 px-2 py-1 rounded text-[10px] font-bold shadow-sm pointer-events-none">
                    OpenStreetMap
                  </div>
                </div>
              </div>
              {/* Venue Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Sede / Nombre del Club
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">
                    stadium
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 font-medium dark:text-white"
                    placeholder="ej., Club Petanca Las Torres"
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
              </div>

              {/* Team Format */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Formato de Equipo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["INDIVIDUAL", "DUPLETA", "TRIPLETA"].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setTeamFormat(fmt as any)}
                      className={`py-3 px-3 rounded-lg border text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                        teamFormat === fmt
                          ? "bg-primary text-white border-primary shadow-md ring-2 ring-primary/20"
                          : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {fmt === "INDIVIDUAL"
                          ? "person"
                          : fmt === "DUPLETA"
                            ? "group"
                            : "groups"}
                      </span>
                      {fmt === "INDIVIDUAL"
                        ? "Individual"
                        : fmt === "DUPLETA"
                          ? "Dupleta"
                          : "Tripleta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Courts (Pistas) Range */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Rango de Pistas a utilizar
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Define las pistas que están reservadas para esta competición
                  (ej. de la 1 a la 12).
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      Desde:
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={courtStart}
                      onChange={(e) =>
                        setCourtStart(
                          e.target.value === "" ? "" : parseInt(e.target.value),
                        )
                      }
                      className="w-full pl-14 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-white font-medium"
                    />
                  </div>
                  <span className="text-slate-400 font-bold">-</span>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      Hasta:
                    </span>
                    <input
                      type="number"
                      min={courtStart || 1}
                      value={courtEnd}
                      onChange={(e) =>
                        setCourtEnd(
                          e.target.value === "" ? "" : parseInt(e.target.value),
                        )
                      }
                      className="w-full pl-14 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Competition Image */}
              <div className="space-y-3 pt-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Imagen de Fondo
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setImageType("RANDOM")}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      imageType === "RANDOM"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      shuffle
                    </span>
                    Aleatoria
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageType("CUSTOM")}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      imageType === "CUSTOM"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      image
                    </span>
                    Personalizar
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageType("LOGO")}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      imageType === "LOGO"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      logo_dev
                    </span>
                    Logo Fed.
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageType("NONE")}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      imageType === "NONE"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      block
                    </span>
                    Sin Imagen
                  </button>
                </div>

                {imageType === "CUSTOM" && (
                  <div className="mt-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="URL de la imagen (ej: https://...)"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-primary/20 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      Pega la dirección de enlace de una imagen de internet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Helper info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 p-4 rounded-lg flex gap-3 items-start border border-blue-100 dark:border-blue-900/30">
            <span className="material-symbols-outlined mt-0.5">help</span>
            <p className="text-sm">
              ¿Necesitas ayuda configurando las fases? Consulta nuestras{" "}
              <a className="font-bold underline cursor-pointer">
                Directrices Oficiales 2024
              </a>{" "}
              antes de continuar.
            </p>
          </div>
        </section>

        {/* RIGHT PANEL: Competition Structure */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          {/* Section Header */}
          <div className="bg-surface dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  account_tree
                </span>
                Estructura de la Competición
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Autoguardado
                </span>
                <span className="material-symbols-outlined text-green-500 text-sm">
                  check_circle
                </span>
              </div>
            </div>
            <div className="p-6 space-y-8 flex-1">
              {/* Categories */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                  Categorías
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="cursor-pointer group relative">
                    <input
                      defaultChecked
                      className="peer sr-only"
                      type="checkbox"
                    />
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-600 dark:text-slate-300 font-bold peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:border-primary transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">
                        accessibility_new
                      </span>
                      Senior
                    </div>
                    <div className="absolute top-[-6px] right-[-6px] size-5 bg-primary text-white rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity scale-75 peer-checked:scale-100">
                      <span className="material-symbols-outlined text-[14px]">
                        check
                      </span>
                    </div>
                  </label>
                  <label className="cursor-pointer group relative">
                    <input className="peer sr-only" type="checkbox" />
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-600 dark:text-slate-300 font-bold peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:border-primary transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">
                        child_care
                      </span>
                      Juvenil
                    </div>
                    <div className="absolute top-[-6px] right-[-6px] size-5 bg-primary text-white rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity scale-75 peer-checked:scale-100">
                      <span className="material-symbols-outlined text-[14px]">
                        check
                      </span>
                    </div>
                  </label>
                  <label className="cursor-pointer group relative">
                    <input
                      defaultChecked
                      className="peer sr-only"
                      type="checkbox"
                    />
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-600 dark:text-slate-300 font-bold peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:border-primary transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">
                        female
                      </span>
                      Femenina
                    </div>
                    <div className="absolute top-[-6px] right-[-6px] size-5 bg-primary text-white rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity scale-75 peer-checked:scale-100">
                      <span className="material-symbols-outlined text-[14px]">
                        check
                      </span>
                    </div>
                  </label>
                  <label className="cursor-pointer group relative">
                    <input className="peer sr-only" type="checkbox" />
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-600 dark:text-slate-300 font-bold peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:border-primary transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">
                        diversity_3
                      </span>
                      Mixta
                    </div>
                    <div className="absolute top-[-6px] right-[-6px] size-5 bg-primary text-white rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity scale-75 peer-checked:scale-100">
                      <span className="material-symbols-outlined text-[14px]">
                        check
                      </span>
                    </div>
                  </label>
                </div>
              </div>
              <hr className="border-slate-100 dark:border-zinc-800" />
              {/* Tournament Type */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                  Tipo de Torneo
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setTournamentType("STANDARD")}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      tournamentType === "STANDARD"
                        ? "bg-primary/5 border-primary ring-1 ring-primary"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary">
                        format_list_numbered
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Estándar
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Suizo + Grupos + Finales
                    </p>
                  </button>
                  <button
                    onClick={() => setTournamentType("KNOCKOUT")}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      tournamentType === "KNOCKOUT"
                        ? "bg-primary/5 border-primary ring-1 ring-primary"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary">
                        account_tree
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Eliminación Directa
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Directa + Consolación + Repesca
                    </p>
                  </button>
                </div>
              </div>

              {tournamentType === "KNOCKOUT" && (
                <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Habilitar Repesca
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Añade un tercer cuadro para perdedores seleccionados.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={hasRepesca}
                        onChange={(e) => setHasRepesca(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {hasRepesca && (
                    <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        Origen de la Repesca
                      </label>
                      <select
                        value={repescaOrigin}
                        onChange={(e) =>
                          setRepescaOrigin(e.target.value as any)
                        }
                        className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-950 dark:text-white"
                      >
                        <option value="ROUND_1">
                          Perdedores 1ª Ronda Directa
                        </option>
                        <option value="ROUND_2">
                          Perdedores 2ª Ronda Directa
                        </option>
                        <option value="MANUAL">Selección Manual (Admin)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <hr className="border-slate-100 dark:border-zinc-800" />
              {/* Phases */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                    Fases de la Competición
                  </label>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Nota: Actualmente el sistema soporta la visualización estándar
                  del flujo Fase 1 a Fase 2 a Fase 3. Puedes editar el formato
                  general arriba. Los rangos de pistas se asignan
                  individualmente durante el panel de control del torneo.
                </div>

                {tournamentType === "STANDARD" ? (
                  <>
                    {phases.map((phase, idx) => (
                      <div
                        key={phase.id}
                        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-4 relative group hover:border-primary/30 transition-colors shadow-sm"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-l-lg"></div>
                        <div className="flex justify-between items-start mb-4 pl-3">
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {phase.type === "SWISS"
                                ? `Fase ${idx + 1}: Sistema Suizo`
                                : phase.type === "POULES"
                                  ? `Fase ${idx + 1}: Grupos`
                                  : `Fase ${idx + 1}: Eliminatoria`}
                              <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                {phase.type === "SWISS"
                                  ? "Clasificatoria"
                                  : phase.type === "POULES"
                                    ? "Grupos"
                                    : "Finales"}
                              </span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {phase.type === "SWISS"
                                ? "Emparejamiento estándar sistema Suizo."
                                : phase.type === "POULES"
                                  ? "Formato GSL (Grupos)."
                                  : "Eliminación directa progresiva."}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemovePhase(phase.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                          </button>
                        </div>
                        
                        <div className="pl-3 mb-4">
                          <div className="flex justify-between items-end mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                              Duración (minutos)
                            </label>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">0 = Sin límite</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={phase.timeLimit !== undefined ? phase.timeLimit : 60}
                              onChange={(e) => handleUpdatePhase(phase.id, { timeLimit: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                              className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-900 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-sm">schedule</span>
                          </div>
                        </div>

                        {phase.type === "SWISS" && (
                          <div className="pl-3 grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Rondas
                              </label>
                              <select
                                value={totalRounds}
                                onChange={(e) =>
                                  setTotalRounds(parseInt(e.target.value))
                                }
                                className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-900 dark:text-white"
                              >
                                <option value={3}>3 Rondas</option>
                                <option value={4}>4 Rondas</option>
                                <option value={5}>5 Rondas</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Desempate
                              </label>
                              <select
                                value={swissTiebreaker}
                                onChange={(e) =>
                                  setSwissTiebreaker(e.target.value)
                                }
                                className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-900 dark:text-white"
                              >
                                <option value="Buchholz">Buchholz</option>
                                <option value="Enfrentamiento Directo">
                                  Enfrentamiento Directo
                                </option>
                                <option value="Diferencia de Puntos">
                                  Diferencia de Puntos
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                        {phase.type === "POULES" && (
                          <div className="pl-3 grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Equipos que pasan
                              </label>
                              <input
                                type="number"
                                value={qualifiersCount}
                                onChange={(e) =>
                                  setQualifiersCount(
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-900 dark:text-white"
                              />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Regla de Clasificación
                              </label>
                              <select
                                value={qualificationRule}
                                onChange={(e) =>
                                  setQualificationRule(e.target.value as any)
                                }
                                className="w-full text-sm border border-slate-200 dark:border-zinc-800 rounded-md py-2 px-3 focus:ring-primary/20 focus:border-primary bg-white dark:bg-zinc-900 dark:text-white"
                              >
                                <option value="top2">
                                  Pasan los 2 mejores
                                </option>
                                <option value="top2_thirds">
                                  Pasan 2 mejores + terceros
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 justify-center mt-2">
                      <button
                        onClick={() => handleAddPhase("SWISS")}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-zinc-700"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          add
                        </span>{" "}
                        Añadir Suizo
                      </button>
                      <button
                        onClick={() => handleAddPhase("POULES")}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-zinc-700"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          add
                        </span>{" "}
                        Añadir Grupos
                      </button>
                      <button
                        onClick={() => handleAddPhase("KNOCKOUT")}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-zinc-700"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          add
                        </span>{" "}
                        Añadir Eliminatoria
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-4 relative group hover:border-accent/50 transition-colors shadow-sm">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-accent rounded-l-lg"></div>
                    <div className="flex justify-between items-start mb-4 pl-3">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Fase Única: Eliminación Directa
                          <span className="bg-accent/20 text-yellow-700 dark:text-yellow-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                            Knockout
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Sorteo inicial. Ganadores a Directa, perdedores a
                          Consolación.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <hr className="border-slate-100 dark:border-zinc-800" />
              {/* Registration Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Máx. Equipos
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-800 focus:border-primary focus:ring focus:ring-primary/20 font-medium bg-white dark:bg-zinc-900 dark:text-white"
                      type="number"
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                      Equipos
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Licencia Federativa
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">
                        badge
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Requerida
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        defaultChecked
                        className="sr-only peer"
                        type="checkbox"
                        value=""
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
