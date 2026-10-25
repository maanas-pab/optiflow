import React, { useEffect, useRef, useState } from 'react';
import type { CameraMetrics, SelfReport, Session, MeshReplay, ReplayFrame, ReplayEvent, PulseResult, PulseEstimateRecord } from '../types';
import { startCamera, stopCamera, listCameras, cameraErrorMessage } from '../lib/camera';
import { loadLandmarker, earFromLandmarks, blendshapeValue, eulerFromMatrix, sampleAppearance, sampleSkinRgb, type AppearanceSample } from '../lib/mediapipe';
import { drawDetailedMesh, type MeshRegion } from '../lib/faceMesh';
import { analyseRppgWindow, RPPG_VERSION, RPPG_WINDOW_SEC, RPPG_UPDATE_SEC, type RppgSample, type PulseState } from '../lib/rppg';
import { createBlinkState, updateBlink, censorBlink, median, mean, stddev, validSecondsFromTimestamps } from '../lib/metrics';
import { buildFeatureVector, FEATURE_NAMES } from '../lib/measurements';
import { KSS_LABELS } from '../types';
import { computeScore } from '../lib/scoring';
import { computeCameraScore } from '../lib/cameraScore';
import { buildSuggestions } from '../lib/recommendations';
import Halo from '../components/Halo';
import LiveGraphs, { type LivePoint } from '../components/LiveGraphs';

type Phase = 'consent' | 'report' | 'baseline' | 'live' | 'done';
const clamp = (x: number) => Math.max(0, Math.min(1, x));

interface Acc {
  attempted: number; valid: number; timestamps: number[]; noFace: number; multi: number;
  interruptions: number; wasValid: boolean; blink: ReturnType<typeof createBlinkState>;
  blinkLeft: ReturnType<typeof createBlinkState>; blinkRight: ReturnType<typeof createBlinkState>;
  low: number; high: number; earBaseline: number | null; headRef: { yaw: number; pitch: number; roll: number } | null;
  jaw: number[]; brow: number[]; lip: number[]; yaw: number[]; pitch: number[]; roll: number[];
  outsideMs: number; validMs: number; lastFrameMs: number | null; baselineEars: number[]; baselineHeads: { yaw: number; pitch: number; roll: number }[];
  browRaise: number[]; furrow: number[]; earVals: number[]; gazeX: number[]; gazeY: number[]; jawTight: number[];
  lastEar: number; lastBrow: number; lastJaw: number; lastLip: number; lastBrowRaise: number; lastFurrow: number;
  appearanceBaseline: AppearanceSample[]; appearanceLive: AppearanceSample[]; frameSinceAppearance: number;
}

function calcFatigue(acc: Acc): number {
  const eyeOpen = mean(acc.earVals) ?? acc.earBaseline ?? 0.25;
  const ratio = acc.earBaseline ? clamp(eyeOpen / acc.earBaseline) : 1;
  const validSec = acc.validMs / 1000;
  const bpm = validSec > 0 ? acc.blink.blinks / (validSec / 60) : 18;
  const blinkDev = clamp(Math.abs(bpm - 18) / 18);
  const gaze = clamp((stddev(acc.gazeX) + stddev(acc.gazeY)) / 0.05);
  const tension = clamp(((mean(acc.browRaise) ?? 0) + (mean(acc.furrow) ?? 0) + (mean(acc.jawTight) ?? 0)) / 1.2);
  return Math.round(clamp(0.35 * (1 - ratio) + 0.25 * blinkDev + 0.2 * gaze + 0.2 * tension) * 100);
}

export default function ScanFlow({ onComplete, onExit }: { onComplete: (s: Session, replay?: MeshReplay) => void; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('consent');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [report, setReport] = useState<SelfReport>({});
  const [targetSec, setTargetSec] = useState(60);
  const [showMesh, setShowMesh] = useState(true);
  const [showGraphs, setShowGraphs] = useState(true);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState({ validSec: 0, usable: 100, blinks: 0, closedPct: 0, remaining: 60, quality: 'Good' });
  const [history, setHistory] = useState<LivePoint[]>([]);
  const [baselineMsg, setBaselineMsg] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [meshIntensity, setMeshIntensity] = useState(0.85);
  const [pulseEnabled, setPulseEnabled] = useState(true);
  const [pulse, setPulse] = useState<{ state: PulseState; bpm: number | null; snr: number | null; text: string; latencyMs: number | null }>({ state: 'preparing', bpm: null, snr: null, text: 'Preparing camera…', latencyMs: null });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appearanceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rppgSamplesRef = useRef<RppgSample[]>([]);
  const pulseEstimatesRef = useRef<PulseEstimateRecord[]>([]);
  const lastPulseAnalysisRef = useRef(0);
  const lastAcceptedPulseRef = useRef<{ bpm: number; snr: number; waveform: { tSec: number; value: number; valid: boolean }[]; windowStartSec: number; windowEndSec: number } | null>(null);
  const replayRef = useRef<{ frames: ReplayFrame[]; events: ReplayEvent[]; startMs: number } | null>(null);
  const lastReplayFrameRef = useRef(0);
  const rippleRef = useRef<{ region: MeshRegion; atMs: number } | null>(null);
  const prevCountsRef = useRef({ blink: 0, left: 0, right: 0, jawAbove: false, headOutside: false });
  const pulseStateRef = useRef<PulseState>('preparing');
  const meshIntensityRef = useRef(0.85); const pulseEnabledRef = useRef(true);
  meshIntensityRef.current = meshIntensity; pulseEnabledRef.current = pulseEnabled;
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const accRef = useRef<Acc | null>(null);
  const phaseRef = useRef<Phase>('consent');
  const pausedRef = useRef(false);
  const targetRef = useRef(60);
  const lastUiRef = useRef(0);
  phaseRef.current = phase; pausedRef.current = paused; targetRef.current = targetSec;

  const newAcc = (): Acc => ({ attempted: 0, valid: 0, timestamps: [], noFace: 0, multi: 0, interruptions: 0, wasValid: false, blink: createBlinkState(), blinkLeft: createBlinkState(), blinkRight: createBlinkState(), low: 0.18, high: 0.22, earBaseline: null, headRef: null, jaw: [], brow: [], lip: [], yaw: [], pitch: [], roll: [], outsideMs: 0, validMs: 0, lastFrameMs: null, baselineEars: [], baselineHeads: [], browRaise: [], furrow: [], earVals: [], gazeX: [], gazeY: [], jawTight: [], lastEar: 0.25, lastBrow: 0, lastJaw: 0, lastLip: 0, lastBrowRaise: 0, lastFurrow: 0, appearanceBaseline: [], appearanceLive: [], frameSinceAppearance: 0 });

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); stopCamera(streamRef.current); }, []);
  useEffect(() => {
    if (cameraOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase, cameraOn]);

  async function enableCamera() {
    setError('');
    try {
      setLoading('Starting camera (video only)…');
      const stream = await startCamera(cameraId);
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCameras(await listCameras()); setCameraOn(true); setLoading('');
    } catch (e) { setLoading(''); setError(cameraErrorMessage(e)); }
  }
  async function changeCamera(id: string) {
    stopCamera(streamRef.current); setCameraId(id || undefined);
    try { const s = await startCamera(id || undefined); streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); } } catch (e) { setError(cameraErrorMessage(e)); }
  }

  function processFrame(nowMs: number) {
    const video = videoRef.current; const lm = landmarkerRef.current; const acc = accRef.current;
    if (!video || !lm || !acc || video.readyState < 2) return;
    acc.attempted += 1;
    let result: any;
    try { result = lm.detectForVideo(video, nowMs); } catch { return; }
    const faces = result?.faceLandmarks ?? [];
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (canvas && video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    if (faces.length === 0) { acc.noFace += 1; if (acc.wasValid) { acc.interruptions += 1; acc.wasValid = false; }
      if (phaseRef.current === 'live' && replayRef.current) {
        const tSec = Math.round((nowMs - replayRef.current.startMs) / 1000 * 10) / 10;
        replayRef.current.events.push({ type: 'interruption', tStartSec: tSec, detail: 'Face tracking lost (no face detected). This segment is excluded from measurements.', included: false, scoreNote: 'Excluded — interruptions do not contribute to the score.' });
      }
      // Pulse: a lost face means the last BPM is stale, not current.
      if (phaseRef.current === 'live' && pulseStateRef.current === 'available') {
        pulseStateRef.current = 'interrupted';
        setPulse({ state: 'interrupted', bpm: null, snr: null, text: 'Signal interrupted — face tracking lost. The last BPM is not shown as current. Resume only after reacquiring sufficient usable data.', latencyMs: null });
      }
      // Censor any in-progress closure: tracking loss must not create a blink later.
      acc.blink = censorBlink(acc.blink); acc.blinkLeft = censorBlink(acc.blinkLeft); acc.blinkRight = censorBlink(acc.blinkRight);
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    if (faces.length > 1) { acc.multi += 1; if (acc.wasValid) { acc.interruptions += 1; acc.wasValid = false; }
      acc.blink = censorBlink(acc.blink); acc.blinkLeft = censorBlink(acc.blinkLeft); acc.blinkRight = censorBlink(acc.blinkRight);
      return; }
    const landmarks = faces[0];
    acc.valid += 1; acc.wasValid = true;
    const frameMs = acc.lastFrameMs === null ? 33 : Math.min(Math.max(nowMs - acc.lastFrameMs, 0), 500);
    acc.lastFrameMs = nowMs; acc.timestamps.push(nowMs);
    const earL = earFromLandmarks(landmarks, true); const earR = earFromLandmarks(landmarks, false);
    const ear = (earL + earR) / 2;
    const cats = result.faceBlendshapes?.[0]?.categories;
    const jaw = blendshapeValue(cats, 'jawOpen');
    const browRaise = (blendshapeValue(cats, 'browInnerUp') + blendshapeValue(cats, 'browOuterUpLeft') + blendshapeValue(cats, 'browOuterUpRight')) / 3;
    const furrow = (blendshapeValue(cats, 'browDownLeft') + blendshapeValue(cats, 'browDownRight')) / 2;
    const brow = (browRaise + furrow) / 2;
    const lip = Math.max(blendshapeValue(cats, 'mouthPressLeft'), blendshapeValue(cats, 'mouthPressRight'));
    const eyeLx = (landmarks[33].x + landmarks[133].x) / 2; const eyeLy = (landmarks[33].y + landmarks[133].y) / 2;
    const eyeRx = (landmarks[362].x + landmarks[263].x) / 2; const eyeRy = (landmarks[362].y + landmarks[263].y) / 2;
    if (phaseRef.current === 'baseline') {
      acc.baselineEars.push(ear);
      const m = result.facialTransformationMatrixes?.[0]?.facialTransformationMatrix;
      if (m) acc.baselineHeads.push(eulerFromMatrix(Array.from(m)));
      acc.frameSinceAppearance += 1;
      if (acc.frameSinceAppearance >= 10) {
        acc.frameSinceAppearance = 0;
        if (!appearanceCanvasRef.current) appearanceCanvasRef.current = document.createElement('canvas');
        const s = sampleAppearance(video, landmarks, appearanceCanvasRef.current);
        if (s) acc.appearanceBaseline.push(s);
      }
    } else if (phaseRef.current === 'live') {
      acc.validMs += frameMs;
      acc.blink = updateBlink(acc.blink, ear, nowMs, frameMs, acc.low, acc.high, acc.earBaseline);
      acc.blinkLeft = updateBlink(acc.blinkLeft, earL, nowMs, frameMs, acc.low, acc.high, acc.earBaseline);
      acc.blinkRight = updateBlink(acc.blinkRight, earR, nowMs, frameMs, acc.low, acc.high, acc.earBaseline);
      // --- Replay events (real, timestamped) + mesh ripples ---
      if (replayRef.current) {
        const tSec = Math.round((nowMs - replayRef.current.startMs) / 1000 * 10) / 10;
        const pc = prevCountsRef.current;
        if (acc.blink.blinks > pc.blink) {
          const dur = acc.blink.durationsMs[acc.blink.durationsMs.length - 1] ?? 250;
          replayRef.current.events.push({ type: 'blink', tStartSec: Math.max(0, Math.round((tSec - dur / 1000) * 10) / 10), tEndSec: tSec, detail: `Bilateral blink, ${dur} ms (EAR below low threshold, then above high threshold).`, included: true, scoreNote: 'Contributes to blink rate and blink-stability component of the camera score.' });
          rippleRef.current = { region: 'leftEye', atMs: nowMs };
        } else if (acc.blinkLeft.blinks > pc.left) {
          replayRef.current.events.push({ type: 'left_closure', tStartSec: tSec, detail: 'Left-eye-only closure (unilateral). Counted separately — it is NOT a bilateral blink.', included: true, scoreNote: 'Recorded for the mesh timeline; only bilateral blinks feed the blink-rate component.' });
          rippleRef.current = { region: 'leftEye', atMs: nowMs };
        } else if (acc.blinkRight.blinks > pc.right) {
          replayRef.current.events.push({ type: 'right_closure', tStartSec: tSec, detail: 'Right-eye-only closure (unilateral). Counted separately — it is NOT a bilateral blink.', included: true, scoreNote: 'Recorded for the mesh timeline; only bilateral blinks feed the blink-rate component.' });
          rippleRef.current = { region: 'rightEye', atMs: nowMs };
        }
        pc.blink = acc.blink.blinks; pc.left = acc.blinkLeft.blinks; pc.right = acc.blinkRight.blinks;
        const jawAbove = jaw > 0.35;
        if (jawAbove && !pc.jawAbove) {
          replayRef.current.events.push({ type: 'jaw_open', tStartSec: tSec, detail: `Jaw-opening event: jawOpen blendshape crossed 0.35 (value ${jaw.toFixed(2)}). Blendshape coefficient, not a muscle measurement.`, included: true, scoreNote: 'Contributes to jaw-opening activity and tension-related movement.' });
          rippleRef.current = { region: 'mouth', atMs: nowMs };
        }
        pc.jawAbove = jawAbove;
      }
      acc.jaw.push(jaw); acc.brow.push(brow); acc.lip.push(lip);
      acc.browRaise.push(browRaise); acc.furrow.push(furrow); acc.earVals.push(ear);
      acc.gazeX.push((eyeLx + eyeRx) / 2); acc.gazeY.push((eyeLy + eyeRy) / 2);
      acc.jawTight.push(lip * (1 - clamp(jaw)));
      acc.lastEar = ear; acc.lastBrow = brow; acc.lastJaw = jaw; acc.lastLip = lip; acc.lastBrowRaise = browRaise; acc.lastFurrow = furrow;
      acc.frameSinceAppearance += 1;
      if (acc.frameSinceAppearance >= 10) {
        acc.frameSinceAppearance = 0;
        if (!appearanceCanvasRef.current) appearanceCanvasRef.current = document.createElement('canvas');
        const s = sampleAppearance(video, landmarks, appearanceCanvasRef.current);
        if (s) acc.appearanceLive.push(s);
      }
      let curEuler = { yaw: 0, pitch: 0, roll: 0 };
      const m = result.facialTransformationMatrixes?.[0]?.facialTransformationMatrix;
      if (m) {
        const e = eulerFromMatrix(Array.from(m)); curEuler = e; acc.yaw.push(e.yaw); acc.pitch.push(e.pitch); acc.roll.push(e.roll);
        if (acc.headRef && (Math.abs(e.yaw - acc.headRef.yaw) > 15 || Math.abs(e.pitch - acc.headRef.pitch) > 12)) acc.outsideMs += frameMs;
        if (replayRef.current && acc.headRef && Math.abs(e.yaw - acc.headRef.yaw) > 15 && !prevCountsRef.current.headOutside) {
          const tSec = Math.round((nowMs - replayRef.current.startMs) / 1000 * 10) / 10;
          replayRef.current.events.push({ type: 'head_turn', tStartSec: tSec, detail: `Head turned outside the calibrated forward range (yaw ${e.yaw.toFixed(1)}° vs baseline ${acc.headRef.yaw.toFixed(1)}°).`, included: true, scoreNote: 'Contributes to head-steadiness component and time-outside-forward %.' });
        }
        prevCountsRef.current.headOutside = !!(acc.headRef && Math.abs(e.yaw - acc.headRef.yaw) > 15);
      }
      // --- Pulse Portrait sampling: RAW video only, never the overlay canvas ---
      if (pulseEnabledRef.current) {
        if (!rppgCanvasRef.current) rppgCanvasRef.current = document.createElement('canvas');
        const skin = sampleSkinRgb(video, landmarks, rppgCanvasRef.current);
        rppgSamplesRef.current.push({ tMs: nowMs, r: skin?.r ?? 0, g: skin?.g ?? 0, b: skin?.b ?? 0, brightness: skin?.brightness ?? 0, yawDeg: curEuler.yaw, valid: skin !== null });
        if (rppgSamplesRef.current.length > 3600) rppgSamplesRef.current.splice(0, 600);
        // Rolling analysis every 2 s once 10 s of samples exist.
        if (nowMs - lastPulseAnalysisRef.current >= RPPG_UPDATE_SEC * 1000 && rppgSamplesRef.current.length > 2) {
          const spanSec = (nowMs - rppgSamplesRef.current[0].tMs) / 1000;
          if (spanSec >= RPPG_WINDOW_SEC) {
            lastPulseAnalysisRef.current = nowMs;
            const est = analyseRppgWindow(rppgSamplesRef.current.slice(-Math.ceil(RPPG_WINDOW_SEC * 60)));
            if (est.accepted) {
              lastAcceptedPulseRef.current = { bpm: est.bpm, snr: est.snr, waveform: est.waveform, windowStartSec: (est.windowStartMs - (replayRef.current?.startMs ?? est.windowStartMs)) / 1000, windowEndSec: (est.windowEndMs - (replayRef.current?.startMs ?? est.windowEndMs)) / 1000 };
              pulseEstimatesRef.current.push({ bpm: est.bpm, snr: est.snr, windowStartSec: lastAcceptedPulseRef.current.windowStartSec, windowEndSec: lastAcceptedPulseRef.current.windowEndSec, validSeconds: est.validSeconds, coveragePct: est.coveragePct, latencyMs: est.latencyMs });
              pulseStateRef.current = 'available';
              setPulse({ state: 'available', bpm: est.bpm, snr: est.snr, text: `Estimate available — ${est.bpm} BPM (window ${lastAcceptedPulseRef.current.windowStartSec.toFixed(0)}–${lastAcceptedPulseRef.current.windowEndSec.toFixed(0)} s, SNR ${est.snr}, processing ${est.latencyMs} ms)`, latencyMs: est.latencyMs });
            } else {
              pulseStateRef.current = 'estimating';
              setPulse(p => ({ ...p, state: 'estimating', text: est.rejectReason ?? 'Estimating pulse…' }));
            }
          } else {
            pulseStateRef.current = 'collecting';
            setPulse(p => ({ ...p, state: 'collecting', text: `Finding your pulse… collecting usable signal (${Math.floor(spanSec)} / ${RPPG_WINDOW_SEC} s). Sit still and face the light.` }));
          }
        }
      }
      // --- Bounded replay frames (every 200 ms, live phase only) ---
      if (replayRef.current && nowMs - lastReplayFrameRef.current >= 200) {
        lastReplayFrameRef.current = nowMs;
        const flat: number[] = [];
        for (const p of landmarks) { flat.push(Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000); }
        replayRef.current.frames.push({ tSec: Math.round((nowMs - replayRef.current.startMs) / 1000 * 10) / 10, landmarks: flat, yaw: curEuler.yaw, pitch: curEuler.pitch, roll: curEuler.roll, valid: true });
        if (replayRef.current.frames.length > 900) replayRef.current.frames.splice(0, 100);
      }
      if (acc.jaw.length > 6000) { acc.jaw.splice(0, 1000); acc.brow.splice(0, 1000); acc.lip.splice(0, 1000); acc.earVals.splice(0, 1000); }
    }
    if (ctx && canvas) {
      if (showMesh) {
        const ripples = rippleRef.current ? [{ region: rippleRef.current.region, ageSec: (nowMs - rippleRef.current.atMs) / 1000 }] : [];
        drawDetailedMesh(ctx, landmarks, canvas.width, canvas.height, { intensity: meshIntensityRef.current, ripples, showRoiOutlines: pulseEnabledRef.current });
      } else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (nowMs - lastUiRef.current > 250 && phaseRef.current === 'live') {
      lastUiRef.current = nowMs;
      const validSec = acc.validMs / 1000;
      const fatigue = calcFatigue(acc);
      const tension = Math.round(clamp(((mean(acc.browRaise) ?? 0) + (mean(acc.furrow) ?? 0) + (mean(acc.jawTight) ?? 0)) / 1.2) * 100);
      setLive({ validSec, usable: acc.attempted ? Math.round(acc.valid / acc.attempted * 100) : 100, blinks: acc.blink.blinks, closedPct: acc.validMs ? Math.round(acc.blink.closedMs / acc.validMs * 100) : 0, remaining: Math.max(0, Math.ceil(targetRef.current - validSec)), quality: acc.attempted && acc.valid / acc.attempted > 0.8 ? 'Good' : acc.attempted && acc.valid / acc.attempted > 0.5 ? 'Fair' : 'Poor' });
      setHistory(h => [...h.slice(-120), { t: validSec, blinks: acc.blink.blinks, eyeOpen: Math.round(acc.lastEar * 1000) / 10, brow: Math.round(acc.lastBrow * 1000) / 10, jaw: Math.round(acc.lastJaw * 1000) / 10, tension, fatigue, energy: 100 - fatigue, closedPct: acc.validMs ? Math.round(acc.blink.closedMs / acc.validMs * 100) : 0 }]);
    }
  }

  function loop(nowMs: number) {
    if ((phaseRef.current === 'baseline' || phaseRef.current === 'live') && !pausedRef.current) processFrame(nowMs);
    rafRef.current = requestAnimationFrame(loop);
  }

  async function startBaseline() {
    setError('');
    try {
      setLoading('Loading the on-device face model… This downloads model files from a CDN on first use. No video leaves your device.');
      landmarkerRef.current = await loadLandmarker();
      setLoading('');
      accRef.current = newAcc();
      setPhase('baseline'); setBaselineMsg('Sit comfortably and blink naturally. Hold a comfortable, forward-facing pose.');
      const started = performance.now();
      rafRef.current = requestAnimationFrame(loop);
      const check = () => {
        const acc = accRef.current!;
        if (performance.now() - started >= 5000) {
          const earMed = median(acc.baselineEars);
          acc.earBaseline = earMed;
          if (earMed) { acc.low = earMed * 0.65; acc.high = earMed * 0.85; }
          const heads = acc.baselineHeads;
          acc.headRef = heads.length ? { yaw: mean(heads.map(h => h.yaw)) ?? 0, pitch: mean(heads.map(h => h.pitch)) ?? 0, roll: mean(heads.map(h => h.roll)) ?? 0 } : null;
          const kept = { low: acc.low, high: acc.high, earBaseline: acc.earBaseline, headRef: acc.headRef, appearanceBaseline: acc.appearanceBaseline };
          accRef.current = { ...newAcc(), ...kept };
          replayRef.current = { frames: [], events: [], startMs: performance.now() };
          lastReplayFrameRef.current = 0; prevCountsRef.current = { blink: 0, left: 0, right: 0, jawAbove: false, headOutside: false };
          rppgSamplesRef.current = []; pulseEstimatesRef.current = []; lastAcceptedPulseRef.current = null; lastPulseAnalysisRef.current = 0;
          pulseStateRef.current = pulseEnabled ? 'collecting' : 'unavailable';
          setPulse(pulseEnabled ? { state: 'collecting', bpm: null, snr: null, text: 'Finding your pulse… collecting usable signal.', latencyMs: null } : { state: 'unavailable', bpm: null, snr: null, text: 'Pulse Portrait is off for this scan.', latencyMs: null });
          setPhase('live'); setBaselineMsg(''); setHistory([]);
          return;
        }
        setTimeout(check, 200);
      };
      check();
    } catch (e) { setLoading(''); setError('The face model could not be loaded. Check your connection and try again. ' + (e instanceof Error ? e.message : '')); }
  }

  function finishScan() {
    cancelAnimationFrame(rafRef.current);
    const acc = accRef.current;
    if (!acc) return;
    const validSec = validSecondsFromTimestamps(acc.timestamps) || acc.validMs / 1000;
    const wallSec = acc.timestamps.length > 1 ? (acc.timestamps[acc.timestamps.length - 1] - acc.timestamps[0]) / 1000 : 0;
    const blinkDur = median(acc.blink.durationsMs);
    const fatigue = calcFatigue(acc);
    const baseApp = (key: 'darkness' | 'redness' | 'brightness' | 'saturation') => median(acc.appearanceBaseline.map(a => a[key]));
    const liveApp = (key: 'darkness' | 'redness' | 'brightness' | 'saturation') => mean(acc.appearanceLive.map(a => a[key]));
    const change = (key: 'darkness' | 'redness' | 'brightness' | 'saturation') => {
      const b = baseApp(key); const l = liveApp(key);
      return b !== null && l !== null ? Math.round((l - b) * 10) / 10 : undefined;
    };
    const cam: CameraMetrics = {
      validSeconds: Math.round(validSec * 10) / 10, wallSeconds: Math.round(wallSec * 10) / 10,
      framesAttempted: acc.attempted, framesValid: acc.valid,
      usablePercent: acc.attempted ? Math.round(acc.valid / acc.attempted * 100) : 0,
      samplingHz: validSec ? Math.round(acc.valid / validSec * 10) / 10 : 0,
      interruptions: acc.interruptions, multipleFaceFrames: acc.multi, noFaceFrames: acc.noFace,
      blinkCount: acc.blink.blinks,
      blinksPerMinute: validSec >= 10 ? Math.round(acc.blink.blinks / (validSec / 60) * 10) / 10 : null,
      medianBlinkDurationMs: blinkDur, meanBlinkIntervalSec: mean(acc.blink.intervalsSec),
      eyesClosedPercent: acc.validMs ? Math.round(acc.blink.closedMs / acc.validMs * 1000) / 10 : 0,
      eyeClosureConsistency: null,
      jawOpenMean: Math.round((mean(acc.jaw) ?? 0) * 1000) / 1000,
      jawOpenEvents: acc.jaw.filter((v, i) => i > 0 && v > 0.35 && acc.jaw[i - 1] <= 0.35).length,
      mouthOpenEvents: acc.jaw.filter((v, i) => i > 0 && v > 0.5 && acc.jaw[i - 1] <= 0.5).length,
      browMovement: Math.round(stddev(acc.brow) * 1000) / 1000,
      lipPressMean: Math.round((mean(acc.lip) ?? 0) * 1000) / 1000,
      movementVariability: Math.round(stddev([...acc.jaw, ...acc.brow]) * 1000) / 1000,
      yawMean: Math.round((mean(acc.yaw) ?? 0) * 10) / 10, pitchMean: Math.round((mean(acc.pitch) ?? 0) * 10) / 10, rollMean: Math.round((mean(acc.roll) ?? 0) * 10) / 10,
      headVariability: Math.round(stddev(acc.yaw) * 10) / 10,
      timeOutsideForwardPercent: acc.validMs ? Math.round(acc.outsideMs / acc.validMs * 1000) / 10 : 0,
      baselineAvailable: acc.earBaseline !== null, insufficient: validSec < 10 || (acc.attempted > 0 && acc.valid / acc.attempted < 0.3),
      browRaiseMean: Math.round((mean(acc.browRaise) ?? 0) * 1000) / 1000,
      foreheadFurrowMean: Math.round((mean(acc.furrow) ?? 0) * 1000) / 1000,
      eyeOpennessMean: Math.round((mean(acc.earVals) ?? 0) * 1000) / 1000,
      blinkForceMean: Math.round((mean(acc.blink.drops) ?? 0) * 1000) / 1000,
      aggressiveBlinkCount: acc.blink.aggressiveCount, softBlinkCount: acc.blink.softCount,
      gazeVariability: Math.round((stddev(acc.gazeX) + stddev(acc.gazeY)) * 1000) / 1000,
      jawMovementFreqPerMin: validSec >= 10 ? Math.round(acc.jaw.filter((v, i) => i > 0 && v > 0.35 && acc.jaw[i - 1] <= 0.35).length / (validSec / 60) * 10) / 10 : undefined,
      jawTightnessMean: Math.round((mean(acc.jawTight) ?? 0) * 1000) / 1000,
      mouthMovement: Math.round(stddev(acc.jaw) * 1000) / 1000,
      tensionMovement: Math.round(clamp(((mean(acc.browRaise) ?? 0) + (mean(acc.furrow) ?? 0) + (mean(acc.jawTight) ?? 0)) / 1.2) * 1000) / 1000,
      eyeDarknessChange: change('darkness'), eyeRednessChange: change('redness'), faceBrightnessChange: change('brightness'),
      fatigueIndicator: fatigue, energyIndicator: 100 - fatigue,
      // optiflow-features-v2
      leftBlinkCount: acc.blinkLeft.blinks, rightBlinkCount: acc.blinkRight.blinks,
      censoredBlinkCount: acc.blink.censoredCount + acc.blinkLeft.censoredCount + acc.blinkRight.censoredCount,
      sustainedClosureCount: acc.blink.sustainedCount,
      eyeClosureFraction: acc.validMs ? Math.round(acc.blink.closedMs / acc.validMs * 1000) / 1000 : 0,
      effectiveSamplingHz: validSec ? Math.round(acc.valid / validSec * 10) / 10 : 0,
      headYawStddevDeg: Math.round(stddev(acc.yaw) * 10) / 10,
      headPitchStddevDeg: Math.round(stddev(acc.pitch) * 10) / 10,
      headRollStddevDeg: Math.round(stddev(acc.roll) * 10) / 10,
      jawOpenFraction: acc.jaw.length ? Math.round(acc.jaw.filter(v => v > 0.35).length / acc.jaw.length * 1000) / 1000 : 0,
      measurementVersion: 'optiflow-features-v2',
    };
    const mlFv = buildFeatureVector(cam);
    const mlFeatures = {
      version: mlFv.version, featureNames: [...FEATURE_NAMES],
      values: mlFv.values, missing: mlFv.missing, qualityFlags: mlFv.qualityFlags,
      sourceId: 'local-collection', participantId: 'local-user', recordingId: 's-' + Date.now(),
      labelKss: report.kss ?? null, labelScope: 'KSS 1-9, current sleepiness, collected before any model prediction',
      split: 'unassigned' as const, consentRecorded: true,
    };
    // Pulse Portrait result (last accepted window only; no estimate if none accepted).
    const lastPulse = lastAcceptedPulseRef.current;
    const pulseResult: PulseResult | undefined = pulseEnabled ? {
      method: 'POS rPPG on forehead + cheek skin RGB (optiflow-pos-v1)',
      methodVersion: RPPG_VERSION,
      bpm: lastPulse?.bpm ?? null, snr: lastPulse?.snr ?? null,
      estimates: pulseEstimatesRef.current,
      waveform: lastPulse?.waveform ?? [],
      waveformWindowStartSec: lastPulse?.windowStartSec ?? 0,
      waveformWindowEndSec: lastPulse?.windowEndSec ?? 0,
      usableSeconds: Math.round(cam.validSeconds * 10) / 10,
      quality: lastPulse ? `Accepted estimate, SNR ${lastPulse.snr}` : 'No accepted estimate — see report for the reason.',
      unavailableReason: lastPulse ? undefined : 'No 10-second window passed the quality gates (SNR, motion, illumination, coverage). No BPM is invented.',
    } : undefined;
    const replay: MeshReplay | undefined = replayRef.current ? {
      version: 'optiflow-replay-v1', measurementVersion: 'optiflow-features-v2', pulseMethod: RPPG_VERSION,
      durationSec: Math.round(cam.validSeconds * 10) / 10,
      frames: replayRef.current.frames, events: replayRef.current.events,
      createdAt: new Date().toISOString(),
    } : undefined;
    // FINAL SCORE = camera-derived score only. Self-report score is computed
    // separately, for comparison in the report — it never becomes the final score.
    const camScore = computeCameraScore(cam);
    const selfScore = computeScore(report);
    const session: Session = {
      id: 's-' + Date.now(), createdAt: new Date().toISOString(), selfReport: report, camera: cam,
      score: camScore.score, scoreLabel: camScore.label, scoreColor: camScore.color,
      cameraScore: camScore.score, cameraScoreComponents: camScore.components, cameraScoreConfidence: camScore.confidence,
      selfReportScore: selfScore.score, selfReportScoreLabel: selfScore.label,
      scoreContributors: selfScore.contributors,
      suggestions: buildSuggestions(cam), scanDurationLabel: `${Math.round(cam.validSeconds)} s valid`,
      mlFeatures,
      pulse: pulseResult,
      // No mlPrediction is attached: no trained model artifact exists yet,
      // so no estimate is shown. See ReportView's "Estimated sleepiness" section.
    };
    stopCamera(streamRef.current); streamRef.current = null; setCameraOn(false);
    setPhase('done'); onComplete(session, replay);
  }

  function cancelScan() {
    cancelAnimationFrame(rafRef.current); stopCamera(streamRef.current); streamRef.current = null; setCameraOn(false);
    replayRef.current = null; rppgSamplesRef.current = []; pulseEstimatesRef.current = []; lastAcceptedPulseRef.current = null;
    onExit();
  }

  useEffect(() => {
    if (phase === 'live' && live.validSec >= targetSec) finishScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.validSec]);

  const slider = (label: string, key: keyof SelfReport, hint: string, positive = false) => (
    <div>
      <label>{label}: {report[key] ?? '— not answered'}</label>
      <input type="range" min={0} max={10} step={1} aria-label={label}
        value={report[key] ?? 5}
        onChange={e => setReport({ ...report, [key]: Number(e.target.value) })}
        onFocus={e => { if (report[key] === undefined) setReport({ ...report, [key]: 5 }); }} />
      <p className="small muted">{hint} · {positive ? '0 = lowest, 10 = highest.' : '0 = none, 10 = strongest.'} Leave untouched to skip.</p>
    </div>
  );
  const chip = (label: string, rating: number | undefined, invert = true) => {
    if (rating === undefined) return null;
    const comfort = invert ? 100 - rating * 10 : rating * 10;
    const bg = comfort >= 80 ? '#B9CDBB' : comfort >= 60 ? '#BCCFDF' : comfort >= 40 ? '#C9C2DD' : comfort >= 20 ? '#E8DCA9' : '#E5BAA8';
    return <span key={label} className="pill" style={{ background: bg }}>● {label} {rating}/10</span>;
  };

  return (
    <div>
      <h1>Scan</h1>
      <p className="muted">A quiet check-in, not a test. Sit comfortably and blink naturally — do not perform expressions.</p>

      {phase === 'consent' && (
        <section className="card">
          <h2>Before we start: consent &amp; camera setup</h2>
          <ul>
            <li><strong>What is measured:</strong> visible facial movement, eye closure, and head movement — as observations, not diagnoses or emotions.</li>
            <li><strong>Where processing happens:</strong> on this device, in your browser. The face model is downloaded from a CDN on first use.</li>
            <li><strong>What is saved:</strong> only session summaries, your voluntary answers, and notes. No raw video or face image is saved or uploaded.</li>
            <li><strong>Your control:</strong> you can pause, cancel, or stop the camera at any time. Video only — the microphone is never requested.</li>
          </ul>
          <div className="grid g2" style={{ marginTop: 12 }}>
            <div><label htmlFor="cam">Camera</label><select id="cam" value={cameraId ?? ''} onChange={e => changeCamera(e.target.value)}><option value="">Default camera</option>{cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>)}</select></div>
            <div><label><input type="checkbox" checked={showMesh} onChange={e => setShowMesh(e.target.checked)} /> Show detailed face mesh (optional)</label><br /><label><input type="checkbox" checked={showGraphs} onChange={e => setShowGraphs(e.target.checked)} /> Show real-time graphs (optional)</label><br /><label><input type="checkbox" checked={pulseEnabled} onChange={e => setPulseEnabled(e.target.checked)} /> Pulse Portrait — experimental pulse estimate (optional)</label>
            <p className="small muted">Pulse Portrait is experimental and unvalidated against a reference device. It is not a medical measurement and must not be used for health decisions. Keep screen brightness steady during capture — the halo is deliberately subtle so it does not change the light on your face.</p></div>
          </div>
          <p className="small muted">Setup tips: face a soft light source, keep your whole face in frame, avoid strong backlight, and sit at a comfortable distance.</p>
          {loading && <p>{loading}</p>}
          {error && <p className="warn" role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn" onClick={enableCamera}>Enable camera preview</button>
            <button className="btn secondary" onClick={() => setPhase('report')}>Continue without camera (self-report &amp; resets)</button>
          </div>
          {cameraOn && (
            <div style={{ marginTop: 16 }}>
              <div className="video-frame halo-wrap"><Halo /><video ref={videoRef} autoPlay playsInline muted aria-label="Mirrored camera preview" /><canvas ref={canvasRef} aria-hidden="true" /></div>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => setPhase('report')}>Continue to self-report →</button>
            </div>
          )}
          {!cameraOn && <div style={{ display: 'none' }}><video ref={videoRef} autoPlay playsInline muted /><canvas ref={canvasRef} /></div>}
        </section>
      )}

      {phase === 'report' && (
        <section className="card">
          <h2>Optional self-report — the scan has access to all of this</h2>
          <p className="muted">These answers travel with the scan into the live panel and the report, visibly separate from camera observations. Skip anything you prefer not to answer. The final score is camera-derived; a self-report comparison score needs at least 3 of stress, fatigue, eye discomfort, and jaw discomfort. The other items are context, not score inputs.</p>
          <div style={{ marginTop: 12 }}>
            <label>How sleepy do you feel right now? — Karolinska Sleepiness Scale (KSS), 1–9, optional</label>
            <select value={report.kss ?? ''} onChange={e => setReport({ ...report, kss: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Prefer not to answer</option>
              {Object.entries(KSS_LABELS).map(([v, label]) => <option key={v} value={v}>{v} — {label}</option>)}
            </select>
            <p className="small muted">KSS is the ML research target for sleepiness prediction, kept on its original 1–9 scale and separate from the 0–10 fatigue item. It is collected <strong>before</strong> any model prediction is shown, so a prediction cannot anchor your answer. No trained model exists yet, so no prediction will be shown for this session — your KSS answer is saved as a label for future, consented training only.</p>
          </div>
          <div className="grid g2">
            {slider('Perceived stress', 'stress', 'How stressed you feel right now')}
            {slider('Sleepiness / fatigue', 'fatigue', 'How sleepy or fatigued you feel')}
            {slider('Energy', 'energy', 'Shown separately as context; not part of the score', true)}
            {slider('Eye discomfort', 'eyeDiscomfort', 'Dryness, strain, or soreness around the eyes')}
            {slider('Jaw discomfort', 'jawDiscomfort', 'Tension or discomfort in the jaw')}
            {slider('Mood', 'mood', 'How positive your mood feels right now (camera does not assess mood)', true)}
            {slider('Focus', 'focus', 'How focused you feel', true)}
            {slider('Calm', 'calm', 'How calm you feel', true)}
            {slider('Headache', 'headache', 'Headache intensity, if any')}
            {slider('Neck / shoulder tension', 'neckTension', 'Tension you feel in neck or shoulders')}
          </div>
          <div className="grid g2" style={{ marginTop: 12 }}>
            <div><label>Sleep duration (hours, optional)</label><input type="number" min={0} max={16} step={0.5} value={report.sleepHours ?? ''} onChange={e => setReport({ ...report, sleepHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div><label>Recent screen time (hours, optional)</label><input type="number" min={0} max={24} step={0.5} value={report.screenHours ?? ''} onChange={e => setReport({ ...report, screenHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div><label>Current activity (optional)</label><input type="text" value={report.activity ?? ''} onChange={e => setReport({ ...report, activity: e.target.value })} placeholder="e.g. Desk work, reading, meeting" /></div>
            <div><label>What would help right now? (optional)</label><select multiple size={4} value={report.helpNow ?? []} onChange={e => setReport({ ...report, helpNow: Array.from(e.target.selectedOptions).map(o => o.value) })}><option value="rest">Rest</option><option value="movement">Movement</option><option value="quiet">Quiet</option><option value="focus">Focus</option></select></div>
          </div>
          <div style={{ marginTop: 12 }}><label>Brief note (optional)</label><textarea rows={3} value={report.note ?? ''} onChange={e => setReport({ ...report, note: e.target.value })} /></div>
          <div style={{ marginTop: 12 }}><label>Scan length (valid observation)</label><select value={targetSec} onChange={e => setTargetSec(Number(e.target.value))}><option value={20}>20 seconds</option><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={50}>50 seconds</option><option value={60}>60 seconds (default)</option><option value={120}>120 seconds (more stable summaries)</option></select></div>
          {error && <p className="warn" role="alert">{error}</p>}
          {loading && <p>{loading}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {cameraOn
              ? <button className="btn" onClick={startBaseline}>Start baseline (about 5 s) →</button>
              : <button className="btn secondary" onClick={() => { const cam: CameraMetrics = { validSeconds: 0, wallSeconds: 0, framesAttempted: 0, framesValid: 0, usablePercent: 0, samplingHz: 0, interruptions: 0, multipleFaceFrames: 0, noFaceFrames: 0, blinkCount: 0, blinksPerMinute: null, medianBlinkDurationMs: null, meanBlinkIntervalSec: null, eyesClosedPercent: 0, eyeClosureConsistency: null, jawOpenMean: 0, jawOpenEvents: 0, mouthOpenEvents: 0, browMovement: 0, lipPressMean: 0, movementVariability: 0, yawMean: 0, pitchMean: 0, rollMean: 0, headVariability: 0, timeOutsideForwardPercent: 0, baselineAvailable: false, insufficient: true }; const s = computeScore(report); onComplete({ id: 's-' + Date.now(), createdAt: new Date().toISOString(), selfReport: report, camera: cam, score: null, scoreLabel: null, scoreColor: null, cameraScore: null, cameraScoreConfidence: 'Unavailable — camera not used', selfReportScore: s.score, selfReportScoreLabel: s.label, scoreContributors: s.contributors, suggestions: buildSuggestions(cam), scanDurationLabel: 'Camera not used' }); setPhase('done'); }}>Finish without camera →</button>}
            <button className="btn secondary" onClick={cancelScan}>Cancel</button>
          </div>
        </section>
      )}

      {(phase === 'baseline' || phase === 'live') && (
        <section className="card">
          <div className="halo-wrap" style={{ borderRadius: 22 }}>
            <Halo />
            <div className={`video-frame pulse-frame ${pulse.state === 'available' ? 'pulse-active' : pulse.state === 'collecting' || pulse.state === 'estimating' ? 'pulse-collecting' : 'pulse-neutral'}`} style={pulse.state === 'available' && pulse.bpm ? ({ '--pulse-period': `${60 / pulse.bpm}s` } as React.CSSProperties) : undefined}>
              <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera view" /><canvas ref={canvasRef} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
              <div className="pulse-ring" aria-hidden="true" />
            </div>
            {phase === 'live' && pulseEnabled && (
              <div className="card" style={{ marginTop: 12 }}>
                <h2 style={{ marginTop: 0 }}>Pulse Portrait</h2>
                <p className="small">See your pulse through your webcam — without touching anything.</p>
                <p className="small">Small changes in the light reflected from your skin can contain a pulse-related signal. OptiFlow extracts an estimate from your camera.</p>
                <p><strong>{pulse.state === 'available' && pulse.bpm ? `${pulse.bpm} BPM (estimated)` : pulse.state === 'collecting' ? 'Finding your pulse…' : pulse.state === 'estimating' ? 'Estimating pulse…' : pulse.state === 'interrupted' ? 'Signal interrupted' : 'Pulse unavailable'}</strong></p>
                <p className="small muted">{pulse.text}</p>
                <p className="small muted">The halo pulses at the estimated rate — this is a rate-based visualization, not beat-by-beat synchronization with your heart. When quality is lost, the halo fades to neutral and the last BPM is NOT shown as current. If it stays unavailable, try sitting still, facing a soft light, and keeping your whole face in frame.</p>
              </div>
            )}
          </div>
          {phase === 'baseline' && <p style={{ marginTop: 12 }}><strong>Baseline:</strong> {baselineMsg} This calibrates thresholds only — it is not a clinically meaningful personal baseline. Comparisons become more useful after several sessions.</p>}
          {phase === 'live' && (
            <div>
              <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>Time remaining: {live.remaining}s valid observation</p>
              <p className="small muted">Sit comfortably and blink naturally. Frames are excluded when the face is lost, occluded, or more than one face is seen.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }} aria-label="Your self-report for this scan">
                {chip('Stress', report.stress)}{chip('Fatigue', report.fatigue)}{chip('Energy', report.energy, false)}{chip('Eye', report.eyeDiscomfort)}{chip('Jaw', report.jawDiscomfort)}{chip('Mood', report.mood, false)}{chip('Focus', report.focus, false)}{chip('Calm', report.calm, false)}{chip('Headache', report.headache)}{chip('Neck', report.neckTension)}
                <span className="small muted">These are your answers, colour-matched to the score spectrum — not camera readings.</span>
              </div>
              <div className="grid g4">
                <div className="card"><strong>Blinks</strong><p>{live.blinks}</p></div>
                <div className="card"><strong>Eyes closed</strong><p>{live.closedPct}% of valid time</p></div>
                <div className="card"><strong>Tracking quality</strong><p>{live.quality} · {live.usable}% usable</p></div>
                <div className="card"><strong>Valid time</strong><p>{Math.round(live.validSec)}s / {targetSec}s</p></div>
              </div>
              {showGraphs && <div style={{ marginTop: 16 }}><h3>Real-time graphs</h3><LiveGraphs history={history} latest={history[history.length - 1] ?? null} /></div>}
              <details style={{ marginTop: 12 }}><summary>Detailed telemetry</summary><p className="small">Valid frames are counted only when exactly one face is detected. Time is based on frame timestamps, not an assumed frame rate. Blendshape values are model coefficients, not emotion probabilities. Eye-region appearance is an experimental relative change vs baseline, not a measurement of dark circles or redness.</p></details>
            </div>
          )}
          <div style={{ marginTop: 12 }}><label>Mesh intensity: {Math.round(meshIntensity * 100)}%</label><input type="range" min={0} max={100} value={Math.round(meshIntensity * 100)} onChange={e => setMeshIntensity(Number(e.target.value) / 100)} aria-label="Mesh intensity" /><p className="small muted">Adjusts how visible the detailed mesh is. It does not change any measurement — the mesh is display-only.</p></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {phase === 'live' && <button className="btn secondary" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
            <button className="btn secondary" onClick={finishScan}>Stop &amp; view report</button>
            <button className="btn secondary" onClick={cancelScan}>Cancel &amp; stop camera</button>
          </div>
          {error && <p className="warn" role="alert">{error}</p>}
        </section>
      )}
      {phase === 'done' && <p>Report ready below. Use “Save check-in” on the report to keep it in your personal history.</p>}
    </div>
  );
}
