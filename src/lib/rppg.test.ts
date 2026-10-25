import { describe, it, expect } from 'vitest';
import { analyseRppgWindow, type RppgSample } from './rppg';

/** Synthetic skin signal: a 72 BPM (1.2 Hz) sinusoid in G, plus a
 *  common-mode brightness drift in all channels (which POS should
 *  suppress). This tests CODE behaviour only — it is not evidence that
 *  the method works on real people, and it is never used as training data. */
function synthetic72Bpm(): RppgSample[] {
  const out: RppgSample[] = [];
  for (let i = 0; i < 360; i++) { // 12 s at 30 Hz
    const t = i / 30;
    const pulse = Math.sin(2 * Math.PI * 1.2 * t) * 2;
    const drift = Math.sin(2 * Math.PI * 0.1 * t) * 5;
    out.push({
      tMs: i * 1000 / 30, r: 120 + drift, g: 100 + drift + pulse, b: 90 + drift,
      brightness: 103 + drift, yawDeg: 0, valid: true,
    });
  }
  return out;
}

describe('POS rPPG analysis', () => {
  it('recovers ~72 BPM from a synthetic 1.2 Hz skin signal', () => {
    const est = analyseRppgWindow(synthetic72Bpm());
    expect(est.accepted).toBe(true);
    expect(est.bpm).toBeGreaterThanOrEqual(66);
    expect(est.bpm).toBeLessThanOrEqual(78);
    expect(est.waveform.length).toBeGreaterThan(0);
    expect(est.latencyMs).toBeLessThan(1000);
  });
  it('rejects a window with too little usable signal instead of inventing BPM', () => {
    const est = analyseRppgWindow(synthetic72Bpm().slice(0, 60));
    expect(est.accepted).toBe(false);
    expect(est.bpm).toBe(0);
  });
  it('rejects high-motion windows', () => {
    const samples = synthetic72Bpm().map(s => ({ ...s, yawDeg: s.tMs % 2000 < 1000 ? -20 : 20 }));
    const est = analyseRppgWindow(samples);
    expect(est.accepted).toBe(false);
  });
  it('marks long gaps as invalid waveform points instead of interpolating across them', () => {
    const samples = synthetic72Bpm().filter(s => !(s.tMs > 2000 && s.tMs < 4000));
    const est = analyseRppgWindow(samples);
    // Window still has enough data, but the gap region must show invalid points.
    const gapPts = est.waveform.filter(p => p.tSec >= 2 && p.tSec <= 4 && !p.valid);
    expect(gapPts.length).toBeGreaterThan(0);
  });
});
