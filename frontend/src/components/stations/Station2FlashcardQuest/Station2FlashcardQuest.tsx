import { useState, useRef, useEffect, useMemo, type MouseEvent } from 'react';
import {
  RotateCw,
  Lightbulb,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  BookOpen,
  Award,
  Trophy,
  RotateCcw,
} from 'lucide-react';
import type { FlashcardItem } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import { sonar } from '../../../utils/sonidos';
import styles from './Station2FlashcardQuest.module.css';

interface Station2Props {
  cards: FlashcardItem[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenStreakBadge?: () => void;
  onNextStation?: () => void;
}

const STACK_PRESETS = [
  { rot: -5.5, x: -38, y: 10, opacity: 0.95 },
  { rot: 5.2,  x:  40, y: 14, opacity: 0.90 },
  { rot: -7.0, x: -50, y: 20, opacity: 0.85 },
  { rot: 6.8,  x:  52, y: 24, opacity: 0.80 },
  { rot: -8.2, x: -60, y: 30, opacity: 0.75 },
  { rot: 7.8,  x:  62, y: 34, opacity: 0.70 },
];

export const Station2FlashcardQuest = ({
  cards = [],
  isCompleted,
  onCompleteStation,
  onOpenStreakBadge,
  onNextStation,
}: Station2Props) => {
  const safeCards =
    cards.length > 0
      ? cards
      : [
          {
            id: 'fallback-1',
            frente: 'Sin tarjetas disponibles',
            dorso: 'Genera una adaptación para visualizar los conceptos de active recall.',
            pista_didactica: 'Vuelve a la estación de ingesta para procesar el material.',
          },
        ];

  const totalCards = safeCards.length;
  const minRequired = totalCards;

  // 🟢 Huella digital única del mazo de este documento específico
  const deckFingerprint = safeCards[0]?.frente
    ? `${safeCards[0].frente.slice(0, 30).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${totalCards}`
    : 'default_deck';

  const storageCardsKey = `novamind_s2_mastered_${deckFingerprint}`;
  const storageCompletedKey = `novamind_s2_completed_${deckFingerprint}`;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [repitiendoMazo, setRepitiendoMazo] = useState<boolean>(false);

  // 🟢 Estado de tarjetas dominadas inicializado por documento
  const [masteredCards, setMasteredCards] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageCardsKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // 🟢 Tarjeta de felicitación inicializada solo si este documento específico ya se completó
  const [showCompletionCard, setShowCompletionCard] = useState<boolean>(() => {
    if (isCompleted) return true;
    try {
      return localStorage.getItem(storageCompletedKey) === 'true';
    } catch {
      return false;
    }
  });

  const [prevFingerprint, setPrevFingerprint] = useState(deckFingerprint);

  // 🟢 Sincronización limpia en render al cambiar de documento
  if (deckFingerprint !== prevFingerprint) {
    setPrevFingerprint(deckFingerprint);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setRepitiendoMazo(false);

    let initialCards: Record<string, boolean> = {};
    let initialCompleted = isCompleted;
    try {
      const savedCards = localStorage.getItem(storageCardsKey);
      if (savedCards) initialCards = JSON.parse(savedCards);
      const savedComp = localStorage.getItem(storageCompletedKey);
      if (savedComp === 'true') initialCompleted = true;
    } catch {
      initialCards = {};
      initialCompleted = false;
    }

    setMasteredCards(initialCards);
    setShowCompletionCard(initialCompleted);
  }

  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const [dynamicHeight, setDynamicHeight] = useState<number | undefined>(undefined);

  const currentCard = safeCards[currentIndex] || safeCards[0];
  const cardId = currentCard.id || `card-${currentIndex}`;

  const remainingInStack = Math.max(0, totalCards - 1 - currentIndex);

  const masteredCount = Object.values(masteredCards).filter(Boolean).length;
  // 🟢 Estado derivado reactivo y limpio
  const debeMostrarCompletado =
    !repitiendoMazo &&
    (isCompleted || showCompletionCard || (totalCards > 0 && masteredCount === minRequired));

  const stackLayers = useMemo(() => {
    if (debeMostrarCompletado) return [];
    return Array.from({ length: remainingInStack }).map((_, idx) => {
      const preset = STACK_PRESETS[idx % STACK_PRESETS.length];
      return { ...preset, index: idx };
    });
  }, [remainingInStack, debeMostrarCompletado]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width - 0.5) * 2;
    const yPercent = (y / rect.height - 0.5) * 2;
    setTilt({ x: -yPercent * 6, y: xPercent * 6 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const handleFlip = () => {
    if (debeMostrarCompletado) return;
    sonar('giro');
    setIsFlipped((prev) => !prev);
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest(`.${styles.hintSection}`) ||
      target.closest(`.${styles.hintToggleBtn}`) ||
      target.closest(`.${styles.hintCallout}`)
    ) {
      return;
    }
    handleFlip();
  };

  const handleToggleHint = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowHint((prev) => !prev);
  };

  const handleNext = () => {
    if (debeMostrarCompletado) return;
    if (currentIndex < totalCards - 1) {
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (debeMostrarCompletado) {
      setShowCompletionCard(false);
      setRepitiendoMazo(true);
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex(totalCards - 1);
      return;
    }
    if (currentIndex > 0) {
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleMasterCard = () => {
    const newMastered = { ...masteredCards, [cardId]: true };
    setMasteredCards(newMastered);
    triggerSmallConfetti();

    try {
      localStorage.setItem(storageCardsKey, JSON.stringify(newMastered));
    } catch {
      // fallback
    }

    const totalMastered = Object.values(newMastered).filter(Boolean).length;

    if (totalMastered >= minRequired) {
      if (!isCompleted) {
        onCompleteStation(50);
      }
      triggerLevelUpConfetti();
      if (onOpenStreakBadge) {
        onOpenStreakBadge();
      }
      setRepitiendoMazo(false);
      setShowCompletionCard(true);

      try {
        localStorage.setItem(storageCompletedKey, 'true');
      } catch {
        // fallback
      }
    } else {
      if (currentIndex < totalCards - 1) {
        handleNext();
      }
    }
  };

  const handleRestartDeck = () => {
    setShowCompletionCard(false);
    setRepitiendoMazo(true);
    setMasteredCards({});
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex(0);

    try {
      localStorage.removeItem(storageCardsKey);
      localStorage.removeItem(storageCompletedKey);
    } catch {
      // fallback
    }
  };

  const isCurrentMastered = !debeMostrarCompletado && !!masteredCards[cardId];

  // Medición dinámica: SOLO para la tarjeta frontal activa
  useEffect(() => {
    if (debeMostrarCompletado) return;

    const computeHeight = () => {
      const activeFace = isFlipped ? backFaceRef.current : frontFaceRef.current;
      if (!activeFace) return;

      const topEl = activeFace.querySelector<HTMLElement>(`.${styles.cardTopRow}`);
      const centerEl = activeFace.querySelector<HTMLElement>(
        isFlipped ? `.${styles.backCenter}` : `.${styles.frontCenter}`
      );
      const bottomEl = activeFace.querySelector<HTMLElement>(`.${styles.cardBottomRow}`);

      if (!centerEl) return;

      const isDesktop = window.innerWidth >= 640;
      const padTop = isDesktop ? 26 : 20;
      const padBottom = isDesktop ? 26 : 20;

      const topH = topEl?.offsetHeight || 24;
      const centerH = Math.max(centerEl.scrollHeight, centerEl.offsetHeight || 0);
      const bottomH = bottomEl?.offsetHeight || 36;
      const bottomMargin = 16;
      const breathingRoom = showHint ? 44 : 28;

      const totalCalculated =
        padTop + topH + centerH + bottomMargin + bottomH + padBottom + breathingRoom;

      const baseline = showHint ? (isDesktop ? 480 : 430) : isDesktop ? 360 : 320;

      const finalHeight = Math.ceil(Math.max(baseline, totalCalculated));
      setDynamicHeight(finalHeight);
    };

    computeHeight();
    const timer = setTimeout(computeHeight, 40);

    window.addEventListener('resize', computeHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeHeight);
    };
  }, [currentIndex, isFlipped, showHint, currentCard, debeMostrarCompletado]);

  return (
    <div className={styles.stationWrapper}>
      {/* Header Info */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <BookOpen size={12} color="var(--color-cyan-400)" />
              Estación 02 · Memorización
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Dominada (+50 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>Tarjetas didácticas interactivas</h3>
          <p className={styles.stationSubtitle}>
            Mazo dinámico de {totalCards} tarjetas. Haz clic en la tarjeta para voltearla y poner a prueba tu retención.
          </p>
        </div>

        {/* Progress Tracker */}
        <div className={styles.progressBox}>
          <div className={styles.progressTexts}>
            <div className={styles.progressLabel}>Dominadas (Mín: {minRequired})</div>
          </div>
          <div className={styles.cardIndexBadge}>
            {debeMostrarCompletado ? '✓' : `#${currentIndex + 1}`}
          </div>
        </div>
      </div>

      {/* Escenario con el mazo apilado detrás */}
      <div className={styles.deckStage}>
        <div className={styles.ambientGlow} aria-hidden="true" />

        <div className={styles.deckWrapper}>
          {/* Tarjetas traseras del mazo */}
          {stackLayers.map((layer) => {
            const z = stackLayers.length - layer.index;
            return (
              <div
                key={`deck-card-${layer.index}`}
                className={styles.deckBackingCard}
                style={{
                  transform: `rotate(${layer.rot}deg) translate(${layer.x}px, ${layer.y}px)`,
                  opacity: layer.opacity,
                  zIndex: z,
                }}
                aria-hidden="true"
              />
            );
          })}

          {/* VISTA 1: TARJETA FINAL DE COMPLETADO */}
          {debeMostrarCompletado ? (
            <div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                zIndex: 10,
              }}
              className={`${styles.cardFlipper} ${styles.completionCardFlipper}`}
            >
              <div className={styles.completionCard}>
                <div className={styles.completionGlowSphere} aria-hidden="true" />

                <div className={styles.completionIconBox}>
                  <Trophy size={36} color="#fbbf24" />
                </div>

                <div className={styles.completionBadge}>
                  <Sparkles size={13} color="#34d399" />
                  <span>Maestría 100% Alcanzada</span>
                </div>

                <h3 className={styles.completionTitle}>
                  ¡Asimilaste todos los conceptos!
                </h3>

                <p className={styles.completionSubtitle}>
                  Has dominado con éxito las <strong>{totalCards} tarjetas</strong> didácticas del material mediante evocación activa. Los conceptos ya quedaron registrados en tu ruta cognitiva.
                </p>

                <div className={styles.completionActionRow}>
                  <button
                    type="button"
                    onClick={handleRestartDeck}
                    className={styles.restartBtn}
                  >
                    <RotateCcw size={15} />
                    <span>Repasar mazo desde el inicio</span>
                  </button>

                  {onOpenStreakBadge && (
                    <button
                      type="button"
                      onClick={onOpenStreakBadge}
                      className={styles.openBadgeBtn}
                    >
                      <Award size={15} />
                      <span>Ver Medalla de Racha</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* VISTA 2: TARJETA ACTIVA ESTÁNDAR */
            <div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleCardClick}
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (isFlipped ? 180 : 0)}deg)`,
                ...(dynamicHeight ? { height: `${dynamicHeight}px` } : {}),
                zIndex: 10,
              }}
              className={`${styles.cardFlipper} ${showHint ? styles.cardFlipperWithHint : ''}`}
            >
              {/* FRENTE */}
              <div ref={frontFaceRef} className={`${styles.cardFace} ${styles.cardFront}`}>
                <div className={styles.cardTopRow}>
                  <span className={styles.frontFaceTag}>
                    Tarjeta 0{currentIndex + 1} · Frente
                  </span>
                  <span className={styles.flipHint}>
                    <RotateCw size={14} /> Clic para girar
                  </span>
                </div>

                <div className={styles.frontCenter}>
                  <div className={styles.frontIconBox}>
                    <HelpCircle size={24} />
                  </div>
                  <h4 className={styles.frontQuestion}>{currentCard.frente}</h4>
                  <p className={styles.frontInstructions}>
                    Formula la respuesta mentalmente antes de girar la tarjeta.
                  </p>

                  {currentCard.pista_didactica && (
                    <div
                      className={styles.hintSection}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={handleToggleHint}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className={styles.hintToggleBtn}
                      >
                        <Lightbulb size={16} color="var(--color-amber-400)" />
                        <span>{showHint ? 'Ocultar pista didáctica' : 'Revelar pista didáctica'}</span>
                      </button>

                      {showHint && (
                        <div className={styles.hintCallout}>
                          <strong style={{ color: 'var(--color-amber-300)' }}>💡 Pista:</strong>{' '}
                          {currentCard.pista_didactica}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardBottomRow}>
                  <span />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className={styles.flipActionButtonCyan}
                  >
                    <span>Girar tarjeta</span>
                    <RotateCw size={13} />
                  </button>
                </div>
              </div>

              {/* REVERSO */}
              <div ref={backFaceRef} className={`${styles.cardFace} ${styles.cardBack}`}>
                <div className={styles.cardTopRow}>
                  <span className={styles.backFaceTag}>
                    Tarjeta 0{currentIndex + 1} · Reverso & Síntesis
                  </span>
                  <span className={styles.flipHint}>
                    <RotateCw size={14} /> Clic para volver
                  </span>
                </div>

                <div className={styles.backCenter}>
                  <div className={styles.backAnswerBox}>{currentCard.dorso}</div>
                </div>

                <div className={styles.cardBottomRow}>
                  <span />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className={styles.flipActionButtonViolet}
                  >
                    <span>Volver al frente</span>
                    <RotateCw size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles de Navegación y Respuestas */}
      <div className={styles.controlsRow}>
        <div className={styles.paginationGroup}>
          <button
            type="button"
            onClick={handlePrev}
            className={styles.navButton}
            title="Tarjeta anterior"
            disabled={currentIndex === 0 && !debeMostrarCompletado}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.paginationCount}>
            {debeMostrarCompletado ? 'Completado' : `${currentIndex + 1} de ${totalCards}`}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className={styles.navButton}
            title="Siguiente tarjeta"
            disabled={currentIndex === totalCards - 1 || debeMostrarCompletado}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.actionsGroup}>
          {debeMostrarCompletado ? (
            <button
              type="button"
              onClick={handleRestartDeck}
              className={styles.restartBottomBtn}
            >
              <RotateCcw size={16} />
              <span>Repasar tarjetas</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMasterCard}
              className={`${styles.masterButton} ${isCurrentMastered ? styles.masterButtonActive : ''}`}
            >
              {isCurrentMastered ? (
                <>
                  <CheckCircle2 size={16} color="#fff" />
                  <span>Tarjeta Dominada ✓</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} color="var(--color-cyan-300)" />
                  <span>Concepto dominado (+XP)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {onNextStation && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onNextStation}
            className={styles.nextStationBtn}
          >
            <span>Siguiente Estación: Guía paso a paso</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};