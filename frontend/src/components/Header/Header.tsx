import React from 'react';
import { Check, LogIn, User as UserIcon, LogOut } from 'lucide-react';
import type { AuthUser } from '../AuthModal/AuthModal';
import styles from './Header.module.css';

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  onSelectStep: (step: 1 | 2 | 3) => void;
  user?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onSelectStep,
  user = null,
  onOpenAuth,
  onLogout,
}) => {
  const steps = [
    { num: 1, id: '01', title: 'Configuración e Ingesta' },
    { num: 2, id: '02', title: 'Visualizar Resultados RAG' },
    { num: 3, id: '03', title: 'Métricas & OCI Cloud' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Columna Izquierda: Marca */}
        <div className={styles.leftCol}>
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
        </div>

        {/* Columna Central: Stepper Centrado */}
        <nav className={styles.centerCol}>
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

        {/* Columna Derecha: Auth / Perfil */}
        <div className={styles.rightCol}>
          {user ? (
            <div className={styles.userProfileWrapper}>
              <div className={styles.userAvatarCircle} title={user.email}>
                <UserIcon size={14} />
              </div>
              <div className={styles.userInfoText}>
                {/* <span className={styles.userRoleTag}>{user.name}</span> */}
                <span className={styles.userNameText}>{user.name}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className={styles.logoutGhostBtn}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className={styles.authLoginBtn}
            >
              <LogIn size={14} />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};