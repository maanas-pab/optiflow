/** Pure measurement helpers — no camera, no DOM, fully testable. */

export interface BlinkState {
  isClosed: boolean; closedSinceMs: number | null;
  blinks: number; durationsMs: number[]; lastBlinkEndMs: number | null;
  intervalsSec: number[]; closedMs: number;
  minEarDuringClose: number | null; drops: number[];
  aggressiveCount: number; softCount: number;
  /** Closures interrupted by tracking loss — censored, never counted as blinks. */
  censoredCount: number;
  /** Closures longer than 1200 ms that reopened — sustained closures, not blinks. */
  sustainedCount: number;
}

/** Hysteresis blink tracker: close below low, open above high. Prevents
 *  double-counting noisy frames around a single threshold.
 *  Also tracks blink depth (EAR drop vs baseline EAR) so blinks can be
 *  split into a short/deep “aggressive” proxy and a longer/shallower
 *  “soft” proxy. Those are duration/depth proxies, not clinical grades. */
export function createBlinkState(): BlinkState {
  return { isClosed: false, closedSinceMs: null, blinks: 0, durationsMs: [], lastBlinkEndMs: null, intervalsSec: [], closedMs: 0, minEarDuringClose: null, drops: [], aggressiveCount: 0, softCount: 0, censoredCount: 0, sustainedCount: 0 };
}

/** Censor an in-progress closure when tracking is lost (no face / multiple
 *  faces / invalid frame). The closure is discarded, not counted, and the
 *  next reopening cannot retroactively complete it. Call this on every
 *  invalid observation while a closure is open. */
export function censorBlink(state: BlinkState): BlinkState {
  if (!state.isClosed) return state;
  return { ...state, isClosed: false, closedSinceMs: null, minEarDuringClose: null, censoredCount: state.censoredCount + 1 };
}

export function updateBlink(state: BlinkState, ear: number, nowMs: number, frameMs: number, low: number, high: number, baselineEar?: number | null): BlinkState {
  const s = { ...state, durationsMs: [...state.durationsMs], intervalsSec: [...state.intervalsSec], drops: [...state.drops] };
  if (!s.isClosed && ear < low) {
    s.isClosed = true; s.closedSinceMs = nowMs; s.minEarDuringClose = ear;
  } else if (s.isClosed && ear > high) {
    s.isClosed = false;
    if (s.closedSinceMs !== null) {
      const dur = nowMs - s.closedSinceMs;
      if (dur > 1200) {
        s.sustainedCount += 1;
        s.lastBlinkEndMs = nowMs;
      } else if (dur >= 40) {
        s.blinks += 1; s.durationsMs.push(dur);
        if (s.lastBlinkEndMs !== null) s.intervalsSec.push((nowMs - s.lastBlinkEndMs) / 1000);
        s.lastBlinkEndMs = nowMs;
        if (baselineEar && s.minEarDuringClose !== null) {
          const drop = 1 - s.minEarDuringClose / baselineEar;
          s.drops.push(drop);
          if (dur <= 200 && drop >= 0.5) s.aggressiveCount += 1; else s.softCount += 1;
        }
      }
    }
    s.closedSinceMs = null; s.minEarDuringClose = null;
  }
  if (s.isClosed) {
    s.closedMs += frameMs;
    s.minEarDuringClose = s.minEarDuringClose === null ? ear : Math.min(s.minEarDuringClose, ear);
  }
  return s;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Valid time = sum of gaps between valid frames, capped so a background-tab
 *  suspension cannot inflate the denominator. Never assume a fixed frame rate. */
export function validSecondsFromTimestamps(timestampsMs: number[], maxGapMs = 500): number {
  if (timestampsMs.length < 2) return timestampsMs.length ? 0 : 0;
  let total = 0;
  for (let i = 1; i < timestampsMs.length; i++) {
    total += Math.min(Math.max(timestampsMs[i] - timestampsMs[i - 1], 0), maxGapMs);
  }
  return total / 1000;
}

export function usablePercent(valid: number, attempted: number): number {
  if (!attempted) return 0;
  return Math.round((valid / attempted) * 100);
}

export interface DailyAgg { date: string; count: number; scoredCount: number; meanScore: number | null; minScore: number | null; maxScore: number | null; cameraOnly: number; }

/** Daily aggregation (mean/min/max over that day's scored sessions). */
export function aggregateSessionsByDay(sessions: { createdAt: string; score: number | null }[]): DailyAgg[] {
  const groups = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const date = s.createdAt.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), s]);
  }
  return [...groups.entries()].map(([date, list]) => {
    const scored = list.map(s => s.score).filter((x): x is number => x !== null);
    return {
      date, count: list.length, scoredCount: scored.length,
      meanScore: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
      minScore: scored.length ? Math.min(...scored) : null,
      maxScore: scored.length ? Math.max(...scored) : null,
      cameraOnly: list.filter(s => s.score === null).length,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}
