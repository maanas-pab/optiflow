/**
 * OptiFlow facial-measurement definitions — extractor version "optiflow-features-v2".
 *
 * This module documents, in one place, every feature the ML pipeline may use.
 * It does NOT diagnose, score, or predict anything on its own: it turns
 * timestamped MediaPipe observations into named, unit-bearing summaries.
 *
 * Definitions (all times are elapsed time from frame timestamps, capped at
 * 500 ms per gap — never an assumed fixed frame rate):
 *
 * - bilateral_blink_count: complete closures of BOTH eyes together.
 *   A closure starts when bilateral EAR (mean of left/right EAR) falls below
 *   low = 0.65 × baseline EAR, and ends when it rises above high =
 *   0.85 × baseline EAR (hysteresis). Duration must be 40–1200 ms.
 *   Closures > 1200 ms are sustained_closures, not blinks.
 *   A closure interrupted by tracking loss is CENSORED: discarded, never
 *   counted, and the next reopening cannot complete it.
 * - left/right_blink_count: same rule applied to that eye's EAR alone.
 *   A unilateral closure (one eye only, e.g. a wink) is NOT a bilateral
 *   blink — this is why the kit's left_wink_only fixture expects 0 blinks.
 * - blinks_per_minute: bilateral_blink_count / valid_minutes, where
 *   valid_minutes = valid_seconds / 60. Null when valid_seconds < 10.
 * - median_blink_duration_ms: median duration of counted bilateral blinks.
 *   Null when no blink was counted OR when effective sampling is below
 *   10 Hz (at 2 FPS, as in CogBeacon-style data, blink timing cannot be
 *   resolved — the kit's low_rate_2fps fixture expects null, not a guess).
 * - eye_closure_fraction: closed_ms / valid_ms, where closed_ms is time
 *   bilateral EAR spent below the low threshold during valid frames.
 *   Reported as eyesClosedPercent = fraction × 100 elsewhere. This is a
 *   threshold-crossing fraction, NOT an anatomical closure percentage.
 * - jaw_open_events: upward crossings of jawOpen blendshape > 0.35;
 *   mouth_open_events: crossings > 0.50. Blendshape values are model
 *   coefficients, not muscle measurements or yawns.
 * - head summaries: mean and standard deviation of yaw/pitch/roll (degrees,
 *   from the facial transformation matrix), plus time_outside_forward_pct:
 *   share of valid time with yaw > 15° or pitch > 12° from the 5 s baseline
 *   head pose. Head pose is NOT whole-body posture.
 * - tracking: usable_percent = valid_frames / attempted_frames × 100;
 *   effective_sampling_hz = valid_frames / valid_seconds (elapsed);
 *   interruptions = transitions from valid tracking to no-face/multi-face.
 *
 * Visual smoothing (live graphs, mesh) is separate from measurement:
 * graphs show the latest raw values, they never feed these summaries.
 * Missing values are null, never 0-filled, in the feature vector.
 * Synthetic fixtures (kit data/synthetic_feature_traces.csv) are
 * ENGINEERING checks for this code only and are REJECTED from any
 * human-state training or evaluation (see ml/train.py).
 */

export const FEATURE_VERSION = 'optiflow-features-v2';
export const MIN_SAMPLING_HZ_FOR_BLINK_TIMING = 10;
export const BLINK_MIN_MS = 40;
export const BLINK_MAX_MS = 1200;

/** Feature names and order for the ML model. Units in comments. */
export const FEATURE_NAMES = [
  'blinks_per_minute',        // blinks / valid minute
  'median_blink_duration_ms', // ms
  'eye_closure_fraction',     // 0–1, bilateral EAR below low threshold
  'eye_openness_mean',        // mean bilateral EAR, unitless ratio
  'blink_aggressive_share',   // aggressive blinks / all blinks, 0–1
  'jaw_open_events_per_min',  // events / valid minute
  'jaw_open_mean',            // mean jawOpen blendshape coefficient, 0–1
  'tension_movement',         // 0–1, brow raise + furrow + jaw tightness / 1.2, clamped
  'head_yaw_stddev_deg',      // degrees
  'time_outside_forward_pct', // 0–100
  'gaze_variability',         // stddev of eye-centre position, unitless
  'usable_percent',           // 0–100, tracking coverage
] as const;
export type FeatureName = typeof FEATURE_NAMES[number];

export interface FeatureVector {
  version: string;
  /** Ordered values matching FEATURE_NAMES; null = unavailable, never imputed here. */
  values: (number | null)[];
  /** Names of features that were unavailable in this session. */
  missing: FeatureName[];
  /** Quality gates that failed, if any. */
  qualityFlags: string[];
}

/** Build a feature vector from a session's CameraMetrics. */
export function buildFeatureVector(cam: {
  blinksPerMinute: number | null; medianBlinkDurationMs: number | null;
  eyesClosedPercent: number; eyeOpennessMean?: number;
  aggressiveBlinkCount?: number; blinkCount: number;
  jawOpenEvents: number; validSeconds: number; jawOpenMean: number;
  tensionMovement?: number; headVariability: number;
  timeOutsideForwardPercent: number; gazeVariability?: number;
  usablePercent: number; samplingHz: number;
}): FeatureVector {
  const perMin = (n: number) => cam.validSeconds >= 10 ? Math.round(n / (cam.validSeconds / 60) * 10) / 10 : null;
  const blinkTimingOk = cam.samplingHz >= MIN_SAMPLING_HZ_FOR_BLINK_TIMING;
  const values: (number | null)[] = [
    cam.blinksPerMinute,
    blinkTimingOk ? cam.medianBlinkDurationMs : null,
    Math.round(cam.eyesClosedPercent / 100 * 1000) / 1000,
    cam.eyeOpennessMean ?? null,
    cam.blinkCount > 0 ? Math.round(((cam.aggressiveBlinkCount ?? 0) / cam.blinkCount) * 1000) / 1000 : null,
    perMin(cam.jawOpenEvents),
    cam.jawOpenMean,
    cam.tensionMovement ?? null,
    cam.headVariability,
    cam.timeOutsideForwardPercent,
    cam.gazeVariability ?? null,
    cam.usablePercent,
  ];
  const missing = FEATURE_NAMES.filter((_, i) => values[i] === null);
  const qualityFlags: string[] = [];
  if (cam.validSeconds < 10) qualityFlags.push('valid_seconds_below_10');
  if (cam.usablePercent < 30) qualityFlags.push('usable_percent_below_30');
  if (!blinkTimingOk) qualityFlags.push('sampling_below_10hz_blink_timing_unavailable');
  return { version: FEATURE_VERSION, values, missing, qualityFlags };
}

/** A feature vector is usable for ML inference only when it passes all gates. */
export function featureVectorUsableForInference(fv: FeatureVector): boolean {
  if (fv.version !== FEATURE_VERSION) return false;
  if (fv.qualityFlags.some(f => f === 'valid_seconds_below_10' || f === 'usable_percent_below_30')) return false;
  // Core blink features must be present; other features may be imputed by the model manifest.
  const idx = (n: FeatureName) => FEATURE_NAMES.indexOf(n);
  return fv.values[idx('blinks_per_minute')] !== null && fv.values[idx('eye_closure_fraction')] !== null;
}
