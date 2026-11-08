import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedIndex, putCachedIndex, deleteCachedIndex, CACHE_KEEP } from '@/lib/listen/index-cache';
import type { AudioIndex } from '@/lib/listen/types';

const index = (tag: number): AudioIndex => ({
  version: 1, lastModified: `LM${tag}`, timescale: 48000, durationSec: 10, sampleRate: 48000, channelCount: 2,
  codec: 'mp4a.40.2', audioSpecificConfig: Uint8Array.of(0x11, 0x90),
  sampleSizes: Uint16Array.of(tag, 2, 3), sttsCounts: Uint32Array.of(3), sttsDeltas: Uint32Array.of(1024),
  runFirst: Uint32Array.of(0), runCount: Uint32Array.of(3), runOffset: Float64Array.of(2 ** 33), runSize: Uint32Array.of(6), runStartTicks: Float64Array.of(0),
});

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('wubby-listen');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('index-cache', () => {
  it('round-trips an index with its typed arrays intact', async () => {
    await putCachedIndex('h1', index(1));
    const got = await getCachedIndex('h1');
    expect(got?.lastModified).toBe('LM1');
    // By tag, not instanceof: fake-indexeddb clones with Node's structuredClone, a different realm from jsdom.
    expect(Object.prototype.toString.call(got?.sampleSizes)).toBe('[object Uint16Array]');
    expect(Array.from(got!.sampleSizes)).toEqual([1, 2, 3]);
    expect(got?.runOffset[0]).toBe(2 ** 33);
  });

  it('returns null for an unknown VOD', async () => {
    expect(await getCachedIndex('nope')).toBeNull();
  });

  it(`keeps only the ${CACHE_KEEP} most recently saved`, async () => {
    for (let i = 0; i < CACHE_KEEP + 3; i++) await putCachedIndex(`h${i}`, index(i), 1000 + i);
    expect(await getCachedIndex('h0')).toBeNull();
    expect(await getCachedIndex('h2')).toBeNull();
    expect(await getCachedIndex(`h${CACHE_KEEP + 2}`)).not.toBeNull();
  });

  it('deletes an entry', async () => {
    await putCachedIndex('h1', index(1));
    await deleteCachedIndex('h1');
    expect(await getCachedIndex('h1')).toBeNull();
  });

  it('never throws when IndexedDB is unavailable (Listen still works, just uncached)', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });
    await expect(getCachedIndex('h1')).resolves.toBeNull();
    await expect(putCachedIndex('h1', index(1))).resolves.toBeUndefined();
    open.mockRestore();
  });
});
