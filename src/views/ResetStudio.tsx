import React, { useEffect, useRef, useState } from 'react';
import { RESET_ACTIVITIES, type ResetActivity } from '../lib/resetActivities';
import { store } from '../lib/storage';
import type { ResetRecord } from '../types';

/** Circular outline timer: a soft ring that fills as time passes, with the
 *  remaining time (and, for breathing, the breath phase) in the middle.
 *  Breath in = dusty blue, breath out = muted peach — a calm, palette-matched
 *  take on the blue/red outline idea, without harsh red. */
export function CircularTimer({ durationSec, elapsedSec, phase, phaseColor }: { durationSec: number; elapsedSec: number; phase?: string; phaseColor?: string }) {
  const R = 104; const C = 2 * Math.PI * R;
  const progress = durationSec > 0 ? Math.min(elapsedSec / durationSec, 1) : 0;
  const remaining = Math.max(0, durationSec - elapsedSec);
  const mm = Math.floor(remaining / 60); const ss = String(remaining % 60).padStart(2, '0');
  const color = phaseColor ?? '#B9CDBB';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px 0' }} role="timer" aria-label={`${mm}:${ss} remaining${phase ? `, ${phase}` : ''}`}>
      <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
        <circle cx="130" cy="130" r={R} fill="#fffdf8" stroke="#e3ded2" strokeWidth="10" />
        <circle cx="130" cy="130" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 130 130)"
          style={{ transition: 'stroke-dashoffset .5s linear, stroke .5s' }} />
        <text x="130" y={phase ? 122 : 134} textAnchor="middle" fontSize="44" fontWeight="700" fill="#303633">{mm}:{ss}</text>
        {phase && <text x="130" y="152" textAnchor="middle" fontSize="18" fontWeight="600" fill="#303633">{phase}</text>}
        <text x="130" y="176" textAnchor="middle" fontSize="12" fill="#6b716e">{Math.round(progress * 100)}% complete</text>
      </svg>
      <p className="small muted" style={{ marginTop: 4 }}>Remaining time is shown in the middle, with the ring filling around it.</p>
    </div>
  );
}

export default function ResetStudio({ onDone, preselect }: { onDone: () => void; preselect?: string }) {
  const [active, setActive] = useState<ResetActivity | null>(() => RESET_ACTIVITIES.find(a => a.id === preselect) ?? null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState(25);
  const [feelBefore, setFeelBefore] = useState<number | undefined>(undefined);
  const [feelAfter, setFeelAfter] = useState<number | undefined>(undefined);
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem('optiflow-favs') ?? '[]'));
  const [finished, setFinished] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  function start(a: ResetActivity) {
    setActive(a); setSeconds(0); setFinished(false); setRunning(true);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  }
  function stop() { setRunning(false); if (timer.current) window.clearInterval(timer.current); }
  function pauseResume() {
    if (running) { setRunning(false); if (timer.current) window.clearInterval(timer.current); }
    else { setRunning(true); timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000); }
  }
  async function complete() {
    if (!active) return;
    stop();
    const rec: ResetRecord = { id: 'r-' + Date.now(), createdAt: new Date().toISOString(), activityId: active.id, title: active.title, durationSec: seconds, feelBefore, feelAfter };
    await store.saveReset(rec); setFinished(true); onDone();
  }
  function toggleFav(id: string) { const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; setFavs(next); localStorage.setItem('optiflow-favs', JSON.stringify(next)); }
  const duration = active?.kind === 'focus' ? customMin * 60 : (active?.durationSec ?? 0);
  // Breathing cycle: 4 s in, 6 s out — matching the steps, no mandatory hold.
  const breathingIn = active?.kind === 'breathing' ? (seconds % 10) < 4 : false;
  const breathingPhase = active?.kind === 'breathing' ? (breathingIn ? 'Breathe in' : 'Breathe out') : undefined;
  const breathingColor = active?.kind === 'breathing' ? (breathingIn ? '#BCCFDF' : '#E5BAA8') : undefined;

  return (
    <div>
      <h1>Reset Studio</h1>
      <p className="muted">Small, usable activities. No activity promises to improve a score. You can use these without a camera.</p>
      {!active ? (
        <div className="grid g2">
          {RESET_ACTIVITIES.map(a => (
            <section className="card" key={a.id}>
              <h2>{a.title} {favs.includes(a.id) && <span aria-label="favorite">★</span>}</h2>
              <p className="small muted">{Math.round(a.durationSec / 60)} min · {a.description}</p>
              <ol className="small">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => start(a)}>Start</button>
                <button className="btn small secondary" onClick={() => toggleFav(a.id)}>{favs.includes(a.id) ? 'Remove favorite' : 'Save favorite'}</button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="card">
          <h2>{active.title}</h2>
          <p>{active.description}</p>
          {active.kind === 'focus' && <div><label>Focus duration (minutes)</label><input type="number" min={1} max={120} value={customMin} onChange={e => setCustomMin(Number(e.target.value))} /></div>}
          <CircularTimer durationSec={duration} elapsedSec={seconds} phase={breathingPhase} phaseColor={breathingColor} />
          {breathingPhase && <p className="small muted" style={{ textAlign: 'center' }}>Comfortable pace — no mandatory breath holding. The ring turns dusty blue for “Breathe in” and muted peach for “Breathe out”.</p>}
          <ol>{active.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={pauseResume}>{running ? 'Pause' : 'Resume'}</button>
            <button className="btn secondary" onClick={stop}>Stop</button>
            <button className="btn secondary" onClick={() => setActive(null)}>Back to library</button>
          </div>
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div><label>How do you feel before? (0–10, optional)</label><input type="range" min={0} max={10} value={feelBefore ?? 5} onChange={e => setFeelBefore(Number(e.target.value))} /></div>
            <div><label>How do you feel now? (0–10, optional)</label><input type="range" min={0} max={10} value={feelAfter ?? 5} onChange={e => setFeelAfter(Number(e.target.value))} /></div>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={complete}>Finish &amp; save activity</button>
          {finished && <p>Saved. Compare your own before/after responses in Insights — no improvement is promised.</p>}
        </section>
      )}
    </div>
  );
}
