import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { RotateCw, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Sparkles, BookOpen, Award } from 'lucide-react';
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

export const Station2FlashcardQuest = ({
  cards = [],
  isCompleted,
  onCompleteStation,
  onOpenStreakBadge,
  onNextStation,
}: Station2Props) => {
  const [prevCards, setPrevCards] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [masteredCards, setMasteredCards] = useState<Record<string, boolean>>({});
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const [dynamicHeight, setDynamicHeight] = useState<number | undefined>(undefined);

  // Sincronización limpia en fase de render sin useEffect
  if (cards !== prevCards) {
    setPrevCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setMasteredCards({});
  }

  const safeCards = cards.length > 0 ? cards : [
    {
      id: 'fallback-1',
      frente: 'Sin tarjetas disponibles',
      dorso: 'Genera una adaptación para visualizar los conceptos de active recall.',
      pista_didactica: 'Vuelve a la estación de ingesta para procesar el material.'
    }
  ];

  const totalCards = safeCards.length;
  // Aprobar exige el 100 % (decisión del usuario, 14/10; antes el 60 %)
  const minRequired = Math.max(1, totalCards);
  const currentCard = safeCards[currentIndex] || safeCards[0];
  const cardId = currentCard.id || `card-${currentIndex}`;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width - 0.5) * 2;
    const yPercent = (y / rect.height - 0.5) * 2;
    setTilt({ x: -yPercent * 8, y: xPercent * 8 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });
  const handleFlip = () => {
    sonar('giro');
    setIsFlipped((prev) => !prev);
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Evitar que el clic en botones, pistas didácticas o elementos interactivos gire la tarjeta
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
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev + 1) % safeCards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev - 1 + safeCards.length) % safeCards.length);
  };

  const handleMasterCard = () => {
    const newMastered = { ...masteredCards, [cardId]: true };
    setMasteredCards(newMastered);
    triggerSmallConfetti();

    const totalMastered = Object.values(newMastered).filter(Boolean).length;

    if (totalMastered >= minRequired) {
      if (!isCompleted) {
        onCompleteStation(50);
      }
      triggerLevelUpConfetti();
      if (onOpenStreakBadge) {
        onOpenStreakBadge();
      }
    }

    setTimeout(() => {
      handleNext();
    }, 350);
  };

  // Acción del botón "Necesito repasar", oculto por decisión del usuario (14/10). Para recuperarlo,
  // descomentar esta función y el botón de más abajo.
  // const handleNeedReview = () => {
  //   setMasteredCards((prev) => ({ ...prev, [cardId]: false }));
  //   handleNext();
  // };

  const isCurrentMastered = !!masteredCards[cardId];
  const masteredCount = Object.values(masteredCards).filter(Boolean).length;
  const isPassed = masteredCount >= minRequired;

  // Medición y ajuste dinámico robusto del alto de la flashcard
  useEffect(() => {
    const computeHeight = () => {
      const activeFace = isFlipped ? backFaceRef.current : frontFaceRef.current;
      if (!activeFace) return;

      const topEl = activeFace.querySelector<HTMLElement>(`.${styles.cardTopRow}`);
      const centerEl = activeFace.querySelector<HTMLElement>(isFlipped ? `.${styles.backCenter}` : `.${styles.frontCenter}`);
      const bottomEl = activeFace.querySelector<HTMLElement>(`.${styles.cardBottomRow}`);

      if (!centerEl) return;

      const isDesktop = window.innerWidth >= 640;
      const padTop = isDesktop ? 26 : 20;
      const padBottom = isDesktop ? 26 : 20;

      const topH = topEl?.offsetHeight || 24;
      // centerEl.scrollHeight contiene la totalidad del contenido (pregunta, icono, botón y pista desplegada)
      const centerH = Math.max(centerEl.scrollHeight, centerEl.offsetHeight || 0);
      const bottomH = bottomEl?.offsetHeight || 36;
      const bottomMargin = 16;

      // Margen generoso de respiro para que el botón "Girar tarjeta" mantenga distancia visual holgada
      const breathingRoom = showHint ? 44 : 28;

      const totalCalculated = padTop + topH + centerH + bottomMargin + bottomH + padBottom + breathingRoom;

      // Alturas mínimas de base según si la pista está desplegada o no
      const baseline = showHint
        ? (isDesktop ? 480 : 430)
        : (isDesktop ? 360 : 320);

      const finalHeight = Math.ceil(Math.max(baseline, totalCalculated));
      setDynamicHeight(finalHeight);
    };

    // Actualización inmediata
    computeHeight();

    // Actualización a los 40ms para asegurar renderizado de tipografías y animación de entrada
    const timer = setTimeout(computeHeight, 40);

    window.addEventListener('resize', computeHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeHeight);
    };
  }, [currentIndex, isFlipped, showHint, currentCard]);

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
          <h3 className={styles.stationTitle}>
            Tarjetas didácticas interactivas
          </h3>
        </div>

        {/* Progress Tracker */}
        <div className={styles.progressBox}>
          <div className={styles.progressTexts}>
            <div className={styles.progressLabel}>Dominadas (Mín: {minRequired})</div>
            <div className={`${styles.progressRatio} ${isPassed ? styles.progressRatioPassed : ''}`}>
              {masteredCount} / {totalCards}
            </div>
          </div>
          <div className={styles.cardIndexBadge}>
            #{currentIndex + 1}
          </div>
        </div>
      </div>

      {/* 3D Flip Card */}
      <div className={styles.perspectiveWrapper}>
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCardClick}
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (isFlipped ? 180 : 0)}deg)`,
            ...(dynamicHeight ? { height: `${dynamicHeight}px` } : {}),
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
              <h4 className={styles.frontQuestion}>
                {currentCard.frente}
              </h4>
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
                      <strong style={{ color: 'var(--color-amber-300)' }}>💡 Pista:</strong> {currentCard.pista_didactica}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.cardBottomRow}>
              {/* Hueco vacío: mantiene el botón a la derecha (space-between) */}
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
              <div className={styles.backAnswerBox}>
                {currentCard.dorso}
              </div>
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
      </div>

      {/* Controles de Navegación y Respuestas */}
      <div className={styles.controlsRow}>
        <div className={styles.paginationGroup}>
          <button
            type="button"
            onClick={handlePrev}
            className={styles.navButton}
            title="Tarjeta anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.paginationCount}>
            {currentIndex + 1} de {totalCards}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className={styles.navButton}
            title="Siguiente tarjeta"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.actionsGroup}>
          {/* "Necesito repasar" oculto por decisión del usuario (14/10):
          <button
            type="button"
            onClick={handleNeedReview}
            className={styles.reviewButton}
          >
            Necesito repasar
          </button>
          */}

          {isPassed ? (
            <button
              type="button"
              onClick={() => onOpenStreakBadge && onOpenStreakBadge()}
              className={styles.badgeButton}
            >
              <Award size={16} />
              <span>Ver Medalla de Racha</span>
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
                  <span>Concepto dominado</span>
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(99, 102, 241, 0.2) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>Siguiente Estación: Guía paso a paso</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};