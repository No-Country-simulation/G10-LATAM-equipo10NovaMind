import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '../components/AuthModal/AuthModal';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function requireSupabase() {
  if (!supabase) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env.local.');
  return supabase;
}
export function authUser(user: User): AuthUser {
  return { id: user.id, email: user.email || '',
    name: user.user_metadata.full_name || user.user_metadata.name || user.email || 'Estudiante',
    avatarUrl: user.user_metadata.avatar_url,
    provider: user.app_metadata.provider === 'google' ? 'google' : 'local' };
}
export async function bearerHeaders() {
  if (!supabase) {
    return { Authorization: 'Bearer guest-demo-token' };
  }
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    return { Authorization: 'Bearer guest-demo-token' };
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}
