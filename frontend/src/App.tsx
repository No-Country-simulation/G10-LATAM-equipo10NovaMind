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
import { SCENARIOS, INITIAL_ACHIEVEMENTS } from "./data/mockScenarios";
import type {
  AdaptedContentPackage,
  RecipientProfile,
  OutputFormat,
  IndustryNiche,
  DetailLevel,
  Achievement,
  OrigenContenido,
} from "./types/types";
import { triggerLevelUpConfetti, triggerSmallConfetti } from "./utils/confetti";
import { solicitarAdaptacion } from "./services/api";
import { estacionesResueltas } from "./utils/paqueteIncremental";
import styles from "./App.module.css";

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

  // Estado del Pipeline y sus 5 micro-etapas
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [unlockedStations, setUnlockedStations] = useState<number[]>([0, 1, 2, 3, 4]);
  const [generatingMessage, setGeneratingMessage] = useState<string>("");
  const [history, setHistory] = useState<PackageRow[]>([]);
  const [packageId, setPackageId] = useState<string | null>(null);
  // Identidad del recorrido montado en el Paso 2. Se fija al abrir un paquete o al empezar a
  // recibir recursos, y no cambia cuando llega el paquete final: así la estación en uso no se reinicia.
  const [questKey, setQuestKey] = useState<string>('demo');
  // Sin Supabase no hay sesión que comprobar: se arranca listo y en modo local.
  const [ready, setReady] = useState(!supabase);
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

  const restorePackage = async (row: PackageRow, version: number) => {
    const { progress, state } = await readState(row.id);
    if (version !== accountVersion.current) return;
    setCurrentPackage(row.payload); setPackageId(row.id); setQuestKey(row.id);
    setCurrentStep(progress?.current_step || 2);
    setActiveStationIndex(progress?.active_station_index || 0);
    setCompletedStations(progress?.completed_stations || {});
    setCognitiveShields(progress?.cognitive_shields ?? 3);
    setQuizState({ ...EMPTY_QUIZ, ...(progress?.quiz_answers || {}) });
    setXp(state.xp);
    setAchievements(state.achievements.length ? state.achievements : INITIAL_ACHIEVEMENTS);
  };

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
        setReady(false); setUser(null); setHistory([]); setPackageId(null);
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

  // Avanza automáticamente a la siguiente estación o al paso 3 si culminó el circuito
  const handleContinueAfterBadge = () => {
    if (activeStationIndex < 4) {
      setActiveStationIndex((prev) => prev + 1);
    } else {
      setCurrentStep(3);
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
    const version = accountVersion.current;
    const startingOwner = user?.id || '00000000-0000-0000-0000-000000000000';
    const priorState = { ...latestState.current };
    const prior = { pkg: currentPackage, packageId, questKey };
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
      setCurrentStep(2);
      triggerSmallConfetti();
    } catch (err: unknown) {
      if (version !== accountVersion.current) return;
      setCompletedStations(priorState.completedStations); setQuizState(priorState.quizState);
      setActiveStationIndex(priorState.activeStationIndex);
      if (recorridoAbierto) {
        // Se mostraron recursos parciales de una generación que no terminó: volver a lo anterior
        setCurrentPackage(prior.pkg); setPackageId(prior.packageId); setQuestKey(prior.questKey);
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
    const rows = [
      ["Front", "Back"],
      ...(currentPackage.contenido_adaptado.flashcards ?? []).map((f) => [
        `"${f.frente.replace(/"/g, '""')}"`,
        `"${f.dorso.replace(/"/g, '""')} <br><em>Hint: ${f.pista_didactica.replace(/"/g, '""')}</em>"`,
      ]),
    ];
    const csvContent = rows.map((e) => e.join(",")).join("\n");
    const dataStr =
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "anki-cards-adaptacion.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
        onSelectStep={(step) => setCurrentStep(step)}
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
        <section aria-label="Mi historial" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <p role="status">{syncMessage}</p>
          {user && <><h2>Mi historial</h2>
            <button disabled={!ready || isProcessing} onClick={() => {
              const version = accountVersion.current; setReady(false);
              void (async () => {
                await saveQueue.current;
                await writeState(user.id, packageId, latestState.current);
                const example = structuredClone(SCENARIOS[0].data);
                example.contenido_adaptado.titulo = 'Ejemplo de demostración · prueba de persistencia';
                example.metadatos.fecha_generacion = new Date().toISOString();
                const row = await createPackage(example, { source: 'explicit-demo' }, user.id);
                if (version !== accountVersion.current) return;
                setHistory(previous => [row, ...previous]);
                await restorePackage(row, version);
              })().catch(error => setSyncMessage('No se pudo guardar el ejemplo: ' + error.message))
                .finally(() => { if (version === accountVersion.current) setReady(true); });
            }}>Guardar ejemplo de demostración en mi cuenta</button>
            {history.length === 0 && <p>Aún no tienes contenidos guardados en esta versión.</p>}
            {history.map(row => <button key={row.id} disabled={!ready || isProcessing} onClick={() => {
              const version = accountVersion.current; setReady(false);
              void (async () => {
                await saveQueue.current;
                await writeState(user.id, packageId, latestState.current);
                await restorePackage(row, version);
              })().catch(error => setSyncMessage('No se pudo abrir: ' + error.message))
                .finally(() => { if (version === accountVersion.current) setReady(true); });
            }}>{row.title}</button>)}</>}
        </section>
        {currentStep === 1 && (
          <Step1Ingestion
            key={user?.id || 'guest'}
            onStartPipeline={handleStartPipeline}
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
            isGenerating={isGenerating}
            unlockedStations={unlockedStations}
            generatingMessage={generatingMessage}
          />
        )}

        {currentStep === 3 && (
          <Step3OCICloud
            contentPackage={currentPackage}
            onDownloadJSON={handleDownloadJSON}
            onDownloadMarkdown={handleDownloadMarkdown}
            onDownloadAnkiCSV={handleDownloadAnkiCSV}
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
            <span> · Hackathon ONE G10 (Oracle Next Education & Alura)</span>
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
      />
    </div>
  );
}
