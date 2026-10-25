import React from 'react';
import type { Session, ResetRecord } from '../types';
import { LineChart } from '../components/Charts';

export default function InsightsView({ sessions, resets }: { sessions: Session[]; resets: ResetRecord[] }) {
  const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const scored = sorted.filter(s => s.score !== null);
  const range = sorted.length ? `${new Date(sorted[0].createdAt).toLocaleDateString()} – ${new Date(sorted[sorted.length - 1].createdAt).toLocaleDateString()}` : 'No data yet';
  const morning = scored.filter(s => new Date(s.createdAt).getHours() < 12);
  const afternoon = scored.filter(s => new Date(s.createdAt).getHours() >= 12);
  const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  const fatigueMorning = avg(morning.map(s => s.selfReport.fatigue ?? NaN).filter(x => !isNaN(x)));
  const fatigueAfternoon = avg(afternoon.map(s => s.selfReport.fatigue ?? NaN).filter(x => !isNaN(x)));
  const sleepPairs = sorted.filter(s => s.selfReport.sleepHours !== undefined && s.selfReport.fatigue !== undefined);
  const helpful = sorted.flatMap(s => Object.entries(s.feedback ?? {}).filter(([, v]) => v === 'helpful').map(([k]) => k));
  const helpfulCounts = new Map<string, number>(); helpful.forEach(k => helpfulCounts.set(k, (helpfulCounts.get(k) ?? 0) + 1));
  const beforeAfter = resets.filter(r => r.feelBefore !== undefined && r.feelAfter !== undefined);
  const enough = scored.length >= 4;

  return (
    <div>
      <h1>Insights</h1>
      <p className="muted">Restrained trends from your own sessions. Sample size, missing data, and date range are shown. Associations are described, never claimed as causes. Empty dates are not extrapolated.</p>
      <p className="small"><strong>Date range:</strong> {range} · <strong>Sessions:</strong> {sessions.length} · <strong>Scored:</strong> {scored.length} · <strong>Camera-only:</strong> {sessions.length - scored.length}</p>

      {sorted.length === 0 ? <section className="card"><p>No sessions yet. Complete a check-in to see trends here.</p></section> : (
        <div className="grid g2">
          <section className="card"><h2>Score over time</h2><LineChart points={scored.map(s => ({ x: s.createdAt.slice(0, 10), y: s.score }))} label="OptiFlow Check-in Score" /></section>
          <section className="card"><h2>Self-reported stress &amp; fatigue</h2><LineChart points={sorted.map(s => ({ x: s.createdAt.slice(0, 10), y: s.selfReport.stress ?? null }))} label="Stress (0–10)" color="#7a8fa3" /><LineChart points={sorted.map(s => ({ x: s.createdAt.slice(0, 10), y: s.selfReport.fatigue ?? null }))} label="Fatigue (0–10)" color="#8a7fa3" /></section>
          <section className="card"><h2>Camera observations (separate charts)</h2><LineChart points={sorted.map(s => ({ x: s.createdAt.slice(0, 10), y: s.camera.blinksPerMinute }))} label="Blinks per minute (rate estimate)" /><LineChart points={sorted.map(s => ({ x: s.createdAt.slice(0, 10), y: s.camera.eyesClosedPercent }))} label="Eyes closed (% of valid time)" /></section>
          <section className="card"><h2>Morning vs afternoon</h2>
            {enough ? <p>You reported mean fatigue of {fatigueMorning ?? '—'}/10 in {morning.length} morning check-in{morning.length === 1 ? '' : 's'} and {fatigueAfternoon ?? '—'}/10 in {afternoon.length} afternoon check-in{afternoon.length === 1 ? '' : 's'}. This describes those sessions; it does not show that time of day causes fatigue.</p>
            : <p className="small muted">Not enough comparable sessions yet for a morning/afternoon summary (needs at least 4 scored sessions).</p>}
          </section>
          <section className="card"><h2>Sleep entered vs fatigue reported</h2>
            {sleepPairs.length ? <ul>{sleepPairs.map(s => <li key={s.id} className="small">{new Date(s.createdAt).toLocaleDateString()}: {s.selfReport.sleepHours} h sleep entered, fatigue {s.selfReport.fatigue}/10</li>)}</ul> : <p className="small muted">Enter sleep duration in a check-in to see this comparison. No sleep disorder is inferred.</p>}
            <p className="small muted">This is a list of your own paired entries, not a causal claim.</p>
          </section>
          <section className="card"><h2>Before / after resets</h2>
            {beforeAfter.length ? <ul>{beforeAfter.map(r => <li key={r.id} className="small">{r.title}: feel-before {r.feelBefore}/10 → feel-after {r.feelAfter}/10</li>)}</ul> : <p className="small muted">Complete a reset activity and answer “How do you feel now?” to compare your own before/after responses. No activity is promised to improve a score.</p>}
          </section>
          <section className="card"><h2>Most frequently helpful</h2>
            {helpfulCounts.size ? <ul>{[...helpfulCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="small">{k}: marked helpful {v} time{v === 1 ? '' : 's'}</li>)}</ul> : <p className="small muted">Mark suggestions “Helpful” or “Not for me” on reports to build this list.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
