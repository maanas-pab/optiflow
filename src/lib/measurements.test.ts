import { describe, it, expect } from 'vitest';
import { buildFeatureVector, featureVectorUsableForInference, FEATURE_NAMES } from './measurements';
import { createBlinkState, updateBlink, censorBlink } from './metrics';

function baseCam(partial: Record<string, unknown> = {}) {
  return {
    blinksPerMinute: 18, medianBlinkDurationMs: 220, eyesClosedPercent: 4,
    eyeOpennessMean: 0.27, aggressiveBlinkCount: 1, blinkCount: 18,
    jawOpenEvents: 4, validSeconds: 60, jawOpenMean: 0.12, tensionMovement: 0.15,
    headVariability: 3, timeOutsideForwardPercent: 5, gazeVariability: 0.02,
    usablePercent: 96, samplingHz: 29, ...partial,
  } as Parameters<typeof buildFeatureVector>[0];
}

describe('feature vector v2', () => {
  it('has the documented feature order and nulls for missing values, never 0-fills', () => {
    const fv = buildFeatureVector(baseCam({ eyeOpennessMean: undefined }));
    expect(fv.version).toBe('optiflow-features-v2');
    expect(fv.values.length).toBe(FEATURE_NAMES.length);
    expect(fv.values[FEATURE_NAMES.indexOf('eye_openness_mean')]).toBeNull();
    expect(fv.missing).toContain('eye_openness_mean');
  });
  it('withholds blink timing below 10 Hz (CogBeacon-style 2 FPS cannot resolve blinks)', () => {
    const fv = buildFeatureVector(baseCam({ samplingHz: 2 }));
    expect(fv.values[FEATURE_NAMES.indexOf('median_blink_duration_ms')]).toBeNull();
    expect(fv.qualityFlags).toContain('sampling_below_10hz_blink_timing_unavailable');
  });
  it('is not usable for inference when valid time or coverage is too low', () => {
    expect(featureVectorUsableForInference(buildFeatureVector(baseCam()))).toBe(true);
    expect(featureVectorUsableForInference(buildFeatureVector(baseCam({ validSeconds: 5 })))).toBe(false);
    expect(featureVectorUsableForInference(buildFeatureVector(baseCam({ usablePercent: 20 })))).toBe(false);
  });
});

describe('censored blink events', () => {
  it('discards a closure interrupted by tracking loss instead of counting it later', () => {
    let s = createBlinkState();
    s = updateBlink(s, 0.10, 0, 16, 0.18, 0.22); // close
    s = censorBlink(s); // face lost
    s = updateBlink(s, 0.30, 500, 16, 0.18, 0.22); // reopen — must NOT count
    expect(s.blinks).toBe(0);
    expect(s.censoredCount).toBe(1);
  });
  it('counts a sustained closure separately from blinks, and a wink is not a bilateral blink', () => {
    let s = createBlinkState();
    s = updateBlink(s, 0.10, 0, 16, 0.18, 0.22);
    s = updateBlink(s, 0.30, 2000, 16, 0.18, 0.22); // 2 s closure
    expect(s.blinks).toBe(0);
    expect(s.sustainedCount).toBe(1);
  });
});
