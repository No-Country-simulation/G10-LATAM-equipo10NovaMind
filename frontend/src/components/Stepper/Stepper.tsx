import React from 'react';
import { Check } from 'lucide-react';
import styles from './Stepper.module.css';

interface StepperProps {
  steps: string[];
  currentStep: number;
  onSelectStep: (stepIndex: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onSelectStep,
}) => {
  return (
    <nav className={styles.stepperContainer} aria-label="Progreso del flujo">
      {steps.map((step, index) => {
        const isComplete = currentStep > index;
        const isActive = currentStep === index;

        return (
          <div key={step} className={styles.stepWrapper}>
            <button
              type="button"
              className={`${styles.stepButton} ${isActive ? styles.active : ''} ${
                isComplete ? styles.complete : ''
              }`}
              onClick={() => onSelectStep(index)}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={styles.stepNumber}>
                {isComplete ? <Check size={13} /> : index + 1}
              </span>
              <span>{step}</span>
            </button>

            {index < steps.length - 1 && (
              <span
                className={`${styles.stepLine} ${isComplete ? styles.filled : ''}`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
};