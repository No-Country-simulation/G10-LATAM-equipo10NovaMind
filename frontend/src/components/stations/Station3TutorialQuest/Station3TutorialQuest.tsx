import { useState } from 'react';
import { Terminal, Copy, Check, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, Award, Target, Lightbulb } from 'lucide-react';
import type { TutorialStep } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import { esComando, tituloSinPaso } from '../../../utils/pasoGuia';
import styles from './Station3TutorialQuest.module.css';

interface Station3Props {
  steps: TutorialStep[];
  /** Título del documento: la estación pregunta «¿cuál es la meta de leer "…"?» */
  tituloDocumento?: string;
  /** Objetivos de aprendizaje del paquete (tarea B1); sin ellos, la meta son los títulos de los pasos */
  objetivos?: string[] | null;
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenBuilderBadge?: () => void;
  onNextStation?: () => void;
}

/**
 * Estación 3 · Guía paso a paso. Responde «¿cuál es la meta de leer esto?»: arriba, lo que
 * lograrás (los títulos de los pasos); debajo, cada paso con qué hacer y cómo saber que lo
 * lograste. El terminal solo aparece cuando el paso trae un comando real (documentos técnicos).
 */
export const Station3TutorialQuest = ({
  steps = [],
  tituloDocumento,
  objetivos,
  isCompleted,
  onCompleteStation,
  onOpenBuilderBadge,
  onNextStation,
}: Station3Props) => {
  const [prevSteps, setPrevSteps] = useState(steps);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sincronización limpia en fase de render sin useEffect
  if (steps !== prevSteps) {
    setPrevSteps(steps);
    setActiveStepIndex(0);
    setCompletedSteps({});
    setCopiedIndex(null);
  }

  const safeSteps = steps.length > 0 ? steps : [
    {
      id: 'step-fallback',
      paso: 1,
      titulo: 'Repasar el documento',
      descripcion: 'Lee el documento con calma e identifica sus ideas principales.',
      cli_command: '',
      completado: false,
      verificacion: 'Puedes explicar con tus palabras de qué trata el documento.'
    }
  ];

  const totalSteps = safeSteps.length;
  // Aprobar exige el 100 % (decisión del usuario, 14/10; antes el 60 %)
  const minRequired = Math.max(1, totalSteps);
  const currentStep = safeSteps[activeStepIndex] || safeSteps[0];
  const stepId = currentStep.id || `step-${activeStepIndex}`;
  const clave = (currentStep.cli_command || '').trim();
  const claveEsComando = esComando(clave);

  const handleCopyCli = (text: string, index: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleValidateCheckpoint = () => {
    triggerSmallConfetti();
    const newCompleted = { ...completedSteps, [stepId]: true };
    setCompletedSteps(newCompleted);

    const count = Object.values(newCompleted).filter(Boolean).length;
    if (count >= minRequired) {
      if (!isCompleted) {
        onCompleteStation(75);
      }
      triggerLevelUpConfetti();
      if (onOpenBuilderBadge) {
        onOpenBuilderBadge();
      }
    }

    if (activeStepIndex < safeSteps.length - 1) {
      setActiveStepIndex((prev) => prev + 1);
    }
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const isCurrentStepCompleted = !!completedSteps[stepId];
  const isPassed = completedCount >= minRequired;
  const metas = (objetivos ?? []).map((o) => o.trim()).filter(Boolean);
  const titulo = tituloDocumento?.trim();

  return (
    <div className={styles.stationWrapper}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <Target size={12} color="var(--color-emerald-400)" />
              Estación 03 · Guía paso a paso
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Aprobada (+75 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>
            ¿Cuál es la meta de leer {titulo ? `«${titulo}»` : 'esto'}?
          </h3>
          <p className={styles.stationSubtitle}>
            Sigue los pasos en orden y marca cada uno cuando lo logres.
          </p>
        </div>

        <div className={styles.headerActions}>
          {isPassed && onOpenBuilderBadge && (
            <button
              type="button"
              onClick={onOpenBuilderBadge}
              className={styles.badgeShowcaseBtn}
            >
              <Award size={16} color="var(--color-amber-400)" />
              <span>Ver Medalla</span>
            </button>
          )}

          <div className={styles.progressStats}>
            <div className={styles.progressLabel}>Pasos logrados</div>
            <div className={`${styles.progressRatio} ${isPassed ? styles.progressRatioPassed : ''}`}>
              {completedCount} / {totalSteps}
            </div>
          </div>
        </div>
      </div>

      {/* Meta: lo que podrás hacer al terminar */}
      <section className={styles.metaBox} aria-label="Meta de la guía">
        <span className={styles.metaEtiqueta}>
          <Target size={14} /> Al terminar esta guía podrás
        </span>
        <ol className={styles.metaLista}>
          {metas.length > 0 ? metas.map((meta, idx) => (
            <li key={meta} className={`${styles.metaItem} ${isPassed ? styles.metaItemHecho : ''}`}>
              <span className={styles.metaNumero}>{isPassed ? '✓' : idx + 1}</span>
              <span>{meta}</span>
            </li>
          )) : safeSteps.map((st, idx) => {
            const hecho = !!completedSteps[st.id || `step-${idx}`];
            return (
              <li key={st.id || `meta-${idx}`} className={`${styles.metaItem} ${hecho ? styles.metaItemHecho : ''}`}>
                <span className={styles.metaNumero}>{hecho ? '✓' : idx + 1}</span>
                <span>{tituloSinPaso(st.titulo)}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Navegación Secuencial de Pasos */}
      <div className={styles.stepsNavbar}>
        {safeSteps.map((st, idx) => {
          const currentId = st.id || `step-${idx}`;
          const isCurrent = activeStepIndex === idx;
          const isDone = !!completedSteps[currentId];

          return (
            <button
              key={currentId}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`${styles.stepNavBtn} ${
                isCurrent
                  ? styles.stepNavBtnActive
                  : isDone
                  ? styles.stepNavBtnDone
                  : ''
              }`}
            >
              <div className={styles.stepNavInfo}>
                <span className={styles.stepNavNumber}>Paso 0{idx + 1}</span>
                <span className={styles.stepNavTitle}>{tituloSinPaso(st.titulo)}</span>
              </div>

              <div>
                {isDone ? (
                  <CheckCircle2 size={18} color="var(--color-emerald-400)" />
                ) : (
                  <div
                    className={`${styles.stepNavIndexCircle} ${
                      isCurrent ? styles.stepNavIndexCircleActive : ''
                    }`}
                  >
                    {idx + 1}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Paso activo */}
      <div className={styles.workspaceCard}>
        <div className={styles.workspaceHeader}>
          <div>
            <div className={styles.stepExecutionTag}>
              Paso {activeStepIndex + 1} de {totalSteps}
            </div>
            <h4 className={styles.stepActiveTitle}>
              {tituloSinPaso(currentStep.titulo)}
            </h4>
          </div>
        </div>

        {currentStep.descripcion && (
          <div>
            <div className={styles.bloqueEtiqueta}>Qué vas a hacer</div>
            <p className={styles.queHaras}>{currentStep.descripcion}</p>
          </div>
        )}

        {clave && (claveEsComando ? (
          <div className={styles.terminalBox}>
            <div className={styles.terminalBar}>
              <div className={styles.terminalControls}>
                <div className={styles.dotRed} />
                <div className={styles.dotYellow} />
                <div className={styles.dotGreen} />
                <span className={styles.terminalTitle}>
                  <Terminal size={12} /> Comando de este paso
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopyCli(clave, activeStepIndex)}
                className={styles.copyButton}
              >
                {copiedIndex === activeStepIndex ? (
                  <>
                    <Check size={14} color="var(--color-emerald-400)" />
                    <span style={{ color: 'var(--color-emerald-300)' }}>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className={styles.terminalContent}>
              <div className={styles.terminalLine}>
                <span className={styles.terminalPrompt}>$</span>
                <pre className={styles.terminalCommand}>{clave}</pre>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.claveBox}>
            <Lightbulb size={18} className={styles.claveIcono} />
            <div>
              <div className={styles.bloqueEtiqueta}>Clave del paso</div>
              <p className={styles.claveTexto}>{clave}</p>
            </div>
          </div>
        ))}

        {/* Cómo saber que lo lograste y CTA */}
        <div className={styles.verificationBar}>
          <div className={styles.verificationInfo}>
            <ShieldCheck size={20} className={styles.verificationIcon} />
            <div>
              <div className={styles.verificationLabel}>
                ¿Cómo sé que lo logré?
              </div>
              <p className={styles.verificationText}>
                {currentStep.verificacion}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleValidateCheckpoint}
            className={`${styles.validateButton} ${
              isCurrentStepCompleted ? styles.btnValidated : styles.btnValidating
            }`}
          >
            {isCurrentStepCompleted ? (
              <>
                <CheckCircle2 size={16} color="#fff" />
                <span>Paso {activeStepIndex + 1} logrado ✓</span>
              </>
            ) : (
              <>
                <Sparkles size={16} color="#a7f3d0" />
                <span>Lo logré</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
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
            <span>Siguiente Estación: Contenido Audiovisual</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
