import type { SelfReport } from '../types';
import { SCORE_BANDS } from '../types';

export interface ScoreResult {
  score: number | null; label: string | null; color: string | null;
  contributors: string[]; mean: number | null; comparable: boolean;
  reason: string;
}

const CORE: Array<[keyof SelfReport, string]> = [
  ['stress', 'Stress'], ['fatigue', 'Fatigue'],
  ['eyeDiscomfort', 'Eye discomfort'], ['jawDiscomfort', 'Jaw discomfort'],
];

/** Transparent prototype formula. Energy is context only, never in the formula. */
export function computeScore(r: SelfReport): ScoreResult {
  const done = CORE.filter(([k]) => typeof r[k] === 'number')
    .map(([k, label]) => ({ label, value: r[k] as number }));
  if (done.length < 3) {
    return {
      score: null, label: null, color: null, contributors: done.map(d => d.label),
      mean: null, comparable: false,
      reason: `Only ${done.length} of 4 core items completed. At least 3 are needed for a score, so this session has a camera-observation report instead of an invented score.`,
    };
  }
  const mean = done.reduce((s, d) => s + d.value, 0) / done.length;
  const score = Math.round(100 * (1 - mean / 10));
  const band = SCORE_BANDS.find(b => score >= b.min)!;
  return {
    score, label: band.label, color: band.color,
    contributors: done.map(d => d.label), mean,
    comparable: done.length === 4,
    reason: done.length === 4
      ? 'All 4 core items contributed, so this score is directly comparable with other 4-item sessions.'
      : 'Only 3 core items contributed, so this score is less directly comparable with 4-item sessions.',
  };
}

export function bandFor(score: number | null) {
  if (score === null) return null;
  return SCORE_BANDS.find(b => score >= b.min)!;
}
