import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openListenDb, STORES } from '@/lib/listen/db';
import { putCachedIndex, getCachedIndex, CACHE_KEEP } from '@/lib/listen/index-cache';
import type { AudioIndex } from '@/lib/listen/types';

const index = (tag: number): AudioIndex => ({
  version: 1, lastModified: `LM${tag}`, timescale: 48000, durationSec: 10, sampleRate: 48000, channelCount: 2,
  codec: 'mp4a.40.2', audioSpecificConfig: Uint8Array.of(0x11, 0x90),
  sampleSizes: Uint16Array.of(1), sttsCounts: Uint32Array.of(1), sttsDeltas: Uint32Array.of(1024),
  runFirst: Uint32Array.of(0), runCount: Uint32Array.of(1), runOffset: Float64Array.of(0), runSize: Uint32Array.of(1), runStartTicks: Float64Array.of(0),
});

beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
});

describe('openListenDb', () => {
  it('has the index, downloads and runs stores', async () => {
    const db = await openListenDb();
    expect([...db.objectStoreNames].sort()).toEqual([STORES.runs, STORES.index, STORES.downloads].sort());
    db.close();
  });

  it('upgrades a v1 database (index cache only) without losing it', async () => {
    await new Promise<void>((resolve) => {
      const q = indexedDB.open('wubby-listen', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('audio-index', { keyPath: 'hash' }).put({ hash: 'old', savedAt: 1, index: index(9) });
      q.onsuccess = () => {
        q.result.close();
        resolve();
      };
    });
    expect((await getCachedIndex('old'))?.lastModified).toBe('LM9');
  });
});

describe('index-cache pruning', () => {
  it('never prunes the index of a VOD that has a download', async () => {
    const db = await openListenDb();
    await new Promise<void>((r) => {
      const tx = db.transaction(STORES.downloads, 'readwrite');
      tx.objectStore(STORES.downloads).put({ hash: 'h0' });
      tx.oncomplete = () => r();
    });
    db.close();
    for (let i = 0; i < CACHE_KEEP + 3; i++) await putCachedIndex(`h${i}`, index(i), 1000 + i);
    expect(await getCachedIndex('h0')).not.toBeNull(); // oldest, but downloaded
    expect(await getCachedIndex('h1')).toBeNull();
  });
});
