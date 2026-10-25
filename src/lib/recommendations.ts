import type { CameraMetrics, Suggestion, Session } from '../types';

/**
 * Camera-driven recommendations ONLY.
 *
 * Selection uses CameraMetrics alone — never SelfReport — so a recommendation
 * cannot be triggered by what the user typed. Self-report is used nowhere
 * here; the report shows it separately as a comparison.
 *
 * Every suggestion is detailed and personalised to the actual numbers in
 * this scan (blink rate, closed %, tension level, jaw tightness, head
 * movement, tracking quality). There is deliberately NO generic
 * "no reset is needed, have a walk or some water" fallback: when the
 * observed pattern is steady, the suggestion is a specific maintenance
 * routine built from what was actually steady, plus the one thing to watch.
 * Nothing here promises a higher score, a treatment, or a diagnosis.
 */

function eyeSuggestion(cam: CameraMetrics): Suggestion {
  const bpm = cam.blinksPerMinute;
  const lowBlink = bpm !== null && bpm < 12;
  const highBlink = bpm !== null && bpm > 28;
  const aggressive = cam.aggressiveBlinkCount ?? 0;
  return {
    id: 'eye-rest-detailed', title: 'Eye rest + blink reset — tailored to this scan',
    why: `In this scan your eyes were closed ${cam.eyesClosedPercent}% of valid time, with ${cam.blinkCount} blinks (${bpm ?? '—'}/min), ${aggressive} aggressive (short, deep) blinks and ${cam.softBlinkCount ?? '—'} softer blinks, and mean eye openness ${cam.eyeOpennessMean ?? '—'}. ${lowBlink ? 'That blink rate is on the low side for this scan, which often goes with long, unbroken screen staring.' : highBlink ? 'That blink rate is on the high side for this scan, with a notable share of short, deep blinks.' : 'Your blink pattern in this scan was uneven enough to be worth a deliberate reset.'}`,
    activity: 'A 3-minute eye rest: look away, soften your gaze, and practise complete, gentle blinks — then check glare, brightness, and viewing distance.',
    duration: '3 min', activityId: 'screen-break',
    steps: [
      'Look away from the screen to something at least 6 metres away, or the farthest point in the room, for 60 seconds. Let your gaze soften — do not stare hard.',
      'Do 10 slow, complete blinks: close fully but gently, pause for a beat, then open. Notice whether the last few feel easier than the first few.',
      'Check your setup before you return: is there glare on the screen, is brightness higher than the room, and is the screen about an arm’s length away with the top near eye level?',
      'For the next 20 minutes, set a quiet reminder to blink fully every few minutes, especially during concentrated reading or video calls.',
      'If your eyes still feel gritty, dry, or sore after this, note that in your journal and consider speaking to an eye-care professional — this app does not diagnose eye conditions.',
    ],
    detail: 'This is triggered by your camera eye numbers, not by anything you typed. It is a rest and workspace check, not eye treatment.',
  };
}

function tensionSuggestion(cam: CameraMetrics): Suggestion {
  const tension = Math.round((cam.tensionMovement ?? 0) * 100);
  return {
    id: 'tension-release-detailed', title: 'Tension-release routine — brow, jaw, and shoulders',
    why: `Your tension-related movement level was ${tension}/100 in this scan (brow raise ${cam.browRaiseMean ?? '—'}, forehead furrow ${cam.foreheadFurrowMean ?? '—'}, jaw tightness ${cam.jawTightnessMean ?? '—'}, lip-press ${cam.lipPressMean}). That is movement you may not have noticed while you were concentrating — the camera saw brow and jaw activity even if you did not feel it.`,
    activity: 'A 4-minute gentle release: soften the brow, let the jaw hang, and move the shoulders — no forceful stretches, no clenching exercises.',
    duration: '4 min', activityId: 'jaw-awareness',
    steps: [
      'Brow: place your fingertips lightly on your forehead, breathe out, and let the brow drop and widen. Do not press hard or pull the skin.',
      'Jaw: let your lips rest lightly together, teeth apart, and let your jaw hang softly for 30 seconds. Notice — without forcing it — whether it was resting closed or tight before.',
      'Shoulders: roll them slowly backward 5 times, then forward 5 times, staying well within a comfortable range. Stop if anything pinches or hurts.',
      'Breathing: breathe in for about 4 counts and out for about 6, at a comfortable pace, for 6 breaths. No mandatory breath holding.',
      'Recheck: sit as you were during the scan for 30 seconds and notice whether your brow and jaw feel softer. Note the difference in your journal, rather than expecting a score change.',
    ],
    detail: 'This addresses visible brow/jaw movement only. It does not measure stress, muscle tension, or fascia, and it is not a treatment for jaw problems.',
  };
}

function headSuggestion(cam: CameraMetrics): Suggestion {
  return {
    id: 'head-workspace-detailed', title: 'Workspace + head-position reset',
    why: `Your head was outside your calibrated forward range ${cam.timeOutsideForwardPercent}% of valid time, with yaw variability ${cam.headVariability}° and mean yaw/pitch/roll ${cam.yawMean}° / ${cam.pitchMean}° / ${cam.rollMean}°. That pattern often goes with a screen that is too low, too far to one side, or a long stretch in one position.`,
    activity: 'A 3-minute position reset: adjust the screen, move gently, and return to a forward-facing setup.',
    duration: '3 min', activityId: 'shoulders',
    steps: [
      'Check screen height: the top of the screen should be near eye level, not well below it. Raise it with books or a stand if you can.',
      'Check screen position: it should be directly in front of you, not angled to one side, at about an arm’s length.',
      'Stand, walk a few steps, and roll your neck very gently side to side — only within a comfortable range, never forcing it.',
      'Sit back down, face the camera/screen squarely, and take 3 comfortable breaths before you resume work.',
      'If you work at a laptop for long stretches, note in your journal whether a separate keyboard or a raised screen would help — that is a workspace question, not a posture diagnosis.',
    ],
    detail: 'Head orientation from facial landmarks is not a full-body posture assessment.',
  };
}

function fatigueSuggestion(cam: CameraMetrics): Suggestion {
  const f = cam.fatigueIndicator ?? 0;
  return {
    id: 'rest-detailed', title: 'Rest break — based on your fatigue-related movement pattern',
    why: `Your fatigue-related movement indicator was ${f}/100 in this scan, built from eye openness ${cam.eyeOpennessMean ?? '—'}, blink rate ${cam.blinksPerMinute ?? '—'}/min, gaze variability ${cam.gazeVariability ?? '—'}, and tension movement. Your camera-derived energy for this scan is therefore ${100 - f}/100 (100 − fatigue indicator). This is a movement pattern, not a fatigue measurement — but it is a useful prompt to rest before you push on.`,
    activity: 'A 5-minute real break away from the screen: rest your eyes, move a little, and decide what you actually need next.',
    duration: '5 min', activityId: 'screen-break',
    steps: [
      'Step away from the screen entirely for at least 5 minutes — a break in front of the same screen does not count as a break.',
      'Rest your eyes with your gaze soft and distant, or closed if that feels comfortable. Do not force yourself to stay awake through it.',
      'Have water if you want it, and move gently — a short walk, a stretch, or simply standing.',
      'Before you return, ask yourself: do I need sleep, food, quiet, or just a change of task? Pick the one that fits, rather than defaulting to more screen time.',
      'If tiredness like this is persistent, frequent, or concerning, consider speaking to a qualified professional. This app does not assess sleep disorders or fatigue causes.',
    ],
    detail: 'Triggered by camera movement patterns only. It does not diagnose fatigue causes.',
  };
}

function maintenanceSuggestion(cam: CameraMetrics): Suggestion {
  return {
    id: 'maintenance-detailed', title: 'Keep it steady — a personalised maintenance routine',
    why: `This scan was comparatively steady: eyes closed only ${cam.eyesClosedPercent}% of valid time, blink rate ${cam.blinksPerMinute ?? '—'}/min, tension movement ${Math.round((cam.tensionMovement ?? 0) * 100)}/100, and head outside forward range only ${cam.timeOutsideForwardPercent}%. That does not mean “nothing to do” — it means the useful work is protecting what was steady, and watching the one number that was least steady in this scan.`,
    activity: 'A 2-minute maintenance routine: one deliberate blink reset, one posture check, and a micro-break plan for the next hour.',
    duration: '2 min', activityId: 'walk',
    steps: [
      `Blink reset: do 5 slow, complete blinks. Your blink rate in this scan was ${cam.blinksPerMinute ?? '—'}/min — use that as your own reference for later scans, not a target to hit.`,
      'Posture check: screen at eye level, directly in front of you, about an arm’s length away. Adjust one thing now if it is off.',
      'Micro-break plan: every 25–30 minutes, look away for 20–30 seconds and blink fully. Set one quiet reminder for the next hour.',
      'One thing to watch: ' + (cam.eyesClosedPercent > 8 ? 'your eyes-closed share was the least steady number here — notice it in your next scan.' : (cam.tensionMovement ?? 0) > 0.25 ? 'your tension movement was the least steady number here — notice your brow and jaw in your next scan.' : 'your head position was the least steady number here — notice whether your screen drifts to one side.'),
      'Save this check-in so the next scan can be compared with this steady baseline, rather than with a population average.',
    ],
    detail: 'This is not “no reset needed.” It is a short, specific routine built from your actual numbers in this scan.',
  };
}

function qualitySuggestion(cam: CameraMetrics): Suggestion {
  return {
    id: 'tracking-quality-detailed', title: 'Fix tracking first, then compare',
    why: `Only ${cam.usablePercent}% of frames were usable in this scan (${cam.framesValid} of ${cam.framesAttempted}), with ${cam.interruptions} interruptions, ${cam.noFaceFrames} no-face frames, and ${cam.multipleFaceFrames} multi-face frames. With tracking this patchy, every other camera number — and the camera score — is less trustworthy, so fixing the setup matters more than interpreting the numbers.`,
    activity: 'A 2-minute setup check: light, framing, and a fresh 20-second scan.',
    duration: '2 min',
    steps: [
      'Face a soft light source (a window or lamp in front of you, not behind you). Strong backlight is the most common cause of lost tracking.',
      'Keep your whole face in frame, centred, at a comfortable distance — not so close that the forehead or chin is cut off.',
      'Remove or reduce reflections: glasses glare, a bright window behind you, or a second face in frame all break tracking.',
      'Run a fresh 20-second scan and check that usable frames are above 80% before you compare it with earlier scans.',
      'If tracking stays poor on this device, use the clearly labelled demo report to explore the interface, and treat this scan as a setup test, not a result.',
    ],
    detail: 'Tracking quality is shown separately from the score for exactly this reason.',
  };
}

/** Camera-only suggestions, ordered by the weakest camera component first. */
export function buildSuggestions(cam: CameraMetrics, _history?: Session[]): Suggestion[] {
  const out: Suggestion[] = [];
  const push = (s: Suggestion) => { if (!out.some(x => x.id === s.id)) out.push(s); };
  if (cam.usablePercent < 60) push(qualitySuggestion(cam));
  const eyeWeak = cam.eyesClosedPercent > 8 || (cam.blinksPerMinute !== null && (cam.blinksPerMinute < 10 || cam.blinksPerMinute > 28)) || (cam.aggressiveBlinkCount ?? 0) > cam.blinkCount * 0.3;
  const tensionHigh = (cam.tensionMovement ?? 0) > 0.25 || (cam.jawTightnessMean ?? 0) > 0.25;
  const headWeak = cam.timeOutsideForwardPercent > 15 || cam.headVariability > 6;
  const fatigueHigh = (cam.fatigueIndicator ?? 0) >= 50;
  if (eyeWeak) push(eyeSuggestion(cam));
  if (tensionHigh) push(tensionSuggestion(cam));
  if (headWeak) push(headSuggestion(cam));
  if (fatigueHigh) push(fatigueSuggestion(cam));
  // Always give a detailed, personalised maintenance routine — never a generic "no reset needed" line.
  push(maintenanceSuggestion(cam));
  return out.slice(0, 5);
}

/** Backwards-compatible name used by older call sites (now camera-only). */
export const buildCameraSuggestions = buildSuggestions;
