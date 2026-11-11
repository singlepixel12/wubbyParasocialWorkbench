// Download manifests + stored audio runs in IndexedDB. Runs in the page AND the service worker,
// so: relative imports only, no window/DOM APIs. Writes are batched per transaction.
import { inTransaction, STORES } from './db';
import { hashFromBgFetchId, markDone, type DownloadManifest, type DownloadState } from './download-model';
import type { Bytes } from './types';
import { deleteThumbnail } from '../offline/thumbs';

export const DOWNLOADS_CHANNEL = 'listen-downloads';
const RUNS_PER_TX = 200;

const runKey = (hash: string, run: number) => `${hash}:${String(run).padStart(6, '0')}`;
const runRange = (hash: string) => IDBKeyRange.bound(`${hash}:`, `${hash}:￿`);

/** Tell every open page (and the worker) that a download changed. */
export function notifyChanged(hash: string): void {
  try {
    const ch = new BroadcastChannel(DOWNLOADS_CHANNEL);
    ch.postMessage({ hash });
    ch.close();
  } catch {
    // BroadcastChannel missing: pages refresh on next load instead.
  }
}

export async function getManifest(hash: string): Promise<DownloadManifest | null> {
  return (await inTransaction<DownloadManifest | undefined>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).get(hash) as IDBRequest<DownloadManifest | undefined>)) ?? null;
}

export async function putManifest(m: DownloadManifest): Promise<void> {
  await inTransaction(STORES.downloads, 'readwrite', (tx) => tx.objectStore(STORES.downloads).put(m));
}

export async function listManifests(): Promise<DownloadManifest[]> {
  return (await inTransaction<DownloadManifest[]>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).getAll() as IDBRequest<DownloadManifest[]>)) ?? [];
}

/**
 * Read, change and write one manifest in ONE transaction. The page and the service worker both
 * write manifests; a separate read and write let a stale copy from one side overwrite the other's
 * newer one (dropping `done` bits, so a complete download never became ready). `change` must be
 * synchronous and returns null to leave the manifest as it is. Resolves with the stored manifest
 * (null if there is none).
 */
export async function updateManifest(hash: string, change: (m: DownloadManifest | null) => DownloadManifest | null): Promise<DownloadManifest | null> {
  let result: DownloadManifest | null = null;
  await inTransaction(STORES.downloads, 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.downloads);
    const get = store.get(hash) as IDBRequest<DownloadManifest | undefined>;
    get.onsuccess = () => {
      const current = get.result ?? null;
      const next = change(current);
      result = next ?? current;
      if (next) store.put(next);
    };
  });
  return result;
}

/**
 * Store fetched runs (skipping any whose length doesn't match the index) and mark them done.
 * Each slice of runs is written in the same transaction as its manifest update, and only while
 * the manifest exists: a download deleted mid-save stores nothing more (no orphaned bytes that
 * the cap and the list can't see). Returns the updated manifest, or null if it was deleted.
 */
export async function saveRuns(hash: string, entries: ReadonlyArray<{ run: number; bytes: Uint8Array }>, runSize: ArrayLike<number>, now = Date.now()): Promise<DownloadManifest | null> {
  const valid = entries.filter((e) => e.run >= 0 && e.run < runSize.length && e.bytes.byteLength === runSize[e.run]);
  const chunks: (typeof valid)[] = [];
  for (let i = 0; i < valid.length; i += RUNS_PER_TX) chunks.push(valid.slice(i, i + RUNS_PER_TX));
  if (!chunks.length) chunks.push([]);
  let updated: DownloadManifest | null = null;
  for (const chunk of chunks) {
    updated = null;
    await inTransaction([STORES.runs, STORES.downloads], 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.downloads);
      const get = store.get(hash) as IDBRequest<DownloadManifest | undefined>;
      get.onsuccess = () => {
        if (!get.result) return; // deleted: write nothing
        for (const e of chunk) tx.objectStore(STORES.runs).put(e.bytes, runKey(hash, e.run));
        updated = markDone(get.result, chunk.map((e) => e.run), runSize, now);
        store.put(updated);
      };
    });
    if (!updated) return null;
  }
  return updated;
}

export async function readStoredRun(hash: string, run: number): Promise<Bytes | null> {
  try {
    const v = await inTransaction<Uint8Array | undefined>(STORES.runs, 'readonly', (tx) => tx.objectStore(STORES.runs).get(runKey(hash, run)) as IDBRequest<Uint8Array | undefined>);
    return v ? (new Uint8Array(v) as Bytes) : null;
  } catch {
    return null;
  }
}

export async function deleteDownload(hash: string): Promise<void> {
  const m = await getManifest(hash).catch(() => null);
  await inTransaction([STORES.runs, STORES.downloads], 'readwrite', (tx) => {
    tx.objectStore(STORES.runs).delete(runRange(hash));
    tx.objectStore(STORES.downloads).delete(hash);
  });
  await deleteThumbnail(m?.thumbnailUrl);
  notifyChanged(hash);
}

export async function setState(hash: string, state: DownloadState, reason?: string, now = Date.now()): Promise<void> {
  await updateManifest(hash, (m) => (m ? { ...m, state, reason, updatedAt: now } : null));
}

export async function touchListened(hash: string, now = Date.now()): Promise<void> {
  await updateManifest(hash, (m) => (m ? { ...m, lastListenedAt: now } : null));
}

/** On app load: anything "downloading" without a live background fetch is really paused. */
export async function reconcile(activeIds: readonly string[], now = Date.now()): Promise<void> {
  const live = new Set(activeIds.map(hashFromBgFetchId).filter(Boolean));
  for (const { hash } of await listManifests()) {
    if (live.has(hash)) continue;
    await updateManifest(hash, (m) => (m?.state === 'downloading' ? { ...m, state: 'paused', reason: m.reason ?? 'interrupted', updatedAt: now } : null));
  }
}
