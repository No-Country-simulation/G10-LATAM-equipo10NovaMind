import React from 'react';
import { Check } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  onSelectStep: (step: 1 | 2 | 3) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onSelectStep,
}) => {
  const steps = [
    { num: 1, id: '01', title: 'Configuración e Ingesta' },
    { num: 2, id: '02', title: 'Visualizar Resultados RAG' },
    { num: 3, id: '03', title: 'Métricas & OCI Cloud' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Marca */}
        <button
          type="button"
          onClick={() => onSelectStep(1)}
          className={styles.brand}
        >
          <div className={styles.brandIcon}>
            <img src="/Isotipo.svg" alt="Logo" className={styles.brandLetter} />
          </div>
          <div className={styles.brandInfo}>
            <span className={styles.brandTitle}>
  <span className={styles.brandLight}>Nueva</span>
  <span className={styles.brandBold}>Mente</span>
</span>
            <span className={styles.brandTagline}>RAG & OCI EdTech</span>
          </div>
        </button>

        {/* Stepper de 3 Pasos */}
        <nav className={styles.nav}>
          {steps.map((s, index) => {
            const isActive = currentStep === s.num;
            const isPassed = currentStep > s.num;

            let buttonClass = styles.stepButton;
            if (isActive) buttonClass += ` ${styles.stepButtonActive}`;
            else if (isPassed) buttonClass += ` ${styles.stepButtonPassed}`;

            let badgeClass = styles.stepBadge;
            if (isActive) badgeClass += ` ${styles.stepBadgeActive}`;
            else if (isPassed) badgeClass += ` ${styles.stepBadgePassed}`;

            return (
              <React.Fragment key={s.num}>
                <button
                  type="button"
                  onClick={() => onSelectStep(s.num as 1 | 2 | 3)}
                  className={buttonClass}
                >
                  <span className={badgeClass}>
                    {isPassed ? <Check size={10} strokeWidth={3.5} /> : s.num}
                  </span>
                  <span>{s.title}</span>
                </button>

                {index < steps.length - 1 && (
                  <div className={styles.stepDivider} />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </header>
  );
};