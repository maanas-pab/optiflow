import React, { useCallback, useEffect, useState } from 'react';
import type { View, Session, JournalEntry, ResetRecord, MeshReplay, UserPreferences } from './types';
import { AuthProvider, useAuth } from './lib/authContext';
import { supabase } from './lib/supabase';
import { fetchCloudSessions, saveCloudSession, loadPreferences, loadCloudReplay, mergeSessions, DEFAULT_PREFERENCES } from './lib/cloud';
import { store } from './lib/storage';
import { DEMO_SESSIONS } from './lib/demo';
import Today from './views/Today';
import ScanFlow from './views/ScanFlow';
import ReportView from './views/ReportView';
import CalendarView from './views/CalendarView';
import InsightsView from './views/InsightsView';
import ResetStudio from './views/ResetStudio';
import JournalView from './views/JournalView';
import MetricLibrary from './views/MetricLibrary';
import SettingsView from './views/SettingsView';
import AccountView from './views/AccountView';
import HomeView from './views/HomeView';
import InsideOptiFlow from './views/InsideOptiFlow';

const NAV: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'today', label: 'Today' }, { id: 'scan', label: 'Scan' }, { id: 'calendar', label: 'Calendar' },
  { id: 'insights', label: 'Insights' }, { id: 'reset', label: 'Reset Studio' }, { id: 'journal', label: 'Journal' },
];
const SECONDARY: { id: View; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'inside', label: 'Inside OptiFlow' },
  { id: 'library', label: 'Metric Library' }, { id: 'settings', label: 'Settings & Privacy' },
];

function AppInner() {
  const auth = useAuth();
  const [view, setView] = useState<View>('home');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [resets, setResets] = useState<ResetRecord[]>([]);
  const [current, setCurrent] = useState<Session | null>(null);
  const [currentReplay, setCurrentReplay] = useState<MeshReplay | undefined>(undefined);
  const [demoMode, setDemoMode] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [syncState, setSyncState] = useState<'local' | 'synced' | 'saving' | 'not-synced' | 'error'>('local');
  const [syncMsg, setSyncMsg] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resetPreselect, setResetPreselect] = useState<string | undefined>(undefined);
  const reducedMotion = prefs.reducedMotion;

  const refresh = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const local = await store.sessions();
      setJournal(await store.journal());
      setResets(await store.resets());
      if (auth.user && supabase) {
        try {
          const cloud = await fetchCloudSessions(auth.user.id);
          setSessions(mergeSessions(cloud, local));
          setSyncState(cloud.length || local.some(s => s.cloud?.synced) ? 'synced' : 'local');
        } catch (e) {
          setSessions(local);
          setSyncState('error'); setSyncMsg(`Cloud history could not be loaded: ${(e as Error).message}. Showing this device's history.`);
        }
        try { setPrefs(await loadPreferences(auth.user.id, auth.user.email)); } catch { /* keep local prefs */ }
      } else {
        setSessions(local);
        setSyncState('local');
      }
    } catch { /* IndexedDB unavailable (e.g. private mode): app still works for this session */ }
    setHistoryLoading(false);
  }, [auth.user]);
  useEffect(() => { refresh(); }, [refresh]);

  // On sign-out / account switch: clear cloud data from memory immediately.
  useEffect(() => {
    if (!auth.user) { setCurrent(null); setCurrentReplay(undefined); setSyncState('local'); setSyncMsg(''); }
  }, [auth.user?.id]);

  /** Save a session locally, then to the cloud when signed in + enabled. */
  const saveSession = useCallback(async (s: Session, replay?: MeshReplay) => {
    await store.saveSession(s);
    if (auth.user && supabase && prefs.cloudSave && !s.isDemo) {
      setSyncState('saving'); setSyncMsg('Saving to your cloud history…');
      try {
        await saveCloudSession(s, auth.user.id, prefs, replay);
        setSyncState('synced'); setSyncMsg('Saved to your cloud history.');
      } catch (e) {
        setSyncState('not-synced'); setSyncMsg(`Saved on this device, but cloud sync failed: ${(e as Error).message}. It will be offered for import later.`);
      }
    }
    await refresh();
  }, [auth.user, prefs, refresh]);

  const displayed = demoMode ? DEMO_SESSIONS : sessions;
  const go = (v: View) => setView(v);
  // Hash route for Inside OptiFlow: #/inside-optiflow (the app has no
  // router dependency, so views are state-based; the hash makes the tab
  // linkable and shareable).
  useEffect(() => {
    if (window.location.hash === '#/inside-optiflow') setView('inside');
  }, []);
  useEffect(() => {
    if (view === 'inside') window.location.hash = '#/inside-optiflow';
    else if (window.location.hash === '#/inside-optiflow') window.location.hash = '';
  }, [view]);

  return (
    <div className={`layout ${reducedMotion ? 'reduced' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand-btn" onClick={() => go('home')} aria-label="OptiFlow home"><span className="brand">OptiFlow<small>A moment to notice how you’re doing.</small></span></button>
        <nav className="nav">
          {NAV.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => go(n.id)}>{n.label}</button>)}
          <div className="sec">Learn &amp; manage</div>
          {SECONDARY.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => go(n.id)}>{n.label}</button>)}
        </nav>
        <div className="sidebar-account">
          {auth.loading ? <p className="small muted">Checking session…</p>
          : auth.user ? <><p className="small"><strong>{prefs.displayName || auth.user.email}</strong></p><p className="small muted">Signed in · <button className="link-btn" onClick={() => go('account')}>Account</button></p></>
          : <><p className="small muted">Guest — history on this device only.</p><button className="link-btn" onClick={() => go('account')}>Sign in to save across devices →</button></>}
          <p className="small muted">Sync: {syncState === 'synced' ? '● Saved' : syncState === 'saving' ? '● Saving…' : syncState === 'not-synced' ? '● Not synced' : syncState === 'error' ? '● Sync error' : '● Local only'}{syncMsg ? ` — ${syncMsg}` : ''}</p>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>Local-first. No raw video is saved. No diagnosis is made.</p>
      </aside>

      <main className="main"><div className="page" key={view}>
        {historyLoading && <section className="card"><p role="status">Loading your history…</p></section>}
        {view === 'today' && !auth.user && !auth.loading && (
          <div className="notice" role="note"><strong>Guest mode:</strong> you can scan and view a report without an account. <button className="link-btn" onClick={() => go('account')}>Sign in to save results across devices →</button></div>
        )}
        {view === 'today' && <Today sessions={displayed} resets={resets} demoMode={demoMode}
          onStart={() => go('scan')} onDemo={() => setDemoMode(!demoMode)} onStartReset={() => go('reset')}
          onOpenSession={async s => { setCurrent(s); if (s.replay) setCurrentReplay(s.replay); else if (s.cloud?.hasReplay && auth.user && supabase) setCurrentReplay(await loadCloudReplay(s, auth.user.id) ?? undefined); else setCurrentReplay(undefined); go('report'); }} />}
        {view === 'scan' && <ScanFlow onComplete={async (s, replay) => { setCurrent(s); setCurrentReplay(replay); await saveSession(s, replay); go('report'); }} onExit={() => go('today')} />}
        {view === 'report' && current && <ReportView session={current} history={displayed} replay={currentReplay} onSaved={async () => { await saveSession(current, currentReplay); }} syncState={syncState}
          onReset={() => go('reset')} onAddNote={async () => { await saveSession(current, currentReplay); }} />}
        {view === 'report' && !current && <section className="card"><p>No report open yet. Start a check-in, or open a session from Today or Calendar.</p><button className="btn" onClick={() => go('scan')}>Start a check-in</button></section>}
        {view === 'calendar' && <CalendarView sessions={displayed} onOpenSession={async s => { setCurrent(s); if (s.replay) setCurrentReplay(s.replay); else if (s.cloud?.hasReplay && auth.user && supabase) setCurrentReplay(await loadCloudReplay(s, auth.user.id) ?? undefined); else setCurrentReplay(undefined); go('report'); }} />}
        {view === 'insights' && <InsightsView sessions={displayed} resets={resets} />}
        {view === 'reset' && <ResetStudio preselect={resetPreselect} onDone={refresh} />}
        {view === 'journal' && <JournalView entries={journal} sessions={sessions} onRefresh={refresh} />}
        {view === 'inside' && <InsideOptiFlow />}
        {view === 'library' && <MetricLibrary />}
        {view === 'settings' && <SettingsView onRefresh={refresh} reducedMotion={prefs.reducedMotion} setReducedMotion={v => setPrefs({ ...prefs, reducedMotion: v })} onAccount={() => go('account')} />}
        {view === 'account' && <AccountView sessions={sessions} prefs={prefs} onPrefsChange={setPrefs} onRefresh={refresh} onOpenSession={s => { setCurrent(s); setCurrentReplay(s.replay); go('report'); }} />}
        {view === 'home' && <HomeView latest={[...displayed].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null} onStart={() => go('scan')} onDemo={() => { setDemoMode(true); go('today'); }} onOpenLatest={() => { const l = [...displayed].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; if (l) { setCurrent(l); setCurrentReplay(l.replay); go('report'); } }} onInside={() => go('inside')} onAccount={() => go('account')} />}
      </div></main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {NAV.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => go(n.id)}>{n.label}</button>)}
        <button className={view === 'account' ? 'active' : ''} onClick={() => go('account')}>Account</button>
      </nav>
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
