import React, { useState } from 'react';
import type { Session, UserPreferences } from '../types';
import { useAuth } from '../lib/authContext';
import AuthView from '../components/AuthView';
import { store, exportAll, download } from '../lib/storage';
import { fetchCloudSessions, saveCloudSession, deleteCloudSession, deleteAllCloudData, savePreferences, loadPreferences, importCandidates, DEFAULT_PREFERENCES } from '../lib/cloud';
import { supabase } from '../lib/supabase';

/**
 * Account & settings (protected: requires sign-in; guests see AuthView).
 * - Display name + preferences (cloud save, pulse waveform, replay storage).
 * - Cloud export (from the signed-in user's cloud rows, via the app's
 *   own export + cloud sessions), individual session deletion, and
 *   full data deletion with explicit confirmation.
 * - Local import: offered, never automatic, with a count preview and
 *   duplicate prevention (see cloud.importCandidates).
 *
 * ACCOUNT DELETION HONESTY: deleting stored data here removes every
 * row and replay object owned by the user and signs them out. Removing
 * the Supabase Auth user record itself cannot be done from browser
 * code with a publishable key — that step is documented in
 * supabase/README.md (Dashboard > Authentication > Users, or a
 * service-role edge function). The screen says so, instead of claiming
 * the account is fully deleted when it is not.
 */
export default function AccountView({ sessions, prefs, onPrefsChange, onRefresh, onOpenSession }: {
  sessions: Session[]; prefs: UserPreferences; onPrefsChange: (p: UserPreferences) => void;
  onRefresh: () => void; onOpenSession: (s: Session) => void;
}) {
  const auth = useAuth();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState('');

  if (!auth.configured || !auth.user) return <AuthView />;

  const user = auth.user;
  const cloudCount = sessions.filter(s => s.cloud?.synced).length;
  const localOnly = sessions.filter(s => !s.cloud?.synced && !s.isDemo);

  async function updatePrefs(next: UserPreferences) {
    onPrefsChange(next);
    try { await savePreferences(user.id, next); setMsg('Preferences saved to your account.'); } catch (e) { setMsg(`Preferences saved on this device only — cloud save failed: ${(e as Error).message}`); }
  }

  async function doImport() {
    setBusy(true); setMsg('');
    try {
      const local = await store.sessions();
      const cloud = await fetchCloudSessions(user.id);
      const candidates = importCandidates(local, new Set(cloud.map(s => s.id)));
      let imported = 0;
      for (const s of candidates) { await saveCloudSession(s, user.id, prefs); imported++; }
      setMsg(`Imported ${imported} local check-in(s) to your cloud history. ${local.length - candidates.length} were skipped (demo or already in cloud).`);
      onRefresh();
    } catch (e) { setMsg(`Import failed: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function doExport() {
    try {
      const cloud = await fetchCloudSessions(user.id);
      const localExport = JSON.parse(await exportAll());
      download('optiflow-cloud-export.json', JSON.stringify({ exportedAt: new Date().toISOString(), userId: user.id, cloudSessions: cloud, localDevice: localExport }, null, 2));
      setMsg('Export downloaded (cloud sessions + this device\'s local data).');
    } catch (e) { setMsg(`Export failed: ${(e as Error).message}`); }
  }

  async function doDeleteSession() {
    if (!deleteSessionId) return;
    setBusy(true);
    try {
      await deleteCloudSession(deleteSessionId, user.id);
      // Also remove the local copy on this device if present (single-key
      // delete — journal and resets are untouched).
      await store.deleteSession(deleteSessionId);
      setMsg('Session deleted from your cloud history and this device.');
      setDeleteSessionId(''); onRefresh();
    } catch (e) { setMsg(`Delete failed: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function doDeleteAllData() {
    setBusy(true);
    try {
      await deleteAllCloudData(user.id);
      await store.clearPersonal();
      setMsg('All cloud data and this device\'s personal data deleted.');
      setConfirmDelete(false); onRefresh();
    } catch (e) { setMsg(`Delete failed: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function doDeleteAccount() {
    setBusy(true);
    try {
      await deleteAllCloudData(user.id);
      await store.clearPersonal();
      await auth.signOut();
      setMsg('Your stored data has been deleted and you are signed out. To remove the Supabase Auth user record itself, the project owner must delete it in Dashboard > Authentication > Users (see supabase/README.md) — browser code cannot do that step with a publishable key.');
      setConfirmAccountDelete(false);
    } catch (e) { setMsg(`Delete failed: ${(e as Error).message}`); }
    setBusy(false);
  }

  async function refreshPrefs() {
    try { onPrefsChange(await loadPreferences(user.id, user.email)); setMsg('Preferences reloaded from your account.'); } catch (e) { setMsg(`Could not reload preferences: ${(e as Error).message}`); }
  }

  return (
    <div>
      <h1>Account</h1>
      <section className="card">
        <h2>Signed in as {user.email}</h2>
        <p className="small muted">User ID (first 8 chars, for support): {user.id.slice(0, 8)}… · Session: persistent, auto-refreshed. If your session expires, you will be asked to sign in again.</p>
        {auth.notice && <p role="status" className="notice">{auth.notice}</p>}
        {auth.error && <p role="alert" className="warn">{auth.error}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={() => auth.signOut()} disabled={auth.busy}>Sign out</button>
          <button className="btn secondary" onClick={refreshPrefs}>Reload preferences</button>
        </div>
        <p className="small muted">Signing out clears your cloud history from this browser's memory. Local device history (IndexedDB) remains on this device until you delete it below.</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Display name &amp; preferences</h2>
        <label htmlFor="display-name">Display name</label>
        <input id="display-name" type="text" value={prefs.displayName ?? ''} onChange={e => updatePrefs({ ...prefs, displayName: e.target.value })} placeholder="e.g. Maanas" />
        <label><input type="checkbox" checked={prefs.cloudSave} onChange={e => updatePrefs({ ...prefs, cloudSave: e.target.checked })} /> Save new check-ins to my cloud history</label>
        <p className="small muted">When off, new check-ins stay on this device only. Existing cloud history is not deleted.</p>
        <label><input type="checkbox" checked={prefs.savePulseWaveform} onChange={e => updatePrefs({ ...prefs, savePulseWaveform: e.target.checked })} /> Also save pulse waveform traces to the cloud (optional, off by default)</label>
        <p className="small muted">When off, only the BPM summary is saved; the waveform stays on this device's report.</p>
        <label><input type="checkbox" checked={prefs.saveReplay} onChange={e => updatePrefs({ ...prefs, saveReplay: e.target.checked })} /> Also store mesh replays in private cloud storage (optional, off by default)</label>
        <p className="small muted">Replays are stored as JSON under your user folder in a private bucket, protected by storage RLS. Turning this off does not delete already-stored replays — delete them per-session below, or delete all data.</p>
        <label><input type="checkbox" checked={prefs.reducedMotion} onChange={e => updatePrefs({ ...prefs, reducedMotion: e.target.checked })} /> Reduced motion</label>
        <p className="small muted">Also honoured automatically via your system prefers-reduced-motion setting.</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Your history</h2>
        <p className="small">{cloudCount} cloud check-in(s) · {localOnly.length} on this device only (not synced).</p>
        <p className="small muted">Cloud history is private to this account (Row Level Security). Another signed-in user cannot read, change, or delete these rows — that is enforced in the database, not just by hiding pages.</p>
        {localOnly.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p><strong>Import local check-ins?</strong> {localOnly.length} personal check-in(s) on this device are not in your cloud history yet. Importing is optional and skips demo sessions and duplicates.</p>
            <button className="btn" onClick={doImport} disabled={busy}>Import {localOnly.length} local check-in(s)</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="btn" onClick={doExport} disabled={busy}>Export my data (cloud + device)</button>
        </div>
        <h3 style={{ marginTop: 18 }}>Delete one session</h3>
        <label htmlFor="delete-session">Choose a session to delete from cloud + device</label>
        <select id="delete-session" value={deleteSessionId} onChange={e => setDeleteSessionId(e.target.value)}>
          <option value="">— select —</option>
          {sessions.filter(s => !s.isDemo).map(s => <option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()} — {s.score !== null ? `${s.score}/100` : 'no score'}{s.cloud?.synced ? ' (cloud)' : ' (device only)'}</option>)}
        </select>
        <button className="btn secondary" onClick={doDeleteSession} disabled={busy || !deleteSessionId} style={{ marginTop: 8 }}>Delete selected session</button>
        <p className="small muted">Deleting a session removes its cloud rows, its note, its feedback, and its stored replay (if any).</p>
        {msg && <p role="status">{msg}</p>}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Danger zone</h2>
        {!confirmDelete ? (
          <button className="btn secondary" onClick={() => setConfirmDelete(true)}>Delete all my data</button>
        ) : (
          <div><p role="alert"><strong>Delete all cloud data and this device's personal data?</strong> This cannot be undone. Your auth account itself is not deleted by this step (see below).</p>
            <button className="btn" onClick={doDeleteAllData} disabled={busy}>Yes, delete all my data</button>{' '}
            <button className="btn secondary" onClick={() => setConfirmDelete(false)}>Cancel</button></div>
        )}
        <div style={{ marginTop: 16 }}>
          {!confirmAccountDelete ? (
            <button className="btn secondary" onClick={() => setConfirmAccountDelete(true)}>Delete my account (data + sign out)</button>
          ) : (
            <div><p role="alert"><strong>Delete your account?</strong> This deletes all your stored data and signs you out. The Supabase Auth user record itself must then be removed by the project owner (Dashboard &gt; Authentication &gt; Users) — browser code cannot do that with a publishable key, and this screen will not claim otherwise.</p>
              <button className="btn" onClick={doDeleteAccount} disabled={busy}>Yes, delete my account data and sign out</button>{' '}
              <button className="btn secondary" onClick={() => setConfirmAccountDelete(false)}>Cancel</button></div>
          )}
        </div>
        <p className="small muted">Supabase project: {supabase ? 'configured' : 'not configured'}. If you use Google sign-in, it must be enabled in Supabase Authentication &gt; Providers; otherwise that button will return an error.</p>
      </section>
    </div>
  );
}

export { DEFAULT_PREFERENCES };
