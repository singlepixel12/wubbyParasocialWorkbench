import { describe, it, expect } from 'vitest';
import {
  newManifest, missingRuns, markDone, progress, totals, planForCap, runFromRange, rangeForRun,
  bgFetchId, hashFromBgFetchId, CAP_BYTES, type DownloadManifest,
} from '@/lib/listen/download-model';
import type { AudioIndex } from '@/lib/listen/types';

const index = (sizes: number[]): AudioIndex => {
  const offsets: number[] = [];
  let o = 1000;
  for (const s of sizes) {
    offsets.push(o);
    o += s + 5000; // video bytes between runs
  }
  return {
    version: 1, lastModified: 'LM', timescale: 48000, durationSec: sizes.length * 4, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2',
    audioSpecificConfig: new Uint8Array(2), sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
    runFirst: new Uint32Array(sizes.length), runCount: new Uint32Array(sizes.length),
    runOffset: Float64Array.from(offsets), runSize: Uint32Array.from(sizes), runStartTicks: new Float64Array(sizes.length),
  };
};
const idx = index([100, 200, 300, 400]);
const base = () => newManifest({ hash: 'h', title: 'T', url: 'u', index: idx, now: 10 });

describe('manifest', () => {
  it('starts empty, downloading, sized from the index', () => {
    const m = base();
    expect(m).toMatchObject({ hash: 'h', runCount: 4, bytesTotal: 1000, bytesDone: 0, state: 'downloading', lastModified: 'LM', lastListenedAt: 10 });
    expect(missingRuns(m)).toEqual([0, 1, 2, 3]);
  });

  it('marks runs done, tracks bytes, and becomes ready when complete', () => {
    let m = markDone(base(), [1, 3], idx.runSize, 20);
    expect(missingRuns(m)).toEqual([0, 2]);
    expect(m.bytesDone).toBe(600);
    expect(progress(m)).toBeCloseTo(0.6);
    expect(m.state).toBe('downloading');
    m = markDone(m, [0, 2, 2], idx.runSize, 30); // duplicates are harmless
    expect(m.bytesDone).toBe(1000);
    expect(m.state).toBe('ready');
    expect(m.updatedAt).toBe(30);
  });

  it('does not mutate its input', () => {
    const m = base();
    markDone(m, [0], idx.runSize, 1);
    expect(m.bytesDone).toBe(0);
    expect(m.done[0]).toBe(0);
  });
});

describe('totals and cap', () => {
  const m = (hash: string, bytesDone: number, state: DownloadManifest['state'], lastListenedAt: number) =>
    ({ ...base(), hash, bytesDone, bytesTotal: bytesDone, state, lastListenedAt }) as DownloadManifest;

  it('totals counts ready and partial downloads and their bytes', () => {
    expect(totals([m('a', 100, 'ready', 1), m('b', 50, 'paused', 2), m('c', 0, 'downloading', 3)])).toEqual({ count: 3, ready: 1, partial: 2, bytesStored: 150 });
  });

  it('fits when under the cap', () => {
    expect(planForCap([m('a', 100, 'ready', 1)], 100, 1000)).toEqual({ fits: true, suggest: [] });
  });

  it('suggests least-recently-listened downloads to delete until it fits', () => {
    const plan = planForCap([m('new', 400, 'ready', 50), m('old', 400, 'ready', 10), m('mid', 400, 'paused', 30)], 500, 1000);
    expect(plan).toEqual({ fits: false, suggest: ['old', 'mid'] });
  });

  it('cap default is 2 GB', () => {
    expect(CAP_BYTES).toBe(2 * 1024 ** 3);
  });
});

describe('ranges and ids', () => {
  it('maps a Range header back to its run, and builds one', () => {
    expect(rangeForRun(idx, 2)).toBe(`bytes=${idx.runOffset[2]}-${idx.runOffset[2] + 299}`);
    expect(runFromRange(idx, rangeForRun(idx, 2))).toBe(2);
    expect(runFromRange(idx, 'bytes=5-9')).toBe(-1);
    expect(runFromRange(idx, null)).toBe(-1);
  });

  it('round-trips a background fetch id', () => {
    const id = bgFetchId('abc', 123);
    expect(id).toBe('listen:abc:123');
    expect(hashFromBgFetchId(id)).toBe('abc');
    expect(hashFromBgFetchId('other:thing')).toBeNull();
  });
});
