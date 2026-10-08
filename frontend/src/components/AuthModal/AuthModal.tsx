import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import styles from './AuthModal.module.css';

export type AuthView = 'login' | 'register' | 'forgot_password' | 'reset_password';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'local' | 'google';
}

interface AuthModalProps {
  isOpen: boolean;
  initialView?: AuthView;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

const GENERIC_USER: AuthUser = {
  id: 'usr-alumn-01',
  name: 'Estudiante ONE Demo',
  email: 'estudiante.demo@oracle-alura.edu',
  avatarUrl: '/Isotipo.svg',
  provider: 'local',
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialView = 'login',
  onClose,
  onLoginSuccess,
}) => {
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState('estudiante.demo@oracle-alura.edu');
  const [password, setPassword] = useState('••••••••');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  // Estados para visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sincronización en fase de render
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setView(initialView);
      setRecoverySent(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }

  // Cierre con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (view === 'forgot_password') {
      setRecoverySent(true);
      return;
    }

    if (view === 'reset_password') {
      setView('login');
      return;
    }

    onLoginSuccess({
      ...GENERIC_USER,
      name: name.trim() || GENERIC_USER.name,
      email: email.trim() || GENERIC_USER.email,
    });
    onClose();
  };

  const handleGoogleAuth = () => {
    onLoginSuccess({
      ...GENERIC_USER,
      name: 'Usuario Google Demo',
      provider: 'google',
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Cerrar modal">
          <X size={18} />
        </button>

        <div className={styles.header}>
          <img src="/Isotipo.svg" alt="NuevaMente Isotipo" className={styles.brandLogo} />
          <h3 className={styles.title}>
            {view === 'login' && 'Iniciar Sesión'}
            {view === 'register' && 'Crear Cuenta'}
            {view === 'forgot_password' && 'Recuperar Contraseña'}
            {view === 'reset_password' && 'Restablecer Contraseña'}
          </h3>
          <p className={styles.subtitle}>
            {view === 'login' && 'Accede a tus rutas pedagógicas personalizadas y almacenamiento OCI.'}
            {view === 'register' && 'Únete a la plataforma adaptativa de aprendizaje Always Free.'}
            {view === 'forgot_password' && 'Ingresa tu correo para recibir las instrucciones de acceso.'}
            {view === 'reset_password' && 'Ingresa tu nueva clave para actualizar tu acceso seguro.'}
          </p>
        </div>

        {(view === 'login' || view === 'register') && (
          <>
            <button type="button" onClick={handleGoogleAuth} className={styles.googleButton}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.26 5.42l4.02-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            <div className={styles.divider}>
              <span>o con correo</span>
            </div>
          </>
        )}

        {view === 'forgot_password' && recoverySent ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={40} color="var(--color-emerald-400)" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Te enviamos las instrucciones a <strong>{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setView('reset_password')}
              className={styles.submitBtn}
            >
              Simular enlace de restablecimiento
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {view === 'register' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nombre Completo</label>
                <div className={styles.inputWrapper}>
                  <User size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Martín González"
                    className={styles.input}
                  />
                </div>
              </div>
            )}

            {view !== 'reset_password' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Correo Electrónico</label>
                <div className={styles.inputWrapper}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@dominio.com"
                    className={styles.input}
                  />
                </div>
              </div>
            )}

            {view !== 'forgot_password' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  {view === 'reset_password' ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                <div className={styles.inputWrapper}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputWithToggle}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.toggleVisibilityBtn}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {view === 'reset_password' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Confirmar Nueva Contraseña</label>
                <div className={styles.inputWrapper}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputWithToggle}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={styles.toggleVisibilityBtn}
                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {view === 'login' && (
              <div className={styles.helperRow}>
                <button
                  type="button"
                  onClick={() => setView('forgot_password')}
                  className={styles.linkButton}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button type="submit" className={styles.submitBtn}>
              {view === 'login' && 'Ingresar a la Plataforma'}
              {view === 'register' && 'Crear Cuenta'}
              {view === 'forgot_password' && 'Enviar Correo de Recuperación'}
              {view === 'reset_password' && 'Actualizar Contraseña'}
            </button>
          </form>
        )}

        <div className={styles.mockBadge}>
          <strong>Sesión de Demostración:</strong> El acceso autentica automáticamente con el usuario genérico en memoria compatible con OCI Object Storage.
        </div>

        <div className={styles.footerSwitcher}>
          {view === 'login' && (
            <span>
              ¿No tienes una cuenta?{' '}
              <button type="button" onClick={() => setView('register')} className={styles.linkButton}>
                Regístrate aquí
              </button>
            </span>
          )}
          {view === 'register' && (
            <span>
              ¿Ya estás registrado?{' '}
              <button type="button" onClick={() => setView('login')} className={styles.linkButton}>
                Inicia sesión
              </button>
            </span>
          )}
          {(view === 'forgot_password' || view === 'reset_password') && (
            <button type="button" onClick={() => setView('login')} className={styles.linkButton}>
              ← Volver al inicio de sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};