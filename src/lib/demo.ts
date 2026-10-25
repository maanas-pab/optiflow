import type { Session } from '../types';
import { computeScore } from './scoring';
import { buildSuggestions } from './recommendations';
import { computeCameraScore } from './cameraScore';

/** Clearly-labelled fictional demo data. Never written to the personal store. */
function demoSession(daysAgo: number, stress: number, fatigue: number, eye: number, jaw: number, energy: number, blinks: number, closed: number): Session {
  const createdAt = new Date(Date.now() - daysAgo * 86400000 - 3600000 * 10).toISOString();
  const selfReport = { stress, fatigue, energy, eyeDiscomfort: eye, jawDiscomfort: jaw, mood: 6, focus: 6, calm: 5, headache: 1, neckTension: 3, sleepHours: 7, screenHours: 6, activity: 'Desk work' };
  const camera = {
    validSeconds: 60, wallSeconds: 64, framesAttempted: 1800, framesValid: 1720, usablePercent: 96, samplingHz: 29,
    interruptions: 1, multipleFaceFrames: 0, noFaceFrames: 79, blinkCount: blinks,
    blinksPerMinute: blinks, medianBlinkDurationMs: 210, meanBlinkIntervalSec: 60 / Math.max(blinks, 1),
    eyesClosedPercent: closed, eyeClosureConsistency: 0.92, jawOpenMean: 0.12, jawOpenEvents: 4, mouthOpenEvents: 3,
    browMovement: 0.18, lipPressMean: 0.08, movementVariability: 0.22, yawMean: 2, pitchMean: -1, rollMean: 1,
    headVariability: 3.1, timeOutsideForwardPercent: 6, baselineAvailable: true, insufficient: false,
    browRaiseMean: 0.15, foreheadFurrowMean: 0.1, eyeOpennessMean: 0.26, blinkForceMean: 0.55,
    aggressiveBlinkCount: 2, softBlinkCount: Math.max(blinks - 2, 0), gazeVariability: 0.02,
    jawMovementFreqPerMin: 4, jawTightnessMean: 0.1, mouthMovement: 0.15, tensionMovement: 0.18,
    eyeDarknessChange: 1.2, eyeRednessChange: 0.4, faceBrightnessChange: -0.8,
    fatigueIndicator: fatigue * 10, energyIndicator: 100 - fatigue * 10,
  };
  const s = computeScore(selfReport);
  const cs = computeCameraScore(camera);
  return {
    id: 'demo-' + daysAgo, createdAt, isDemo: true, selfReport, camera,
    score: cs.score, scoreLabel: cs.label, scoreColor: cs.color,
    cameraScore: cs.score, cameraScoreComponents: cs.components, cameraScoreConfidence: cs.confidence,
    selfReportScore: s.score, selfReportScoreLabel: s.label, scoreContributors: s.contributors,
    suggestions: buildSuggestions(camera), scanDurationLabel: '60 s valid',
  };
}

export const DEMO_SESSIONS: Session[] = [
  demoSession(6, 3, 3, 2, 1, 7, 18, 4),
  demoSession(4, 5, 4, 4, 2, 5, 14, 6),
  demoSession(2, 2, 2, 1, 1, 8, 20, 3),
  demoSession(0, 4, 5, 3, 2, 6, 15, 5),
];
