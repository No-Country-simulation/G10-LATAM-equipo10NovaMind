/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Header } from "./components/Header/Header";
import { PlayerHUD } from "./components/PlayerHUD/PlayerHUD";
import { BadgeModal } from "./components/BadgeModal/BadgeModal";
import { Station1ResumenNinja } from "./components/stations/Station1ResumenNinja/Station1ResumenNinja";
import { SCENARIOS, INITIAL_ACHIEVEMENTS } from "./data/mockScenarios";
import type { Achievement } from "./types/types";
import styles from "./App.module.css";

export default function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(2);

  // Escenario activo (por defecto el primero: VCN Networks)
  const [currentScenario] = useState(SCENARIOS[0]);

  // Gamification HUD State
  const [xp, setXp] = useState<number>(0);
  const [streakDays] = useState<number>(3);
  const [cognitiveShields] = useState<number>(3);
  const [recentXpGain, setRecentXpGain] = useState<number | null>(null);

  // Estado de la Estación 1
  const [isStation1Completed, setIsStation1Completed] = useState<boolean>(false);

  // Medallas
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState<boolean>(false);
  const [selectedBadgeForModal, setSelectedBadgeForModal] = useState<Achievement | null>(null);

  const addXp = (amount: number) => {
    setXp((prev) => prev + amount);
    setRecentXpGain(amount);
    setTimeout(() => {
      setRecentXpGain(null);
    }, 2500);
  };

  const handleCompleteStation1 = (xpAmount: number) => {
    if (!isStation1Completed) {
      setIsStation1Completed(true);
      addXp(xpAmount);
    }
  };

  const handleOpenNinjaBadge = () => {
    setAchievements((prev) =>
      prev.map((b) =>
        b.id === "ninja"
          ? { ...b, desbloqueado: true, fecha: new Date().toISOString() }
          : b
      )
    );
    const ninjaBadge = achievements.find((b) => b.id === "ninja") || INITIAL_ACHIEVEMENTS[0];
    setSelectedBadgeForModal({ ...ninjaBadge, desbloqueado: true });
    setIsTrophyModalOpen(true);
  };

  const unlockedBadgesCount = achievements.filter((a) => a.desbloqueado).length;

  return (
    <div className={styles.appWrapper}>
      {/* 1. Global Header */}
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
      />

      {/* 2. Player HUD */}
      {currentStep === 2 && (
        <PlayerHUD
          xp={xp}
          streakDays={streakDays}
          cognitiveShields={cognitiveShields}
          maxShields={3}
          completedStationsCount={isStation1Completed ? 1 : 0}
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
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 01 · Configuración e Ingesta</span>
            <h2 className={styles.placeholderTitle}>Ingesta RAG en Construcción</h2>
            <p className={styles.placeholderText}>
              Selecciona <strong>"02 Visualizar Resultados RAG"</strong> en la barra superior para explorar la primera estación y el HUD.
            </p>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Station1ResumenNinja
              data={currentScenario.data.contenido_adaptado.resumen_ninja}
              isCompleted={isStation1Completed}
              onCompleteStation={handleCompleteStation1}
              onOpenNinjaBadge={handleOpenNinjaBadge}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 03 · Infraestructura</span>
            <h2 className={styles.placeholderTitle}>Métricas & Sincronización OCI Cloud</h2>
            <p className={styles.placeholderText}>
              Panel de auditoría de tokens, latencias y persistencia de artefactos Always Free.
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
            <button
              type="button"
              onClick={() => {
                setSelectedBadgeForModal(null);
                setIsTrophyModalOpen(true);
              }}
              className={styles.trophyLink}
              style={{ background: "none", border: "none", font: "inherit" }}
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
      />
    </div>
  );
}