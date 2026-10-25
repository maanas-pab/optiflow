import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Session, MeshReplay, ReplayEvent } from '../types';
import { drawDetailedMesh, interpolateLandmarks, type MeshRegion } from '../lib/faceMesh';

/**
 * "Show me why" — mesh-only replay modal.
 *
 * Shows NO camera video, NO face photograph, NO skin texture: only the
 * landmark mesh on a clean ivory background, reconstructed from the
 * bounded, timestamped replay record captured during THIS scan.
 * Older/saved sessions have no replay record, so they honestly show
 * "Replay unavailable" instead of a generic animation pretending to be
 * a replay.
 *
 * Accessibility: Escape dismisses, focus is contained in the modal and
 * restored to the button that opened it, X button top-right, scrollable
 * on small screens, stacked layout on mobile.
 *
 * Colour legend (same as the live mesh):
 *   dusty blue = observed movement · lavender = selected event
 *   muted amber = excluded / uncertain · sage = usable segment
 * Red is reserved for a labelled tracking issue only.
 *
 * Score honesty: the displayed final score is the camera-derived
 * composite (cameraScore.ts), NOT a trained ML score. The modal shows
 * its actual components and, for each event, whether it contributed.
 * The KSS sleepiness model has no trained artifact, so no ML
 * contributions are invented here — the modal says so explicitly.
 * Landmark-only storage is NOT anonymous: replay data is in memory
 * for this session by default and is only persisted if the user
 * explicitly saves it (see the save-replay control in the report).
 */
export default function ShowMeWhyModal({ session, replay, onClose, onSaveReplay }: {
  session: Session; replay?: MeshReplay; onClose: () => void; onSaveReplay?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [tSec, setTsec] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<ReplayEvent | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  const duration = replay?.durationSec ?? 0;
  const frames = replay?.frames ?? [];

  // Focus containment + restoration, Escape dismissal.
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const els = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
        if (!els.length) return;
        const first = els[0]; const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); (prevFocus.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);

  // Playback clock.
  useEffect(() => {
    if (!playing || !replay) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000 * speed; last = now;
      setTsec(prev => {
        const next = prev + dt;
        if (next >= duration) { setPlaying(false); return duration; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration, replay]);

  // Draw the mesh for the current replay time (interpolated between frames).
  const toPoints = (flat: number[]) => {
    const out: { x: number; y: number }[] = [];
    for (let k = 0; k < flat.length; k += 2) out.push({ x: flat[k], y: flat[k + 1] });
    return out;
  };
  const currentLandmarks = useMemo(() => {
    if (!frames.length) return null;
    let i = frames.findIndex(f => f.tSec >= tSec);
    if (i < 0) return toPoints(frames[frames.length - 1].landmarks);
    if (i === 0) return toPoints(frames[0].landmarks);
    const a = frames[i - 1]; const b = frames[i];
    const f = (tSec - a.tSec) / Math.max(0.001, b.tSec - a.tSec);
    const la = []; const lb = [];
    for (let k = 0; k < a.landmarks.length; k += 2) la.push({ x: a.landmarks[k], y: a.landmarks[k + 1] });
    for (let k = 0; k < b.landmarks.length; k += 2) lb.push({ x: b.landmarks[k], y: b.landmarks[k + 1] });
    return interpolateLandmarks(la, lb, Math.max(0, Math.min(1, f))).map(p => ({ x: p.x, y: p.y }));
  }, [frames, tSec]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !currentLandmarks) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = 480; canvas.height = 360;
    ctx.fillStyle = '#F7F5F0'; ctx.fillRect(0, 0, 480, 360);
    const region: MeshRegion = selected?.type === 'blink' || selected?.type === 'left_closure' ? 'leftEye'
      : selected?.type === 'right_closure' ? 'rightEye'
      : selected?.type === 'jaw_open' ? 'mouth'
      : selected?.type === 'head_turn' ? 'face' : 'none';
    drawDetailedMesh(ctx, currentLandmarks, 480, 360, { intensity: 0.95, highlight: region, showRoiOutlines: false });
  }, [currentLandmarks, selected]);

  const selectEvent = (ev: ReplayEvent) => { setSelected(ev); setTsec(ev.tStartSec); setPlaying(false); };
  const legend = [
    ['#7a8fa3', 'Dusty blue — observed movement'],
    ['#8a7fb8', 'Lavender — selected event'],
    ['#d8c97a', 'Muted amber — excluded / uncertain measurement'],
    ['#B9CDBB', 'Sage — usable measurement segment'],
  ];

  return (
    <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Show me why — mesh replay and explanation">
        <button ref={closeRef} className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <h2>Show me why</h2>
        <p className="small muted">Mesh only — no camera video, face photograph, or skin texture is shown here. The mesh below is reconstructed from landmarks recorded during this scan.</p>
        {!replay || frames.length === 0 ? (
          <div className="card">
            <h3>Replay unavailable</h3>
            <p>This session has no recorded mesh geometry — for example, it was opened from history, or the camera was not used. A generic animation would not be a replay, so none is shown.</p>
            <p className="small">The score explanation below still uses the session's actual recorded measurements and components.</p>
          </div>
        ) : (
          <div className="grid g2">
            <div>
              <div style={{ background: '#F7F5F0', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                <canvas ref={canvasRef} width={480} height={360} style={{ width: '100%', display: 'block' }} aria-label="Mesh-only replay of this scan" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                <button className="btn small" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
                <label>Time: {tSec.toFixed(1)} / {duration.toFixed(1)} s</label>
                <input type="range" min={0} max={duration} step={0.1} value={tSec} onChange={e => { setTsec(Number(e.target.value)); setPlaying(false); }} aria-label="Replay timeline" style={{ flex: 1 }} />
                <label>Speed</label>
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: 90 }}>
                  <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
                </select>
              </div>
              <p className="small muted">Replay frames were recorded every 200 ms; event markers carry exact timestamps, and blink durations come from the event record — interpolation never invents a blink's shape or duration.</p>
              {onSaveReplay && <button className="btn small secondary" onClick={onSaveReplay}>Save this replay with the check-in (optional)</button>}
              <p className="small muted">Replay data is temporary by default. Saving it stores landmark geometry with this check-in — landmark data can reconstruct face shape and movement, so it is personal data and is covered by the same export/delete controls.</p>
            </div>
            <div>
              <h3>{selected ? 'Selected event' : 'What happened, when'}</h3>
              {selected ? (
                <div className="card">
                  <p><strong>{selected.type.replace('_', ' ')} — {selected.tStartSec.toFixed(1)} s{selected.tEndSec !== undefined ? `–${selected.tEndSec.toFixed(1)} s` : ''}</strong></p>
                  <p className="small">What was observed: {selected.detail}</p>
                  <p className="small">Included: {selected.included ? 'Yes — this segment was used.' : 'No — excluded from measurements.'}</p>
                  <p className="small">Score: {selected.scoreNote}</p>
                  <button className="btn small secondary" onClick={() => setSelected(null)}>Back to all events</button>
                </div>
              ) : (
                <p className="small muted">Click an event marker below to highlight its mesh region and see what was observed, when, how it was measured, whether it was included, and whether it contributed to the score.</p>
              )}
              <h3>Event timeline</h3>
              <ul>
                {replay.events.map((ev, i) => (
                  <li key={i}><button className="btn small secondary" onClick={() => selectEvent(ev)}>{ev.tStartSec.toFixed(1)} s — {ev.type.replace('_', ' ')}</button> <span className="small muted">{ev.included ? '● usable' : '● excluded'}</span></li>
                ))}
              </ul>
              {replay.events.length === 0 && <p className="small">No events were recorded in this scan.</p>}
            </div>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <h3>Legend</h3>
          <p className="small">{legend.map(([c, l]) => <span key={l} style={{ marginRight: 14 }}><span style={{ color: c }}>●</span> {l}</span>)}</p>
          <h3>Why this score?</h3>
          {session.score !== null ? (
            <><p className="small">The final score ({session.score}/100) comes from <strong>rules, not a trained model</strong>: Eye comfort × 40% + Tension-related movement × 30% + Blink stability × 15% + Head steadiness × 15%, computed only from camera observations. It is a transparent composite, not learned ML — and it is not a stress, fatigue, or health measurement.</p>
            {session.cameraScoreComponents && <ul>{session.cameraScoreComponents.map(cmp => <li key={cmp.name} className="small">{cmp.name} ({cmp.weight}%): {cmp.value}/100 — {cmp.detail}</li>)}</ul>}
            <p className="small">Confidence: {session.cameraScoreConfidence ?? '—'}. Measurement quality: {session.camera.usablePercent}% usable frames, {session.camera.validSeconds}s valid, {session.camera.interruptions} interruptions.</p></>
          ) : (
            <p className="small">No final score was given for this session (insufficient camera data or camera not used). The mesh above, when available, is accompanying observation only — it is not the basis of a score, and no score was invented.</p>
          )}
          <p className="small">Sleepiness model: no trained KSS model exists yet, so no ML feature contributions are shown — inventing them would be false. When a trained, evaluated model exists, its actual contributions and unavailable inputs will appear here. Feature contributions, when shown, describe how a model calculated its output — not causes of fatigue.</p>
          {session.pulse && <p className="small">Pulse Portrait (this session): {session.pulse.bpm !== null ? `${session.pulse.bpm} BPM (estimated, POS rPPG, ${session.pulse.methodVersion})` : 'no accepted estimate'}. The mesh cannot replay the subtle RGB changes that produced the pulse estimate — see the Pulse Portrait waveform in the report for that branch.</p>}
          <p className="small muted">Comparable history: {(() => { const prev = null; void prev; return 'shown in the report only when measurements and collection context are compatible; otherwise “Not enough comparable history” is shown there.'; })()}</p>
        </div>
      </div>
    </div>
  );
}
