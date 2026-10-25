import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';

/**
 * Sign-in / sign-up / password-reset screen.
 * Public informational pages stay accessible without an account; this
 * screen is only required for the Account view and for cloud saving.
 * Guest scanning is preserved: a guest can scan and view a report, and
 * is invited here only when they choose to save results across devices.
 */
export default function AuthView() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'newpassword'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  if (!auth.configured) {
    return (
      <div>
        <h1>Account</h1>
        <section className="card">
          <h2>Cloud accounts are not configured yet</h2>
          <p>OptiFlow is currently running in guest/local mode: scans and history are saved on this device only (IndexedDB), and nothing is uploaded.</p>
          <p className="small">To enable accounts, the project owner creates a Supabase project, applies the migrations in <code>supabase/migrations/</code>, and sets <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see <code>supabase/README.md</code> and <code>.env.example</code>). No secret or service-role key is ever used in browser code.</p>
          <p className="small muted">You can still scan, view reports, and use every camera/ML/rPPG feature without an account.</p>
        </section>
      </div>
    );
  }
  if (auth.loading) return <section className="card"><p role="status">Checking your session…</p></section>;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setDone(false);
    if (mode === 'signin') { if (await auth.signIn(email, password)) setDone(true); }
    else if (mode === 'signup') { if (await auth.signUp(email, password)) setDone(true); }
    else if (mode === 'forgot') { if (await auth.sendPasswordReset(email)) setDone(true); }
    else if (mode === 'newpassword') { if (await auth.updatePassword(password)) setDone(true); }
  }

  return (
    <div>
      <h1>Account</h1>
      <section className="card">
        <h2>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create an account' : mode === 'forgot' ? 'Reset your password' : 'Set a new password'}</h2>
        <p className="small muted">Signing in lets you save check-ins to your private cloud history and open them on another device. Camera frames are still processed on-device; only summaries are saved by default (see Account settings for pulse-trace and replay choices).</p>
        {auth.notice && <p role="status" className="notice">{auth.notice}</p>}
        {auth.error && <p role="alert" className="warn">{auth.error}</p>}
        {auth.linkExpired && <p className="small">Expired links cannot be reused — request a fresh sign-in or reset link below.</p>}
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          {mode !== 'newpassword' && (
            <div><label htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          )}
          {mode !== 'forgot' && (
            <div><label htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
              <p className="small muted">At least 6 characters (Supabase default minimum; your project's policy may require more).</p></div>
          )}
          <button className="btn" type="submit" disabled={auth.busy}>
            {auth.busy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : 'Update password'}
          </button>
        </form>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="btn secondary small" onClick={() => auth.signInWithGoogle()} disabled={auth.busy}>Continue with Google</button>
          {mode !== 'signin' && <button className="btn secondary small" onClick={() => { setMode('signin'); auth.clearMessage(); }}>Back to sign in</button>}
          {mode !== 'signup' && <button className="btn secondary small" onClick={() => { setMode('signup'); auth.clearMessage(); }}>Create an account</button>}
          {mode !== 'forgot' && <button className="btn secondary small" onClick={() => { setMode('forgot'); auth.clearMessage(); }}>Forgot password?</button>}
          <button className="btn secondary small" onClick={() => { setMode('newpassword'); auth.clearMessage(); }}>I have a recovery link — set a new password</button>
        </div>
        {done && <p role="status" className="small">Done — see the message above for the next step.</p>}
        <p className="small muted">Guest? You can scan without signing in. Your guest results stay on this device unless you sign in and choose to import them — they are never silently assigned to an account.</p>
      </section>
    </div>
  );
}
