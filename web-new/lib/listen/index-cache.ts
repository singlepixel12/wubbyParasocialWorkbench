// About 2 MB per VOD (997k 16-bit sample sizes for a 6 h stream). Saves re-downloading the 23.6 MB moov.
// Every function swallows storage errors: a broken cache must never break Listen.
// Indexes of downloaded VODs are never pruned: offline playback and the worker need them.
import { inTransaction, STORES } from './db';
import type { AudioIndex } from './types';

export const CACHE_KEEP = 10;

interface Entry {
  hash: string;
  savedAt: number;
  index: AudioIndex;
}

export async function getCachedIndex(hash: string): Promise<AudioIndex | null> {
  try {
    const entry = await inTransaction<Entry | undefined>(STORES.index, 'readonly', (tx) => tx.objectStore(STORES.index).get(hash) as IDBRequest<Entry | undefined>);
    return entry?.index ?? null;
  } catch {
    return null;
  }
}

export async function putCachedIndex(hash: string, index: AudioIndex, now = Date.now()): Promise<void> {
  try {
    await inTransaction(STORES.index, 'readwrite', (tx) => tx.objectStore(STORES.index).put({ hash, savedAt: now, index } satisfies Entry));
    const all = (await inTransaction<Entry[]>(STORES.index, 'readonly', (tx) => tx.objectStore(STORES.index).getAll() as IDBRequest<Entry[]>)) ?? [];
    const pinned = new Set(((await inTransaction<IDBValidKey[]>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).getAllKeys())) ?? []).map(String));
    const stale = all.filter((e) => !pinned.has(e.hash)).sort((a, b) => b.savedAt - a.savedAt).slice(CACHE_KEEP);
    if (stale.length) {
      await inTransaction(STORES.index, 'readwrite', (tx) => {
        for (const e of stale) tx.objectStore(STORES.index).delete(e.hash);
      });
    }
  } catch {
    // Quota or private mode: Listen re-downloads the moov next time. Acceptable.
  }
}

export async function deleteCachedIndex(hash: string): Promise<void> {
  try {
    await inTransaction(STORES.index, 'readwrite', (tx) => tx.objectStore(STORES.index).delete(hash));
  } catch {
    // ignore
  }
}
