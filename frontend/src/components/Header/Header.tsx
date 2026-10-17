import React from 'react';
import { Check, LogIn, User as UserIcon, LogOut } from 'lucide-react';
import type { AuthUser } from '../AuthModal/AuthModal';
import styles from './Header.module.css';

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  /** Hay un paquete cargado: sin él, los pasos 2 y 3 no se pueden abrir */
  pasosAbiertos: boolean;
  onSelectStep: (step: 1 | 2 | 3) => void;
  user?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  pasosAbiertos,
  onSelectStep,
  user = null,
  onOpenAuth,
  onLogout,
}) => {
  const steps = [
    { num: 1, id: '01', title: 'Configuración e Ingesta' },
    { num: 2, id: '02', title: 'Visualizar Resultados' },
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
              <img src="/Isotipo.svg" alt="" className={styles.brandLetter} />
            </div>
            <div className={styles.brandInfo}>
              <span className={styles.brandTitle}>
                <span className={styles.brandLight}>Nueva</span>
                <span className={styles.brandBold}>Mente</span>
              </span>
              <span className={styles.brandTagline}>IA & OCI EdTech</span>
            </div>
          </button>
        </div>

        {/* Columna Central: Stepper Centrado */}
        <nav className={styles.centerCol}>
          {steps.map((s, index) => {
            const isActive = currentStep === s.num;
            const isPassed = currentStep > s.num;
            // Para avanzar hay que cargar un documento o abrir una muestra en el paso 1
            const bloqueado = s.num > 1 && !pasosAbiertos;

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
                  disabled={bloqueado}
                  title={bloqueado ? 'Carga un documento o abre una muestra en el paso 1 para continuar' : undefined}
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
          ) : (<>
            <span
              className={styles.modoInvitado}
              title="Sin sesión: se abren las muestras pregeneradas, sin gastar cuota. Para generar con tus documentos y guardar en OCI, ingresa."
            >
              Modo invitado
            </span>
            <button
              type="button"
              onClick={onOpenAuth}
              className={styles.authLoginBtn}
            >
              <LogIn size={14} />
              <span>Ingresar</span>
            </button>
          </>)}
        </div>
      </div>
    </header>
  );
};