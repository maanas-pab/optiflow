import React from 'react';
import type { Session, ResetRecord } from '../types';
import Halo from '../components/Halo';
import { LineChart } from '../components/Charts';
import { aggregateSessionsByDay } from '../lib/metrics';
import { bandForComfort } from '../lib/indicators';
import { DEMO_SESSIONS } from '../lib/demo';

export default function Today({ sessions, resets, onStart, onDemo, onOpenSession, demoMode, onStartReset }: {
  sessions: Session[]; resets: ResetRecord[]; onStart: () => void; onDemo: () => void; onOpenSession: (s: Session) => void; demoMode: boolean; onStartReset?: () => void;
}) {
  const sorted = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const last7 = aggregateSessionsByDay(sessions.filter(s => Date.now() - new Date(s.createdAt).getTime() < 7 * 86400000));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = sessions.filter(s => s.createdAt.slice(0, 10) === todayStr).length;
  const helpful = sessions.flatMap(s => Object.entries(s.feedback ?? {}).filter(([, v]) => v === 'helpful').map(([k]) => k));
  const observation = sorted.length >= 3 && latest?.score !== null
    ? `Across your last ${Math.min(sorted.length, 7)} check-ins, your scores have ranged from ${Math.min(...sorted.slice(0, 7).map(s => s.score ?? 999).filter(x => x !== 999))} to ${Math.max(...sorted.slice(0, 7).map(s => s.score ?? 0))}. That is a description of your reports, not a judgement.`
    : undefined;

  return (
    <div>
      {demoMode && <div className="demo-banner"><strong>Demo mode</strong> — you are viewing fictional demo data. Your personal history is separate and untouched.</div>}
      <section className="card halo-wrap" style={{ overflow: 'hidden' }}>
        <Halo color={latest?.scoreColor} />
        <div style={{ position: 'relative' }}>
          <h1>Take a moment for yourself.</h1>
          <p>A moment to notice how you’re doing — visible facial movement, your own reports of energy and stress, and a calm next step.</p>
          <button className="btn" onClick={onStart}>Start a check-in →</button>
          {latest?.suggestions[0] && onStartReset && <button className="btn secondary" style={{ marginLeft: 10 }} onClick={onStartReset}>Next step: {latest.suggestions[0].title} →</button>}
          <p className="small muted" style={{ marginTop: 10 }}>No account needed. Camera frames are processed on this device and never saved. Sign in (Account) to save results across devices.</p>
        </div>
      </section>

      {!latest ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Your first check-in</h2>
          <p>When you complete a scan, your most recent score, a seven-day trend, and a suggested reset will appear here. Nothing is pre-filled with fictional scans.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={onStart}>Start a check-in</button>
            <button className="btn secondary" onClick={onDemo}>Explore a demo (clearly labelled, separate data)</button>
          </div>
        </section>
      ) : (
        <div className="grid g3" style={{ marginTop: 16 }}>
          <section className="card"><h2>Most recent</h2>
            {latest.score !== null ? <><p style={{ fontSize: '2.4rem', fontWeight: 700 }}>{latest.score}<span className="small">/100</span></p><p><span className="pill" style={{ background: latest.scoreColor ?? undefined }}>● {latest.scoreLabel}</span></p><p className="small muted">Final score — camera-derived only. Self-report score, when available, is a comparison in the report, not the final score.</p></> : <p>Camera-observation report (no final camera score)</p>}
            <p className="small muted">{new Date(latest.createdAt).toLocaleString()} · {latest.scanDurationLabel}</p>
            <button className="btn small secondary" onClick={() => onOpenSession(latest)}>Open report →</button>
          </section>
          <section className="card"><h2>Seven-day trend</h2>
            <LineChart points={last7.map(d => ({ x: d.date, y: d.meanScore }))} label="Mean scored check-ins per day" color="#303633" />
            <p className="small muted">{todayCount} check-in{todayCount === 1 ? '' : 's'} today. Days without a score are not drawn.</p>
          </section>
          <section className="card"><h2>Suggested reset</h2>
            <p>{latest.suggestions[0]?.title ?? 'Keep noticing'}</p>
            <p className="small">{latest.suggestions[0]?.activity}</p>
            <p className="small muted">{latest.suggestions[0]?.duration}</p>
          </section>
        </div>
      )}

      <div className="grid g2" style={{ marginTop: 16 }}>
        <section className="card"><h2>Calendar preview</h2>
          <p className="small muted">Days are coloured by the mean of that day’s saved, scored check-ins. Neutral means no score that day. A few check-ins do not represent the whole day.</p>
          <div className="grid g4">{aggregateSessionsByDay(sessions).slice(-8).map(d => (
            <div key={d.date} style={{ background: d.meanScore !== null ? (bandForComfort(d.meanScore).color ?? '#eee') : '#f0ede6', borderRadius: 10, padding: 8 }}>
              <strong>{d.date.slice(5)}</strong><p className="small">{d.count} check-in{d.count === 1 ? '' : 's'}{d.meanScore !== null ? ` · mean ${d.meanScore}` : ' · no score'}</p>
            </div>))}
          </div>
        </section>
        <section className="card"><h2>A personal observation</h2>
          {observation ? <p>{observation}</p> : <p className="small muted">With a few more comparable sessions, a restrained observation will appear here — describing associations, never claiming causes.</p>}
          <p className="small muted">The score reflects a moment, not the person.</p>
          {helpful.length > 0 && <p className="small">Activities you marked helpful: {[...new Set(helpful)].join(', ')}</p>}
          {resets.length > 0 && <p className="small">Reset activities completed: {resets.length}</p>}
        </section>
      </div>
      {demoMode && <p style={{ marginTop: 16 }}><button className="btn secondary" onClick={() => onDemo()}>Back to my personal dashboard (demo data stays separate)</button> — demo sessions shown here are the fictional set in <code>src/lib/demo.ts</code>.</p>}
      {!demoMode && sessions.length === 0 && <p className="small muted" style={{ marginTop: 12 }}>Tip: the demo above uses fictional data only. Your personal history will never be pre-filled.</p>}
      {demoMode && <div style={{ display: 'none' }}>{DEMO_SESSIONS.length}</div>}
    </div>
  );
}
