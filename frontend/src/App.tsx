/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { supabase, authUser, requireSupabase } from './services/supabase';
import { listPackages, createPackage, readState, writeState, EMPTY_QUIZ } from './services/persistence';
import type { PackageRow, QuizState } from './services/persistence';
import { AuthModal } from "./components/AuthModal/AuthModal";
import type { AuthUser } from "./components/AuthModal/AuthModal";
import { Header } from "./components/Header/Header";
import { PlayerHUD } from "./components/PlayerHUD/PlayerHUD";
import { Step1Ingestion } from "./components/Step1Ingestion/Step1Ingestion";
import { Step2KnowledgeQuest } from "./components/Step2KnowledgeQuest/Step2KnowledgeQuest";
import { Step3OCICloud } from "./components/Step3OCICloud/Step3OCICloud";
import { BadgeModal } from "./components/BadgeModal/BadgeModal";
import { CreditosModal } from "./creditos/CreditosModal";
import { SCENARIOS, INITIAL_ACHIEVEMENTS } from "./data/mockScenarios";
import type {
  AdaptedContentPackage,
  RecipientProfile,
  OutputFormat,
  IndustryNiche,
  DetailLevel,
  Achievement,
  MuestraPregenerada,
  OrigenContenido,
} from "./types/types";
import { triggerLevelUpConfetti, triggerSmallConfetti } from "./utils/confetti";
import { sonar } from "./utils/sonidos";
import { mazoAnkiCsv, nombreArchivoAnki } from "./utils/exportAnki";
import { solicitarAdaptacion, exportarDossierPDF } from "./services/api";
import { cargarMuestra, escenarioDe, indiceMuestras } from "./services/muestras";
import { estacionesResueltas } from "./utils/paqueteIncremental";
import styles from "./App.module.css";

/** Etapas de la carga de una muestra: las de una generación, dichas como lo que son. */
const ETAPAS_MUESTRA = [
  "Abriendo la muestra pregenerada (sin gastar cuota)…",
  "Muestra · Estación 1: Resumen",
  "Muestra · Estación 2: Tarjetas didácticas",
  "Muestra · Estación 3: Guía paso a paso",
  "Muestra · Estación 4: Contenido AudioVisual",
  "Muestra · Estación 5: Cuestionario",
];
const PAUSA_ETAPA_MUESTRA_MS = 550;

export default function App() {
  // Autenticación
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Stepper workflow principal: 1 = Ingesta, 2 = Knowledge Quest, 3 = Métricas & OCI
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Control de estación activa dentro del Paso 2 (0 a 4)
  const [activeStationIndex, setActiveStationIndex] = useState<number>(0);

  // Paquete técnico activo (por defecto Escenario 0: Redes VCN)
  const [currentPackage, setCurrentPackage] = useState<AdaptedContentPackage>(
    SCENARIOS[0].data,
  );

  // Gamification HUD State
  const [xp, setXp] = useState<number>(0);
  const [streakDays] = useState<number>(1);
  const [cognitiveShields, setCognitiveShields] = useState<number>(3);
  const [recentXpGain, setRecentXpGain] = useState<number | null>(null);

  // Seguimiento de estaciones completadas (0 a 4)
  const [completedStations, setCompletedStations] = useState<
    Record<number, boolean>
  >({});

  // Sistema de Medallas y Trofeos
  const [achievements, setAchievements] =
    useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [selectedBadgeForModal, setSelectedBadgeForModal] =
    useState<Achievement | null>(null);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState<boolean>(false);
  const [isCreditosModalOpen, setIsCreditosModalOpen] = useState<boolean>(false);

  // Estado del Pipeline y sus 5 micro-etapas
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [unlockedStations, setUnlockedStations] = useState<number[]>([0, 1, 2, 3, 4]);
  const [generatingMessage, setGeneratingMessage] = useState<string>("");
  // El historial no se muestra (decisión del usuario, 14/10); al entrar se abre el último paquete
  const [, setHistory] = useState<PackageRow[]>([]);
  const [packageId, setPackageId] = useState<string | null>(null);
  // Identidad del recorrido montado en el Paso 2. Se fija al abrir un paquete o al empezar a
  // recibir recursos, y no cambia cuando llega el paquete final: así la estación en uso no se reinicia.
  const [questKey, setQuestKey] = useState<string>('demo');
  // Los pasos 2 y 3 solo se abren con un paquete real: generado (documento o demo) o restaurado.
  // Antes de eso, el paquete de ejemplo no se muestra como si fuera un resultado (15/10).
  const [paqueteListo, setPaqueteListo] = useState(false);
  // Documentos de ejemplo con su paquete y su video ya generados (no gastan cuota al abrirlos)
  const [muestras, setMuestras] = useState<Record<string, MuestraPregenerada[]>>({});
  useEffect(() => {
    let vivo = true;
    void indiceMuestras().then((indice) => {
      if (vivo) setMuestras(indice);
    });
    return () => {
      vivo = false;
    };
  }, []);
  // Sin Supabase no hay sesión que comprobar: se arranca listo y en modo local.
  const [ready, setReady] = useState(!supabase);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState<boolean>(false);
  const [quizState, setQuizState] = useState<QuizState>(EMPTY_QUIZ);
  const [syncMessage, setSyncMessage] = useState(
    supabase ? 'Comprobando sesión…' : 'Modo local (sin Supabase). Tu trabajo se guardará en esta sesión.',
  );
  const accountVersion = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestState = useRef({ currentStep, activeStationIndex, completedStations, cognitiveShields, xp, achievements, quizState });
  // Se actualiza tras cada render (no durante él), antes que cualquier useEffect que lo lea.
  useLayoutEffect(() => {
    latestState.current = { currentStep, activeStationIndex, completedStations, cognitiveShields, xp, achievements, quizState };
  });

  // Al cambiar de paso o de estación se empieza por arriba: el botón que lleva ahí suele estar al
  // final de la página y, sin esto, el recorrido se abría a media altura (en el diagrama).
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep, activeStationIndex]);

  const restorePackage = async (row: PackageRow, version: number) => {
    const { progress, state } = await readState(row.id);
    if (version !== accountVersion.current) return;
    setCurrentPackage(row.payload); setPackageId(row.id); setQuestKey(row.id); setPaqueteListo(true);
    setCurrentStep(progress?.current_step || 2);
    setActiveStationIndex(progress?.active_station_index || 0);
    setCompletedStations(progress?.completed_stations || {});
    setCognitiveShields(progress?.cognitive_shields ?? 3);
    setQuizState({ ...EMPTY_QUIZ, ...(progress?.quiz_answers || {}) });
    setXp(state.xp);
    setAchievements(state.achievements.length ? state.achievements : INITIAL_ACHIEVEMENTS);
  };

const [ajustesSeleccionados, setAjustesSeleccionados] = useState<{
  perfil?: string;
  sector?: string;
  nivel?: string;
}>({});

  useEffect(() => {
    if (!supabase) return;
    const versiones = accountVersion;
    let disposed = false;
    let currentOwner: string | null | undefined;
    const refresh = async () => {
      try {
        const { data, error } = await supabase!.auth.getUser();
        if (disposed) return;
        const nextOwner = data.user?.id || null;
        if (nextOwner === currentOwner) return;
        currentOwner = nextOwner;
        const version = ++accountVersion.current;
        setReady(false); setUser(null); setHistory([]); setPackageId(null); setPaqueteListo(false);
        setCurrentPackage(SCENARIOS[0].data); setCurrentStep(1); setActiveStationIndex(0);
        setCompletedStations({}); setCognitiveShields(3); setXp(0);
        setQuizState(EMPTY_QUIZ);
        setIsProcessing(false); setIsGenerating(false); setProcessingStage(''); setGeneratingMessage('');
        setAchievements(INITIAL_ACHIEVEMENTS); setIsTrophyModalOpen(false); setSelectedBadgeForModal(null);
        if (!data.user) {
          setReady(true);
          setSyncMessage(error && error.name !== 'AuthSessionMissingError' ? error.message : 'Modo Invitado · Inicia sesión si deseas sincronizar en la nube.');
          return;
        }
        setUser(authUser(data.user)); setIsAuthOpen(false);
        const rows = await listPackages();
        const state = await supabase!.from('user_state').select('*').eq('user_id', nextOwner).single();
        if (state.error) throw state.error;
        if (disposed || version !== accountVersion.current) return;
        setHistory(rows); setXp(state.data.xp);
        setAchievements(state.data.achievements.length ? state.data.achievements : INITIAL_ACHIEVEMENTS);
        const last = rows.find(r => r.id === state.data.preferences.last_package_id);
        if (last) await restorePackage(last, version);
        if (!disposed && version === accountVersion.current) { setReady(true); setSyncMessage('Historial recuperado desde Supabase.'); }
      } catch (error) {
        if (!disposed) {
          setReady(true);
          setSyncMessage('No se pudo recuperar la cuenta: ' + (error instanceof Error ? error.message : String(error)));
        }
      } finally {
        if (!disposed) setReady(true);
      }
    };
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(() => { if (!disposed) void refresh(); }, 0); });
    return () => { disposed = true; versiones.current++; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !ready || user.id === '00000000-0000-0000-0000-000000000000') return;
    const ownerId = user.id; const version = accountVersion.current;
    const timer = setTimeout(() => {
      const snapshot = { ...latestState.current };
      setSyncMessage('Guardando progreso…');
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (version !== accountVersion.current) return;
        await writeState(ownerId, packageId, snapshot);
        if (version === accountVersion.current) setSyncMessage('Progreso guardado en Supabase.');
      }).catch(error => { if (version === accountVersion.current) setSyncMessage('Error de guardado: ' + error.message); });
    }, 400);
    return () => clearTimeout(timer);
  }, [user, ready, packageId, currentStep, activeStationIndex, completedStations, cognitiveShields, xp, achievements, quizState]);

  const logout = async () => {
    try {
      if (user && ready && user.id !== '00000000-0000-0000-0000-000000000000') {
        await saveQueue.current;
        await writeState(user.id, packageId, latestState.current);
      }
      if (supabase && user?.id !== '00000000-0000-0000-0000-000000000000') {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }
      setUser(null);
      setSyncMessage('Modo Invitado · Inicia sesión si deseas sincronizar en la nube.');
    } catch (error) { setSyncMessage('No se cerró la sesión: ' + (error instanceof Error ? error.message : String(error))); }
  };

  const completedStationsCount =
    Object.values(completedStations).filter(Boolean).length;
  const unlockedBadgesCount = achievements.filter((a) => a.desbloqueado).length;

  // Otorgar XP con badge animado
  const addXp = (amount: number) => {
    setXp((prev) => prev + amount);
    setRecentXpGain(amount);
    setTimeout(() => {
      setRecentXpGain(null);
    }, 2500);
  };

  // Completar estación con feedback festivo
  const handleCompleteStation = (stationIndex: number, xpAmount: number) => {
    if (!completedStations[stationIndex]) {
      const nextCompleted = { ...completedStations, [stationIndex]: true };
      setCompletedStations(nextCompleted);
      addXp(xpAmount);

      const newCount = Object.values(nextCompleted).filter(Boolean).length;
      sonar(newCount === 5 ? 'fanfarria' : 'logro');
      if (newCount === 5) {
        triggerLevelUpConfetti();
      }
    }
  };

  // Deducción de escudo cognitivo por fallo en Quiz
  const handleDeductShield = () => {
    setCognitiveShields((prev) => (prev > 0 ? prev - 1 : 0));
  };

  // Desbloqueo y apertura de modal para una medalla
  const handleUnlockBadge = (badgeId: string) => {
    const timestamp = new Date().toISOString();
    setAchievements((prev) =>
      prev.map((b) => {
        if (b.id === badgeId) {
          const updated = {
            ...b,
            desbloqueado: true,
            fecha: timestamp,
          };
          setSelectedBadgeForModal(updated);
          setIsTrophyModalOpen(true);
          return updated;
        }
        return b;
      }),
    );
  };

  // Apertura y navegación del Reproductor de Créditos Cinematográficos (Modal Fullscreen)
  const handleOpenCreditos = () => {
    setIsTrophyModalOpen(false); // Evita competencia de foco o z-index con BadgeModal
    setIsCreditosModalOpen(true);
  };

  const handleCloseCreditos = () => {
    setIsCreditosModalOpen(false);
  };

  const handleVolverResultados = () => {
    setIsCreditosModalOpen(false);
    setCurrentStep(3);
  };

  const handleExplorarNuevaMente = () => {
    setIsCreditosModalOpen(false);
  };

  // Avanza automáticamente a la siguiente estación o al paso 3 si culminó el circuito
  const handleContinueAfterBadge = () => {
    if (activeStationIndex < 4) {
      setActiveStationIndex((prev) => prev + 1);
    } else {
      setCurrentStep(3);
    }
  };

  /**
   * Abre la muestra pregenerada de un documento de ejemplo: no llama a ningún modelo. La carga
   * recorre las mismas etapas que una generación, pero dice que es una muestra (regla 1).
   * Sin escenario se abre el primero del documento.
   */
const handleAbrirMuestra = async (documento: string, escenario?: string) => {
    const muestra = escenarioDe(muestras, documento, escenario);
    if (!muestra || isProcessing) return;

    // 👇 Sincroniza los parámetros reales de la muestra seleccionada
    setAjustesSeleccionados({
      perfil: muestra.ajustes.perfil,
      sector: muestra.ajustes.nicho,
      nivel: muestra.ajustes.detalle,
    });

    const version = accountVersion.current;
    setIsProcessing(true);
    setIsGenerating(true);
    try {
      const paquete = await cargarMuestra(muestra);
      for (const etapa of ETAPAS_MUESTRA) {
        if (version !== accountVersion.current) return;
        setProcessingStage(etapa);
        setGeneratingMessage(etapa);
        await new Promise((r) => setTimeout(r, PAUSA_ETAPA_MUESTRA_MS));
      }
      if (version !== accountVersion.current) return;
      setCompletedStations({});
      setActiveStationIndex(0);
      setQuizState(EMPTY_QUIZ);
      setCurrentPackage(paquete);
      setPackageId(null);
      setQuestKey(`muestra-${documento}-${muestra.escenario}-${Date.now()}`);
      setUnlockedStations([0, 1, 2, 3, 4]);
      setPaqueteListo(true);
      setCurrentStep(2);
      triggerSmallConfetti();
      sonar('logro');
    } catch (err: unknown) {
      if (version !== accountVersion.current) return;
      alert(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (version === accountVersion.current) {
        setIsGenerating(false);
        setIsProcessing(false);
        setProcessingStage("");
        setGeneratingMessage("");
      }
    }
  };

  const handleStartPipeline = async (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    rawFile?: File | null,
    origenContenido?: OrigenContenido,
  ) => {
    if (isProcessing) return;

// 👇 GUARDAR LOS PARÁMETROS REALES SELECCIONADOS POR EL USUARIO
    setAjustesSeleccionados({
      perfil: profile,
      sector: niche,
      nivel: detail,
    });

    const version = accountVersion.current;
    const startingOwner = user?.id || '00000000-0000-0000-0000-000000000000';
    const priorState = { ...latestState.current };
    const prior = { pkg: currentPackage, packageId, questKey, paqueteListo };
    let recorridoAbierto = false; // ¿ya se mostró algún recurso parcial?
    setReady(false);
    setIsProcessing(true);
    setIsGenerating(true);
    setProcessingStage("Iniciando orquestación con agentes de NuevaMente...");
    setGeneratingMessage("Conectando con el orquestador multi-agente de NuevaMente...");
    setCompletedStations({});
    setActiveStationIndex(0);
    setQuizState(EMPTY_QUIZ);

    try {
      if (startingOwner !== '00000000-0000-0000-0000-000000000000') {
        await saveQueue.current;
        await writeState(startingOwner, packageId, priorState);
      }
      const adaptedPkg = await solicitarAdaptacion(
        {
          docTitle: title,
          docContent: content,
          profile,
          format,
          niche,
          detail,
          selectedScenarioId,
          rawFile,
          origenContenido,
        },
        (stage, partialPackage) => {
          if (version !== accountVersion.current) return;
          setProcessingStage(stage);
          setGeneratingMessage(stage);
          if (!partialPackage) return;
          // Publicación incremental: el recorrido se abre con el primer recurso listo
          setCurrentPackage(partialPackage);
          setUnlockedStations(estacionesResueltas(partialPackage));
          if (!recorridoAbierto) {
            recorridoAbierto = true;
            setPackageId(null);
            setQuestKey(`gen-${Date.now()}`);
            setPaqueteListo(true);
            setCurrentStep(2);
          }
        }
      );

      // Finalización exitosa: cargamos el nuevo paquete y abrimos la Ruta Cognitiva
      if (version !== accountVersion.current) return;
      let saved = null;
      if (startingOwner === '00000000-0000-0000-0000-000000000000') {
        saved = { id: adaptedPkg.persistencia?.package_id || `pkg-${Date.now()}`, title: adaptedPkg.contenido_adaptado.titulo, payload: adaptedPkg };
      } else {
        const verified = await requireSupabase().auth.getUser();
        if (verified.data.user?.id !== startingOwner) throw new Error('La cuenta cambió durante la generación.');
        saved = adaptedPkg.persistencia?.package_id
          ? { id: adaptedPkg.persistencia.package_id, title: adaptedPkg.contenido_adaptado.titulo, payload: adaptedPkg }
          : await createPackage(adaptedPkg, { profile, format, niche, detail, selectedScenarioId, source: selectedScenarioId === 'demo-offline-swap' ? 'explicit-demo' : 'backend' }, startingOwner);
      }
      if (version !== accountVersion.current) return;
      setPackageId(saved.id); setHistory(prev => [saved, ...prev]);
      if (!recorridoAbierto) setQuestKey(saved.id);
      setCurrentPackage(adaptedPkg);
      setUnlockedStations([0, 1, 2, 3, 4]);
      setPaqueteListo(true);
      setCurrentStep(2);
      triggerSmallConfetti();
      sonar('logro');
    } catch (err: unknown) {
      if (version !== accountVersion.current) return;
      setCompletedStations(priorState.completedStations); setQuizState(priorState.quizState);
      setActiveStationIndex(priorState.activeStationIndex);
      if (recorridoAbierto) {
        // Se mostraron recursos parciales de una generación que no terminó: volver a lo anterior
        setCurrentPackage(prior.pkg); setPackageId(prior.packageId); setQuestKey(prior.questKey);
        setPaqueteListo(prior.paqueteListo);
      }
      console.error("Error en el pipeline de NuevaMente:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`⚠️ ${errMsg}`);
      setCurrentStep(1);
    } finally {
      // Si cambió la cuenta durante la generación, el estado ya se reinició: no tocarlo.
      if (version === accountVersion.current) {
        setReady(true);
        setIsGenerating(false);
        setIsProcessing(false);
        setProcessingStage("");
        setGeneratingMessage("");
      }
    }
  };

  // Exportadores
  const handleDownloadJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(currentPackage, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${currentPackage.almacenamiento_oci?.objeto_id || "adaptacion-rag.json"}`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadMarkdown = () => {
    // Cada sección solo se exporta si su recurso existe (en modo paralelo uno puede haber fallado)
    const c = currentPackage.contenido_adaptado;
    const secciones = [
      `# ${c.titulo}\nPerfil: ${currentPackage.metadatos.perfil_aplicado}`,
      c.introduccion_contextualizada && `## Introducción Contextualizada\n${c.introduccion_contextualizada}`,
      c.objetivos_aprendizaje?.length && `## Objetivos de aprendizaje\n${c.objetivos_aprendizaje.map((o) => `- ${o}`).join("\n")}`,
      c.resumen_ejecutivo && `## Resumen ejecutivo\n${c.resumen_ejecutivo.texto}`,
      c.resumen_ninja && `## Resumen Ninja\n${c.resumen_ninja.analogia_central}\n\n### Conceptos Clave\n${c.resumen_ninja.conceptos_clave.map((k) => `- ${k.texto}`).join("\n")}`,
      c.glosario?.length && `## Glosario\n${c.glosario.map((g) => `- **${g.termino}:** ${g.definicion}`).join("\n")}`,
      c.flashcards?.length && `## Flashcards\n${c.flashcards.map((f, i) => `### Tarjeta ${i + 1}: ${f.frente}\n**Respuesta:** ${f.dorso}\n*Pista:* ${f.pista_didactica}\n`).join("\n")}`,
      c.tutorial?.length && `## Laboratorio Práctico\n${c.tutorial.map((t) => `### Paso ${t.paso}: ${t.titulo}\n\`\`\`bash\n${t.cli_command}\n\`\`\`\n*Verificación:* ${t.verificacion}\n`).join("\n")}`,
    ];
    const mdContent = secciones.filter(Boolean).join("\n\n") + "\n";
    const dataStr =
      "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${(currentPackage.almacenamiento_oci?.objeto_id || "adaptacion-rag.json").replace(".json", ".md")}`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadAnkiCSV = () => {
    const titulo = currentPackage.contenido_adaptado.titulo;
    const csvContent = mazoAnkiCsv(currentPackage.contenido_adaptado.flashcards ?? [], titulo);
    const dataStr =
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", nombreArchivoAnki(titulo));
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);
      const blob = await exportarDossierPDF(currentPackage);
      const url = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      const baseName = (
        currentPackage.almacenamiento_oci?.objeto_id ||
        `dossier_${(currentPackage.contenido_adaptado.titulo || "educativo").toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`
      ).replace(/\.json$/i, "");
      downloadAnchor.setAttribute("download", `${baseName}.pdf`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error("Error al descargar PDF:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`⚠️ No se pudo generar el dossier en PDF: ${msg}`);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Reinicio pedagógico del circuito al agotar los 3 escudos
  const handleResetCircuit = () => {
    setQuizState(EMPTY_QUIZ);
    setCognitiveShields(3);
    setCompletedStations({});
    setActiveStationIndex(0);
  };

  return (
    <div className={styles.appWrapper}>
      {/* 1. Global Stepper Workflow Header */}
      <Header
        currentStep={currentStep}
        pasosAbiertos={paqueteListo}
        onSelectStep={(step) => {
          if (step === 1 || paqueteListo) setCurrentStep(step);
        }}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={() => void logout()}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          setReady(true);
          setIsAuthOpen(false);
        }}
      />

      {/* 2. Gamified Player HUD */}
      {currentStep === 2 && (
        <PlayerHUD
          xp={xp}
          streakDays={streakDays}
          cognitiveShields={cognitiveShields}
          maxShields={3}
          completedStationsCount={completedStationsCount}
          totalStations={5}
          recentXpGain={recentXpGain}
          unlockedBadgesCount={unlockedBadgesCount}
          totalBadgesCount={achievements.length}
          onOpenAchievements={() => {
            setSelectedBadgeForModal(null);
            setIsTrophyModalOpen(true);
          }}
        />
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* El estado de la sincronización no se muestra (decisión del usuario, 14/10); sus fallos sí */}
        {/^(Error|No se)/.test(syncMessage) && (
          <p role="alert" style={{ padding: '0.75rem 1rem', margin: '0 0 1rem', color: 'var(--color-rose-400)' }}>
            {syncMessage}
          </p>
        )}
        {currentStep === 1 && (
          <Step1Ingestion
            key={user?.id || 'guest'}
            onStartPipeline={handleStartPipeline}
            muestras={muestras}
            onAbrirMuestra={(documento, escenario) => void handleAbrirMuestra(documento, escenario)}
            sesionIniciada={user !== null && user.id !== '00000000-0000-0000-0000-000000000000'}
            onIniciarSesion={() => setIsAuthOpen(true)}
            isProcessing={isProcessing}
            processingStage={processingStage}
          />
        )}

       {currentStep === 2 && (
          <Step2KnowledgeQuest
            key={`${user?.id || 'guest'}:${questKey}`}
            quizState={quizState}
            onQuizChange={setQuizState}
            contentPackage={currentPackage}
            escenarios={currentPackage.muestra ? muestras[currentPackage.muestra.documento] ?? [] : []}
            onAbrirEscenario={(m) => void handleAbrirMuestra(m.documento, m.escenario)}
            completedStations={completedStations}
            activeStationIndex={activeStationIndex}
            onSelectStationIndex={setActiveStationIndex}
            onCompleteStation={handleCompleteStation}
            cognitiveShields={cognitiveShields}
            onDeductShield={handleDeductShield}
            onResetCircuit={handleResetCircuit}
            onOpenNinjaBadge={() => handleUnlockBadge("ninja")}
            onOpenStreakBadge={() => handleUnlockBadge("streak")}
            onOpenBuilderBadge={() => handleUnlockBadge("builder")}
            onOpenDirectorBadge={() => handleUnlockBadge("director")}
            onOpenMasterBadge={() => handleUnlockBadge("master")}
            onDownloadArtifact={handleDownloadJSON}
            onGoToOCIInspect={() => setCurrentStep(3)}
            onOpenCreditos={handleOpenCreditos}
            isGenerating={isGenerating}
            unlockedStations={unlockedStations}
            generatingMessage={generatingMessage}
            // 👇 CONEXIÓN AL COMPONENTE HIJO
            ajustesSeleccionados={ajustesSeleccionados}
          />
        )}

        {currentStep === 3 && (
          <Step3OCICloud
            contentPackage={currentPackage}
            onDownloadJSON={handleDownloadJSON}
            onDownloadMarkdown={handleDownloadMarkdown}
            onDownloadAnkiCSV={handleDownloadAnkiCSV}
            onDownloadPDF={handleDownloadPDF}
            isDownloadingPDF={isDownloadingPDF}
            onOpenCreditos={handleOpenCreditos}
          />
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrand}>
            <div className={styles.isologoFooter}>
              <img
                src="/IsotipoMonocromo.svg"
                alt=""
                className={styles.brandLetter}
              />
            </div>
            <span className={styles.brandSign}>NuevaMente</span>
            <span> · Hackathon ONE G10 (Oracle Next Education & Alura) · <strong>Equipo 10</strong></span>
          </div>

          <div className={styles.footerLinks}>
            <span>Capa Always Free OCI (Cero Costos)</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setSelectedBadgeForModal(null);
                setIsTrophyModalOpen(true);
              }}
              className={styles.trophyLink}
              style={{
                background: "none",
                border: "none",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              Medallas ({unlockedBadgesCount}/{achievements.length})
            </button>
          </div>
        </div>
      </footer>

      {/* Badges / Trophy Modal */}
      <BadgeModal
        isOpen={isTrophyModalOpen}
        onClose={() => {
          setIsTrophyModalOpen(false);
          setSelectedBadgeForModal(null);
        }}
        singleBadge={selectedBadgeForModal}
        allBadges={achievements}
        xp={xp}
        streakDays={streakDays}
        sesionIniciada={user !== null}
        onContinueQuest={handleContinueAfterBadge}
        onReviewStations={() => {
          // Te lleva al paso 2 y a la primera estación para repasar
          setCurrentStep(2);
          setActiveStationIndex(0);
        }}
        onRestartToStation1={() => {
          // Vuelve al inicio del recorrido
          setCurrentStep(2);
          setActiveStationIndex(0);
        }}
        onOpenCreditos={handleOpenCreditos}
      />

      {/* Reproductor Cinematográfico Superpuesto (Modal Fullscreen) */}
      <CreditosModal
        isOpen={isCreditosModalOpen}
        onClose={handleCloseCreditos}
        onVolverResultados={handleVolverResultados}
        onExplorarNuevaMente={handleExplorarNuevaMente}
      />
    </div>
  );
}
