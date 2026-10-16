import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, X } from 'lucide-react';
import { requireSupabase, authUser } from '../../services/supabase';
import styles from './AuthModal.module.css';

export interface AuthUser {
  id: string; name: string; email: string; avatarUrl?: string; provider: 'local' | 'google';
}
interface Props { isOpen: boolean; onClose: () => void; onLoginSuccess: (user: AuthUser) => void }

// Diseño portado de origin/feature/newmind-edtech-oci (9142429) sobre la autenticación real de Supabase:
// sin usuario genérico simulado ni "Olvidé mi contraseña" (descartado por el equipo el 14/10).
export function AuthModal({ isOpen, onClose, onLoginSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const cambiarVista = () => { setRegister(!register); setMessage(''); setVerPassword(false); };

  return <div className={styles.overlay} onClick={onClose}>
    <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="auth-titulo"
      onClick={e => e.stopPropagation()}>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
        <X size={18} />
      </button>

      <div className={styles.header}>
        <img src="/Isotipo.svg" alt="" className={styles.brandLogo} />
        <h2 id="auth-titulo" className={styles.title}>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        <p className={styles.subtitle}>
          {register
            ? 'Crea tu cuenta de NuevaMente para guardar tus paquetes y tu progreso.'
            : 'Accede a tus paquetes guardados y retoma tu progreso en NuevaMente.'}
        </p>
      </div>

      <button type="button" disabled={busy} className={styles.googleButton} onClick={() => void run(async () => {
        const { error } = await requireSupabase().auth.signInWithOAuth({ provider: 'google',
          options: { redirectTo: window.location.origin + '/auth/callback' } });
        if (error) throw error;
      })}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24Z" />
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.26 5.42l4.02-3.15Z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
        </svg>
        <span>Continuar con Google</span>
      </button>

      <div className={styles.divider}><span>o con correo</span></div>

      <form className={styles.form} onSubmit={e => { e.preventDefault(); void run(async () => {
        const client = requireSupabase();
        const result = register ? await client.auth.signUp({ email, password,
          options: {
            emailRedirectTo: window.location.origin + '/auth/callback',
            // authUser() muestra full_name como nombre de la cuenta
            data: name.trim() ? { full_name: name.trim() } : undefined,
          } })
          : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.session && result.data.user) {
          onLoginSuccess(authUser(result.data.user)); setPassword(''); setVerPassword(false); onClose();
        } else setMessage('Revisa tu correo para confirmar la cuenta antes de ingresar.');
      }); }}>
        {register && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="auth-nombre">Nombre</label>
            <div className={styles.inputWrapper}>
              <User size={16} className={styles.inputIcon} aria-hidden />
              <input id="auth-nombre" className={styles.input} type="text" autoComplete="name"
                placeholder="Ej. Martín González" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
        )}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="auth-correo">Correo electrónico</label>
          <div className={styles.inputWrapper}>
            <Mail size={16} className={styles.inputIcon} aria-hidden />
            <input id="auth-correo" className={styles.input} type="email" autoComplete="email" required
              placeholder="usuario@dominio.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="auth-clave">Contraseña</label>
          <div className={styles.inputWrapper}>
            <Lock size={16} className={styles.inputIcon} aria-hidden />
            <input id="auth-clave" className={`${styles.input} ${styles.inputWithToggle}`}
              type={verPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'}
              required minLength={8} placeholder={register ? 'Mínimo 8 caracteres' : '••••••••'}
              value={password} onChange={e => setPassword(e.target.value)} />
            <button
              type="button"
              className={styles.toggleVisibilityBtn}
              onClick={() => setVerPassword(v => !v)}
              aria-label={verPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              aria-pressed={verPassword}
              title={verPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            >
              {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? 'Un momento…' : register ? 'Crear cuenta' : 'Ingresar a la plataforma'}
        </button>
      </form>
      {message && <p className={styles.mensaje} role="status">{message}</p>}

      <div className={styles.footerSwitcher}>
        {register ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? '}
        <button type="button" disabled={busy} className={styles.linkButton} onClick={cambiarVista}>
          {register ? 'Inicia sesión' : 'Regístrate aquí'}
        </button>
      </div>
    </section>
  </div>;
}
