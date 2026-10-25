import React from 'react';

/** Tiny dependency-free SVG line chart. Points are labelled; colour is never the only signal. */
export function LineChart({ points, label, color = '#303633', height = 140 }: { points: { x: string; y: number | null }[]; label: string; color?: string; height?: number }) {
  const vals = points.map(p => p.y).filter((v): v is number => v !== null);
  const max = vals.length ? Math.max(...vals) : 100; const min = vals.length ? Math.min(...vals) : 0;
  const w = 560; const pad = 28;
  const xy = points.map((p, i) => {
    const dx = pad + (points.length > 1 ? (i / (points.length - 1)) * (w - pad * 2) : (w / 2 - pad));
    const dy = p.y === null ? null : pad + (1 - (p.y - min) / Math.max(max - min, 1)) * (height - pad * 2);
    return { dx, dy, date: p.x, value: p.y };
  });
  const path = xy.filter(p => p.dy !== null).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.dx},${p.dy}`).join(' ');
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="small muted">{label} — {points.length} points, {vals.length} with a value. Missing dates are not drawn.</figcaption>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label={label}>
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
        {xy.map((p, i) => p.dy !== null && <g key={i}><circle cx={p.dx} cy={p.dy} r="4" fill={color} /><text x={p.dx} y={height - 4} fontSize="10" textAnchor="middle" fill="#6b716e">{p.date.slice(5)}</text></g>)}
      </svg>
    </figure>
  );
}
