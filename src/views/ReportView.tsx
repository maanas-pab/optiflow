import React, { useState } from 'react';
import type { Session, MeshReplay } from '../types';
import ShowMeWhyModal from '../components/ShowMeWhyModal';
import Halo from '../components/Halo';
import MetricCard from '../components/MetricCard';
import { store } from '../lib/storage';
import { buildIndicators, bandForComfort } from '../lib/indicators';

export default function ReportView({ session, history, replay, syncState, onSaved, onReset, onAddNote }: {
  session: Session; history: Session[]; replay?: MeshReplay; syncState?: string; onSaved: () => void; onReset: () => void; onAddNote: (note: string) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState(session.note ?? '');
  const [saved, setSaved] = useState(false);
  const c = session.camera;
  const prev = history.filter(s => s.id !== session.id && !s.isDemo).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const prevScored = prev.find(s => s.score !== null);
  const delta = (a: number, b: number) => { const d = Math.round((a - b) * 10) / 10; return d === 0 ? 'same as last' : `${d > 0 ? '+' : ''}${d} vs last`; };
  const cmp = (key: 'blinksPerMinute' | 'eyesClosedPercent') => {
    const p = prev.find(s => s.camera[key] !== null);
    return p && session.camera[key] !== null ? delta(session.camera[key] as number, p.camera[key] as number) : undefined;
  };
  async function save() {
    if (!session.isDemo) { await store.saveSession(session); setSaved(true); onSaved(); }
    else { setSaved(true); }
  }
  function feedback(id: string, v: 'helpful' | 'not-for-me') {
    session.feedback = { ...(session.feedback ?? {}), [id]: v };
    if (!session.isDemo) store.saveSession(session);
  }
  const dt = new Date(session.createdAt).toLocaleString();
  return (
    <div>
      {session.isDemo && <div className="demo-banner"><strong>Demo report</strong> — fictional data for exploring the interface. Not part of your personal history.</div>}
      <section className="card halo-wrap" style={{ overflow: 'hidden', background: session.scoreColor ? undefined : undefined }}>
        <Halo color={session.scoreColor} />
        <div style={{ position: 'relative' }}>
          <p className="muted">{dt} · {session.scanDurationLabel}</p>
          {session.score !== null ? (
            <><div className="score-big">{session.score}<span style={{ fontSize: '1.5rem' }}>/100</span></div>
            <p><span className="pill" style={{ background: session.scoreColor ?? undefined }}>● {session.scoreLabel}</span> <strong>Final score — camera-derived</strong></p>
            <p className="small">This final score is computed <strong>only from what the camera observed</strong> in this scan — eye comfort, tension-related movement, blink stability, and head steadiness, averaged over the whole scan. It does <strong>not</strong> use anything you typed. That is deliberate: it can point out movement you might not have noticed, even when it differs from how you reported feeling. It is a movement-observation score, not a mental-health, attractiveness, or medical score.</p>
            {session.cameraScoreComponents && (
              <table><thead><tr><th>Component</th><th>Weight</th><th>Value</th><th>Detail</th></tr></thead><tbody>
                {session.cameraScoreComponents.map(comp => <tr key={comp.name}><td>{comp.name}</td><td>{comp.weight}%</td><td>{comp.value}/100</td><td className="small">{comp.detail}</td></tr>)}
              </tbody></table>
            )}
            <p className="small"><strong>Confidence:</strong> {session.cameraScoreConfidence ?? '—'}</p>
            <button className="btn small" onClick={() => setShowWhy(true)}>Show me why →</button>
            <details><summary>How the camera score works (transparent formula)</summary><p className="small">Score = Eye comfort × 40% + Tension-related movement comfort × 30% + Blink stability × 15% + Head steadiness × 15%, each component 0–100, then rounded. Eye comfort falls with eyes-closed % and blink-rate deviation; tension comfort falls with brow/jaw movement; blink stability uses median blink duration and aggressive-blink share; head steadiness falls with time outside the forward range and yaw variability. Experimental pixel appearance (darkness/redness/brightness change) is deliberately <em>excluded</em> from the score because it is lighting-dominated. Weights and neutral ranges are product conventions, not validated clinical thresholds. Unusable frames are excluded, time comes from frame timestamps, and no score is given under 10s valid or 30% usable frames.</p></details></>
          ) : (
            <><h1 style={{ fontSize: '2.2rem' }}>Camera-observation report — no final score</h1>
            <p>No camera score was invented: {session.cameraScoreConfidence ?? 'there was not enough usable camera data, or the camera was not used'}. What follows is what the camera observed (if any), alongside what you reported. Your self-report score, when available, is shown below as a comparison only — it is never substituted as the final score.</p>
            <button className="btn small" onClick={() => setShowWhy(true)}>Show me why →</button></>
          )}
          <p className="small"><strong>Measurement quality:</strong> {c.usablePercent}% usable frames · {c.validSeconds}s valid · {c.samplingHz} samples/sec · {c.interruptions} interruptions. Quality is shown separately from the score.</p>
          {c.insufficient && <p className="warn" role="alert"><strong>Insufficient usable data:</strong> this session had little valid tracking, so treat its camera numbers cautiously and adjust lighting or framing before comparing it with other sessions.</p>}
          <p className="small muted">A score reflects a moment, not the person. Colour bands are product conventions, not validated clinical thresholds.</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Camera score vs what you reported — the comparison</h2>
        {session.selfReportScore !== undefined && session.selfReportScore !== null ? (
          <p>Your self-report score (from stress, fatigue, eye, and jaw ratings only, via <code>round(100 × (1 − mean/10))</code>) is <strong>{session.selfReportScore}/100{session.selfReportScoreLabel ? ` · ${session.selfReportScoreLabel}` : ''}</strong>. {session.score !== null ? <>The camera-derived final score is <strong>{session.score}/100</strong> — a difference of <strong>{Math.abs(session.score - session.selfReportScore)} points</strong>. {session.score > session.selfReportScore ? 'The camera observed a steadier movement pattern than you reported feeling — movement in one short scan and how you feel overall can genuinely differ.' : session.score < session.selfReportScore ? 'The camera observed more movement / eye-closure / tension-related movement than your self-report suggested — that is exactly the kind of thing you might not have noticed while concentrating.' : 'They agree closely in this scan.'} Neither score overrides the other: one is what was observed, the other is what you said. Use both, and trust your own report for how you feel.</> : 'No camera final score is available in this session, so this self-report score is shown for comparison only — it has not been substituted as the final score.'}</p>
        ) : (
          <p>No self-report score is available (fewer than 3 of stress, fatigue, eye, and jaw were completed, and self-report is optional). The camera score above stands on its own, computed without any user input.</p>
        )}
        <h3>Things you might not have noticed</h3>
        {(() => {
          const p = prev.find(s => s.camera.blinkCount > 0);
          const notes: string[] = [];
          if (p) {
            if (c.tensionMovement !== undefined && p.camera.tensionMovement !== undefined && Math.abs(c.tensionMovement - p.camera.tensionMovement) >= 0.1) notes.push(`Tension-related movement changed from ${Math.round(p.camera.tensionMovement * 100)}/100 in your last session to ${Math.round(c.tensionMovement * 100)}/100 now — brow and jaw movement you may not have felt while concentrating.`);
            if (c.blinksPerMinute !== null && p.camera.blinksPerMinute !== null && Math.abs(c.blinksPerMinute - p.camera.blinksPerMinute) >= 4) notes.push(`Blink rate changed from ${p.camera.blinksPerMinute}/min last time to ${c.blinksPerMinute}/min now.`);
            if (Math.abs(c.eyesClosedPercent - p.camera.eyesClosedPercent) >= 3) notes.push(`Eyes-closed share changed from ${p.camera.eyesClosedPercent}% to ${c.eyesClosedPercent}% of valid time.`);
            if (c.jawTightnessMean !== undefined && p.camera.jawTightnessMean !== undefined && Math.abs(c.jawTightnessMean - p.camera.jawTightnessMean) >= 0.1) notes.push(`Jaw tightness proxy changed from ${Math.round(p.camera.jawTightnessMean * 100)}/100 to ${Math.round(c.jawTightnessMean * 100)}/100 — again, movement observed, not proof of clenching.`);
            if (Math.abs(c.timeOutsideForwardPercent - p.camera.timeOutsideForwardPercent) >= 10) notes.push(`Time outside your forward head range changed from ${p.camera.timeOutsideForwardPercent}% to ${c.timeOutsideForwardPercent}% — check whether your screen position changed.`);
          }
          if (notes.length === 0) notes.push('Nothing stood out sharply against your last session, or this is your first comparable session. The detailed indicator cards below still show every number from this scan, so you can spot smaller changes yourself.');
          return <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>;
        })()}
        <p className="small muted">These notes compare camera numbers with your own previous session only. They describe movement, not causes, and they are not diagnoses.</p>
      </section>

      <div className="grid g3" style={{ marginTop: 16 }}>
        <section className="card"><h2>How you felt</h2>
          <p>Stress: {session.selfReport.stress ?? '—'} / 10</p><p>Fatigue: {session.selfReport.fatigue ?? '—'} / 10</p>
          <p>Eye discomfort: {session.selfReport.eyeDiscomfort ?? '—'} / 10</p><p>Jaw discomfort: {session.selfReport.jawDiscomfort ?? '—'} / 10</p>
          <p>Energy (context only): {session.selfReport.energy ?? '—'} / 10</p>
          {session.selfReport.sleepHours !== undefined && <p>Sleep entered: {session.selfReport.sleepHours} h</p>}
          {session.selfReport.screenHours !== undefined && <p>Screen time entered: {session.selfReport.screenHours} h</p>}
          {session.selfReport.activity && <p>Activity: {session.selfReport.activity}</p>}
        </section>
        <section className="card"><h2>What the camera observed</h2>
          <p>Blinks: {c.blinkCount} · {c.blinksPerMinute !== null ? `${c.blinksPerMinute} blinks/min (rate estimate)` : 'rate unavailable — too short'}</p>
          <p>Eyes closed: {c.eyesClosedPercent}% of valid time</p>
          <p>Jaw-opening events: {c.jawOpenEvents} · Brow movement (variability): {c.browMovement}</p>
          <p>Head movement variability: {c.headVariability}° · Time outside forward range: {c.timeOutsideForwardPercent}%</p>
          <p className="small muted">These are movement observations. They are not stress, emotion, or health ratings.</p>
        </section>
        <section className="card"><h2>What you could try</h2>
          <ol>{session.suggestions.slice(0, 3).map(s => <li key={s.id}><strong>{s.title}</strong> — {s.activity} <span className="muted">({s.duration})</span></li>)}</ol>
          <p className="small muted">Choose what fits your situation. Nothing here promises a higher score.</p>
        </section>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>What the scan assessed — colour-matched indicators</h2>
        <p className="small muted">Each indicator is coloured with the same spectrum as the score (sage = most comfortable, peach = least comfortable), and always labelled with a number. Self-report is the authority for feelings; camera cards are movement / appearance observations only, not diagnoses. Experimental appearance cards have no colour band, on purpose.</p>
        {(() => {
          const sameDay = [...history.filter(s => s.createdAt.slice(0, 10) === session.createdAt.slice(0, 10)), session].filter((s, i, a) => a.findIndex(x => x.id === s.id) === i);
          const scored = sameDay.map(s => s.score).filter((x): x is number => x !== null);
          const meanDay = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
          const band = bandForComfort(meanDay);
          return scored.length > 0 ? <p><span className="pill" style={{ background: band.color ?? undefined }}>● This day’s average: {meanDay}/100 · {band.label}</span> <span className="small muted">Average of {scored.length} scored check-in{scored.length === 1 ? '' : 's'} on {session.createdAt.slice(0, 10)}. The calendar colours this day with exactly this average.</span></p> : null;
        })()}
        <div className="grid g3">
          {buildIndicators(session).map(ind => (
            <article className="card" key={ind.id} style={{ padding: 16 }}>
              <h3>{ind.name}</h3>
              <p><span className="pill" style={{ background: ind.color ?? '#f0ede6' }}>● {ind.label ?? 'No band — experimental / not answered'}</span></p>
              <p className="small"><strong>{ind.display}</strong></p>
              <p className="small"><strong>How:</strong> {ind.method}</p>
              <p className="small muted"><strong>Limit:</strong> {ind.limitation}</p>
              <p className="small muted">Source: {ind.kind === 'self-report' ? 'Your self-report' : ind.kind === 'camera' ? 'Camera observation' : 'Derived from camera indicators'}</p>
            </article>
          ))}
        </div>
      </section>

      <details style={{ marginTop: 24 }}><summary><h2 style={{ display: 'inline' }}>Detailed metrics</h2> <span className="small muted">(expand for every number)</span></summary>
      <div className="grid g3">
        <MetricCard title="Blinks" value={String(c.blinkCount)} unit="count" desc="Raw count in this scan, not a rate. Use the rate for comparisons across scan lengths." source="Camera" limitation="Blinks can be missed in poor light or when the face is partly occluded." comparison={prev.length ? `${prev[0].camera.blinkCount} in last session` : undefined} />
        <MetricCard title="Blinks per minute" value={c.blinksPerMinute !== null ? String(c.blinksPerMinute) : '—'} unit="blinks/min" desc="Count divided by valid observation time. A rate estimate, clearly labelled." source="Camera" limitation="Unstable in very short scans; unavailable under 10 s of valid time." comparison={cmp('blinksPerMinute')} />
        <MetricCard title="Median blink duration" value={c.medianBlinkDurationMs !== null ? String(c.medianBlinkDurationMs) : '—'} unit="ms" desc="Median duration of detected blinks." source="Camera" limitation="Depends on frame rate and threshold calibration; not a clinical measure." />
        <MetricCard title="Eyes closed" value={String(c.eyesClosedPercent)} unit="% of valid time" desc="Share of valid time with eyes classified as closed by the calibrated threshold." source="Camera" limitation="Thresholds are calibrated per session; lighting changes the estimate." comparison={cmp('eyesClosedPercent')} />
        <MetricCard title="Jaw-opening activity" value={String(c.jawOpenMean)} unit="mean blendshape coefficient" desc="Mean jawOpen model coefficient. Movement observation only — not proof of jaw clenching." source="Camera" limitation="Blendshape values are model coefficients, not muscle measurements." />
        <MetricCard title="Brow movement" value={String(c.browMovement)} unit="variability" desc="Variability of brow blendshape coefficients during the scan." source="Camera" limitation="Not an emotion reading. Brow movement has many ordinary causes." />
        <MetricCard title="Lip-press activity" value={String(c.lipPressMean)} unit="mean coefficient" desc="Mean lip-press blendshape coefficient where supported." source="Camera" limitation="Model coefficient only; support varies by device and lighting." />
        <MetricCard title="Head yaw / pitch / roll" value={`${c.yawMean}° / ${c.pitchMean}° / ${c.rollMean}°`} desc="Mean head orientation relative to the camera, from facial transformation matrices." source="Camera" limitation="This is not a full-body posture assessment." />
        <MetricCard title="Head movement variability" value={String(c.headVariability)} unit="° (yaw std. dev.)" desc="How much yaw varied during the scan." source="Camera" limitation="A still head is not healthier than a moving one; no direction is assumed good or bad." />
        <MetricCard title="Scan quality" value={`${c.usablePercent}%`} unit="usable frames" desc={`${c.framesValid} of ${c.framesAttempted} frames usable · ${c.interruptions} interruptions · ${c.noFaceFrames} no-face frames · ${c.multipleFaceFrames} multi-face frames.`} source="Camera" limitation="Poor quality weakens every camera comparison in this session." />
      </div>

      </details>
      {prevScored && session.score !== null && prevScored.score !== null && (
        <section className="card" style={{ marginTop: 16 }}><h2>Personal comparison</h2>
          <p>Your last scored check-in was {prevScored.score}/100 ({prevScored.scoreLabel}) on {new Date(prevScored.createdAt).toLocaleDateString()}. This session is {session.score - prevScored.score > 0 ? `${session.score - prevScored.score} points higher` : session.score - prevScored.score < 0 ? `${prevScored.score - session.score} points lower` : 'the same'} — described as a change in reported comfort, not as an improvement or decline in health.</p>
          <p className="small muted">Comparisons use your own sessions only. Sessions with different item coverage are less directly comparable.</p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Pulse Portrait</h2>
        <p className="small">See your pulse through your webcam — without touching anything. Small changes in the light reflected from your skin can contain a pulse-related signal. OptiFlow extracts an estimate from your camera.</p>
        {session.pulse ? (
          <><p><strong>{session.pulse.bpm !== null ? `Estimated pulse: ${session.pulse.bpm} BPM` : 'No accepted pulse estimate'}</strong> {session.pulse.bpm !== null && `(SNR ${session.pulse.snr}, method ${session.pulse.method})`}</p>
          <p className="small">Usable observation: {session.pulse.usableSeconds}s · Quality: {session.pulse.quality} · {session.pulse.unavailableReason ?? ''}</p>
          {session.pulse.waveform.length > 0 && (
            <div>
              <p className="small"><strong>Recovered pulse-related waveform</strong> — window {session.pulse.waveformWindowStartSec.toFixed(1)}–{session.pulse.waveformWindowEndSec.toFixed(1)} s of the scan. Vertical axis: normalized amplitude (unitless, after normalisation). This is NOT an ECG curve and NOT a contact-sensor PPG waveform.</p>
              <svg viewBox="0 0 600 160" style={{ width: '100%', background: '#F7F5F0', borderRadius: 12 }} role="img" aria-label="Recovered pulse waveform">
                <line x1="0" y1="80" x2="600" y2="80" stroke="#e3ded2" />
                {(() => {
                  const pts = session.pulse!.waveform;
                  const max = Math.max(...pts.map(p => Math.abs(p.value)), 0.001);
                  let d = '';
                  pts.forEach((pt, i) => {
                    const x = pts.length > 1 ? i / (pts.length - 1) * 600 : 0;
                    const y = 80 - (pt.value / max) * 60;
                    if (!pt.valid) { d += ''; return; }
                    d += (d === '' || pts[i - 1]?.valid === false ? `M ${x} ${y}` : ` L ${x} ${y}`);
                  });
                  return <path d={d} fill="none" stroke="#7a8fa3" strokeWidth="2" />;
                })()}
              </svg>
              <p className="small muted">Gaps in the line are excluded data (invalid samples) — the waveform is NOT interpolated across long invalid gaps to look complete. Display smoothing, if any, is separate from the measurement; the plotted values are the accepted window's filtered signal.</p>
            </div>
          )}
          {session.pulse.estimates.length > 1 && (
            <div><p className="small"><strong>BPM over time (separate from the waveform above):</strong></p>
            <ul>{session.pulse.estimates.map((e, i) => <li key={i} className="small">{e.windowStartSec.toFixed(0)}–{e.windowEndSec.toFixed(0)} s: {e.bpm} BPM (SNR {e.snr}, processing {e.latencyMs} ms, coverage {e.coveragePct}%)</li>)}</ul></div>
          )}
          <p className="small muted">How it was obtained: POS rPPG on forehead + cheek skin RGB means from raw video (10 s windows, re-analysed every 2 s, 0.7–4.0 Hz band, SNR ≥ 2.0 gate, motion and illumination gates). Landmarks aligned the regions; landmark coordinates alone do not contain the skin-colour signal. This estimate is experimental and unvalidated against a reference pulse device — no accuracy is claimed, and it must not be used to infer stress, blood pressure, oxygen saturation, or cardiovascular health.</p></>
        ) : (
          <p className="small">Pulse Portrait was off for this session, or this session was created before Pulse Portrait existed. No pulse estimate is shown, and none is invented.</p>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Estimated sleepiness — experimental ML</h2>
        {session.mlPrediction ? (
          <><p><strong>Estimated KSS: {session.mlPrediction.predictedKss} / 9</strong> (model {session.mlPrediction.modelId} v{session.mlPrediction.modelVersion}, features {session.mlPrediction.featureVersion}). This is an <em>estimate</em> from an identified model, not an observation and not how you feel.</p>
          <details><summary>Feature contributions (how the model calculated this, not causes of sleepiness)</summary><ul>{session.mlPrediction.contributions.map(c => <li key={c.feature} className="small">{c.feature}: {c.contribution > 0 ? '+' : ''}{c.contribution}</li>)}</ul></details>
          <p className="small muted">If this estimate does not match how you feel, use the correction below — it is saved for later retraining and does not instantly change the model.</p>
          <label>Correction: how sleepy do you actually feel? (KSS 1–9)</label>
          <select value={session.mlPrediction.userCorrectionKss ?? ''} onChange={e => { if (session.mlPrediction) session.mlPrediction.userCorrectionKss = e.target.value ? Number(e.target.value) : undefined; if (!session.isDemo) store.saveSession(session); }}>
            <option value="">No correction</option>{[1,2,3,4,5,6,7,8,9].map(v => <option key={v} value={v}>{v}</option>)}
          </select></>
        ) : (
          <><p><strong>Model evaluation pending — no estimate is shown.</strong></p>
          <p className="small">No trained KSS model artifact exists yet, so OptiFlow deliberately shows no ML sleepiness estimate for this session — and it does not substitute the camera check-in score, your self-report, or a random value in its place. When a model is trained on permitted labeled data and evaluated on held-out participants, its version, evaluation, and feature contributions will appear here.</p>
          {session.mlFeatures && <details><summary>Features collected for future training (optiflow-features-v2)</summary>
            <ul>{session.mlFeatures.featureNames.map((n, i) => <li key={n} className="small">{n}: {session.mlFeatures!.values[i] ?? 'unavailable (null)'}</li>)}</ul>
            <p className="small">Label (KSS, collected before any prediction): {session.mlFeatures.labelKss ?? 'not answered'} · Missing: {session.mlFeatures.missing.join(', ') || 'none'} · Quality flags: {session.mlFeatures.qualityFlags.join(', ') || 'none'} · Source: {session.mlFeatures.sourceId} · Split: {session.mlFeatures.split ?? 'unassigned'}</p>
            <p className="small muted">Synthetic fixtures are never used as training labels. External datasets (UTA-RLDD, YawDD, CogBeacon, UBFC-rPPG, COHFACE, UBFC-Phys) are research references only — none has trained a model yet. See Inside OptiFlow.</p>
          </details>}
          {session.selfReport.kss !== undefined && <p className="small">Your KSS answer for this session: <strong>{session.selfReport.kss}/9</strong> — this is self-reported, not estimated.</p>}</>
        )}
        <p className="small muted">Observed = measured facial events · Self-reported = your answers · Estimated = an identified model's output. These three are kept separate throughout OptiFlow.</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>What was measured — and what was not</h2>
        <p className="small">Bilateral blinks: {c.blinkCount} · Left-eye closures: {c.leftBlinkCount ?? '—'} · Right-eye closures: {c.rightBlinkCount ?? '—'} · Censored closures (tracking lost mid-closure): {c.censoredBlinkCount ?? '—'} · Sustained closures (&gt;1.2 s): {c.sustainedClosureCount ?? '—'} · Eye-closure fraction: {c.eyeClosureFraction ?? Math.round(c.eyesClosedPercent / 100 * 1000) / 1000} · Effective sampling: {c.effectiveSamplingHz ?? c.samplingHz} Hz · Measurement version: {c.measurementVersion ?? 'pre-v2'}</p>
        <p className="small muted">Blink timing is unavailable when effective sampling is below 10 Hz. Blendshape coefficients are model coefficients, not muscle-tension or emotion measurements. Head summaries describe head orientation only, not posture.</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}><h2>Personal next steps — based on your camera score, in detail</h2>
        <p className="small muted">These recommendations were selected from camera numbers alone, ordered by your weakest camera component first. Each one gives you concrete steps to do, not just a label. Nothing here promises a higher score or a treatment.</p>
        {session.suggestions.map(s => (
          <article key={s.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            <h3>{s.title} · {s.duration}</h3><p className="small"><strong>Why this appeared:</strong> {s.why}</p><p>{s.activity}</p>
            {s.steps && <ol>{s.steps.map((step, i) => <li key={i} className="small">{step}</li>)}</ol>}
            {s.detail && <p className="small muted">{s.detail}</p>}
            <p className="small">Was this helpful? <button className="btn small secondary" onClick={() => feedback(s.id, 'helpful')}>Helpful</button> <button className="btn small secondary" onClick={() => feedback(s.id, 'not-for-me')}>Not for me</button> {session.feedback?.[s.id] && <span className="muted">Saved: {session.feedback[s.id]}</span>}</p>
            {s.activityId && <button className="btn small secondary" onClick={onReset}>Start this reset →</button>}
          </article>
        ))}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <label>Add a note</label><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={save}>{saved ? '✓ Saved' : 'Save check-in'}</button>
          <button className="btn secondary" onClick={onReset}>Start a reset</button>
          <button className="btn secondary" onClick={() => { session.note = note; onAddNote(note); }}>Save note</button>
        </div>
        <p className="small muted">Saving stores only this summary — no video or face image.{syncState ? ` Sync status: ${syncState}.` : ''} {session.cloud?.synced ? 'This session is in your cloud history.' : session.cloud ? 'This session is on this device only (not synced).' : ''}</p>
      </section>
      {showWhy && <ShowMeWhyModal session={session} replay={replay} onClose={() => setShowWhy(false)} onSaveReplay={replay ? async () => { await store.saveSession({ ...session, replay }); onSaved(); } : undefined} />}
    </div>
  );
}
