/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
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
} from "./types/types";
import { triggerLevelUpConfetti, triggerSmallConfetti } from "./utils/confetti";
import { solicitarAdaptacion } from "./services/api";
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
    const timestamp = "2026-10-05T00:00:00.000Z";
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

  // Pipeline RAG completo con entrega progresiva
  const handleStartPipeline = async (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    pdfBase64?: string | null,
  ) => {
    setIsProcessing(true);

    try {
      const adaptedPkg = await solicitarAdaptacion(
        {
          docTitle: title,
          docContent: content,
          profile,
          format,
          niche,
          detail,
          selectedScenarioId,
          pdfBase64,
        },
        (stage) => setProcessingStage(stage)
      );

      // Reinicio de estaciones para el nuevo documento
      setCompletedStations({});
      setCurrentPackage(adaptedPkg);
      setCurrentStep(2);
      setActiveStationIndex(0);
      triggerSmallConfetti();
    } catch (err: unknown) {
      console.error("Error en el pipeline de NovaMind:", err);
      // Salvaguarda Zero-Crash con el escenario OCI Swap
      setCurrentPackage(SCENARIOS[0].data);
      setCurrentStep(2);
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
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
    const mdContent = `# ${currentPackage.contenido_adaptado.titulo}
Perfil: ${currentPackage.metadatos.perfil_aplicado} | OCI Always Free

## Introducción Contextualizada
${currentPackage.contenido_adaptado.introduccion_contextualizada}

## Resumen Ninja
${currentPackage.contenido_adaptado.resumen_ninja.analogia_central}

### Conceptos Clave
${currentPackage.contenido_adaptado.resumen_ninja.conceptos_clave.map((c) => `- ${c.texto}`).join("\n")}

## Flashcards
${currentPackage.contenido_adaptado.flashcards.map((f, i) => `### Tarjeta ${i + 1}:${f.frente}\n**Respuesta:** ${f.dorso}\n*Pista:*${f.pista_didactica}\n`).join("\n")}

## Laboratorio Práctico
${currentPackage.contenido_adaptado.tutorial.map((t) => `### Paso ${t.paso}:${t.titulo}\n\`\`\`bash\n${t.cli_command}\n\`\`\`\n*Verificación:* ${t.verificacion}\n`).join("\n")}
`;
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
      ...currentPackage.contenido_adaptado.flashcards.map((f) => [
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
        onLogout={() => setUser(null)}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(loggedUser) => setUser(loggedUser)}
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
        {currentStep === 1 && (
          <Step1Ingestion
            onStartPipeline={handleStartPipeline}
            isProcessing={isProcessing}
            processingStage={processingStage}
          />
        )}

        {currentStep === 2 && (
          <Step2KnowledgeQuest
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
            <span>RAG Grounding 98%</span>
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
