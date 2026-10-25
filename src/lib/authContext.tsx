import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session as SupabaseSession, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, friendlyAuthError } from './supabase';

export interface AuthState {
  configured: boolean;
  loading: boolean;       // initial session restore in progress
  busy: boolean;          // a sign-in/sign-up/etc. call in progress
  error: string;
  notice: string;
  user: User | null;
  session: SupabaseSession | null;
  /** True when the current URL looks like an expired/invalid auth link. */
  linkExpired: boolean;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  clearMessage: () => void;
}

const Ctx = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/**
 * Auth provider (Supabase Auth, official JS client).
 * - Persistent sessions: supabase-js stores the session and refreshes it.
 * - Email verification: sign-up sends a verification email when the
 *   project has "Confirm email" enabled; the app then shows a
 *   "check your inbox" notice instead of pretending sign-in worked.
 * - Password reset: reset email links back to this app's origin; the
 *   recovery session is detected from the URL and the Account screen
 *   offers a new-password form.
 * - Google sign-in: only attempted when the project has the Google
 *   provider enabled; otherwise Supabase returns an error, shown as-is.
 * - Expired session: onAuthStateChange fires TOKEN_REFRESHED / SIGNED_OUT;
 *   an expired refresh token signs the user out and the UI shows a
 *   "session expired, please sign in again" state via `linkExpired` /
 *   error handling in the Account screen.
 * Route protection is a UX layer only: the database enforces ownership
 * with RLS (see supabase/migrations), so a client-side bypass cannot
 * read another user's rows.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    // Detect an expired/invalid link from the URL hash (Supabase puts
    // error=access_denied&error_description=... there on failure).
    const hash = window.location.hash;
    if (hash.includes('error=access_denied') || hash.includes('error_code=otp_expired')) {
      setLinkExpired(true);
      setError('That sign-in link has expired. Request a new one below.');
    }
    supabase.auth.getSession().then(({ data, error: e }) => {
      if (e) setError(friendlyAuthError(e.message));
      setSession(data.session); setUser(data.session?.user ?? null); setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s); setUser(s?.user ?? null);
      if (event === 'SIGNED_OUT') { setNotice('Signed out. Your cloud history is cleared from this browser; local device history remains on this device.'); }
      if (event === 'TOKEN_REFRESHED') setNotice('');
      if (event === 'PASSWORD_RECOVERY') setNotice('Password recovery link accepted — set a new password below.');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const clearMessage = () => { setError(''); setNotice(''); setLinkExpired(false); };

  async function signUp(email: string, password: string): Promise<boolean> {
    if (!supabase) { setError('Supabase is not configured yet. See supabase/README.md for setup.'); return false; }
    setBusy(true); setError(''); setNotice('');
    const { data, error: e } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return false; }
    if (!data.session) {
      // Email confirmation required — no session yet, by design.
      setNotice('Account created. Check your email for the verification link, then sign in. The link returns to this app.');
      return true;
    }
    setNotice('Account created and signed in.');
    return true;
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    if (!supabase) { setError('Supabase is not configured yet.'); return false; }
    setBusy(true); setError(''); setNotice('');
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return false; }
    return true;
  }

  async function signInWithGoogle(): Promise<void> {
    if (!supabase) { setError('Supabase is not configured yet.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    setBusy(false);
    if (e) setError(friendlyAuthError(e.message) + ' (Google sign-in requires the Google provider to be enabled in Supabase Authentication settings.)');
  }

  async function signOut(): Promise<void> {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setSession(null); setUser(null);
  }

  async function sendPasswordReset(email: string): Promise<boolean> {
    if (!supabase) { setError('Supabase is not configured yet.'); return false; }
    setBusy(true); setError(''); setNotice('');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return false; }
    setNotice('Password reset email sent — check your inbox. The link returns to this app.');
    return true;
  }

  async function updatePassword(password: string): Promise<boolean> {
    if (!supabase) { setError('Supabase is not configured yet.'); return false; }
    setBusy(true); setError(''); setNotice('');
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return false; }
    setNotice('Password updated. You are signed in.');
    return true;
  }

  const value: AuthState = {
    configured: isSupabaseConfigured, loading, busy, error, notice, user, session, linkExpired,
    signUp, signIn, signInWithGoogle, signOut, sendPasswordReset, updatePassword, clearMessage,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
