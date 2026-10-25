import { describe, it, expect } from 'vitest';
import { buildCloudSessionData, importCandidates, mergeSessions, sessionToRow, DEFAULT_PREFERENCES } from './cloud';
import type { Session } from '../types';

function fakeSession(id: string, isDemo = false): Session {
  return {
    id, createdAt: '2026-10-25T10:00:00.000Z', isDemo,
    selfReport: { stress: 3, kss: 5 },
    camera: { validSeconds: 60, wallSeconds: 60, framesAttempted: 100, framesValid: 90, usablePercent: 90, samplingHz: 30, interruptions: 0, multipleFaceFrames: 0, noFaceFrames: 0, blinkCount: 20, blinksPerMinute: 20, medianBlinkDurationMs: 250, meanBlinkIntervalSec: 3, eyesClosedPercent: 10, eyeClosureConsistency: null, jawOpenMean: 0.1, jawOpenEvents: 2, mouthOpenEvents: 2, browMovement: 0.1, lipPressMean: 0.1, movementVariability: 0.1, yawMean: 0, pitchMean: 0, rollMean: 0, headVariability: 2, timeOutsideForwardPercent: 5, baselineAvailable: true, insufficient: false },
    score: 70, scoreLabel: 'Some discomfort', scoreColor: '#BCCFDF',
    scoreContributors: [], suggestions: [], scanDurationLabel: '60 s valid',
    pulse: { method: 'POS', methodVersion: 'optiflow-pos-v1', bpm: 72, snr: 5, estimates: [], waveform: [{ tSec: 0, value: 1, valid: true }], waveformWindowStartSec: 0, waveformWindowEndSec: 10, usableSeconds: 60, quality: 'ok' },
    replay: { version: 'optiflow-replay-v1', measurementVersion: 'optiflow-features-v2', pulseMethod: 'optiflow-pos-v1', durationSec: 60, frames: [], events: [], createdAt: '2026-10-25T10:00:00.000Z' },
  };
}

describe('cloud session preparation', () => {
  it('strips pulse waveform and replay by default (opt-in only)', () => {
    const data = buildCloudSessionData(fakeSession('s-1'), DEFAULT_PREFERENCES);
    expect((data.pulse as { waveform: unknown[] }).waveform).toEqual([]);
    expect(data.replay).toBeUndefined();
  });
  it('keeps waveform only when explicitly opted in', () => {
    const data = buildCloudSessionData(fakeSession('s-1'), { ...DEFAULT_PREFERENCES, savePulseWaveform: true });
    expect((data.pulse as { waveform: unknown[] }).waveform.length).toBe(1);
  });
  it('row always carries the caller user id (ownership is never taken from the session object)', () => {
    const row = sessionToRow(fakeSession('s-1'), 'user-A', DEFAULT_PREFERENCES, 'America/Chicago');
    expect(row.user_id).toBe('user-A');
    expect(row.client_session_id).toBe('s-1');
  });
  it('import skips demo sessions and already-cloud sessions (no silent reassignment, no duplicates)', () => {
    const local = [fakeSession('s-1'), fakeSession('s-2', true), fakeSession('s-3')];
    const out = importCandidates(local, new Set(['s-3']));
    expect(out.map(s => s.id)).toEqual(['s-1']);
  });
  it('merge: cloud wins on conflict, local-only kept as unsynced, no duplicates', () => {
    const cloud = [{ ...fakeSession('s-1'), score: 80 }];
    const local = [fakeSession('s-1'), fakeSession('s-2')];
    const merged = mergeSessions(cloud, local);
    expect(merged.map(s => s.id).sort()).toEqual(['s-1', 's-2']);
    expect(merged.find(s => s.id === 's-1')?.score).toBe(80);
    expect(merged.find(s => s.id === 's-1')?.cloud?.synced).toBe(true);
    expect(merged.find(s => s.id === 's-2')?.cloud?.synced).toBe(false);
  });
});
