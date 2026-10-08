import { useState } from "react";
import {
  Lock,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  BookOpen,
  Download,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  Compass,
} from "lucide-react";
import type { QuizQuestion } from "../../../types/types";
import { triggerCelebrationConfetti } from "../../../utils/confetti";
import styles from "./Station5Quiz.module.css";

interface Station5Props {
  questions: QuizQuestion[];
  completedStationsCount: number;
  isUnlocked: boolean;
  cognitiveShields: number;
  onSelectStation: (stationIndex: number) => void;
  onDeductShield: () => void;
  onResetCircuit: () => void;
  onCompleteStation: (xp: number) => void;
  onOpenMasterBadge: () => void;
  onDownloadArtifact: () => void;
}

export const Station5FinalTrial = ({
  questions = [],
  completedStationsCount,
  isUnlocked,
  cognitiveShields,
  onSelectStation,
  onDeductShield,
  onResetCircuit,
  onCompleteStation,
  onOpenMasterBadge,
  onDownloadArtifact,
}: Station5Props) => {
  const [prevQuestions, setPrevQuestions] = useState(questions);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, boolean>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);

  // Sincronización limpia en render sin useEffect
  if (questions !== prevQuestions) {
    setPrevQuestions(questions);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsEvaluated(false);
    setUserAnswers({});
    setIsQuizCompleted(false);
  }

  const safeQuestions =
    questions.length > 0
      ? questions
      : [
          {
            id: "quiz-fallback-1",
            pregunta: "¿Cuál es el propósito central del contenido analizado?",
            opciones: [
              "Comprensión profunda de los conceptos clave",
              "Memorización sin contexto",
              "Ignorar las fuentes",
            ],
            respuesta_correcta: 0,
            justificacion_rag:
              "El objetivo principal de la adaptación pedagógica es asimilar los principios clave sin alucinaciones.",
            cita_fuente: "Documento procesado",
          },
        ];

  const totalQuestions = safeQuestions.length;
  const minRequiredToPass = Math.max(1, Math.ceil(totalQuestions * 0.6));
  const minPercentage = Math.round((minRequiredToPass / totalQuestions) * 100);
  const currentQ = safeQuestions[currentQuestionIndex] || safeQuestions[0];

  // 1. Pantalla: Bloqueo por requisitos previos
  if (!isUnlocked) {
    return (
      <div className={styles.lockedCard}>
        <div className={styles.lockedAmbientGlow} />

        <div className={styles.lockedContent}>
          <div className={styles.lockedIconBox}>
            <Lock size={32} />
          </div>

          <div>
            <span className={styles.lockedTag}>
              The Final Trial · Examen Capstone
            </span>
            <h3 className={styles.lockedTitle}>Estación 05 Bloqueada</h3>
            <p className={styles.lockedDesc}>
              Completa al menos{" "}
              <strong style={{ color: "var(--color-amber-300)" }}>
                2 estaciones previas
              </strong>{" "}
              para desbloquear la prueba de dominio sin alucinaciones.
            </p>
          </div>

          <div className={styles.lockedProgressBox}>
            <div className={styles.lockedProgressLabels}>
              <span style={{ color: "var(--color-text-muted)" }}>
                Requisito de Desbloqueo:
              </span>
              <strong
                style={{
                  color: "var(--color-amber-300)",
                  fontFamily: "var(--font-code)",
                }}
              >
                {completedStationsCount} de 2 Estaciones Completadas
              </strong>
            </div>
            <div className={styles.lockedProgressBarBg}>
              <div
                className={styles.lockedProgressBarFill}
                style={{
                  width: `${Math.min(100, (completedStationsCount / 2) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className={styles.lockedStationNavGroup}>
            <button
              type="button"
              onClick={() => onSelectStation(0)}
              className={styles.lockedNavBtn}
            >
              Ir a Estación 1 (Resumen)
            </button>
            <button
              type="button"
              onClick={() => onSelectStation(1)}
              className={styles.lockedNavBtn}
            >
              Ir a Estación 2 (Flashcards)
            </button>
            <button
              type="button"
              onClick={() => onSelectStation(2)}
              className={styles.lockedNavBtn}
            >
              Ir a Estación 3 (Tutorial)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Pantalla: Sobrecarga Cognitiva (0 Escudos)
  if (cognitiveShields === 0 && !isQuizCompleted) {
    return (
      <div className={styles.dangerCard}>
        <div className={styles.dangerIconBox}>
          <ShieldAlert size={40} />
        </div>

        <div
          style={{
            maxWidth: "32rem",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div>
            <span className={styles.dangerTag}>
              Escudos Cognitivos Agotados (0/3)
            </span>
          </div>

          <h3 className={styles.dangerTitle}>El error es parte del dominio</h3>

          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            Consumiste tus 3 reservas de atención frente a conceptos no
            consolidados. En la ciencia cognitiva, la curva del olvido se vence
            mediante la repetición espaciada, no forzando respuestas al azar.
          </p>

          <div className={styles.dangerNotice}>
            <Compass
              size={20}
              style={{
                color: "var(--color-amber-400)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
            <p>
              Recuperaremos tus <strong>3 escudos al 100%</strong> y
              reiniciaremos el recorrido desde la <strong>Estación 01</strong>{" "}
              para que reconstruyas la intuición con una base sólida.
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={onResetCircuit}
            className={styles.restartCircuitBtn}
          >
            <RotateCcw size={16} />
            <span>Restaurar Escudos y Reiniciar Ruta Cognitiva</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Manejo de Selección y Evaluación
  const handleSelectOption = (index: number) => {
    if (isEvaluated) return;
    setSelectedOption(index);
    setIsEvaluated(true);

    const isCorrect = index === currentQ.respuesta_correcta;
    setUserAnswers((prev) => ({ ...prev, [currentQuestionIndex]: isCorrect }));

    if (!isCorrect) {
      onDeductShield();
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsEvaluated(false);
    } else {
      setIsQuizCompleted(true);
      const correctCount = Object.values(userAnswers).filter(Boolean).length;

      if (correctCount >= minRequiredToPass) {
        triggerCelebrationConfetti();
        onCompleteStation(100);
        onOpenMasterBadge();
      }
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsEvaluated(false);
    setUserAnswers({});
    setIsQuizCompleted(false);
  };

  const correctAnswersCount = Object.values(userAnswers).filter(Boolean).length;
  const userScorePercentage = Math.round(
    (correctAnswersCount / totalQuestions) * 100,
  );
  const isSuccess = correctAnswersCount >= minRequiredToPass;

  // 4. Pantalla: Resultado Final
  if (isQuizCompleted) {
    return (
      <div
        className={`${styles.resultCard} ${isSuccess ? styles.resultSuccess : styles.resultFailed}`}
      >
        <div
          className={`${styles.resultIconBox} ${isSuccess ? styles.resultIconSuccess : styles.resultIconFailed}`}
        >
          {isSuccess ? <Award size={40} /> : <AlertTriangle size={40} />}
        </div>

        <div
          style={{
            maxWidth: "28rem",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div>
            <span
              className={isSuccess ? styles.examApprovalPill : styles.dangerTag}
            >
              {isSuccess
                ? "¡Evaluación Capstone Aprobada!"
                : "Evaluación No Superada"}
            </span>
          </div>

          <h3 className={styles.lockedTitle}>
            {correctAnswersCount} de {totalQuestions} Aciertos (
            {userScorePercentage}%)
          </h3>

          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            {isSuccess
              ? `Has superado el umbral requerido (mínimo ${minRequiredToPass} de ${totalQuestions} - ${minPercentage}%) demostrando anclaje conceptual riguroso.`
              : `Se requieren al menos ${minRequiredToPass} respuestas correctas (${minPercentage}%) para superar la estación y reclamar la Medalla Master.`}
          </p>
        </div>

        <div className={styles.resultButtonsGroup}>
          <button
            type="button"
            onClick={handleRestartQuiz}
            className={styles.lockedNavBtn}
          >
            <RotateCcw size={14} style={{ marginRight: "0.25rem" }} />
            Reintentar Examen
          </button>

          {isSuccess && (
            <>
              <button
                type="button"
                onClick={onDownloadArtifact}
                className={styles.downloadArtifactBtn}
              >
                <Download size={14} />
                Descargar Artefacto JSON
              </button>

              <button
                type="button"
                onClick={() => onSelectStation(0)}
                className={styles.lockedNavBtn}
              >
                <BookOpen size={14} style={{ marginRight: "0.25rem" }} />
                Repasar desde Estación 1
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 5. Vista de Pregunta Activa
  return (
    <div className={styles.stationWrapper}>
      <div className={styles.headerContainer}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            <span className={styles.examTitleTag}>
              <Award size={12} color="var(--color-amber-400)" />
              Estación 05 · The Final Trial (Quiz Capstone)
            </span>
            <span className={styles.examApprovalPill}>
              Aprobación: ≥{minRequiredToPass}/{totalQuestions} ({minPercentage}
              %)
            </span>
          </div>
          <h3
            className={styles.lockedTitle}
            style={{ fontSize: "1.5rem", textAlign: "left" }}
          >
            Examen Interactivo con Justificación RAG
          </h3>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
            }}
          >
            Cada respuesta se contrasta con el material de origen para verificar
            la comprensión sin alucinaciones.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}
          >
            Pregunta
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-code)",
              fontWeight: 700,
              color: "var(--color-amber-400)",
            }}
          >
            {currentQuestionIndex + 1} de {totalQuestions}
          </div>
        </div>
      </div>

      <div className={styles.questionCard}>
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-code)",
              color: "var(--color-violet-400)",
              textTransform: "uppercase",
              marginBottom: "0.25rem",
            }}
          >
            Desafío 0{currentQuestionIndex + 1}
          </div>
          <h4 className={styles.questionTitle}>{currentQ.pregunta}</h4>
        </div>

        <div className={styles.optionsList}>
          {currentQ.opciones.map((op, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrectAnswer = idx === currentQ.respuesta_correcta;

            let optionClass = styles.optionButton;
            if (isEvaluated) {
              if (isCorrectAnswer) {
                optionClass = `${styles.optionButton} ${styles.optionCorrect}`;
              } else if (isSelected && !isCorrectAnswer) {
                optionClass = `${styles.optionButton} ${styles.optionIncorrect}`;
              } else {
                optionClass = `${styles.optionButton} ${styles.optionMuted}`;
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={isEvaluated}
                className={optionClass}
              >
                <span>{op}</span>
                {isEvaluated && (
                  <span>
                    {isCorrectAnswer ? (
                      <CheckCircle2
                        size={20}
                        color="var(--color-emerald-400)"
                      />
                    ) : isSelected ? (
                      <XCircle size={20} color="var(--color-rose-400)" />
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isEvaluated && (
          <div className={styles.ragGroundingBox}>
            <div className={styles.ragHeader}>
              <BookOpen size={16} />
              <span>Fundamentación RAG</span>
            </div>

            <p className={styles.ragJustificationText}>
              {currentQ.justificacion_rag}
            </p>

            {currentQ.cita_fuente && (
              <div className={styles.ragCitation}>
                <strong style={{ color: "var(--color-violet-300)" }}>
                  Cita textual fuente:
                </strong>{" "}
                {currentQ.cita_fuente}
              </div>
            )}

            <button
              type="button"
              onClick={handleNextQuestion}
              className={styles.nextQuestionBtn}
            >
              <span>
                {currentQuestionIndex < totalQuestions - 1
                  ? "Siguiente Pregunta"
                  : "Finalizar Examen"}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
