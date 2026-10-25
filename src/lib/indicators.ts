import type { Indicator, Session } from '../types';
import { SCORE_BANDS } from '../types';

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const bandForComfort = (comfort: number | null) => {
  if (comfort === null) return { color: null as string | null, label: null as string | null };
  const b = SCORE_BANDS.find(b => comfort >= b.min)!;
  return { color: b.color, label: b.label };
};

/** Colour-match one indicator to the same spectrum as the score.
 *  Colour is always paired with a label and a number, never used alone. */
function ind(id: string, name: string, kind: Indicator['kind'], display: string, comfort: number | null, method: string, limitation: string): Indicator {
  const { color, label } = bandForComfort(comfort);
  return { id, name, kind, display, comfort, color, label, method, limitation };
}

export const srComfort = (rating: number | undefined, invert = true) =>
  rating === undefined ? null : (invert ? Math.round(100 - rating * 10) : Math.round(rating * 10));

/**
 * Build the full assessed-indicator list for a session.
 *
 * Framing rule (deliberate, and stated on every card):
 * - Self-report is the authority for how you feel (mood, energy, fatigue,
 *   stress, discomfort, focus, calm, headache, neck tension).
 * - The camera only observes visible movement and relative appearance
 *   change vs your own baseline. It does NOT measure stress, fatigue,
 *   mood, emotion, muscle tension, dark circles, redness, puffiness,
 *   paleness, teeth grinding, or tense fascia directly. Those words
 *   appear below only as the visible proxies that were actually tracked,
 *   with their limits stated.
 * - Energy (camera-derived) is exactly 100 − fatigue indicator, as requested.
 *   Self-reported energy, when present, is shown separately and takes precedence.
 */
export function buildIndicators(s: Session): Indicator[] {
  const r = s.selfReport; const c = s.camera;
  const fatigueObs = c.fatigueIndicator ?? null;
  const energyObs = c.energyIndicator ?? (fatigueObs !== null && fatigueObs !== undefined ? 100 - fatigueObs : null);
  const out: Indicator[] = [
    ind('mood', 'Mood (self-reported)', 'self-report',
      r.mood !== undefined ? `${r.mood}/10 — higher is more positive` : 'Not answered',
      srComfort(r.mood, false),
      'Your own rating. The camera does not read mood or emotion from a face.',
      'Mood is personal and contextual; a face alone cannot establish it.'),
    ind('energy-self', 'Energy (self-reported)', 'self-report',
      r.energy !== undefined ? `${r.energy}/10` : 'Not answered',
      srComfort(r.energy, false),
      'Your own rating, shown separately from the score formula.',
      'Self-reported energy is context, not a camera measurement.'),
    ind('energy-camera', 'Energy (camera-derived)', 'derived',
      energyObs !== null ? `${energyObs}/100 — derived as 100 − fatigue indicator` : 'Unavailable — insufficient camera data',
      energyObs,
      'Derived exactly as 100 minus the observational fatigue indicator below. It is not a direct energy measurement.',
      'If the fatigue indicator is noisy, this derived value is noisy too. Prefer your self-reported energy.'),
    ind('fatigue-self', 'Fatigue (self-reported)', 'self-report',
      r.fatigue !== undefined ? `${r.fatigue}/10` : 'Not answered',
      srComfort(r.fatigue, true),
      'Your own rating of sleepiness / fatigue.',
      'The most reliable fatigue signal in this app is your own report.'),
    ind('fatigue-camera', 'Fatigue-related movement indicator (camera)', 'camera',
      fatigueObs !== null ? `${fatigueObs}/100 intensity` : 'Unavailable',
      fatigueObs !== null ? 100 - fatigueObs : null,
      'Combines low eye openness, altered blink rate, gaze variability, and brow tension vs your baseline. Intensity 0 = no such movement pattern, 100 = strongest observed pattern.',
      'This is a movement pattern, not a fatigue measurement. Lighting, task, and individual differences dominate it.'),
    ind('stress-self', 'Stress (self-reported)', 'self-report',
      r.stress !== undefined ? `${r.stress}/10` : 'Not answered',
      srComfort(r.stress, true),
      'Your own rating. Stress is hard to assess from a physical image alone.',
      'No camera number in this app is presented as a stress measurement.'),
    ind('tension-movement', 'Visible tension-related movement (camera)', 'camera',
      c.tensionMovement !== undefined ? `${Math.round(c.tensionMovement * 100)}/100 movement level` : 'Unavailable',
      c.tensionMovement !== undefined ? Math.round(100 - c.tensionMovement * 100) : null,
      'Brow raise + forehead furrow (brow-down) + jaw tightness (lip-press with jaw closed) + brow variability. Tracks the visible signs you listed — raised eyebrows, forehead furrows, brow tension — as movement, not as stress itself.',
      'Raised eyebrows and furrows have many ordinary causes (light, concentration, speech). This does not measure stress, tense fascia, or muscle tension.'),
    ind('eye-discomfort-self', 'Eye discomfort (self-reported)', 'self-report',
      r.eyeDiscomfort !== undefined ? `${r.eyeDiscomfort}/10` : 'Not answered',
      srComfort(r.eyeDiscomfort, true),
      'Your own rating of eye dryness, strain, or soreness.',
      'The camera cannot feel discomfort; only you can report it.'),
    ind('eye-movement', 'Eye movement & blink pattern (camera)', 'camera',
      `Blinks ${c.blinkCount} · ${c.blinksPerMinute ?? '—'}/min · aggressive ${c.aggressiveBlinkCount ?? 0} · soft ${c.softBlinkCount ?? 0} · eyes closed ${c.eyesClosedPercent}%`,
      c.eyesClosedPercent !== null ? Math.round(100 - Math.min(c.eyesClosedPercent * 2, 100)) : null,
      'Aggressive blink proxy = short, deep EAR drop; soft blink = longer, shallower drop. Raised-eyebrow activity is tracked in the tension indicator. Eye-region appearance change is tracked separately below.',
      'Blink “aggressiveness” is a duration/depth proxy, not a clinical eye exam. It does not establish eye discomfort, redness, or swelling.'),
    ind('eye-appearance', 'Eye-region appearance change vs baseline (experimental)', 'camera',
      (c.eyeDarknessChange !== undefined || c.eyeRednessChange !== undefined)
        ? `Under-eye darkness change ${c.eyeDarknessChange ?? '—'} · redness change ${c.eyeRednessChange ?? '—'} (relative units, baseline = 0)`
        : 'Unavailable — no baseline appearance sample',
      null,
      'Pixel samples under the eyes vs your cheek, compared with your own 5-second baseline in the same lighting. A positive darkness change means the under-eye area was relatively darker than your cheek than it was at baseline.',
      'Experimental and lighting-dominated. It does NOT measure dark circles, red or swollen eyes, or puffiness, and it varies with skin tone, light direction, and camera. No colour band is assigned to this experimental value.'),
    ind('jaw-self', 'Jaw discomfort (self-reported)', 'self-report',
      r.jawDiscomfort !== undefined ? `${r.jawDiscomfort}/10` : 'Not answered',
      srComfort(r.jawDiscomfort, true),
      'Your own rating of jaw tension or discomfort.',
      'Jaw movement alone is not proof of clenching or grinding.'),
    ind('jaw-movement', 'Jaw movement & tightness (camera)', 'camera',
      `Jaw-opening events ${c.jawOpenEvents} · movement ${c.jawMovementFreqPerMin ?? '—'}/min · tightness ${c.jawTightnessMean !== undefined ? Math.round(c.jawTightnessMean * 100) : '—'}/100`,
      c.jawTightnessMean !== undefined ? Math.round(100 - c.jawTightnessMean * 100) : null,
      'Jaw-opening frequency vs your baseline, plus lip-press while the jaw is closed as a tightness proxy. “Moving your jaw more than normal” is measured against your own baseline, not a population norm.',
      'This does not detect jaw clenching or teeth grinding. Teeth are not reliably visible, and grinding is often silent and nocturnal.'),
    ind('face-appearance', 'Face brightness / saturation change vs baseline (experimental)', 'camera',
      c.faceBrightnessChange !== undefined ? `${c.faceBrightnessChange} relative units (baseline = 0)` : 'Unavailable',
      null,
      'Mean face brightness and colour saturation sampled from cheek/forehead, compared with your baseline in the same session.',
      'Experimental only. It does NOT measure paleness or dullness as health signs — lighting, camera exposure, and skin tone dominate it. No colour band is assigned.'),
    ind('head-movement', 'Head movement (camera)', 'camera',
      `Yaw ${c.yawMean}° · pitch ${c.pitchMean}° · roll ${c.rollMean}° · variability ${c.headVariability}° · outside forward range ${c.timeOutsideForwardPercent}%`,
      c.timeOutsideForwardPercent !== null ? Math.round(100 - Math.min(c.timeOutsideForwardPercent * 2, 100)) : null,
      'Head orientation from facial transformation matrices, relative to your calibrated forward pose.',
      'Not a posture assessment. A still head is not healthier than a moving one.'),
    ind('focus-self', 'Focus (self-reported)', 'self-report',
      r.focus !== undefined ? `${r.focus}/10` : 'Not answered',
      srComfort(r.focus, false),
      'Your own rating of focus right now.', 'Context only; not part of the score.'),
    ind('calm-self', 'Calm (self-reported)', 'self-report',
      r.calm !== undefined ? `${r.calm}/10` : 'Not answered',
      srComfort(r.calm, false),
      'Your own rating of calm right now.', 'Context only; not part of the score.'),
    ind('headache-self', 'Headache (self-reported)', 'self-report',
      r.headache !== undefined ? `${r.headache}/10` : 'Not answered',
      srComfort(r.headache, true),
      'Your own rating. If headache persists or concerns you, consider a qualified professional.',
      'Context only; the camera does not assess headache.'),
    ind('neck-self', 'Neck / shoulder tension (self-reported)', 'self-report',
      r.neckTension !== undefined ? `${r.neckTension}/10` : 'Not answered',
      srComfort(r.neckTension, true),
      'Your own rating.', 'Context only; the camera does not assess neck or shoulder tension directly.'),
  ];
  return out;
}
