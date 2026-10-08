import { useState, type MouseEvent } from 'react';
import { RotateCw, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Sparkles, BookOpen, Award } from 'lucide-react';
import type { FlashcardItem } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import styles from './Station2FlashcardQuest.module.css';

interface Station2Props {
  cards: FlashcardItem[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenStreakBadge?: () => void;
}

export const Station2FlashcardQuest = ({
  cards = [],
  isCompleted,
  onCompleteStation,
  onOpenStreakBadge,
}: Station2Props) => {
  const [prevCards, setPrevCards] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [masteredCards, setMasteredCards] = useState<Record<string, boolean>>({});
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
  const minRequired = Math.max(1, Math.ceil(totalCards * 0.6));
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
  const handleFlip = () => setIsFlipped(!isFlipped);

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

  const handleNeedReview = () => {
    setMasteredCards((prev) => ({ ...prev, [cardId]: false }));
    handleNext();
  };

  const isCurrentMastered = !!masteredCards[cardId];
  const masteredCount = Object.values(masteredCards).filter(Boolean).length;
  const isPassed = masteredCount >= minRequired;

  return (
    <div className={styles.stationWrapper}>
      {/* Header Info */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <BookOpen size={12} color="var(--color-cyan-400)" />
              Estación 02 · Active Recall & Memorización
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Dominada (+50 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>
            Flashcard Quest Interactivo
          </h3>
          <p className={styles.stationSubtitle}>
            Pon a prueba tu memoria activa con tarjetas 3D. Umbral de aprobación: al menos {minRequired} de {totalCards} dominadas.
          </p>
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
          onClick={handleFlip}
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (isFlipped ? 180 : 0)}deg)`,
          }}
          className={styles.cardFlipper}
        >
          {/* FRENTE */}
          <div className={`${styles.cardFace} ${styles.cardFront}`}>
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
            </div>

            <div className={styles.cardBottomRow}>
              <span>Active Recall Simulator</span>
              <span style={{ color: 'var(--color-cyan-400)', fontWeight: 600 }}>Girar tarjeta ↺</span>
            </div>
          </div>

          {/* REVERSO */}
          <div className={`${styles.cardFace} ${styles.cardBack}`}>
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

              {currentCard.pista_didactica && (
                <div onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className={styles.hintToggleBtn}
                  >
                    <Lightbulb size={16} color="var(--color-amber-400)" />
                    <span>{showHint ? 'Ocultar pista' : 'Revelar pista didáctica'}</span>
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
              <span>Fidelidad Pedagógica</span>
              <span style={{ color: 'var(--color-violet-400)', fontWeight: 600 }}>Volver al frente ↺</span>
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
          <button
            type="button"
            onClick={handleNeedReview}
            className={styles.reviewButton}
          >
            Necesito repasar
          </button>

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
                  <span>Dominar Concepto</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};