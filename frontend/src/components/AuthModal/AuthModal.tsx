import { useState } from 'react';
import { requireSupabase, authUser } from '../../services/supabase';
import styles from './AuthModal.module.css';

export interface AuthUser {
  id: string; name: string; email: string; avatarUrl?: string; provider: 'local' | 'google';
}
interface Props { isOpen: boolean; onClose: () => void; onLoginSuccess: (user: AuthUser) => void }

export function AuthModal({ isOpen, onClose, onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!isOpen) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return <div className={styles.overlay}>
    <section className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Acceso a NuevaMente">
      <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar modal">×</button>
      <h2 className={styles.title}>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
      <button disabled={busy} className={styles.googleButton} onClick={() => void run(async () => {
        const { error } = await requireSupabase().auth.signInWithOAuth({ provider: 'google',
          options: { redirectTo: window.location.origin + '/auth/callback' } });
        if (error) throw error;
      })}>Continuar con Google</button>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); void run(async () => {
        const client = requireSupabase();
        const result = register ? await client.auth.signUp({ email, password,
          options: { emailRedirectTo: window.location.origin + '/auth/callback' } })
          : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.session && result.data.user) {
          onLoginSuccess(authUser(result.data.user)); setPassword(''); onClose();
        } else setMessage('Revisa tu correo para confirmar la cuenta antes de ingresar.');
      }); }}>
        <label className={styles.label}>Correo electrónico
          <input className={styles.input} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className={styles.label}>Contraseña
          <input className={styles.input} type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className={styles.submitBtn} disabled={busy}>{register ? 'Crear cuenta' : 'Ingresar'}</button>
      </form>
      <p role="status">{message}</p>
      <button disabled={busy} className={styles.linkButton} onClick={() => { setRegister(!register); setMessage(''); }}>
        {register ? 'Ya tengo una cuenta' : 'Crear cuenta con correo'}
      </button>
    </section>
  </div>;
}
