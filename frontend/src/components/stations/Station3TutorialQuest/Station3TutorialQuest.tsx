import { useState } from 'react';
import { Terminal, Copy, Check, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, Award } from 'lucide-react';
import type { TutorialStep } from '../../../types/types';
// import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import styles from './Station3TutorialQuest.module.css';

interface Station3Props {
  steps: TutorialStep[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenBuilderBadge?: () => void;
}

export const Station3TutorialQuest = ({
  steps = [],
  isCompleted,
  onCompleteStation,
  onOpenBuilderBadge,
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
      titulo: 'Inicialización de Práctica',
      descripcion: 'Sigue las instrucciones del paso para completar la validación pedagógica.',
      cli_command: 'echo "Laboratorio de aplicación didáctica listo"',
      completado: false,
      verificacion: 'Verifica la comprensión práctica del concepto abordado.'
    }
  ];

  const totalSteps = safeSteps.length;
  const minRequired = Math.max(1, Math.ceil(totalSteps * 0.6));
  const currentStep = safeSteps[activeStepIndex] || safeSteps[0];
  const stepId = currentStep.id || `step-${activeStepIndex}`;

  const handleCopyCli = (text: string, index: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleValidateCheckpoint = () => {
    // triggerSmallConfetti();
    const newCompleted = { ...completedSteps, [stepId]: true };
    setCompletedSteps(newCompleted);

    const count = Object.values(newCompleted).filter(Boolean).length;
    if (count >= minRequired) {
      if (!isCompleted) {
        onCompleteStation(75);
      }
    //   triggerLevelUpConfetti();
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

  return (
    <div className={styles.stationWrapper}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <Terminal size={12} color="var(--color-emerald-400)" />
              Estación 03 · Laboratorio Práctico Paso a Paso
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Aprobada (+75 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>
            Laboratorio de Ejecución Técnica
          </h3>
          <p className={styles.stationSubtitle}>
            Valida los checkpoints prácticos. Umbral de aprobación: al menos {minRequired} de {totalSteps} pasos completados.
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
            <div className={styles.progressLabel}>Validados (Mín: {minRequired})</div>
            <div className={`${styles.progressRatio} ${isPassed ? styles.progressRatioPassed : ''}`}>
              {completedCount} / {totalSteps}
            </div>
          </div>
        </div>
      </div>

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
                <span className={styles.stepNavTitle}>{st.titulo}</span>
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

      {/* Espacio de Ejecución del Paso Activo */}
      <div className={styles.workspaceCard}>
        <div className={styles.workspaceHeader}>
          <div>
            <div className={styles.stepExecutionTag}>
              Ejecución Paso 0{activeStepIndex + 1}
            </div>
            <h4 className={styles.stepActiveTitle}>
              {currentStep.titulo}
            </h4>
          </div>
          <span className={styles.stepActiveDescription}>
            {currentStep.descripcion}
          </span>
        </div>

        {/* Caja de Terminal Interactiva */}
        <div className={styles.terminalBox}>
          <div className={styles.terminalBar}>
            <div className={styles.terminalControls}>
              <div className={styles.dotRed} />
              <div className={styles.dotYellow} />
              <div className={styles.dotGreen} />
              <span className={styles.terminalTitle}>
                sandbox-terminal · interactive shell
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleCopyCli(currentStep.cli_command, activeStepIndex)}
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
                  <span>Copiar Sintaxis</span>
                </>
              )}
            </button>
          </div>

          <div className={styles.terminalContent}>
            <div className={styles.terminalComment}>
              # Comando para validación práctica:
            </div>
            <div className={styles.terminalLine}>
              <span className={styles.terminalPrompt}>$</span>
              <pre className={styles.terminalCommand}>
                {currentStep.cli_command || 'echo "Validación de comando lista"'}
              </pre>
            </div>
          </div>
        </div>

        {/* Condición de Verificación y CTA */}
        <div className={styles.verificationBar}>
          <div className={styles.verificationInfo}>
            <ShieldCheck size={20} className={styles.verificationIcon} />
            <div>
              <div className={styles.verificationLabel}>
                Condición de Verificación
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
                <span>Paso 0{activeStepIndex + 1} Validado ✓</span>
              </>
            ) : (
              <>
                <Sparkles size={16} color="#a7f3d0" />
                <span>Validar Checkpoint</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};