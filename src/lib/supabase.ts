import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client — browser code uses ONLY the publishable key.
 *
 * Env (see .env.example, never commit real values):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY   (preferred, new-style key)
 *   VITE_SUPABASE_ANON_KEY          (legacy fallback, also publishable)
 *
 * The service-role / secret key must NEVER appear here, in any .env file
 * shipped with the app, or in any client bundle. Privileged operations
 * (deleting an auth user, bypassing RLS) require a server-side component
 * with the service-role key — see supabase/README.md.
 *
 * When the env vars are absent, `supabase` is null and the app runs in
 * guest/local mode (IndexedDB only). Nothing is simulated: no fake
 * session, no fake cloud history. The Account screen explains exactly
 * what is missing.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,      // session survives reloads (localStorage)
        autoRefreshToken: true,    // refresh before expiry
        detectSessionInUrl: true,  // email-verification / recovery links
      },
    })
  : null;

/** Human-readable auth errors: Supabase messages are usually fine, but
 *  expired-link and unconfirmed-email cases get a clear next step. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('expired') || m.includes('invalid') && m.includes('link')) return 'That link has expired or was already used. Request a new one below.';
  if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'Your email is not confirmed yet. Check your inbox for the verification email, then try again.';
  if (m.includes('invalid login credentials')) return 'That email/password combination was not recognised. Check both, or use “Forgot password?”.';
  if (m.includes('user already registered') || m.includes('already registered')) return 'An account with this email already exists. Try signing in instead.';
  if (m.includes('password')) return message; // keep Supabase's password rules verbatim
  return message;
}
