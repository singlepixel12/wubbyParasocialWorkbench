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
 * Store fetched runs (skipping any whose length doesn't match the index) and mark them done.
 * Returns the updated manifest, or null if the download was deleted meanwhile.
 */
export async function saveRuns(hash: string, entries: ReadonlyArray<{ run: number; bytes: Uint8Array }>, runSize: ArrayLike<number>, now = Date.now()): Promise<DownloadManifest | null> {
  const valid = entries.filter((e) => e.run >= 0 && e.run < runSize.length && e.bytes.byteLength === runSize[e.run]);
  for (let i = 0; i < valid.length; i += RUNS_PER_TX) {
    const chunk = valid.slice(i, i + RUNS_PER_TX);
    await inTransaction(STORES.runs, 'readwrite', (tx) => {
      for (const e of chunk) tx.objectStore(STORES.runs).put(e.bytes, runKey(hash, e.run));
    });
  }
  const m = await getManifest(hash);
  if (!m) return null;
  const updated = markDone(m, valid.map((e) => e.run), runSize, now);
  await putManifest(updated);
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
  const m = await getManifest(hash);
  if (!m) return;
  await putManifest({ ...m, state, reason, updatedAt: now });
}

export async function touchListened(hash: string, now = Date.now()): Promise<void> {
  const m = await getManifest(hash);
  if (m) await putManifest({ ...m, lastListenedAt: now });
}

/** On app load: anything "downloading" without a live background fetch is really paused. */
export async function reconcile(activeIds: readonly string[], now = Date.now()): Promise<void> {
  const live = new Set(activeIds.map(hashFromBgFetchId).filter(Boolean));
  for (const m of await listManifests()) {
    if (m.state === 'downloading' && !live.has(m.hash)) await putManifest({ ...m, state: 'paused', reason: m.reason ?? 'interrupted', updatedAt: now });
  }
}
