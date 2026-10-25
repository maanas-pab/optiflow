import { describe, it, expect } from 'vitest';
import { computeCameraScore } from './cameraScore';
import type { CameraMetrics } from '../types';

function cam(partial: Partial<CameraMetrics> = {}): CameraMetrics {
  return {
    validSeconds: 60, wallSeconds: 64, framesAttempted: 1800, framesValid: 1720, usablePercent: 96, samplingHz: 29,
    interruptions: 1, multipleFaceFrames: 0, noFaceFrames: 79, blinkCount: 18, blinksPerMinute: 18,
    medianBlinkDurationMs: 220, meanBlinkIntervalSec: 3, eyesClosedPercent: 4, eyeClosureConsistency: null,
    jawOpenMean: 0.12, jawOpenEvents: 4, mouthOpenEvents: 3, browMovement: 0.15, lipPressMean: 0.08,
    movementVariability: 0.2, yawMean: 2, pitchMean: -1, rollMean: 1, headVariability: 3,
    timeOutsideForwardPercent: 5, baselineAvailable: true, insufficient: false,
    browRaiseMean: 0.12, foreheadFurrowMean: 0.08, eyeOpennessMean: 0.27, blinkForceMean: 0.5,
    aggressiveBlinkCount: 1, softBlinkCount: 17, gazeVariability: 0.02, jawMovementFreqPerMin: 4,
    jawTightnessMean: 0.08, mouthMovement: 0.15, tensionMovement: 0.15,
    ...partial,
  };
}

describe('camera-derived final score', () => {
  it('is computed from camera data only — the function takes no self-report at all', () => {
    // By construction computeCameraScore(cam) has no self-report argument.
    // Two identical camera scans therefore always score identically, whatever the user typed.
    expect(computeCameraScore(cam()).score).toBe(computeCameraScore(cam()).score);
    expect(computeCameraScore(cam()).components.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
  it('falls when eyes-closed % or tension movement rise, and is clamped 0–100', () => {
    const base = computeCameraScore(cam()).score!;
    const worseEyes = computeCameraScore(cam({ eyesClosedPercent: 30 })).score!;
    const worseTension = computeCameraScore(cam({ tensionMovement: 0.9 })).score!;
    expect(worseEyes).toBeLessThan(base);
    expect(worseTension).toBeLessThan(base);
    expect(base).toBeGreaterThanOrEqual(0); expect(base).toBeLessThanOrEqual(100);
  });
  it('gives no score for insufficient camera data, instead of inventing one', () => {
    expect(computeCameraScore(cam({ validSeconds: 5 })).score).toBeNull();
    expect(computeCameraScore(cam({ usablePercent: 20 })).score).toBeNull();
    expect(computeCameraScore(cam({ validSeconds: 5 })).available).toBe(false);
  });
  it('flags short scans as lower confidence, and excludes experimental appearance from the score', () => {
    const short = computeCameraScore(cam({ validSeconds: 20 }));
    expect(short.confidence).toContain('short scan');
    const a = computeCameraScore(cam({ eyeDarknessChange: 20, eyeRednessChange: 20, faceBrightnessChange: -20 }));
    const b = computeCameraScore(cam({ eyeDarknessChange: -20, eyeRednessChange: -20, faceBrightnessChange: 20 }));
    expect(a.score).toBe(b.score); // appearance change must not move the score
  });
});
