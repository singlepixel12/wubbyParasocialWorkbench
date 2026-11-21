// What the service worker does when a background fetch ends. Kept free of worker globals so it
// can be unit-tested; scripts/sw/service-worker.js only wires events to it.
import { hashFromBgFetchId, NO_RECORDS_REASON, runFromRange, STALLED_REASON, type DownloadManifest } from './download-model';
import { getCachedIndex } from './index-cache';
import { getManifest, notifyChanged, saveRuns, updateManifest } from './offline-store';
import type { AudioIndex } from './types';

export interface BgRecordLike {
  request: { headers: { get(name: string): string | null } };
  responseReady: Promise<{ status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}
export interface BgRegistrationLike {
  id: string;
  /** Bytes Chrome fetched for this registration (to tell "nothing downloaded" from "records lost"). */
  downloaded?: number;
  matchAll(): Promise<BgRecordLike[]>;
}
export interface SwDeps {
  getIndex: (hash: string) => Promise<AudioIndex | null>;
  saveRuns: (hash: string, entries: { run: number; bytes: Uint8Array }[], runSize: ArrayLike<number>) => Promise<Pick<DownloadManifest, 'hash' | 'title' | 'state' | 'done'> | null>;
  /** Pause it with this reason, unless it's no longer "downloading" (a pause set elsewhere stands). */
  pause: (hash: string, reason: string) => Promise<void>;
  notify: (hash: string) => void;
  getManifest: (hash: string) => Promise<Pick<DownloadManifest, 'hash' | 'title' | 'restartRequested'> | null>;
  /** Ids of the Background Fetches still running (other parts of the same VOD among them). */
  liveIds: () => Promise<string[]>;
  /** Abort these Background Fetches (the other parts, when one part is cancelled). */
  abortParts: (ids: string[]) => Promise<void>;
}

async function pauseIfDownloading(hash: string, reason: string): Promise<void> {
  await updateManifest(hash, (m) => (m?.state === 'downloading' ? { ...m, state: 'paused', reason, updatedAt: Date.now() } : null));
}

const defaultDeps: SwDeps = { getIndex: getCachedIndex, saveRuns, pause: pauseIfDownloading, notify: notifyChanged, getManifest, liveIds: async () => [], abortParts: async () => {} };
/** Save in slices so a 5,000-record download never holds 430 MB in memory at once. */
const SAVE_EVERY = 200;

/**
 * A download is one Background Fetch per part (download-model MAX_REQUESTS_PER_FETCH). Each part
 * that ends saves its own records; the VOD is only paused once no other part of it is running.
 * `liveIds` is the worker's `registration.backgroundFetch.getIds()`.
 */
export async function handleBackgroundFetchEnd(
  kind: 'success' | 'fail' | 'abort',
  reg: BgRegistrationLike,
  overrides: Partial<SwDeps> = {},
): Promise<{ hash: string; title: string; state: 'ready' | 'paused' | 'downloading'; saved: number } | null> {
  const deps: SwDeps = { ...defaultDeps, ...overrides };
  const hash = hashFromBgFetchId(reg.id);
  if (!hash) return null;
  const index = await deps.getIndex(hash);
  if (!index) {
    await deps.pause(hash, 'audio index missing; reopen the VOD');
    deps.notify(hash);
    return { hash, title: '', state: 'paused', saved: 0 };
  }

  let saved = 0;
  let failed = 0;
  let pending: { run: number; bytes: Uint8Array }[] = [];
  let last: Awaited<ReturnType<SwDeps['saveRuns']>> = null;
  const flush = async () => {
    if (!pending.length) return;
    last = await deps.saveRuns(hash, pending, index.runSize);
    saved += pending.length;
    pending = [];
  };

  const records = await reg.matchAll();
  for (const rec of records) {
    const run = runFromRange(index, rec.request.headers.get('range'));
    const res = await rec.responseReady.catch(() => null);
    if (run < 0 || !res || res.status !== 206) {
      if (res || kind === 'success') failed++;
      continue;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength !== index.runSize[run]) {
      failed++;
      continue;
    }
    pending.push({ run, bytes });
    if (pending.length >= SAVE_EVERY) await flush();
  }
  await flush();

  const manifest = last ?? (await deps.getManifest(hash));
  if (!manifest) return null; // deleted while it downloaded: nothing was stored, nothing to say
  const title = manifest?.title ?? '';
  const complete = (last as { state?: string } | null)?.state === 'ready';
  if (complete) {
    deps.notify(hash);
    return { hash, title, state: 'ready', saved };
  }

  // Chrome fetched bytes but listed no records (its matchAll() returns [] above ~8,000 requests).
  // Nothing can be saved, and another identical round would lose them the same way: stop here.
  if (records.length === 0 && (reg.downloaded ?? 0) > 0) {
    await deps.pause(hash, NO_RECORDS_REASON);
    deps.notify(hash);
    return { hash, title, state: 'paused', saved };
  }

  // Another part of this VOD is still running: it's still downloading. The last part to end
  // decides (and if two end together and both see the other, the page's reconcile pauses it).
  const siblings = (await deps.liveIds().catch(() => [] as string[])).filter((id) => id !== reg.id && hashFromBgFetchId(id) === hash);
  if (siblings.length && kind !== 'abort') {
    deps.notify(hash);
    return { hash, title, state: 'downloading', saved };
  }

  // An abort is the user's cancel, unless the page's watchdog asked for it (a stuck round).
  const restart = (manifest as Pick<DownloadManifest, 'restartRequested'>).restartRequested === true;
  const reason = kind === 'abort' ? (restart ? STALLED_REASON : 'cancelled') : kind === 'fail' ? 'connection lost' : `${failed} parts failed; resume to retry them`;
  await deps.pause(hash, reason);
  // Each part has its own Android notification: cancelling one cancels the VOD, so stop the rest.
  // Their abort events save what they finished and keep the pause just set.
  if (kind === 'abort' && siblings.length) await deps.abortParts(siblings).catch(() => undefined);
  deps.notify(hash);
  return { hash, title, state: 'paused', saved };
}
