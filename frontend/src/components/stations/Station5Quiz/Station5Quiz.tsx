import type { QuizState } from '../../../services/persistence';
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
import { sonar } from "../../../utils/sonidos";
import { FuenteChip } from "../../RecursoEstado/RecursoEstado";
import { puntosDeRepaso } from "../../../utils/repasoQuiz";
import { RepasoGuiado } from "./RepasoGuiado";
import styles from "./Station5Quiz.module.css";

interface Station5Props {
  quizState: QuizState;
  onQuizChange: (update: (previous: QuizState) => QuizState) => void;
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
  quizState,
  onQuizChange,
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
  const { currentQuestionIndex, selectedOption, isEvaluated, userAnswers, isQuizCompleted } = quizState;
  const setCurrentQuestionIndex = (value: number | ((previous: number) => number)) =>
    onQuizChange(prev => ({ ...prev, currentQuestionIndex: typeof value === 'function' ? value(prev.currentQuestionIndex) : value }));
  const setSelectedOption = (value: number | null) => onQuizChange(prev => ({ ...prev, selectedOption: value,
    selectedAnswers: value === null ? prev.selectedAnswers : { ...prev.selectedAnswers, [prev.currentQuestionIndex]: value } }));
  const setIsEvaluated = (value: boolean) => onQuizChange(prev => ({ ...prev, isEvaluated: value }));
  const setUserAnswers = (value: Record<number, boolean> | ((previous: Record<number, boolean>) => Record<number, boolean>)) =>
    onQuizChange(prev => ({ ...prev, userAnswers: typeof value === 'function' ? value(prev.userAnswers) : value,
      selectedAnswers: typeof value === 'function' ? prev.selectedAnswers : {} }));
  const setIsQuizCompleted = (value: boolean) => onQuizChange(prev => ({ ...prev, isQuizCompleted: value }));

  // Sin preguntas no se inventa ninguna: Step2 muestra «no disponible» antes de llegar aquí.
  const safeQuestions = questions;

  const totalQuestions = safeQuestions.length;
  // Como todas las estaciones, el quiz exige el 100 %.
  const minRequiredToPass = totalQuestions;
  const currentQ = safeQuestions[currentQuestionIndex] || safeQuestions[0];
  // Alternativas ya falladas en esta pregunta: se marcan y no se pueden volver a elegir.
  const fallidas = quizState.failedOptions?.[currentQuestionIndex] ?? [];
  // Tras acertar se explica por qué fallaban las descartadas, si el backend lo generó (modo paralelo).
  // Antes no: la explicación de una incorrecta puede delatar la correcta.
  const explicacionesFallidas = isEvaluated
    ? fallidas
        .map((idx) => ({ opcion: currentQ?.opciones[idx], texto: currentQ?.explicaciones_opciones?.[idx] }))
        .filter((e) => e.opcion && e.texto)
    : [];

  // Repaso guiado: preguntas falladas con su cita y página reales, sin llamar a ningún modelo.
  const puntosRepaso = puntosDeRepaso(safeQuestions, quizState.failedOptions);

  if (!currentQ) return null;

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
              Estación 05 · Examen final
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

          <h3 className={styles.dangerTitle}>El error es parte del aprendizaje</h3>

          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            Cada intento es una oportunidad para fortalecer lo aprendido.
            En lugar de adivinar, la clave para dominar conceptos complejos
            está en dar un paso atrás y repasar a tu propio ritmo.
            Reconstruyamos las bases para que vuelvas al desafío con total seguridad.
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
              Restauraremos tus <strong>3 escudos al 100%</strong> y
              recorreremos la ruta desde la <strong>Estación 01</strong> para
              fijar cada concepto clave antes de volver a intentarlo.
            </p>
          </div>
        </div>

        <RepasoGuiado puntos={puntosRepaso} revelarRespuestas={false} />

        <div>
          <button
            type="button"
            onClick={onResetCircuit}
            className={styles.restartCircuitBtn}
          >
            <RotateCcw size={16} />
            <span>Restaurar Escudos y Reforzar Conceptos</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Manejo de Selección y Evaluación
  const handleSelectOption = (index: number) => {
    if (isEvaluated || fallidas.includes(index)) return;

    if (index === currentQ.respuesta_correcta) {
      sonar('acierto');
      setSelectedOption(index);
      setIsEvaluated(true);
      setUserAnswers((prev) => ({ ...prev, [currentQuestionIndex]: true }));
      return;
    }

    // Incorrecta: cuesta un escudo y se puede reintentar sin revelar la correcta.
    sonar('error');
    onQuizChange((prev) => ({
      ...prev,
      failedOptions: {
        ...prev.failedOptions,
        [prev.currentQuestionIndex]: [...(prev.failedOptions?.[prev.currentQuestionIndex] ?? []), index],
      },
    }));
    onDeductShield();
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsEvaluated(false);
    } else {
      setIsQuizCompleted(true);
      const correctCount = Object.values(userAnswers).filter(Boolean).length;

      if (totalQuestions > 0 && correctCount === minRequiredToPass) {
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
    onQuizChange((prev) => ({ ...prev, failedOptions: {} }));
    setIsQuizCompleted(false);
  };

  const correctAnswersCount = Object.values(userAnswers).filter(Boolean).length;
  const userScorePercentage = Math.round(
    (correctAnswersCount / totalQuestions) * 100,
  );
  const isSuccess = totalQuestions > 0 && correctAnswersCount === minRequiredToPass;

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
                ? "¡Evaluación Final Aprobada!"
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
              ? `Respondiste correctamente las ${totalQuestions} preguntas, demostrando anclaje conceptual riguroso.`
              : `Se requiere el 100 % de aciertos (${totalQuestions} de ${totalQuestions}) para superar la estación y reclamar la Medalla Master.`}
          </p>
        </div>

        <RepasoGuiado puntos={puntosRepaso} revelarRespuestas={isSuccess} />

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
              Estación 05 · Examen final
            </span>
            <span className={styles.examApprovalPill}>
              Aprobación: {minRequiredToPass}/{totalQuestions} (100 %)
            </span>
          </div>
          <h3
            className={styles.lockedTitle}
            style={{ fontSize: "1.5rem", textAlign: "left" }}
          >
            Cuestionario
          </h3>
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

        {!isEvaluated && fallidas.length > 0 && (
          <div className={styles.wrongAttemptAlert} role="status">
            <XCircle size={16} color="var(--color-rose-400)" />
            <span>Respuesta incorrecta. Perdiste un escudo. Prueba otra alternativa.</span>
          </div>
        )}

        <div className={styles.optionsList}>
          {currentQ.opciones.map((op, idx) => {
            const isSelected = selectedOption === idx;
            const isFailed = fallidas.includes(idx);

            let optionClass = styles.optionButton;
            if (isFailed) {
              optionClass = `${styles.optionButton} ${styles.optionIncorrect}`;
            } else if (isEvaluated) {
              optionClass = `${styles.optionButton} ${isSelected ? styles.optionCorrect : styles.optionMuted}`;
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={isEvaluated || isFailed}
                className={optionClass}
              >
                <span>{op}</span>
                {isFailed ? (
                  <span><XCircle size={20} color="var(--color-rose-400)" /></span>
                ) : isEvaluated && isSelected ? (
                  <span><CheckCircle2 size={20} color="var(--color-emerald-400)" /></span>
                ) : null}
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
              {explicacionesFallidas.length > 0 && <strong>Respuesta correcta: </strong>}
              {currentQ.justificacion_rag}
            </p>

            {explicacionesFallidas.map((e) => (
              <p key={e.opcion} className={styles.ragJustificationText}>
                <strong>Descartaste «{e.opcion}»:</strong> {e.texto}
              </p>
            ))}

            {currentQ.cita_fuente && (
              <div className={styles.ragCitation}>
                <strong style={{ color: "var(--color-violet-300)" }}>
                  Cita textual fuente:
                </strong>{" "}
                {currentQ.cita_fuente}{" "}
                <FuenteChip fuente={currentQ.fuente} />
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
