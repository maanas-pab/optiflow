import { describe, it, expect } from 'vitest';
import { buildIndicators, bandForComfort } from './indicators';
import type { Session } from '../types';

function session(partial: Partial<Session>): Session {
  return {
    id: 't', createdAt: '2026-10-24T10:00:00Z', selfReport: {}, camera: {
      validSeconds: 60, wallSeconds: 64, framesAttempted: 100, framesValid: 95, usablePercent: 95, samplingHz: 30,
      interruptions: 0, multipleFaceFrames: 0, noFaceFrames: 5, blinkCount: 18, blinksPerMinute: 18,
      medianBlinkDurationMs: 200, meanBlinkIntervalSec: 3, eyesClosedPercent: 5, eyeClosureConsistency: null,
      jawOpenMean: 0.1, jawOpenEvents: 4, mouthOpenEvents: 3, browMovement: 0.1, lipPressMean: 0.05,
      movementVariability: 0.1, yawMean: 0, pitchMean: 0, rollMean: 0, headVariability: 2,
      timeOutsideForwardPercent: 5, baselineAvailable: true, insufficient: false,
    },
    score: null, scoreLabel: null, scoreColor: null, scoreContributors: [], suggestions: [], scanDurationLabel: '60 s valid',
    ...partial,
  } as Session;
}

describe('indicators', () => {
  it('derives energy exactly as 100 − fatigue indicator', () => {
    const s = session({ camera: { ...session({}).camera, fatigueIndicator: 30, energyIndicator: 70 } });
    const energy = buildIndicators(s).find(i => i.id === 'energy-camera')!;
    expect(energy.display).toContain('70/100');
    expect(energy.comfort).toBe(70);
  });
  it('colour-matches comfort to the score spectrum', () => {
    expect(bandForComfort(85).color).toBe('#B9CDBB');
    expect(bandForComfort(50).color).toBe('#C9C2DD');
    expect(bandForComfort(10).color).toBe('#E5BAA8');
    expect(bandForComfort(null).color).toBeNull();
  });
  it('keeps mood as self-report only and never invents a camera mood', () => {
    const s = session({ selfReport: { mood: 7 } });
    const mood = buildIndicators(s).find(i => i.id === 'mood')!;
    expect(mood.kind).toBe('self-report');
    expect(mood.comfort).toBe(70);
    expect(mood.method).toContain('camera does not read mood');
  });
  it('marks experimental appearance indicators with no colour band', () => {
    const s = session({ camera: { ...session({}).camera, eyeDarknessChange: 2.5 } });
    const app = buildIndicators(s).find(i => i.id === 'eye-appearance')!;
    expect(app.color).toBeNull();
    expect(app.limitation).toContain('does NOT measure dark circles');
  });
});
