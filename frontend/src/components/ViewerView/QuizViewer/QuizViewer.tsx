import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import type { QuizItem, QuizOpcion } from '../../../types/api';
import styles from './QuizViewer.module.css';

interface QuizViewerProps {
  items?: QuizItem[];
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

const DEFAULT_QUIZ: QuizItem[] = [
  {
    pregunta: '¿Cuál es la función principal de las Security Lists en una VCN?',
    opciones: [
      'Almacenar archivos y backups de la base de datos.',
      'Actuar como guardias virtuales regulando el tráfico de datos.',
      'Conectar automáticamente la nube con un cable físico local.',
      'Crear automáticamente usuarios y contraseñas de acceso.',
    ],
    respuesta_correcta: 'Actuar como guardias virtuales regulando el tráfico de datos.',
    justificacion: '¡Correcto! Las Security Lists funcionan como reglas de cortafuegos supervisando las entradas y salidas del tráfico.',
  },
];

export const QuizViewer: React.FC<QuizViewerProps> = ({
  items,
  question,
  options,
  correctIndex,
  explanation,
}) => {
  // Construir lista activa de preguntas
  const quizList: QuizItem[] = (items && items.length > 0)
    ? items
    : (question && options)
      ? [{
          pregunta: question,
          opciones: options,
          respuesta_correcta: options[correctIndex ?? 1] || options[0],
          justificacion: explanation || 'Respuesta validada por el sistema.',
        }]
      : DEFAULT_QUIZ;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const currentItem = quizList[currentIndex] || quizList[0];

  // Normalizar opciones a strings
  const stringOptions: string[] = (currentItem.opciones || []).map((opt: string | QuizOpcion) => {
    if (typeof opt === 'string') return opt;
    return opt.texto;
  });

  // Determinar índice correcto
  let computedCorrectIndex = 0;
  if (currentItem.respuesta_correcta) {
    const idx = stringOptions.findIndex(
      (opt) =>
        opt.trim().toLowerCase() === currentItem.respuesta_correcta.trim().toLowerCase() ||
        opt.trim().startsWith(currentItem.respuesta_correcta.trim())
    );
    if (idx !== -1) {
      computedCorrectIndex = idx;
    }
  }

  const selectedAnswer = answers[currentIndex] ?? null;

  const handleSelectOption = (index: number) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: index }));
  };

  const handleNext = () => {
    if (currentIndex < quizList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const currentExplanation =
    currentItem.justificacion ||
    currentItem.justificacion_pedagogica ||
    explanation ||
    '¡Respuesta correcta anclada a la fuente oficial!';

  return (
    <div className={styles.quizWrap}>
      <div className={styles.surfaceTop}>
        <span>
          PREGUNTA {currentIndex + 1} DE {quizList.length}
        </span>
        <span className={styles.levelChip}>Quiz Didáctico Interactivo</span>
      </div>

      <h2 className={styles.questionTitle}>{currentItem.pregunta}</h2>

      <div className={styles.quizOptions}>
        {stringOptions.map((option, index) => {
          let btnClass = styles.quizOption;
          if (selectedAnswer === index) {
            btnClass += ` ${index === computedCorrectIndex ? styles.correct : styles.incorrect}`;
          }

          return (
            <button
              key={`${index}-${option}`}
              type="button"
              className={btnClass}
              onClick={() => handleSelectOption(index)}
            >
              <span>
                {String.fromCharCode(65 + index)}) {option}
              </span>
              {selectedAnswer === index && (
                <span>
                  {index === computedCorrectIndex ? (
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

      {selectedAnswer !== null && (
        <div
          className={`${styles.feedback} ${
            selectedAnswer === computedCorrectIndex ? styles.success : styles.error
          }`}
        >
          {selectedAnswer === computedCorrectIndex ? (
            <CheckCircle2 size={15} />
          ) : (
            <XCircle size={15} />
          )}
          <span>
            {selectedAnswer === computedCorrectIndex
              ? currentExplanation
              : `Incorrecto. La respuesta correcta es la opción ${String.fromCharCode(65 + computedCorrectIndex)}).`}
          </span>
        </div>
      )}

      <div className={styles.quizFoot}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ArrowLeft size={15} /> Anterior
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleNext}
          disabled={currentIndex >= quizList.length - 1}
        >
          Siguiente pregunta <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};