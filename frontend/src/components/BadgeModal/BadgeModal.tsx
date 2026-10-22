import React, { useState, useEffect } from "react";
import {
  X,
  Award,
  CheckCircle2,
  Sparkles,
  Flame,
  Shield,
  Calendar,
  RotateCcw,
  Trophy,
  Zap,
  Brain,
  Terminal,
  Clapperboard,
  Crown,
  Lock,
} from "lucide-react";
import type { Achievement } from "../../types/types";
import styles from "./BadgeModal.module.css";

interface BadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleBadge?: Achievement | null;
  allBadges: Achievement[];
  xp: number;
  streakDays: number;
  sesionIniciada: boolean;
  onContinueQuest?: () => void;
  onRestartToStation1?: () => void;
  onReviewStations?: () => void;
}

// Configuración de temas e iconos vectoriales según la medalla
interface BadgeTheme {
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  borderGlow: string;
  badgeStyleClass: string;
}

const getBadgeTheme = (id: string = "", title: string = ""): BadgeTheme => {
  const normId = id.toLowerCase();
  const normTitle = title.toLowerCase();

  // 1. Estación 2: Memoria de Acero (Cian Eléctrico / Cerebro)
  // Se evalúa antes para evitar colisiones con palabras como "acero"
  if (
    normId.includes("station2") ||
    normId.includes("flashcard") ||
    normId.includes("streak") ||
    normTitle.includes("memoria") ||
    normTitle.includes("acero")
  ) {
    return {
      icon: <Brain size={38} className={styles.vectorIcon} />,
      accentColor: "#38bdf8",
      glowColor: "rgba(6, 182, 212, 0.45)",
      borderGlow: "rgba(56, 189, 248, 0.65)",
      badgeStyleClass: styles.themeCyan,
    };
  }

  // 2. Estación 3: Ingeniero de Laboratorio (Esmeralda Neón / Terminal)
  if (
    normId.includes("station3") ||
    normId.includes("tutorial") ||
    normId.includes("builder") ||
    normTitle.includes("ingeniero") ||
    normTitle.includes("laboratorio")
  ) {
    return {
      icon: <Terminal size={38} className={styles.vectorIcon} />,
      accentColor: "#34d399",
      glowColor: "rgba(16, 185, 129, 0.45)",
      borderGlow: "rgba(52, 211, 153, 0.65)",
      badgeStyleClass: styles.themeEmerald,
    };
  }

  // 3. Estación 4: Director Didáctico (Fucsia / Claqueta)
  if (
    normId.includes("station4") ||
    normId.includes("director") ||
    normTitle.includes("director") ||
    normTitle.includes("audiovisual")
  ) {
    return {
      icon: <Clapperboard size={38} className={styles.vectorIcon} />,
      accentColor: "#f0abfc",
      glowColor: "rgba(217, 70, 239, 0.45)",
      borderGlow: "rgba(240, 171, 252, 0.65)",
      badgeStyleClass: styles.themeFuchsia,
    };
  }

  // 4. Estación 5: Maestro Cero Alucinaciones / Examen Final (Corona Dorada)
  if (
    normId.includes("station5") ||
    normId.includes("quiz") ||
    normId.includes("master") ||
    normTitle.includes("alucinacion") ||
    normTitle.includes("cero alucinaciones") ||
    normTitle.includes("maestro") ||
    normTitle.includes("examen final")
  ) {
    return {
      icon: <Crown size={40} className={styles.vectorIcon} />,
      accentColor: "#fbbf24",
      glowColor: "rgba(245, 158, 11, 0.55)",
      borderGlow: "rgba(251, 191, 36, 0.75)",
      badgeStyleClass: styles.themeGold,
    };
  }

  // 5. Estación 1 / Defecto: Resumen Ninja (Ámbar / Rayo)
  return {
    icon: <Zap size={38} className={styles.vectorIcon} />,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.45)",
    borderGlow: "rgba(245, 158, 11, 0.65)",
    badgeStyleClass: styles.themeAmber,
  };
};

export const BadgeModal: React.FC<BadgeModalProps> = ({
  isOpen,
  onClose,
  singleBadge,
  allBadges = [],
  xp,
  streakDays,
  sesionIniciada,
  onContinueQuest,
  onRestartToStation1,
}) => {
  const [showcaseForced, setShowcaseForced] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDisplayingShowcase = !singleBadge || showcaseForced;

  const currentLevel = Math.floor(xp / 100) + 1;
  const getRankTitle = (lvl: number) => {
    if (lvl >= 4) return "Máster de Dominio Cognitivo";
    if (lvl === 3) return "Especialista en Arquitectura";
    if (lvl === 2) return "Explorador Técnico";
    return "Iniciado en Infraestructura";
  };

  const unlockedCount = allBadges.filter((b) => b.desbloqueado).length;

  const badgeId = (singleBadge?.id || "").toLowerCase();
  const badgeTitle = (singleBadge?.titulo || "").toLowerCase();

  // 🟢 Detección estricta de la Estación 5 (no confunde "Memoria de Acero")
  const isCapstoneFinalBadge =
    !badgeTitle.includes("memoria") &&
    !badgeTitle.includes("acero") &&
    !badgeId.includes("station2") &&
    !badgeId.includes("flashcard") &&
    (badgeId.includes("station5") ||
      badgeId.includes("quiz") ||
      badgeId.includes("master") ||
      badgeTitle.includes("alucinacion") ||
      badgeTitle.includes("cero alucinaciones") ||
      badgeTitle.includes("maestro") ||
      badgeTitle.includes("examen final"));

  const activeTheme = getBadgeTheme(singleBadge?.id, singleBadge?.titulo);

  const handleContinue = () => {
    setShowcaseForced(false);
    onClose();
    if (onContinueQuest) onContinueQuest();
  };

  const handleRestartToStart = () => {
    setShowcaseForced(false);
    onClose();
    if (onRestartToStation1) onRestartToStation1();
  };

  const handleModalClose = () => {
    setShowcaseForced(false);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleModalClose}>
      <div
        className={`${styles.modalCard} ${!isDisplayingShowcase ? activeTheme.badgeStyleClass : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Halo volumétrico de fondo */}
        <div className={styles.modalBacklight} aria-hidden="true" />

        {/* Botón de cierre */}
        <button
          type="button"
          onClick={handleModalClose}
          className={styles.closeButton}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {!isDisplayingShowcase && singleBadge ? (
          /* Celebración de Medalla Individual */
          <div className={styles.celebrationWrapper}>
            <div className={styles.badgeOrbContainer}>
              <div className={styles.badgePulseRing} />
              <div className={styles.badgeIconCenter}>{activeTheme.icon}</div>
              <Sparkles size={22} className={styles.sparkleDecor} />
            </div>

            <div className={styles.celebrationTextContent}>
              <div className={styles.unlockedSubheader}>
                ¡MEDALLA DESBLOQUEADA!
              </div>
              <h3 className={styles.badgeCelebrationTitle}>
                {singleBadge.titulo}
              </h3>
              <p className={styles.badgeCelebrationDescription}>
                {singleBadge.descripcion}
              </p>
            </div>

            <div className={styles.ociNotice}>
              <div className={styles.ociNoticeTitle}>
                <Shield size={15} />
                <span>
                  {sesionIniciada
                    ? "Logro guardado en tu cuenta"
                    : "Logro de esta sesión"}
                </span>
              </div>
              <p className={styles.ociNoticeText}>
                {sesionIniciada
                  ? "Se sincroniza con tu progreso y lo verás al volver a iniciar sesión."
                  : "Estás como invitado: el logro se sincroniza en memoria. Inicia sesión para conservarlo."}
              </p>
            </div>

            {isCapstoneFinalBadge ? (
              /* Acciones al culminar la Estación 5: Vitrina de Logros o Repaso */
              <div className={styles.finalActionsContainer}>
                <button
                  type="button"
                  onClick={() => setShowcaseForced(true)}
                  className={styles.ctaContinueButton}
                >
                  <Trophy size={16} />
                  <span>Ver Vitrina de Trofeos</span>
                </button>

                {onRestartToStation1 && (
                  <button
                    type="button"
                    onClick={handleRestartToStart}
                    className={styles.restartLinkButton}
                  >
                    <RotateCcw size={14} />
                    <span>Reiniciar Recorrido desde la Estación 1</span>
                  </button>
                )}
              </div>
            ) : (
              /* Estaciones 1 a 4: Continuar a la siguiente estación */
              <button
                type="button"
                onClick={handleContinue}
                className={styles.ctaContinueButton}
              >
                ¡Continuar Ruta Cognitiva!
              </button>
            )}
          </div>
        ) : (
          /* Vitrina Completa de Trofeos y Medallas */
          <div className={styles.showcaseWrapper}>
            <div className={styles.showcaseHeader}>
              <div className={styles.showcaseTitleGroup}>
                <div className={styles.showcaseTrophyIconBox}>
                  <Award size={20} />
                </div>
                <div>
                  <h3 className={styles.showcaseTitle}>
                    Vitrina de Trofeos & Medallas
                  </h3>
                  <div className={styles.showcaseRank}>
                    Nivel {currentLevel} · {getRankTitle(currentLevel)}
                  </div>
                </div>
              </div>

              <span className={styles.showcaseStatsRatio}>
                <strong>
                  {unlockedCount} / {allBadges.length}
                </strong>{" "}
                Medallas
              </span>
            </div>

            {/* Resumen de estadísticas del estudiante */}
            <div className={styles.playerSummaryGrid}>
              <div className={styles.summaryCard}>
                <Sparkles size={18} className={styles.summaryIconViolet} />
                <div>
                  <div className={styles.summaryLabel}>Experiencia Total</div>
                  <div className={styles.summaryValue}>{xp} XP</div>
                </div>
              </div>

              <div className={styles.summaryCard}>
                <Flame size={18} className={styles.summaryIconAmber} />
                <div>
                  <div className={styles.summaryLabel}>Racha de Estudio</div>
                  <div className={styles.summaryValue}>{streakDays} Días</div>
                </div>
              </div>
            </div>

            {/* Listado de todas las medallas con iconos y estética coherente */}
            <div className={styles.badgeList}>
              {allBadges.map((badge) => {
                const bTheme = getBadgeTheme(badge.id, badge.titulo);
                return (
                  <div
                    key={badge.id}
                    className={`${styles.badgeItem} ${
                      badge.desbloqueado
                        ? styles.badgeItemUnlocked
                        : styles.badgeItemLocked
                    } ${badge.desbloqueado ? bTheme.badgeStyleClass : ""}`}
                  >
                    <div className={styles.badgeContentLeft}>
                      <div
                        className={`${styles.badgeItemIconBox} ${
                          badge.desbloqueado
                            ? styles.badgeItemIconBoxUnlocked
                            : styles.badgeItemIconBoxLocked
                        }`}
                      >
                        {badge.desbloqueado ? (
                          bTheme.icon
                        ) : (
                          <Lock size={18} className={styles.lockIcon} />
                        )}
                      </div>

                      <div className={styles.badgeDetails}>
                        <div className={styles.badgeItemTitle}>
                          {badge.titulo}
                        </div>
                        <div className={styles.badgeItemDesc}>
                          {badge.descripcion}
                        </div>
                        {badge.desbloqueado && badge.fecha && (
                          <div className={styles.badgeItemDate}>
                            <Calendar size={12} />
                            <span>Obtenido en sesión</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.badgeItemStatus}>
                      {badge.desbloqueado ? (
                        <span className={styles.statusUnlockedTag}>
                          <CheckCircle2 size={14} /> Obtenida
                        </span>
                      ) : (
                        <span className={styles.statusLockedTag}>
                          Bloqueada
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className={styles.closeSecondaryButton}
            >
              Cerrar Vitrina
            </button>
          </div>
        )}
      </div>
    </div>
  );
};