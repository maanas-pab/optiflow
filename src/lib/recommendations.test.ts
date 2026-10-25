import { describe, it, expect } from 'vitest';
import { buildSuggestions } from './recommendations';
import type { CameraMetrics } from '../types';

function cam(partial: Partial<CameraMetrics> = {}): CameraMetrics {
  return {
    validSeconds: 60, wallSeconds: 64, framesAttempted: 100, framesValid: 95, usablePercent: 95, samplingHz: 30,
    interruptions: 0, multipleFaceFrames: 0, noFaceFrames: 5, blinkCount: 18, blinksPerMinute: 18,
    medianBlinkDurationMs: 220, meanBlinkIntervalSec: 3, eyesClosedPercent: 4, eyeClosureConsistency: null,
    jawOpenMean: 0.1, jawOpenEvents: 4, mouthOpenEvents: 3, browMovement: 0.15, lipPressMean: 0.08,
    movementVariability: 0.2, yawMean: 0, pitchMean: 0, rollMean: 0, headVariability: 3,
    timeOutsideForwardPercent: 5, baselineAvailable: true, insufficient: false,
    tensionMovement: 0.15, jawTightnessMean: 0.08, aggressiveBlinkCount: 1, softBlinkCount: 17,
    ...partial,
  };
}

describe('camera-driven recommendations', () => {
  it('never returns the old generic no-reset message, even for a steady scan', () => {
    const out = buildSuggestions(cam());
    expect(out.length).toBeGreaterThan(0);
    const text = out.map(s => s.title + s.activity + (s.steps ?? []).join(' ')).join(' ');
    expect(text).not.toContain('No reset is needed');
    expect(text).not.toContain('A short walk or a drink of water, if you like, is a fine next step');
    // Every suggestion must have concrete steps, not just a one-liner.
    for (const s of out) expect((s.steps ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it('adds a detailed eye suggestion when eyes-closed % is high, from camera numbers alone', () => {
    const out = buildSuggestions(cam({ eyesClosedPercent: 25, blinksPerMinute: 8 }));
    expect(out.some(s => s.id === 'eye-rest-detailed')).toBe(true);
    expect(out.find(s => s.id === 'eye-rest-detailed')!.why).toContain('25%');
  });
  it('adds a quality suggestion first when tracking is poor', () => {
    const out = buildSuggestions(cam({ usablePercent: 40, framesValid: 40, framesAttempted: 100, interruptions: 5 }));
    expect(out[0].id).toBe('tracking-quality-detailed');
  });
});
