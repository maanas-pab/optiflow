import { describe, it, expect } from 'vitest';
import { createBlinkState, updateBlink, median, validSecondsFromTimestamps, usablePercent, aggregateSessionsByDay } from './metrics';

describe('blink counting with hysteresis', () => {
  it('counts one blink for a close-then-open sequence, not noisy flicker', () => {
    let s = createBlinkState();
    s = updateBlink(s, 0.30, 0, 0, 0.18, 0.22); // baseline open
    s = updateBlink(s, 0.10, 100, 16, 0.18, 0.22); // close
    s = updateBlink(s, 0.12, 200, 16, 0.18, 0.22); // still closed, not a second blink
    s = updateBlink(s, 0.30, 350, 16, 0.18, 0.22); // open -> 1 blink, ~250ms
    expect(s.blinks).toBe(1);
    expect(median(s.durationsMs)).toBe(250);
  });
  it('does not count a sub-40ms flicker as a blink', () => {
    let s = createBlinkState();
    s = updateBlink(s, 0.10, 0, 16, 0.18, 0.22);
    s = updateBlink(s, 0.30, 20, 16, 0.18, 0.22);
    expect(s.blinks).toBe(0);
  });
});

describe('valid time and aggregation', () => {
  it('sums capped gaps and never assumes a fixed frame rate', () => {
    expect(validSecondsFromTimestamps([0, 33, 66, 100])).toBeCloseTo(0.1, 2);
    // A 10-second background-tab gap is capped at 500ms, not counted as 10s of observation.
    expect(validSecondsFromTimestamps([0, 33, 10033])).toBeCloseTo(0.533, 2);
  });
  it('computes usable percent and daily means from scored sessions only', () => {
    expect(usablePercent(90, 100)).toBe(90);
    expect(usablePercent(0, 0)).toBe(0);
    const days = aggregateSessionsByDay([
      { createdAt: '2026-10-20T09:00:00Z', score: 80 },
      { createdAt: '2026-10-20T17:00:00Z', score: 60 },
      { createdAt: '2026-10-20T18:00:00Z', score: null },
      { createdAt: '2026-10-21T09:00:00Z', score: 70 },
    ]);
    expect(days[0]).toMatchObject({ date: '2026-10-20', count: 3, scoredCount: 2, meanScore: 70, cameraOnly: 1 });
    expect(days[1].meanScore).toBe(70);
  });
  it('median handles empty and even inputs without inventing values', () => {
    expect(median([])).toBeNull();
    expect(median([1, 3])).toBe(2);
  });
});
