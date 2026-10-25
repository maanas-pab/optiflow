import React from 'react';

export interface LivePoint {
  t: number; blinks: number; eyeOpen: number; brow: number; jaw: number;
  tension: number; fatigue: number; energy: number; closedPct: number;
}

function Spark({ points, get, color, label, unit }: { points: LivePoint[]; get: (p: LivePoint) => number; color: string; label: string; unit?: string }) {
  const vals = points.map(get);
  const max = Math.max(...vals, 1); const min = Math.min(...vals, 0);
  const w = 260, h = 64, pad = 6;
  const path = points.map((p, i) => {
    const x = pad + (points.length > 1 ? (i / (points.length - 1)) * (w - pad * 2) : w / 2);
    const y = pad + (1 - (get(p) - min) / Math.max(max - min, 0.001)) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  const last = vals[vals.length - 1];
  return (
    <div className="card" style={{ padding: 12 }}>
      <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between' }}><strong>{label}</strong><span style={{ color }}>{last !== undefined ? `${Math.round(last * 10) / 10}${unit ?? ''}` : '—'}</span></p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${label} over time`}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e3ded2" />
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
        {points.length > 0 && <circle cx={w - pad} cy={pad + (1 - (last - min) / Math.max(max - min, 0.001)) * (h - pad * 2)} r="4" fill={color} />}
      </svg>
      <p className="small muted" style={{ margin: 0 }}>Live, vs time in this scan. Not a health reading.</p>
    </div>
  );
}

function Level({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p style={{ margin: '6px 0 2px', display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><strong>{Math.round(value)}/100</strong></p>
      <div style={{ height: 10, borderRadius: 999, background: '#efece4', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

/** Real-time graphs + levels for the live scan. Each series has its own
 *  colour, label, and current value — colour is never the only signal. */
export default function LiveGraphs({ history, latest }: { history: LivePoint[]; latest: LivePoint | null }) {
  if (!latest) return <p className="small muted">Live graphs will appear once tracking starts.</p>;
  return (
    <div>
      <div className="grid g2">
        <Spark points={history} get={p => p.blinks} color="#303633" label="Blink count" unit="" />
        <Spark points={history} get={p => p.eyeOpen} color="#BCCFDF" label="Eye openness (EAR ×100)" unit="" />
        <Spark points={history} get={p => p.brow} color="#C9C2DD" label="Brow movement" unit="" />
        <Spark points={history} get={p => p.jaw} color="#E5BAA8" label="Jaw opening" unit="" />
        <Spark points={history} get={p => p.tension} color="#8a7fa3" label="Tension-related movement" unit="" />
        <Spark points={history} get={p => p.closedPct} color="#E8DCA9" label="Eyes closed %" unit="%" />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Live levels</h3>
        <Level label="Fatigue-related movement indicator" value={latest.fatigue} color="#E8DCA9" />
        <Level label="Derived energy (100 − fatigue indicator)" value={latest.energy} color="#B9CDBB" />
        <Level label="Tension-related movement" value={latest.tension} color="#C9C2DD" />
        <p className="small muted">Levels are movement observations in this moment, not measurements of fatigue, energy, or stress. Your self-report, shown above, is the authority for how you feel.</p>
      </div>
    </div>
  );
}
