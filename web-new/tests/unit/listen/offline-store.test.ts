import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { newManifest } from '@/lib/listen/download-model';
import {
  getManifest, putManifest, listManifests, saveRuns, readStoredRun, deleteDownload, setState, touchListened, reconcile, updateManifest,
} from '@/lib/listen/offline-store';
import type { AudioIndex } from '@/lib/listen/types';
import { rememberVodDetails } from '@/lib/listen/downloads';
import { createMockVideo } from '../../test-utils';

const sizes = [3, 4, 5];
const idx = { runSize: Uint32Array.from(sizes), runOffset: Float64Array.of(0, 100, 200), lastModified: 'LM' } as unknown as AudioIndex;
const bytes = (n: number, v: number) => new Uint8Array(n).fill(v);

beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
  await putManifest(newManifest({ hash: 'h', title: 'T', url: 'u', index: idx, now: 1 }));
});

describe('offline-store', () => {
  it('saves runs, reads them back, and updates the manifest', async () => {
    const m = await saveRuns('h', [{ run: 2, bytes: bytes(5, 7) }, { run: 0, bytes: bytes(3, 1) }], idx.runSize, 5);
    expect(m?.bytesDone).toBe(8);
    expect(Array.from((await readStoredRun('h', 2))!)).toEqual([7, 7, 7, 7, 7]);
    expect(await readStoredRun('h', 1)).toBeNull();
    expect((await getManifest('h'))?.done[0]).toBe(1);
  });

  it('rejects a run whose length does not match the index', async () => {
    const m = await saveRuns('h', [{ run: 1, bytes: bytes(2, 9) }], idx.runSize, 5);
    expect(m?.bytesDone).toBe(0);
    expect(await readStoredRun('h', 1)).toBeNull();
  });

  it('becomes ready once every run is stored', async () => {
    const m = await saveRuns('h', sizes.map((n, run) => ({ run, bytes: bytes(n, run) })), idx.runSize, 9);
    expect(m?.state).toBe('ready');
  });

  it('deletes a download completely', async () => {
    await saveRuns('h', [{ run: 0, bytes: bytes(3, 1) }], idx.runSize, 5);
    await deleteDownload('h');
    expect(await getManifest('h')).toBeNull();
    expect(await readStoredRun('h', 0)).toBeNull();
    expect(await listManifests()).toEqual([]);
  });

  it('sets state, touches last-listened', async () => {
    await setState('h', 'paused', 'connection lost', 7);
    await touchListened('h', 99);
    expect(await getManifest('h')).toMatchObject({ state: 'paused', reason: 'connection lost', lastListenedAt: 99 });
  });

  it('reconcile: a downloading manifest with no live background fetch becomes paused', async () => {
    await reconcile([], 50);
    expect((await getManifest('h'))?.state).toBe('paused');
    await setState('h', 'downloading', undefined, 51);
    await reconcile(['listen:h:123'], 52);
    expect((await getManifest('h'))?.state).toBe('downloading');
  });

  // The page and the service worker write the same manifest. Every write is read-modify-write in
  // one transaction, so neither side can put back a stale copy over the other's.
  describe('concurrent writers (page + worker)', () => {
    it("a details refresh racing the worker's save keeps every done bit and becomes ready", async () => {
      const video = createMockVideo({ videoHash: 'h', title: 'Fresh row' });
      await Promise.all([
        saveRuns('h', [{ run: 0, bytes: bytes(3, 1) }], idx.runSize, 5),
        rememberVodDetails(video),
        saveRuns('h', [{ run: 1, bytes: bytes(4, 2) }], idx.runSize, 6),
        rememberVodDetails(video),
        saveRuns('h', [{ run: 2, bytes: bytes(5, 3) }], idx.runSize, 7),
        touchListened('h', 8),
      ]);
      const m = await getManifest('h');
      expect(Array.from(m!.done)).toEqual([1, 1, 1]);
      expect(m).toMatchObject({ state: 'ready', bytesDone: 12, lastListenedAt: 8, video: { title: 'Fresh row' } });
    });

    it('updateManifest leaves a missing manifest missing and returns null', async () => {
      expect(await updateManifest('nope', (m) => (m ? { ...m, title: 'x' } : null))).toBeNull();
      expect(await getManifest('nope')).toBeNull();
    });

    it('a change that throws aborts the transaction and stores nothing', async () => {
      await expect(updateManifest('h', () => { throw new Error('boom'); })).rejects.toBeTruthy();
      expect((await getManifest('h'))?.title).toBe('T');
    });
  });

  describe('a download deleted while it saves', () => {
    it('stores no runs once the manifest is gone (no orphaned bytes)', async () => {
      await deleteDownload('h');
      expect(await saveRuns('h', [{ run: 0, bytes: bytes(3, 1) }, { run: 1, bytes: bytes(4, 2) }], idx.runSize, 5)).toBeNull();
      expect(await readStoredRun('h', 0)).toBeNull();
      expect(await readStoredRun('h', 1)).toBeNull();
      expect(await listManifests()).toEqual([]);
    });

    it('setState and touchListened never resurrect a deleted manifest', async () => {
      await deleteDownload('h');
      await setState('h', 'paused', 'cancelled');
      await touchListened('h');
      expect(await getManifest('h')).toBeNull();
    });
  });
});
