// About 2 MB per VOD (997k 16-bit sample sizes for a 6 h stream). Saves re-downloading the 23.6 MB moov.
// Every function swallows storage errors: a broken cache must never break Listen.
import type { AudioIndex } from './types';

const DB_NAME = 'wubby-listen';
const STORE = 'audio-index';
export const CACHE_KEEP = 10;

interface Entry {
  hash: string;
  savedAt: number;
  index: AudioIndex;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'hash' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getCachedIndex(hash: string): Promise<AudioIndex | null> {
  try {
    const entry = (await withStore<Entry | undefined>('readonly', (s) => s.get(hash) as IDBRequest<Entry | undefined>)) ?? null;
    return entry?.index ?? null;
  } catch {
    return null;
  }
}

export async function putCachedIndex(hash: string, index: AudioIndex, now = Date.now()): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.put({ hash, savedAt: now, index } satisfies Entry));
    const all = (await withStore<Entry[]>('readonly', (s) => s.getAll() as IDBRequest<Entry[]>)) ?? [];
    const stale = all.sort((a, b) => b.savedAt - a.savedAt).slice(CACHE_KEEP);
    if (stale.length) {
      await withStore('readwrite', (s) => {
        for (const e of stale) s.delete(e.hash);
        return null;
      });
    }
  } catch {
    // Quota or private mode: Listen re-downloads the moov next time. Acceptable.
  }
}

export async function deleteCachedIndex(hash: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(hash));
  } catch {
    // ignore
  }
}
