import React, { useState } from 'react';
import {
  GitBranch,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  CircleHelp,
  CheckCircle2,
} from 'lucide-react';
import type { FlashcardItem } from '../../../types/api';
import styles from './FlashcardViewer.module.css';

interface FlashcardViewerProps {
  cards: (FlashcardItem & { concept?: string; body?: string })[];
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({ cards }) => {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = cards[cardIndex] || {
    frente: '¿Qué controla una VCN dentro del cloud?',
    dorso: 'Es tu red privada y personalizable dentro de OCI.',
    concept: 'CONCEPTO',
    body: 'Una red virtual definida por software en Oracle Cloud.',
    pista_didactica: 'Piensa en ella como tu propio barrio privado dentro de la nube.',
  };

  const handleNext = () => {
    setFlipped(false);
    setCardIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setFlipped(false);
    setCardIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div>
      <div className={styles.surfaceTop}>
        <span>
          FLASHCARD {cardIndex + 1} DE {cards.length}
        </span>
        <span className={styles.sourceAnchor}>
          <GitBranch size={13} /> ANCLADO A 6 CHUNKS
        </span>
      </div>

      <div className={styles.flipScene} onClick={() => setFlipped(!flipped)}>
        <div className={`${styles.flipCard} ${flipped ? styles.flipped : ''}`}>
          {/* FRENTE */}
          <div className={`${styles.cardFace} ${styles.front}`}>
            <div className={styles.faceHeader}>
              <span className={styles.typeChip}>{current.concept || 'CONCEPTO'}</span>
              <span className={styles.faceLabel}>FRENTE</span>
            </div>
            <div>
              <h2>{current.frente}</h2>
              {current.body && <p>{current.body}</p>}
            </div>
            <div className={styles.questionBox}>
              <span>PREGUNTA DE COMPRENSIÓN</span>
              <strong>{current.frente}</strong>
            </div>
          </div>

          {/* REVERSO */}
          <div className={`${styles.cardFace} ${styles.back}`}>
            <div className={styles.faceHeader}>
              <span className={`${styles.typeChip} ${styles.greenChip}`}>
                EXPLICACIÓN ADAPTADA
              </span>
              <span className={styles.faceLabel}>REVERSO</span>
            </div>
            <h3>{current.dorso}</h3>
            {current.pista_didactica && (
              <div className={styles.hintBox}>
                <Lightbulb size={16} />
                <div>
                  <b>Pista didáctica</b>
                  <span>{current.pista_didactica}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.viewerControls}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handlePrev}
          disabled={cardIndex === 0}
        >
          <ArrowLeft size={15} /> Anterior
        </button>
        <button
          type="button"
          className={styles.turnButton}
          onClick={() => setFlipped(!flipped)}
        >
          <RotateCcw size={15} /> {flipped ? 'Ver frente' : 'Girar tarjeta'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleNext}
        >
          Siguiente <ArrowRight size={15} />
        </button>
      </div>

      <div className={styles.selfCheck}>
        <button type="button">
          <CircleHelp size={15} /> Necesito repasar
        </button>
        <button type="button">
          <CheckCircle2 size={15} /> Entendido
        </button>
      </div>
    </div>
  );
};