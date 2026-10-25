import React, { useMemo, useState } from 'react';
import type { Session } from '../types';
import { aggregateSessionsByDay } from '../lib/metrics';
import { bandForComfort } from '../lib/indicators';

export default function CalendarView({ sessions, onOpenSession }: { sessions: Session[]; onOpenSession: (s: Session) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);
  const [weekMode, setWeekMode] = useState(false);
  const days = useMemo(() => {
    const year = cursor.getFullYear(); const month = cursor.getMonth();
    const first = new Date(year, month, 1); const startDay = first.getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) out.push(null);
    for (let d = 1; d <= count; d++) out.push(new Date(year, month, d));
    return out;
  }, [cursor]);
  const agg = new Map(aggregateSessionsByDay(sessions).map(d => [d.date, d]));
  const selectedSessions = selected ? sessions.filter(s => s.createdAt.slice(0, 10) === selected).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const shownDays = weekMode && selected ? days.filter(d => d && Math.abs(d.getTime() - new Date(selected).getTime()) < 7 * 86400000) : days;

  return (
    <div>
      <h1>Calendar</h1>
      <p className="muted">Colour = mean of that day’s saved, camera-derived final scores. Neutral = no camera score. Sessions without a camera score are marked separately. A few check-ins do not represent the whole day.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn small secondary" onClick={() => shift(-1)}>← Previous month</button>
        <strong>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button className="btn small secondary" onClick={() => shift(1)}>Next month →</button>
        <button className="btn small secondary" onClick={() => setWeekMode(!weekMode)}>{weekMode ? 'Show month view' : 'Show week around selected day'}</button>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cal">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <strong key={d} className="small muted">{d}</strong>)}
          {shownDays.map((d, i) => {
            if (!d) return <div key={'e' + i} />;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const a = agg.get(key);
            // Day colour is ALWAYS the mean-score band, never the first session's colour,
            // so multiple scans in a day average out to one colour + one average score.
            const dayBand = a?.meanScore !== null && a?.meanScore !== undefined ? bandForComfort(a.meanScore) : { color: null };
            return (
              <button key={key} className={selected === key ? 'selected' : ''} style={{ background: dayBand.color ?? '#fff' }} onClick={() => setSelected(key)} aria-label={`${key}, ${a?.count ?? 0} check-ins, mean score ${a?.meanScore ?? 'none'}`}>
                <strong>{d.getDate()}</strong>
                <span className="small" style={{ display: 'block' }}>{a ? `${a.count} check-in${a.count === 1 ? '' : 's'}${a.meanScore !== null ? ` · mean ${a.meanScore}` : ''}${a.cameraOnly ? ` · ${a.cameraOnly} camera-only` : ''}` : '—'}</span>
              </button>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Legend: <span className="pill" style={{ background: '#B9CDBB' }}>● 80–100 Feeling comfortable</span> <span className="pill" style={{ background: '#BCCFDF' }}>● 60–79 Some discomfort</span> <span className="pill" style={{ background: '#C9C2DD' }}>● 40–59 A pause may help</span> <span className="pill" style={{ background: '#E8DCA9' }}>● 20–39 Consider a reset</span> <span className="pill" style={{ background: '#E5BAA8' }}>● 0–19 Make room for rest</span> · Labels and icons accompany every colour.</p>
      </div>

      {selected && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>{selected}</h2>
          {selectedSessions.length === 0 ? <p>No saved check-ins on this day.</p> : selectedSessions.map(s => (
            <article key={s.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <p><strong>{new Date(s.createdAt).toLocaleTimeString()}</strong> — {s.score !== null ? `${s.score}/100 · ${s.scoreLabel}` : 'Camera-only session (no score)'} · {s.scanDurationLabel}</p>
              <p className="small">Stress {s.selfReport.stress ?? '—'} · Fatigue {s.selfReport.fatigue ?? '—'} · Eye {s.selfReport.eyeDiscomfort ?? '—'} · Jaw {s.selfReport.jawDiscomfort ?? '—'} · Energy {s.selfReport.energy ?? '—'}</p>
              {s.note && <p className="small">Note: {s.note}</p>}
              {s.selfReport.activity && <p className="small">Context: {s.selfReport.activity}</p>}
              <button className="btn small secondary" onClick={() => onOpenSession(s)}>Open report →</button>
            </article>
          ))}
          <p className="small muted">Daily range (scored sessions): {(() => { const a = agg.get(selected); return a?.meanScore !== null ? `${a?.minScore}–${a?.maxScore}, mean ${a?.meanScore}` : 'no scored sessions'; })()}</p>
        </section>
      )}
    </div>
  );
}
