import { describe, it, expect } from 'vitest';
import { runIndexAt, runStartSec, runEndSec, planFetches, evictionEnd, runsStartingBefore } from '@/lib/listen/buffer-planner';
import type { AudioIndex } from '@/lib/listen/types';

/** n runs of 4 s each at 48 kHz. */
function fakeIndex(n: number): AudioIndex {
  return {
    version: 1, lastModified: null, timescale: 48000, durationSec: n * 4, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2',
    audioSpecificConfig: new Uint8Array(2), sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
    runFirst: new Uint32Array(n), runCount: new Uint32Array(n), runOffset: new Float64Array(n), runSize: new Uint32Array(n),
    runStartTicks: Float64Array.from({ length: n }, (_, i) => i * 4 * 48000),
  };
}
const idx = fakeIndex(100); // 400 s

describe('run timing', () => {
  it('finds the run containing a time', () => {
    expect(runIndexAt(idx, 0)).toBe(0);
    expect(runIndexAt(idx, 3.99)).toBe(0);
    expect(runIndexAt(idx, 4)).toBe(1);
    expect(runIndexAt(idx, 9999)).toBe(99);
    expect(runStartSec(idx, 2)).toBe(8);
    expect(runEndSec(idx, 2)).toBe(12);
    expect(runEndSec(idx, 99)).toBe(400);
  });
});

describe('planFetches', () => {
  const base = { index: idx, aheadSec: 20, maxInFlight: 6, appended: new Set<number>(), inFlight: new Set<number>() };

  it('fetches from the playhead run up to aheadSec', () => {
    expect(planFetches({ ...base, playheadSec: 10 })).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('skips appended and in-flight runs and respects the in-flight cap', () => {
    // aheadSec 100 so the cap (6 - 3 in flight = 3), not the read-ahead window, is what limits it.
    expect(planFetches({ ...base, aheadSec: 100, playheadSec: 10, appended: new Set([2, 3]), inFlight: new Set([4, 5, 6]) })).toEqual([7, 8, 9]);
  });

  it('plans nothing when the read-ahead is full', () => {
    expect(planFetches({ ...base, playheadSec: 0, appended: new Set([0, 1, 2, 3, 4]) })).toEqual([]);
  });

  it('stops at the last run', () => {
    expect(planFetches({ ...base, playheadSec: 396 })).toEqual([99]);
  });
});

describe('eviction', () => {
  it('evicts behind the playhead only once 60 s have built up, keeping 30 s', () => {
    expect(evictionEnd(100, null)).toBeNull();
    expect(evictionEnd(100, 50)).toBeNull();
    expect(evictionEnd(100, 30)).toBe(70);
  });

  it('lists every run touched by an eviction so it is fetched again if needed', () => {
    expect(runsStartingBefore(idx, new Set([0, 1, 2, 3, 10]), 9)).toEqual([0, 1, 2]);
  });
});
