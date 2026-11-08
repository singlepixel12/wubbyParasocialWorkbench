// Pure decisions for the engine: which runs to fetch next and what to evict. No I/O.
import type { AudioIndex } from './types';

export const KEEP_BEHIND_SEC = 30;
export const EVICT_WHEN_BEHIND_SEC = 60;

export const runStartSec = (index: AudioIndex, r: number) => index.runStartTicks[r] / index.timescale;
export const runEndSec = (index: AudioIndex, r: number) =>
  r + 1 < index.runStartTicks.length ? index.runStartTicks[r + 1] / index.timescale : index.durationSec;

/** Index of the run whose start is the last one ≤ sec (clamped). -1 for an empty index. */
export function runIndexAt(index: AudioIndex, sec: number): number {
  const ticks = sec * index.timescale;
  let lo = 0;
  let hi = index.runStartTicks.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (index.runStartTicks[mid] <= ticks) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface PlanInput {
  index: AudioIndex;
  playheadSec: number;
  aheadSec: number;
  appended: ReadonlySet<number>;
  inFlight: ReadonlySet<number>;
  maxInFlight: number;
}

/** Runs to start fetching now, in playback order. */
export function planFetches(p: PlanInput): number[] {
  const out: number[] = [];
  const budget = p.maxInFlight - p.inFlight.size;
  if (budget <= 0) return out;
  const limit = p.playheadSec + p.aheadSec;
  const n = p.index.runStartTicks.length;
  for (let r = Math.max(0, runIndexAt(p.index, p.playheadSec)); r < n && runStartSec(p.index, r) < limit && out.length < budget; r++) {
    if (!p.appended.has(r) && !p.inFlight.has(r)) out.push(r);
  }
  return out;
}

/** End of the [0, end) range to remove from the SourceBuffer, or null when nothing is old enough. */
export function evictionEnd(playheadSec: number, bufferedStartSec: number | null): number | null {
  if (bufferedStartSec === null) return null;
  return bufferedStartSec < playheadSec - EVICT_WHEN_BEHIND_SEC ? playheadSec - KEEP_BEHIND_SEC : null;
}

/** Appended runs that an eviction of [0, sec) touches, so they are no longer complete in the buffer. */
export function runsStartingBefore(index: AudioIndex, appended: Iterable<number>, sec: number): number[] {
  return [...appended].filter((r) => runStartSec(index, r) < sec).sort((a, b) => a - b);
}
