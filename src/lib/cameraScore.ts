import type { CameraMetrics } from '../types';
import { SCORE_BANDS } from '../types';

export interface CameraScoreComponent { name: string; weight: number; value: number; detail: string; }
export interface CameraScoreResult {
  score: number | null; label: string | null; color: string | null;
  components: CameraScoreComponent[]; confidence: string; reason: string; available: boolean;
}

const clamp100 = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/**
 * THE FINAL SCORE — camera-derived only.
 *
 * This function takes ONLY CameraMetrics. It never reads SelfReport, so the
 * final score is completely independent of what the user typed, and two
 * sessions with identical camera data but different self-reports get the
 * identical camera score (tested in cameraScore.test.ts).
 *
 * What it actually is: a transparent, product-convention composite of
 * OBSERVED movement in this scan — eye closure/openness, tension-related
 * movement, blink stability, and head steadiness — averaged over the whole
 * scan, not a single frame. It is NOT a stress, fatigue, mood, or health
 * measurement, and it is NOT a diagnosis. Its "accuracy" improvements are
 * measurement-stability improvements (see below), not clinical accuracy:
 *
 * 1. Whole-scan averages, never single-frame spikes.
 * 2. Baseline-calibrated blink thresholds (EAR low/high from the 5s baseline).
 * 3. Hysteresis blink counting, so noise around one threshold is not double-counted.
 * 4. Unusable frames (no face / multiple faces) are excluded from every denominator.
 * 5. Time is from frame timestamps, capped at 500ms gaps, so a background-tab
 *    suspension cannot inflate the score's denominator.
 * 6. Experimental pixel appearance (darkness/redness/brightness change) is
 *    DELIBERATELY excluded from the score — it is lighting-dominated and
 *    would make the score less accurate, not more.
 * 7. If valid time < 10s or usable frames < 30%, no score is given at all,
 *    rather than an invented one. Short scans (10–29s) are flagged less stable.
 *
 * Weights: Eye comfort 40% + Tension-related movement 30% +
 *           Blink stability 15% + Head steadiness 15% = 100%.
 * These weights and the neutral ranges below are product conventions,
 * not validated clinical thresholds. They are shown in full on the report.
 */
export function computeCameraScore(cam: CameraMetrics): CameraScoreResult {
  if (cam.validSeconds < 10 || cam.usablePercent < 30) {
    return {
      score: null, label: null, color: null, components: [], available: false,
      confidence: 'Unavailable',
      reason: cam.validSeconds < 10
        ? `Only ${cam.validSeconds}s of valid observation — at least 10s is needed for a camera score, so none is invented.`
        : `Only ${cam.usablePercent}% of frames were usable — at least 30% is needed for a camera score, so none is invented.`,
    };
  }

  // --- Eye comfort (40%) ---
  let eye = 100;
  eye -= Math.min(cam.eyesClosedPercent * 2.5, 50); // 20% closed -> -50
  if (cam.blinksPerMinute !== null) {
    eye -= Math.min(Math.abs(cam.blinksPerMinute - 18) / 18 * 30, 30); // deviation from 18/min midpoint, product convention
  }
  if (cam.eyeOpennessMean !== undefined && cam.eyeOpennessMean < 0.22) {
    eye -= Math.min((0.22 - cam.eyeOpennessMean) * 200, 30); // low mean EAR = more closed / heavy-eyelid proxy
  }
  eye = clamp100(eye);

  // --- Tension-related movement comfort (30%) ---
  const tension = cam.tensionMovement ?? (cam.jawTightnessMean !== undefined ? clamp100(cam.jawTightnessMean * 100) / 100 : 0);
  const tensionComfort = clamp100(100 - tension * 100);

  // --- Blink stability (15%) ---
  let blinkStability = 75; // neutral when no median blink duration is available
  if (cam.medianBlinkDurationMs !== null) {
    const d = cam.medianBlinkDurationMs;
    if (d >= 150 && d <= 350) blinkStability = 100;
    else if (d < 150) blinkStability = clamp100(100 - (150 - d) * 0.3);
    else blinkStability = clamp100(100 - (d - 350) * 0.2);
  }
  if (cam.aggressiveBlinkCount !== undefined && cam.blinkCount > 0) {
    const aggressiveShare = cam.aggressiveBlinkCount / cam.blinkCount;
    blinkStability = clamp100(blinkStability - aggressiveShare * 20);
  }

  // --- Head steadiness (15%) ---
  let head = 100;
  head -= Math.min(cam.timeOutsideForwardPercent * 1.2, 50);
  head -= Math.min(Math.max(cam.headVariability - 3, 0) * 5, 20);
  head = clamp100(head);

  const components: CameraScoreComponent[] = [
    { name: 'Eye comfort', weight: 40, value: eye, detail: `Eyes closed ${cam.eyesClosedPercent}% of valid time · ${cam.blinksPerMinute ?? '—'} blinks/min · mean eye openness ${cam.eyeOpennessMean ?? '—'}` },
    { name: 'Tension-related movement', weight: 30, value: tensionComfort, detail: `Tension movement level ${Math.round(tension * 100)}/100 (brow raise + forehead furrow + jaw tightness) · brow movement ${cam.browMovement}` },
    { name: 'Blink stability', weight: 15, value: blinkStability, detail: `Median blink ${cam.medianBlinkDurationMs ?? '—'} ms · aggressive blinks ${cam.aggressiveBlinkCount ?? '—'} of ${cam.blinkCount} · soft blinks ${cam.softBlinkCount ?? '—'}` },
    { name: 'Head steadiness', weight: 15, value: head, detail: `Outside forward range ${cam.timeOutsideForwardPercent}% · yaw variability ${cam.headVariability}°` },
  ];
  const score = Math.round(eye * 0.4 + tensionComfort * 0.3 + blinkStability * 0.15 + head * 0.15);
  const band = SCORE_BANDS.find(b => score >= b.min)!;
  const confidence = cam.validSeconds < 30 ? 'Lower — short scan (under 30s valid)'
    : cam.usablePercent < 80 ? 'Lower — tracking quality under 80%'
    : 'Good — full scan, usable frames at or above 80%';
  return {
    score, label: band.label, color: band.color, components, available: true, confidence,
    reason: 'Computed only from camera observations in this scan, averaged over the whole scan. Self-report was not used in this score at all — it is shown separately as a comparison.',
  };
}
