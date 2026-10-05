import React, { useState } from "react";
import { Header } from "./components/Header/Header";
import { PlayerHUD } from "./components/PlayerHUD/PlayerHUD";
import styles from "./App.module.css";

// Componentes temporales o pendientes de modularizar
// import { Step1Ingestion } from "./components/Step1Ingestion/Step1Ingestion";
// import { Step2KnowledgeQuest } from "./components/Step2KnowledgeQuest/Step2KnowledgeQuest";
// import { Step3OCICloud } from "./components/Step3OCICloud/Step3OCICloud";
// import { BadgeModal } from "./components/BadgeModal/BadgeModal";

export default function App() {
  // Stepper workflow: 1 = Config/Ingest, 2 = Results (Quest), 3 = Metrics & OCI Cloud
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Gamification HUD State
  const [xp, setXp] = useState<number>(120);
  const [streakDays] = useState<number>(3);
  const [cognitiveShields, setCognitiveShields] = useState<number>(3);
  const [recentXpGain, setRecentXpGain] = useState<number | null>(null);
  const [completedStationsCount] = useState<number>(2);

  // Add XP helper
  const addXp = (amount: number) => {
    setXp((prev) => prev + amount);
    setRecentXpGain(amount);
    setTimeout(() => {
      setRecentXpGain(null);
    }, 2500);
  };

  return (
    <div className={styles.appWrapper}>
      {/* 1. Global Header */}
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
      />

      {/* 2. Player HUD (visible en paso 2) */}
      {currentStep === 2 && (
        <PlayerHUD
          xp={xp}
          streakDays={streakDays}
          cognitiveShields={cognitiveShields}
          maxShields={3}
          completedStationsCount={completedStationsCount}
          totalStations={5}
          recentXpGain={recentXpGain}
          unlockedBadgesCount={1}
          totalBadgesCount={5}
          onOpenAchievements={() => addXp(50)}
        />
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {currentStep === 1 && (
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 01 · Configuración e Ingesta</span>
            <h2 className={styles.placeholderTitle}>Ingesta RAG en Construcción</h2>
            <p className={styles.placeholderText}>
              Haz clic en el paso <strong>"02 Visualizar Resultados RAG"</strong> en el Header para ver en acción el <strong>PlayerHUD</strong> con sus tokens y módulos.
            </p>
          </div>
        )}

        {currentStep === 2 && (
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 02 · Circuito Gamificado</span>
            <h2 className={styles.placeholderTitle}>Knowledge Quest & Estaciones</h2>
            <p className={styles.placeholderText}>
              Aquí se renderizan las 5 estaciones pedagógicas. El HUD superior ya refleja los escudos cognitivos, XP, nivel y racha diaria.
            </p>
          </div>
        )}

        {currentStep === 3 && (
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 03 · Infraestructura</span>
            <h2 className={styles.placeholderTitle}>Métricas & OCI Object Storage</h2>
            <p className={styles.placeholderText}>
              Panel de sincronización con la nube de Oracle Always Free y descarga de artefactos.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div>
            <span className={styles.brandSign}>NuevaMente</span>
            <span> · Hackathon ONE G10 (Oracle Next Education & Alura)</span>
          </div>

          <div className={styles.footerLinks}>
            <span>Capa Always Free OCI</span>
            <span>·</span>
            <span>RAG Grounding 98%</span>
            <span>·</span>
            <span className={styles.trophyLink}>Vitrina de Medallas</span>
          </div>
        </div>
      </footer>
    </div>
  );
}