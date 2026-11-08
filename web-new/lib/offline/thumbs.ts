// Thumbnails of downloaded VODs, kept in the Cache API so the offline diary shows them.
// The worker serves them (shell-cache.ts); the page adds and removes them with the download.
// Relative imports only (also bundled into sw.js).
export const THUMBS_CACHE = 'wubby-thumbs';

const cachesApi = (): CacheStorage | undefined => (typeof caches === 'undefined' ? undefined : caches);

/**
 * Best effort: a CORS fetch first, and an opaque one if the storage host refuses CORS (an `<img>`
 * can still show an opaque response). Never throws; a missing thumbnail falls back to the black box.
 */
export async function cacheThumbnail(url: string | undefined): Promise<boolean> {
  const api = cachesApi();
  if (!url || !api) return false;
  try {
    const cache = await api.open(THUMBS_CACHE);
    if (await cache.match(url)) return true;
    // Opaque only when CORS itself failed (a throw): an opaque copy of a 404 would hide forever.
    let res = await fetch(url, { mode: 'cors' }).catch(() => null);
    if (res === null) res = await fetch(url, { mode: 'no-cors' }).catch(() => null);
    if (!res || (res.type !== 'opaque' && res.status !== 200)) return false;
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
}

export async function deleteThumbnail(url: string | undefined): Promise<void> {
  const api = cachesApi();
  if (!url || !api) return;
  try {
    await (await api.open(THUMBS_CACHE)).delete(url);
  } catch {
    // nothing to free
  }
}
