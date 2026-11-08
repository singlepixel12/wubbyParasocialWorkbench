// One IndexedDB for Listen, shared by the page and the service worker.
// v1 had only audio-index; v2 adds downloads (manifests) and audio-runs (stored run bytes).
export const DB_NAME = 'wubby-listen';
export const DB_VERSION = 2;
export const STORES = { index: 'audio-index', downloads: 'downloads', runs: 'audio-runs' } as const;

export function openListenDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.index)) db.createObjectStore(STORES.index, { keyPath: 'hash' });
      if (!db.objectStoreNames.contains(STORES.downloads)) db.createObjectStore(STORES.downloads, { keyPath: 'hash' });
      if (!db.objectStoreNames.contains(STORES.runs)) db.createObjectStore(STORES.runs); // key: `${hash}:${run padded}`
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
}

/** Run `fn` in one transaction over `stores`; resolves with `fn`'s request result when the transaction commits. */
export async function inTransaction<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | null | void,
): Promise<T | undefined> {
  const db = await openListenDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const req = fn(tx) || null;
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    });
  } finally {
    db.close();
  }
}
