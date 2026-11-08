// What the service worker does when a background fetch ends. Kept free of worker globals so it
// can be unit-tested; scripts/sw/service-worker.js only wires events to it.
import { hashFromBgFetchId, runFromRange, type DownloadManifest } from './download-model';
import { getCachedIndex } from './index-cache';
import { getManifest, notifyChanged, saveRuns, setState } from './offline-store';
import type { AudioIndex } from './types';

export interface BgRecordLike {
  request: { headers: { get(name: string): string | null } };
  responseReady: Promise<{ status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}
export interface BgRegistrationLike {
  id: string;
  matchAll(): Promise<BgRecordLike[]>;
}
export interface SwDeps {
  getIndex: (hash: string) => Promise<AudioIndex | null>;
  saveRuns: (hash: string, entries: { run: number; bytes: Uint8Array }[], runSize: ArrayLike<number>) => Promise<Pick<DownloadManifest, 'hash' | 'title' | 'state' | 'done'> | null>;
  setState: (hash: string, state: 'paused', reason: string) => Promise<void>;
  notify: (hash: string) => void;
  getManifest: (hash: string) => Promise<Pick<DownloadManifest, 'hash' | 'title'> | null>;
}

const defaultDeps: SwDeps = { getIndex: getCachedIndex, saveRuns, setState, notify: notifyChanged, getManifest };
/** Save in slices so a 5,000-record download never holds 430 MB in memory at once. */
const SAVE_EVERY = 200;

export async function handleBackgroundFetchEnd(
  kind: 'success' | 'fail' | 'abort',
  reg: BgRegistrationLike,
  deps: SwDeps = defaultDeps,
): Promise<{ hash: string; title: string; state: 'ready' | 'paused'; saved: number } | null> {
  const hash = hashFromBgFetchId(reg.id);
  if (!hash) return null;
  const index = await deps.getIndex(hash);
  if (!index) {
    await deps.setState(hash, 'paused', 'audio index missing; reopen the VOD');
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

  for (const rec of await reg.matchAll()) {
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
  const title = manifest?.title ?? '';
  const complete = (last as { state?: string } | null)?.state === 'ready';
  if (!complete) {
    const reason = kind === 'abort' ? 'cancelled' : kind === 'fail' ? 'connection lost' : `${failed} parts failed; resume to retry them`;
    await deps.setState(hash, 'paused', reason);
  }
  deps.notify(hash);
  return { hash, title, state: complete ? 'ready' : 'paused', saved };
}
