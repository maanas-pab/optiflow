import { describe, it, expect } from 'vitest';
import { predictKss, type ModelArtifact } from './modelInference';
import { buildFeatureVector } from './measurements';

// Golden test: mirrors ml/golden_test.json (same artifact, same inputs).
// The Python reference and the browser must agree on these numbers.
const artifact: ModelArtifact = {
  model_id: 'optiflow-kss-ridge-v0', model_version: '0.0.0-golden', feature_version: 'optiflow-features-v2',
  feature_names: ['blinks_per_minute','median_blink_duration_ms','eye_closure_fraction','eye_openness_mean','blink_aggressive_share','jaw_open_events_per_min','jaw_open_mean','tension_movement','head_yaw_stddev_deg','time_outside_forward_pct','gaze_variability','usable_percent'],
  means: [18, 220, 0.05, 0.27, 0.1, 4, 0.12, 0.15, 3, 5, 0.02, 95],
  scales: [6, 80, 0.05, 0.05, 0.2, 3, 0.1, 0.2, 2, 8, 0.02, 10],
  impute_values: [18, 220, 0.05, 0.27, 0.1, 4, 0.12, 0.15, 3, 5, 0.02, 95],
  coefficients: [0.4, 0.3, 0.5, -0.4, 0.2, 0.1, 0.1, 0.3, 0.1, 0.2, 0.1, -0.1],
  intercept: 5.0, target: 'kss_1_9',
};

const cam = {
  blinksPerMinute: 24, medianBlinkDurationMs: 300, eyesClosedPercent: 10,
  eyeOpennessMean: 0.22, aggressiveBlinkCount: 3, blinkCount: 24,
  jawOpenEvents: 6, validSeconds: 60, jawOpenMean: 0.2, tensionMovement: 0.35,
  headVariability: 5, timeOutsideForwardPercent: 13, gazeVariability: 0.04,
  usablePercent: 90, samplingHz: 29,
};

describe('model inference', () => {
  it('suppresses predictions when no trained model exists — never substitutes a score', () => {
    const r = predictKss(null, buildFeatureVector(cam));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.suppressed).toBe('no_trained_model');
  });
  it('matches the golden reference on a fixed input (browser/Python parity)', () => {
    const r = predictKss(artifact, buildFeatureVector(cam));
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Hand-computed from the artifact above: intercept 5 + sum(coef*scaled).
      // Scaled: [1, 1, 1, -1, 0.125, 0.667, 0.8, 1, 1, 1, 1, -0.5]
      // = 5 + 0.4+0.3+0.5+0.4+0.025+0.067+0.08+0.3+0.1+0.2+0.1+0.05 = 7.522 -> 7.5
      expect(r.prediction.predictedKss).toBeCloseTo(7.5, 1);
      expect(r.prediction.target).toBe('kss_1_9');
    }
  });
  it('suppresses on feature-version mismatch and on insufficient quality', () => {
    const bad = predictKss({ ...artifact, feature_version: 'v1' }, buildFeatureVector(cam));
    expect(bad.ok).toBe(false);
    const lowQ = predictKss(artifact, buildFeatureVector({ ...cam, usablePercent: 20 }));
    expect(lowQ.ok).toBe(false);
  });
});
