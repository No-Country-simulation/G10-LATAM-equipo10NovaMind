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
  explanation = '¡Correcto! Las Security Lists funcionan como reglas de cortafuegos supervisando las entradas y salidas del tráfico.',
}) => {
  const [answer, setAnswer] = useState<number | null>(null);

  return (
    <div className={styles.quizWrap}>
      <div className={styles.surfaceTop}>
        <span>PREGUNTA 1 DE 4</span>
        <span className={styles.levelChip}>Nivel: Principiante</span>
      </div>

      <h2 className={styles.questionTitle}>{question}</h2>

      <div className={styles.quizOptions}>
        {options.map((option, index) => {
          let btnClass = styles.quizOption;
          if (answer === index) {
            btnClass += ` ${index === correctIndex ? styles.correct : styles.incorrect}`;
          }

          return (
            <button
              key={option}
              type="button"
              className={btnClass}
              onClick={() => setAnswer(index)}
            >
              <span>
                {String.fromCharCode(65 + index)}) {option}
              </span>
              {answer === index && (
                <span>
                  {index === correctIndex ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <XCircle size={17} />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answer !== null && (
        <div
          className={`${styles.feedback} ${
            answer === correctIndex ? styles.success : styles.error
          }`}
        >
          {answer === correctIndex ? (
            <CheckCircle2 size={15} />
          ) : (
            <XCircle size={15} />
          )}
          <span>
            {answer === correctIndex
              ? explanation
              : 'Incorrecto. Revisa la definición de Security Lists en la tarjeta de Flashcards.'}
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