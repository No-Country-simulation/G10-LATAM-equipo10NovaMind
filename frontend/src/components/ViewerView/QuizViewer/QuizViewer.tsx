import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import styles from './QuizViewer.module.css';

interface QuizViewerProps {
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

export const QuizViewer: React.FC<QuizViewerProps> = ({
  question = '¿Cuál es la función principal de las Security Lists en una VCN?',
  options = [
    'Almacenar archivos y backups de la base de datos.',
    'Actuar como guardias virtuales regulando el tráfico de datos.',
    'Conectar automáticamente la nube con un cable físico local.',
  ],
  correctIndex = 1,
  explanation = '¡Correcto! Las Security Lists funcionan como reglas de cortafuegos supervisando las entradas (ingress) y salidas (egress) del tráfico en la subred.',
}) => {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className={styles.quizWrap}>
      <div className={styles.surfaceTop}>
        <span>PREGUNTA 1 DE 4</span>
        <span className={styles.levelChip}>Nivel: Principiante</span>
      </div>

      <h2 className={styles.questionTitle}>{question}</h2>

      <div className={styles.optionsGrid}>
        {options.map((opt, index) => {
          const isSelected = selected === index;
          const isCorrect = index === correctIndex;

          let optionStyle = styles.optionButton;
          if (isSelected) {
            optionStyle = `${styles.optionButton} ${
              isCorrect ? styles.correct : styles.incorrect
            }`;
          }

          return (
            <button
              key={opt}
              type="button"
              className={optionStyle}
              onClick={() => setSelected(index)}
            >
              <span>
                {String.fromCharCode(65 + index)}) {opt}
              </span>
              {isSelected && (
                <span>
                  {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div
          className={`${styles.feedback} ${
            selected === correctIndex ? styles.success : styles.error
          }`}
        >
          {selected === correctIndex ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          <span>
            {selected === correctIndex
              ? explanation
              : 'Incorrecto. Revisa el concepto de Security Lists y reglas de ingress/egress en la sección anterior.'}
          </span>
        </div>
      )}

      <div className={styles.quizFoot}>
        <button type="button" className={styles.secondaryButton}>
          Anterior
        </button>
        <button type="button" className={styles.primaryButton}>
          Siguiente pregunta <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};