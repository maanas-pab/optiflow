import { describe, it, expect } from 'vitest';
import { computeScore } from './scoring';

describe('OptiFlow Check-in Score', () => {
  it('uses the documented formula: round(100 * (1 - mean/10))', () => {
    expect(computeScore({ stress: 2, fatigue: 2, eyeDiscomfort: 2, jawDiscomfort: 2 }).score).toBe(80);
    expect(computeScore({ stress: 0, fatigue: 0, eyeDiscomfort: 0, jawDiscomfort: 0 }).score).toBe(100);
    expect(computeScore({ stress: 10, fatigue: 10, eyeDiscomfort: 10, jawDiscomfort: 10 }).score).toBe(0);
  });
  it('requires at least three core items and never invents a score', () => {
    const r = computeScore({ stress: 5, fatigue: 5 });
    expect(r.score).toBeNull();
    expect(r.contributors).toEqual(['Stress', 'Fatigue']);
  });
  it('labels 3-item sessions as less directly comparable', () => {
    const r = computeScore({ stress: 3, fatigue: 3, eyeDiscomfort: 3 });
    expect(r.score).toBe(70); expect(r.comparable).toBe(false);
    expect(computeScore({ stress: 3, fatigue: 3, eyeDiscomfort: 3, jawDiscomfort: 3 }).comparable).toBe(true);
  });
  it('keeps energy out of the formula', () => {
    expect(computeScore({ stress: 4, fatigue: 4, eyeDiscomfort: 4, jawDiscomfort: 4, energy: 0 }).score)
      .toBe(computeScore({ stress: 4, fatigue: 4, eyeDiscomfort: 4, jawDiscomfort: 4, energy: 10 }).score);
  });
  it('assigns the documented bands', () => {
    expect(computeScore({ stress: 1, fatigue: 1, eyeDiscomfort: 1, jawDiscomfort: 1 }).label).toBe('Feeling comfortable');
    expect(computeScore({ stress: 9, fatigue: 9, eyeDiscomfort: 9, jawDiscomfort: 9 }).label).toBe('Make room for rest');
  });
});
