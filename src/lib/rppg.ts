/**
 * OptiFlow Pulse Portrait — classical POS rPPG, experimental.
 *
 * METHOD (documented, reproducible, and testable — not MTTS-CAN):
 * Skin-region mean RGB is sampled from the RAW video frame (a separate
 * offscreen canvas fed only by the <video> element — never by the overlay
 * canvas that carries the mesh, halo, or any composited graphics, so the
 * display cannot contaminate the measurement).
 *
 * Regions, tracked per frame by MediaPipe landmarks:
 *   forehead patch (below landmark 10), left cheek (landmark 205),
 *   right cheek (landmark 425). These are large skin areas away from
 *   eyes and mouth. If a patch is outside the frame or the face is lost,
 *   that sample is invalid — never imputed as a skin colour.
 *
 * Signal chain (POS, Wang et al., "Algorithmic Principles of Remote PPG",
 * IEEE Trans. Biomed. Eng. 2017 — the same family of method used by
 * browser demos such as ubicomplab/rppg-web; MTTS-CAN is a different,
 * neural method and is NOT what runs here — see Inside OptiFlow):
 *   1. Resample irregular timestamped RGB means to a uniform 30 Hz grid
 *      by linear interpolation. Gaps > 500 ms break the window: samples
 *      across a long gap are NOT interpolated (they become a gap segment
 *      in the displayed waveform).
 *   2. Detrend (subtract a moving average) and normalise each channel.
 *   3. POS projection: X = G - B, Y = -2R + G + B, pulse = X + alpha*Y,
 *      alpha = std(X) / std(Y). This suppresses specular / motion colour
 *      changes that are common to all channels.
 *   4. Band-limit by FFT: keep only 0.7–4.0 Hz (42–240 BPM), zero the rest,
 *      inverse-transform. The result is the recovered pulse-related
 *      waveform, plotted in "normalized amplitude" (unitless, after
 *      normalisation — it is NOT an ECG, NOT blood volume in ml, and
 *      NOT a PPG waveform from a contact sensor).
 *   5. BPM = frequency of the largest spectral peak in 0.7–4.0 Hz.
 *      SNR = peak power / mean power in the band. An estimate is accepted
 *      only if SNR >= 2.0, the peak is not at a band edge, head motion in
 *      the window is low, and illumination did not jump.
 *
 * WINDOWS: 10 s analysis window, re-analysed every 2 s (rolling, 80%
 * overlap). Each estimate carries its window start/end timestamps and
 * processing latency (measured). Waveform segments are per-window; the
 * report shows the LAST accepted window's waveform plus a BPM-over-time
 * trend of all accepted estimates — never a stitched, discontinuous
 * "continuous" waveform pretending to be one recording.
 *
 * This is a CAUSAL, retrospective window estimate: it summarises the
 * last 10 s. It is not zero-latency, and the live halo is a RATE-BASED
 * visualization (it pulses at the estimated BPM), NOT beat-synchronised
 * to individual heartbeats.
 *
 * LIMITATIONS (shown in the UI, not hidden): no reference pulse-oximeter
 * validation has been run for OptiFlow, so no accuracy number is claimed.
 * Skin tone, lighting, motion, makeup, glasses, and camera compression
 * all affect it. It must not be used for stress, blood pressure, SpO2,
 * or cardiovascular-health inference, or for any medical/safety decision.
 * MTTS-CAN evaluation remains future work (see ml/rppg.py and Inside
 * OptiFlow); quoting MTTS-CAN paper accuracy as OptiFlow accuracy would
 * be false.
 */

export const RPPG_VERSION = 'optiflow-pos-v1';
export const RPPG_WINDOW_SEC = 10;
export const RPPG_UPDATE_SEC = 2;
export const RPPG_SAMPLE_HZ = 30;
export const RPPG_MIN_HZ = 0.7;
export const RPPG_MAX_HZ = 4.0;
export const RPPG_MIN_SNR = 2.0;

export interface RppgSample { tMs: number; r: number; g: number; b: number; brightness: number; yawDeg: number; valid: boolean; }
export interface RppgEstimate {
  bpm: number; snr: number; windowStartMs: number; windowEndMs: number;
  validSeconds: number; coveragePct: number; latencyMs: number;
  accepted: boolean; rejectReason?: string;
  /** Filtered waveform for the window, in normalized amplitude. */
  waveform: { tSec: number; value: number; valid: boolean }[];
  /** Peak frequency in Hz, for cross-checking. */
  peakHz: number;
}
export type PulseState = 'preparing' | 'collecting' | 'estimating' | 'available' | 'interrupted' | 'unavailable';

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Naive DFT (N <= 512, fine at 2 s cadence) returning power per bin. */
export function dftPower(signal: number[], sampleHz: number): { freqs: number[]; power: number[] } {
  const N = signal.length;
  const freqs: number[] = []; const power: number[] = [];
  for (let k = 0; k <= Math.floor(N / 2); k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const a = -2 * Math.PI * k * n / N;
      re += signal[n] * Math.cos(a); im += signal[n] * Math.sin(a);
    }
    freqs.push(k * sampleHz / N); power.push(re * re + im * im);
  }
  return { freqs, power };
}

/** Inverse DFT keeping only bins in [minHz, maxHz]; returns filtered signal. */
export function bandpass(signal: number[], sampleHz: number, minHz: number, maxHz: number): number[] {
  const N = signal.length;
  const out = new Array(N).fill(0);
  for (let k = 0; k < N; k++) {
    const freq = k <= N / 2 ? k * sampleHz / N : (k - N) * sampleHz / N;
    if (Math.abs(freq) < minHz || Math.abs(freq) > maxHz) continue;
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const a = -2 * Math.PI * k * n / N;
      re += signal[n] * Math.cos(a); im += signal[n] * Math.sin(a);
    }
    for (let n = 0; n < N; n++) {
      const a = 2 * Math.PI * k * n / N;
      out[n] += (re * Math.cos(a) - im * Math.sin(a)) / N;
    }
  }
  return out;
}

function detrendNormalize(xs: number[]): number[] {
  // Subtract a 1 s moving average (window = sampleHz), then z-normalise.
  const W = RPPG_SAMPLE_HZ;
  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const lo = Math.max(0, i - Math.floor(W / 2)); const hi = Math.min(xs.length, i + Math.floor(W / 2));
    const seg = xs.slice(lo, hi);
    out.push(xs[i] - mean(seg));
  }
  const m = mean(out); const s = std(out) || 1;
  return out.map(v => (v - m) / s);
}

/**
 * Analyse one window of timestamped RGB samples. Returns an estimate
 * (accepted or rejected with a reason) plus the filtered waveform.
 * Pure function — fully testable on synthetic signals.
 */
export function analyseRppgWindow(samples: RppgSample[]): RppgEstimate {
  const started = performance.now();
  const valid = samples.filter(s => s.valid);
  const endMs = samples.length ? samples[samples.length - 1].tMs : 0;
  const startMs = endMs - RPPG_WINDOW_SEC * 1000;
  const windowSamples = valid.filter(s => s.tMs >= startMs);
  const coverage = samples.length ? Math.round(valid.length / samples.length * 100) : 0;
  const validSec = windowSamples.length >= 2
    ? (windowSamples[windowSamples.length - 1].tMs - windowSamples[0].tMs) / 1000 : 0;
  const empty: RppgEstimate = {
    bpm: 0, snr: 0, windowStartMs: startMs, windowEndMs: endMs,
    validSeconds: Math.round(validSec * 10) / 10, coveragePct: coverage,
    latencyMs: Math.round(performance.now() - started), accepted: false,
    waveform: [], peakHz: 0,
  };
  if (windowSamples.length < RPPG_WINDOW_SEC * 15) {
    return { ...empty, rejectReason: `Only ${validSec.toFixed(1)} s of usable skin signal in the window (need ${RPPG_WINDOW_SEC} s). Sit still, face the light, and keep your face in frame.` };
  }
  // Motion / illumination gates.
  const yawStd = std(windowSamples.map(s => s.yawDeg));
  if (yawStd > 8) return { ...empty, rejectReason: `Head motion too high in this window (yaw std ${yawStd.toFixed(1)}°). Try sitting still.` };
  const bright = windowSamples.map(s => s.brightness);
  const maxJump = Math.max(...bright.map((v, i) => i ? Math.abs(v - bright[i - 1]) : 0));
  const brightMean = mean(bright) || 1;
  if (maxJump / brightMean > 0.35) return { ...empty, rejectReason: 'Lighting changed abruptly in this window — collecting a new signal.' };

  // Resample to a uniform 30 Hz grid; gaps > 500 ms become invalid grid points.
  const N = RPPG_WINDOW_SEC * RPPG_SAMPLE_HZ;
  const grid: { r: number; g: number; b: number; valid: boolean }[] = [];
  for (let i = 0; i < N; i++) {
    const t = startMs + (i / RPPG_SAMPLE_HZ) * 1000;
    // Find bracketing samples.
    let before: RppgSample | null = null; let after: RppgSample | null = null;
    for (const s of windowSamples) {
      if (s.tMs <= t) before = s; else { after = s; break; }
    }
    if (!before || !after || after.tMs - before.tMs > 500) {
      grid.push({ r: 0, g: 0, b: 0, valid: false });
    } else {
      const f = (t - before.tMs) / (after.tMs - before.tMs || 1);
      grid.push({ r: before.r + f * (after.r - before.r), g: before.g + f * (after.g - before.g), b: before.b + f * (after.b - before.b), valid: true });
    }
  }
  const validGrid = grid.filter(g => g.valid).length;
  if (validGrid < N * 0.7) {
    return { ...empty, rejectReason: `Only ${Math.round(validGrid / N * 100)}% of the resampled window was usable (need 70%).` };
  }
  // Fill invalid grid points by nearest valid value for spectral analysis
  // only — the displayed waveform keeps them marked invalid (gaps).
  const fill = (vals: number[]) => {
    const out = [...vals]; let last = vals.find(v => !Number.isNaN(v)) ?? 0;
    for (let i = 0; i < out.length; i++) { if (Number.isNaN(out[i])) out[i] = last; else last = out[i]; }
    return out;
  };
  const r = fill(grid.map(g => g.valid ? g.r : NaN));
  const g = fill(grid.map(g => g.valid ? g.g : NaN));
  const b = fill(grid.map(g => g.valid ? g.b : NaN));
  const rn = detrendNormalize(r); const gn = detrendNormalize(g); const bn = detrendNormalize(b);
  const x = gn.map((v, i) => v - bn[i]);
  const y = gn.map((v, i) => -2 * rn[i] + v + bn[i]);
  const alpha = (std(x) || 1) / (std(y) || 1);
  const pulse = x.map((v, i) => v + alpha * y[i]);
  const filtered = bandpass(pulse, RPPG_SAMPLE_HZ, RPPG_MIN_HZ, RPPG_MAX_HZ);
  const { freqs, power } = dftPower(filtered, RPPG_SAMPLE_HZ);
  let peakIdx = -1; let peakPower = -1;
  freqs.forEach((f, i) => {
    if (f >= RPPG_MIN_HZ && f <= RPPG_MAX_HZ && power[i] > peakPower) { peakPower = power[i]; peakIdx = i; }
  });
  if (peakIdx < 0) return { ...empty, rejectReason: 'No spectral peak in the pulse band.' };
  const bandPower = power.filter((_, i) => freqs[i] >= RPPG_MIN_HZ && freqs[i] <= RPPG_MAX_HZ);
  const snr = peakPower / (mean(bandPower) || 1);
  const peakHz = freqs[peakIdx];
  const waveform = filtered.map((v, i) => ({ tSec: Math.round(i / RPPG_SAMPLE_HZ * 10) / 10, value: Math.round(v * 1000) / 1000, valid: grid[i].valid }));
  const latencyMs = Math.round(performance.now() - started);
  if (snr < RPPG_MIN_SNR) {
    return { ...empty, snr: Math.round(snr * 10) / 10, peakHz, waveform, latencyMs, rejectReason: `Spectral peak too weak (SNR ${snr.toFixed(1)}, need ${RPPG_MIN_SNR}). The signal may be motion or lighting, not pulse.` };
  }
  if (peakHz <= RPPG_MIN_HZ + 0.05 || peakHz >= RPPG_MAX_HZ - 0.05) {
    return { ...empty, snr: Math.round(snr * 10) / 10, peakHz, waveform, latencyMs, rejectReason: 'Peak sits at the edge of the pulse band — likely an artefact, not pulse.' };
  }
  return {
    bpm: Math.round(peakHz * 60), snr: Math.round(snr * 10) / 10,
    windowStartMs: startMs, windowEndMs: endMs,
    validSeconds: Math.round(validSec * 10) / 10, coveragePct: coverage,
    latencyMs, accepted: true, waveform, peakHz: Math.round(peakHz * 100) / 100,
  };
}
