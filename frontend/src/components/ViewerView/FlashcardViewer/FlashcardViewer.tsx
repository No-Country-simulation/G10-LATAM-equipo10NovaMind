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
  cards?: (FlashcardItem & { concept?: string; body?: string })[];
}

const DEFAULT_CARDS: (FlashcardItem & { concept?: string; body?: string })[] = [
  {
    concept: 'CONCEPTO',
    frente: '¿Qué es una VCN en Oracle Cloud?',
    dorso:
      'Es tu red privada y personalizable dentro de OCI: el espacio donde defines subredes, rutas y reglas de tráfico.',
    body: 'Una red virtual definida por software en Oracle Cloud Infrastructure.',
    pista_didactica: 'Piensa en ella como tu propio barrio privado dentro de la nube.',
  },
  {
    concept: 'CONCEPTO CLAVE',
    frente: '¿Por qué separar una subred pública de una privada?',
    dorso:
      'La separación limita la superficie de exposición: los recursos privados no reciben tráfico directo desde Internet.',
    body: 'Segmentos lógicos que organizan los recursos de tu red.',
    pista_didactica: 'Como separar la recepción de una oficina del archivo interno confidencial.',
  },
  {
    concept: 'SEGURIDAD',
    frente: '¿Qué función cumple una Security List?',
    dorso:
      'Actúa como un cortafuegos virtual que define qué tráfico ingress (entrada) y egress (salida) está permitido.',
    body: 'Reglas virtuales para controlar el tráfico de red de forma granular.',
    pista_didactica: 'Son los guardias que revisan cada paquete de datos entrante y saliente.',
  },
];

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({ cards }) => {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const activeCards = (cards && cards.length > 0) ? cards : DEFAULT_CARDS;
  const safeIndex = Math.min(cardIndex, activeCards.length - 1);
  const current = activeCards[safeIndex] || DEFAULT_CARDS[0];

  const handleNext = () => {
    setFlipped(false);
    setCardIndex((prev) => (prev + 1) % activeCards.length);
  };

  const handlePrev = () => {
    setFlipped(false);
    setCardIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div>
      <div className={styles.surfaceTop}>
        <span>
          FLASHCARD {safeIndex + 1} DE {activeCards.length}
        </span>
        <span className={styles.sourceAnchor}>
          <GitBranch size={13} /> ANCLADO A RAG CHROMA
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
          disabled={safeIndex === 0}
        >
          <ArrowLeft size={14} /> Anterior
        </button>
        <button
          type="button"
          className={styles.turnButton}
          onClick={() => setFlipped(!flipped)}
        >
          <RotateCcw size={14} /> {flipped ? 'Ver frente' : 'Girar tarjeta'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleNext}
          disabled={safeIndex === activeCards.length - 1}
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>

      <div className={styles.selfCheck}>
        <button type="button" className={styles.checkButtonWarn}>
          <CircleHelp size={15} /> Necesito repasar
        </button>
        <button type="button" className={styles.checkButtonSuccess}>
          <CheckCircle2 size={15} /> Entendido
        </button>
      </div>
    </div>
  );
};