import type { MLPrediction } from '../types';
import { FEATURE_NAMES, FEATURE_VERSION, featureVectorUsableForInference, type FeatureVector } from './measurements';

/**
 * Versioned browser inference for the desk_sleepiness (KSS 1–9) model.
 *
 * A trained model artifact is a plain JSON object (see ml/model_schema.json):
 *   { model_id, model_version, feature_version, feature_names, feature_order,
 *     means, scales, impute_values, coefficients, intercept,
 *     target: "kss_1_9", checksum, evaluation: {...} }
 * The browser implementation must match ml/train.py's reference
 * implementation on golden inputs — see modelInference.test.ts, which
 * mirrors the Python golden test in ml/golden_test.json.
 *
 * SUPPRESSION RULES (never silently substitute a hand-written score):
 * - No artifact loaded → predict() returns { suppressed: 'no_trained_model' }.
 * - Feature version mismatch → 'feature_version_mismatch'.
 * - Quality gates failed → 'insufficient_quality'.
 * - Required feature missing and no impute value → 'missing_feature'.
 * The existing 0–100 camera check-in score is a SEPARATE transparent
 * composite (cameraScore.ts) and is never presented as an ML prediction.
 */

export interface ModelArtifact {
  model_id: string; model_version: string; feature_version: string;
  feature_names: string[]; means: number[]; scales: number[]; impute_values: (number | null)[];
  coefficients: number[]; intercept: number; target: string;
  checksum?: string; evaluation?: Record<string, unknown>; limitations?: string[];
}

export type PredictResult =
  | { ok: true; prediction: MLPrediction }
  | { ok: false; suppressed: string; detail: string };

export function shaLike(s: string): string {
  // A short, deterministic checksum for display/comparison only (not a
  // cryptographic guarantee). Real artifacts carry a SHA-256 from training.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(0 + i)) | 0;
  return 'fnv-ish:' + Math.abs(h).toString(16);
}

export function predictKss(artifact: ModelArtifact | null, fv: FeatureVector): PredictResult {
  if (!artifact) return { ok: false, suppressed: 'no_trained_model', detail: 'No trained model artifact is loaded. Model evaluation pending — no estimate is shown.' };
  if (artifact.feature_version !== FEATURE_VERSION || fv.version !== FEATURE_VERSION) {
    return { ok: false, suppressed: 'feature_version_mismatch', detail: `Model expects ${artifact.feature_version}, features are ${fv.version}. Prediction suppressed.` };
  }
  if (!featureVectorUsableForInference(fv)) {
    return { ok: false, suppressed: 'insufficient_quality', detail: `Quality gates failed: ${fv.qualityFlags.join(', ') || 'missing core features'}. Prediction suppressed.` };
  }
  if (JSON.stringify(artifact.feature_names) !== JSON.stringify([...FEATURE_NAMES])) {
    return { ok: false, suppressed: 'feature_order_mismatch', detail: 'Model feature order does not match optiflow-features-v2. Prediction suppressed.' };
  }
  let z = artifact.intercept;
  const contributions: { feature: string; contribution: number }[] = [];
  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    let v = fv.values[i];
    if (v === null) {
      const imp = artifact.impute_values[i];
      if (imp === null) return { ok: false, suppressed: 'missing_feature', detail: `Required feature ${FEATURE_NAMES[i]} is missing and has no imputation value. Prediction suppressed.` };
      v = imp;
    }
    const scaled = (v - artifact.means[i]) / (artifact.scales[i] || 1);
    const c = artifact.coefficients[i] * scaled;
    contributions.push({ feature: FEATURE_NAMES[i], contribution: Math.round(c * 1000) / 1000 });
    z += c;
  }
  const predicted = Math.max(1, Math.min(9, Math.round(z * 10) / 10));
  return {
    ok: true,
    prediction: {
      modelId: artifact.model_id, modelVersion: artifact.model_version, featureVersion: artifact.feature_version,
      target: artifact.target, predictedKss: predicted, contributions,
    },
  };
}
