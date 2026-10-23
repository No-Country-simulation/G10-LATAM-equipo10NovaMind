import { useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';
import type { QuizQuestion } from '../../../types/types';
import { triggerCelebrationConfetti } from '../../../utils/confetti';
import { sonar } from '../../../utils/sonidos';
import { FuenteChip } from '../../RecursoEstado/RecursoEstado';
import { puntosDeRepaso } from '../../../utils/repasoQuiz';
import { RepasoGuiado } from './RepasoGuiado';
import styles from './Station5Quiz.module.css';

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
  onOpenCreditos?: () => void;
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
  onOpenCreditos,
}: Station5Props) => {
  const safeQuestions = questions;
  const totalQuestions = safeQuestions.length;
  const minRequiredToPass = totalQuestions;

  // 🟢 Huella digital única del cuestionario de este documento
  const quizFingerprint = safeQuestions[0]?.pregunta
    ? `${safeQuestions[0].pregunta.slice(0, 30).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${totalQuestions}`
    : 'default_quiz';
  const storageQuizKey = `novamind_s5_state_${quizFingerprint}`;

  // Sincronización perezosa al cargar el cuestionario de este documento específico
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageQuizKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        onQuizChange((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {
      // fallback
    }
  }, [storageQuizKey]);

  const { currentQuestionIndex, selectedOption, isEvaluated, userAnswers, isQuizCompleted } = quizState;

  const persistState = (patch: Partial<QuizState>) => {
    try {
      const current = {
        currentQuestionIndex,
        userAnswers,
        isQuizCompleted,
        failedOptions: quizState.failedOptions ?? {},
        ...patch,
      };
      localStorage.setItem(storageQuizKey, JSON.stringify(current));
    } catch {
      // fallback
    }
  };

  const setCurrentQuestionIndex = (value: number | ((previous: number) => number)) => {
    onQuizChange((prev) => {
      const nextIdx = typeof value === 'function' ? value(prev.currentQuestionIndex) : value;
      persistState({ currentQuestionIndex: nextIdx });
      return { ...prev, currentQuestionIndex: nextIdx };
    });
  };

  const setSelectedOption = (value: number | null) =>
    onQuizChange((prev) => {
      const nextAnswers =
        value === null
          ? prev.selectedAnswers
          : { ...prev.selectedAnswers, [prev.currentQuestionIndex]: value };
      persistState({ selectedOption: value, selectedAnswers: nextAnswers });
      return {
        ...prev,
        selectedOption: value,
        selectedAnswers: nextAnswers,
      };
    });

  const setIsEvaluated = (value: boolean) =>
    onQuizChange((prev) => {
      persistState({ isEvaluated: value });
      return { ...prev, isEvaluated: value };
    });

  const setUserAnswers = (
    value: Record<number, boolean> | ((previous: Record<number, boolean>) => Record<number, boolean>)
  ) =>
    onQuizChange((prev) => {
      const nextMap = typeof value === 'function' ? value(prev.userAnswers) : value;
      persistState({ userAnswers: nextMap });
      return {
        ...prev,
        userAnswers: nextMap,
        selectedAnswers: typeof value === 'function' ? prev.selectedAnswers : {},
      };
    });

  const setIsQuizCompleted = (value: boolean) =>
    onQuizChange((prev) => {
      persistState({ isQuizCompleted: value });
      return { ...prev, isQuizCompleted: value };
    });

  const currentQ = safeQuestions[currentQuestionIndex] || safeQuestions[0];
  const fallidas = quizState.failedOptions?.[currentQuestionIndex] ?? [];

  const explicacionesFallidas = isEvaluated
    ? fallidas
        .map((idx) => ({ opcion: currentQ?.opciones[idx], texto: currentQ?.explicaciones_opciones?.[idx] }))
        .filter((e) => e.opcion && e.texto)
    : [];

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
            <span className={styles.lockedTag}>Estación 05 · Examen final</span>
            <h3 className={styles.lockedTitle}>Estación 05 Bloqueada</h3>
            <p className={styles.lockedDesc}>
              Completa al menos{' '}
              <strong style={{ color: 'var(--color-amber-300)' }}>2 estaciones previas</strong> para
              desbloquear la prueba de dominio sin alucinaciones.
            </p>
          </div>

          <div className={styles.lockedProgressBox}>
            <div className={styles.lockedProgressLabels}>
              <span style={{ color: 'var(--color-text-muted)' }}>Requisito de Desbloqueo:</span>
              <strong
                style={{
                  color: 'var(--color-amber-300)',
                  fontFamily: 'var(--font-code)',
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
            <button type="button" onClick={() => onSelectStation(0)} className={styles.lockedNavBtn}>
              Ir a Estación 1 (Resumen)
            </button>
            <button type="button" onClick={() => onSelectStation(1)} className={styles.lockedNavBtn}>
              Ir a Estación 2 (Flashcards)
            </button>
            <button type="button" onClick={() => onSelectStation(2)} className={styles.lockedNavBtn}>
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
            maxWidth: '32rem',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div>
            <span className={styles.dangerTag}>Escudos Cognitivos Agotados (0/3)</span>
          </div>

          <h3 className={styles.dangerTitle}>El error es parte del aprendizaje</h3>

          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
          >
            Cada intento es una oportunidad para fortalecer lo aprendido. En lugar de adivinar, la clave
            para dominar conceptos complejos está en dar un paso atrás y repasar a tu propio ritmo.
          </p>

          <div className={styles.dangerNotice}>
            <Compass
              size={20}
              style={{
                color: 'var(--color-amber-400)',
                flexShrink: 0,
                marginTop: '2px',
              }}
            />
            <p>
              Restauraremos tus <strong>3 escudos al 100%</strong> y recorreremos la ruta desde la{' '}
              <strong>Estación 01</strong> para fijar cada concepto clave antes de volver a intentarlo.
            </p>
          </div>
        </div>

        <RepasoGuiado puntos={puntosRepaso} revelarRespuestas={false} />

        <div>
          <button type="button" onClick={onResetCircuit} className={styles.restartCircuitBtn}>
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

    sonar('error');
    onQuizChange((prev) => {
      const nextFailed = {
        ...prev.failedOptions,
        [prev.currentQuestionIndex]: [...(prev.failedOptions?.[prev.currentQuestionIndex] ?? []), index],
      };
      persistState({ failedOptions: nextFailed });
      return {
        ...prev,
        failedOptions: nextFailed,
      };
    });
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
    try {
      localStorage.removeItem(storageQuizKey);
    } catch {
      // fallback
    }
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsEvaluated(false);
    setUserAnswers({});
    onQuizChange((prev) => ({ ...prev, failedOptions: {} }));
    setIsQuizCompleted(false);
  };

  const correctAnswersCount = Object.values(userAnswers).filter(Boolean).length;
  const userScorePercentage = Math.round((correctAnswersCount / totalQuestions) * 100);
  const isSuccess = totalQuestions > 0 && correctAnswersCount === minRequiredToPass;

  // 4. Pantalla: Resultado Final
  if (isQuizCompleted) {
    return (
      <div className={`${styles.resultCard} ${isSuccess ? styles.resultSuccess : styles.resultFailed}`}>
        <div className={`${styles.resultIconBox} ${isSuccess ? styles.resultIconSuccess : styles.resultIconFailed}`}>
          {isSuccess ? <Award size={40} /> : <AlertTriangle size={40} />}
        </div>

        <div
          style={{
            maxWidth: '28rem',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div>
            <span className={isSuccess ? styles.examApprovalPill : styles.dangerTag}>
              {isSuccess ? '¡Evaluación Final Aprobada!' : 'Evaluación No Superada'}
            </span>
          </div>

          <h3 className={styles.lockedTitle}>
            {correctAnswersCount} de {totalQuestions} Aciertos ({userScorePercentage}%)
          </h3>

          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
          >
            {isSuccess
              ? `Respondiste correctamente las ${totalQuestions} preguntas, demostrando anclaje conceptual riguroso.`
              : `Se requiere el 100 % de aciertos (${totalQuestions} de ${totalQuestions}) para superar la estación y reclamar la Medalla Master.`}
          </p>
        </div>

        {/* 🟢 TARJETA DESTACADA: SORPRESA DEL EQUIPO NUEVAMENTE */}
        {isSuccess && onOpenCreditos && (
          <div className={styles.surpriseBox}>
            <div className={styles.surpriseTag}>
              <Sparkles size={12} />
              <span>Experiencia Exclusiva</span>
            </div>
            <h4 className={styles.surpriseTitle}>El equipo NuevaMente tiene una sorpresa para ti</h4>
            <p className={styles.surpriseDesc}>
              Has demostrado dominio conceptual absoluto sin alucinaciones. Como reconocimiento a tu esfuerzo, hemos preparado una experiencia cinematográfica interactiva inspirada en la demoscene y el HUD holográfico de JARVIS.
            </p>
            <button
              type="button"
              onClick={onOpenCreditos}
              className={styles.surpriseCtaBtn}
              aria-label="Descubrir la sorpresa cinematográfica"
            >
              <Sparkles size={16} />
              <span>Descubrir la sorpresa</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        <RepasoGuiado puntos={puntosRepaso} revelarRespuestas={isSuccess} />

        <div className={styles.resultButtonsGroup}>
          <button type="button" onClick={handleRestartQuiz} className={styles.lockedNavBtn}>
            <RotateCcw size={14} style={{ marginRight: '0.25rem' }} />
            Reintentar Examen
          </button>

          {isSuccess && (
            <>
              {/* 🟢 Botón Ver Medalla Desbloqueada */}
              <button
                type="button"
                onClick={onOpenMasterBadge}
                className={styles.badgeShowcaseBtn}
              >
                <Award size={15} color="var(--color-amber-400)" />
                <span>Ver Medalla Desbloqueada</span>
              </button>

              {onOpenCreditos && (
                <button
                  type="button"
                  onClick={onOpenCreditos}
                  className={styles.badgeShowcaseBtn}
                  style={{
                    borderColor: 'rgba(56, 189, 248, 0.45)',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                  }}
                  title="Reproducir créditos cinematográficos"
                >
                  <Sparkles size={15} color="#38bdf8" />
                  <span>Descubrir sorpresa</span>
                </button>
              )}

              <button type="button" onClick={onDownloadArtifact} className={styles.downloadArtifactBtn}>
                <Download size={14} />
                Descargar Artefacto JSON
              </button>

              <button type="button" onClick={() => onSelectStation(0)} className={styles.lockedNavBtn}>
                <BookOpen size={14} style={{ marginRight: '0.25rem' }} />
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
      {/* Halo ambiental dorado/ámbar característico de la prueba final */}
      <div className={styles.lockedAmbientGlow} aria-hidden="true" />

      <div className={styles.headerContainer}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.25rem',
              flexWrap: 'wrap',
            }}
          >
            <span className={styles.examTitleTag}>
              <Award size={12} color="var(--color-amber-400)" />
              Estación 05 · Examen final
            </span>
            <span className={styles.examApprovalPill}>
              Aprobación: {minRequiredToPass}/{totalQuestions} (100 %)
            </span>
            {isSuccess && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={13} /> Dominada (+100 XP)
              </span>
            )}
          </div>
          <h3 className={styles.lockedTitle} style={{ fontSize: '1.5rem', textAlign: 'left' }}>
            Cuestionario
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isSuccess && (
            <button
              type="button"
              onClick={onOpenMasterBadge}
              className={styles.badgeShowcaseBtn}
            >
              <Award size={15} color="var(--color-amber-400)" />
              <span>Ver Medalla</span>
            </button>
          )}

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Pregunta</div>
            <div
              style={{
                fontSize: '0.875rem',
                fontFamily: 'var(--font-code)',
                fontWeight: 700,
                color: 'var(--color-amber-400)',
              }}
            >
              {currentQuestionIndex + 1} de {totalQuestions}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.questionCard}>
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-code)',
              color: 'var(--color-violet-400)',
              textTransform: 'uppercase',
              marginBottom: '0.25rem',
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
                  <span>
                    <XCircle size={20} color="var(--color-rose-400)" />
                  </span>
                ) : isEvaluated && isSelected ? (
                  <span>
                    <CheckCircle2 size={20} color="var(--color-emerald-400)" />
                  </span>
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
                <strong style={{ color: 'var(--color-violet-300)' }}>Cita textual fuente:</strong>{' '}
                {currentQ.cita_fuente} <FuenteChip fuente={currentQ.fuente} />
              </div>
            )}

            <button type="button" onClick={handleNextQuestion} className={styles.nextQuestionBtn}>
              <span>
                {currentQuestionIndex < totalQuestions - 1 ? 'Siguiente Pregunta' : 'Finalizar Examen'}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};