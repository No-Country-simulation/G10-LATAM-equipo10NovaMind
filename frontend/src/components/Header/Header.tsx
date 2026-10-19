import React, { useSyncExternalStore } from 'react';
import { Check, LogIn, User as UserIcon, LogOut, Volume2, VolumeX } from 'lucide-react';
import type { AuthUser } from '../AuthModal/AuthModal';
import { cambiarSonido, sonar, sonidoActivo, suscribirSonido } from '../../utils/sonidos';
import styles from './Header.module.css';

/** Activa o silencia los efectos de sonido; la preferencia se recuerda en este navegador. */
const BotonSonido: React.FC = () => {
  const activo = useSyncExternalStore(suscribirSonido, sonidoActivo);
  const etiqueta = activo ? 'Silenciar los efectos de sonido' : 'Activar los efectos de sonido';
  return (
    <button
      type="button"
      onClick={() => {
        cambiarSonido(!activo);
        if (!activo) sonar('acierto');
      }}
      className={styles.sonidoBtn}
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={activo}
    >
      {activo ? <Volume2 size={15} /> : <VolumeX size={15} />}
    </button>
  );
};

interface HeaderProps {
  currentStep: 1 | 2 | 3;
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
    { num: 1, title: 'Configuración e Ingesta' },
    { num: 2, title: 'Visualizar Resultados' },
    { num: 3, title: 'Métricas & OCI Cloud' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Columna Izquierda: Marca */}
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

        {/* Columna Central: Stepper Encapsulado (Progreso Sutil) */}
        <nav className={styles.centerCol} aria-label="Progreso del flujo">
          <div className={styles.stepperPill}>
            {steps.map((s, index) => {
              const isActive = currentStep === s.num;
              const isPassed = currentStep > s.num;
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
                      {isPassed ? <Check size={10} strokeWidth={3} /> : s.num}
                    </span>
                    <span className={styles.stepTitleText}>{s.title}</span>
                  </button>

                  {index < steps.length - 1 && (
                    <div className={styles.stepDivider} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </nav>

        {/* Columna Derecha: Auth / Perfil */}
        <div className={styles.rightCol}>
          <BotonSonido />
          
          {user ? (
            <div className={styles.userProfileWrapper}>
              <div className={styles.userAvatarCircle} title={user.email}>
                <UserIcon size={14} />
              </div>
              <div className={styles.userInfoText}>
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
            <div className={styles.authActionsGroup}>
              <span
                className={styles.modoInvitado}
                title="Modo invitado activo: abre muestras pregeneradas sin gastar cuota."
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
};