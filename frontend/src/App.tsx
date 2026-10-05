/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Header } from "./components/Header/Header";
import { PlayerHUD } from "./components/PlayerHUD/PlayerHUD";
import { BadgeModal } from "./components/BadgeModal/BadgeModal";
import type { Achievement } from "./types/types";
import styles from "./App.module.css";

const INITIAL_MOCK_BADGES: Achievement[] = [
  {
    id: "ninja",
    titulo: "Intuición Ninja",
    descripcion: "Asimilaste la analogía técnica y los conceptos clave de la infraestructura.",
    icono: "🥷",
    desbloqueado: true,
    fecha: new Date().toISOString(),
    categoria: "ninja",
  },
  {
    id: "streak",
    titulo: "Memoria Activa",
    descripcion: "Completaste las tarjetas de estudio espaciado con Active Recall.",
    icono: "⚡",
    desbloqueado: false,
    categoria: "streak",
  },
  {
    id: "builder",
    titulo: "Arquitecto Práctico",
    descripcion: "Ejecutaste el laboratorio de comandos en la nube de Oracle.",
    icono: "🛠️",
    desbloqueado: false,
    categoria: "builder",
  },
  {
    id: "master",
    titulo: "Maestría en Nube OCI",
    descripcion: "Superaste el examen técnico de anclaje RAG con 100% de precisión.",
    icono: "👑",
    desbloqueado: false,
    categoria: "master",
  },
];

export default function App() {
  // Stepper workflow principal: 1 = Ingesta, 2 = Knowledge Quest, 3 = Métricas OCI
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Estado del Player HUD
  const [xp, setXp] = useState<number>(120);
  const [streakDays] = useState<number>(3);
  const [cognitiveShields, setCognitiveShields] = useState<number>(3);
  const [recentXpGain, setRecentXpGain] = useState<number | null>(null);

  // Estado de Medallas
  const [achievements] = useState<Achievement[]>(INITIAL_MOCK_BADGES);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState<boolean>(false);
  const [selectedBadgeForModal, setSelectedBadgeForModal] = useState<Achievement | null>(null);

  // Helper para sumar XP
  const addXp = (amount: number) => {
    setXp((prev) => prev + amount);
    setRecentXpGain(amount);
    setTimeout(() => {
      setRecentXpGain(null);
    }, 2500);
  };

  // Helper para simular daño a escudos
  const handleTestShield = () => {
    setCognitiveShields((prev) => (prev > 0 ? prev - 1 : 3));
  };

  const unlockedBadgesCount = achievements.filter((a) => a.desbloqueado).length;

  return (
    <div className={styles.appWrapper}>
      {/* 1. Global Stepper Workflow Header */}
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
          completedStationsCount={1}
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
              Selecciona <strong>"02 Visualizar Resultados RAG"</strong> en la barra superior para explorar el HUD gamificado interactivo.
            </p>
          </div>
        )}

        {currentStep === 2 && (
          <div className={styles.previewPlaceholder}>
            <span className={styles.placeholderTag}>Paso 02 · Circuito Gamificado</span>
            <h2 className={styles.placeholderTitle}>Knowledge Quest & Estaciones</h2>
            <p className={styles.placeholderText}>
              Haz clic abajo para probar la respuesta interactiva del HUD:
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => addXp(50)}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "10px",
                  background: "var(--color-violet-bg)",
                  border: "1px solid var(--color-violet-border)",
                  color: "var(--color-violet-300)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                +50 XP
              </button>
              <button
                type="button"
                onClick={handleTestShield}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "10px",
                  background: "var(--color-rose-bg)",
                  border: "1px solid var(--color-rose-border)",
                  color: "var(--color-rose-300)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                Probar Escudo (-1)
              </button>
            </div>
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