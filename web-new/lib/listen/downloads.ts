// Page side of offline downloads: register the worker, check space, start/resume/cancel a
// Background Fetch, reconcile on load, auto-delete finished VODs. The worker saves results.
import { bgFetchOf, type BgFetchRegistration } from './background-fetch';
import { bgFetchId, hashFromBgFetchId, missingRuns, newManifest, planForCap, rangeForRun, recordAutoResume, type DownloadManifest } from './download-model';
import { getCachedIndex } from './index-cache';
import { deleteDownload, getManifest, listManifests, notifyChanged, putManifest, reconcile } from './offline-store';
import { isFinished, readPosition } from './positions';
import type { AudioIndex } from './types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface VodRef {
  hash: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
}

export async function ensureWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
  return navigator.serviceWorker.ready;
}

/** True on a cellular connection when the browser says so (Android Chrome does); unknown = false. */
export function onMobileData(): boolean {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return c?.type === 'cellular';
}

const remainingBytes = (index: AudioIndex, runs: number[]) => runs.reduce((a, r) => a + index.runSize[r], 0);
const allRuns = (index: AudioIndex) => Array.from(index.runSize, (_, r) => r);

/** Before Download: how much is left, does it fit the 2 GB cap, is there room on the phone. */
export async function preflight(hash: string, index: AudioIndex) {
  const manifests = await listManifests();
  const existing = manifests.find((m) => m.hash === hash);
  const bytesNeeded = remainingBytes(index, existing ? missingRuns(existing) : allRuns(index));
  const cap = planForCap(manifests.filter((m) => m.hash !== hash), remainingBytes(index, allRuns(index)));
  let quotaOk = true;
  try {
    const est = await navigator.storage?.estimate?.();
    // Background Fetch holds the bytes until the worker copies them: ~2x briefly, plus 10%.
    if (est?.quota !== undefined) quotaOk = est.quota - (est.usage ?? 0) > bytesNeeded * 2 * 1.1;
  } catch {
    // unknown: let Chrome decide
  }
  return { bytesNeeded, cap, quotaOk };
}

/**
 * Start (or resume) the background download of every missing run.
 * `manual`: the user tapped Download/Resume, which restarts the auto-resume schedule.
 */
export async function startDownload(vod: VodRef, index: AudioIndex, now = Date.now(), { manual = false } = {}): Promise<void> {
  await navigator.storage?.persist?.().catch(() => false);
  const stored = (await getManifest(vod.hash)) ?? newManifest({ ...vod, index, now });
  const manifest = manual ? { ...stored, autoRetries: 0, bytesAtLastAutoRetry: undefined } : stored;
  const missing = missingRuns(manifest);
  await putManifest({ ...manifest, state: 'downloading', reason: undefined, updatedAt: now });
  notifyChanged(vod.hash);
  try {
    const bg = bgFetchOf(await ensureWorker());
    if (!bg) throw new Error('Background downloads are not supported in this browser');
    const requests = missing.map((r) => new Request(vod.url, { headers: { Range: rangeForRun(index, r) }, mode: 'cors' }));
    await bg.fetch(bgFetchId(vod.hash, now), requests, {
      title: `Wubby Archive · ${vod.title}`,
      icons: vod.thumbnailUrl ? [{ src: vod.thumbnailUrl, sizes: '512x288', type: 'image/webp' }] : [],
      downloadTotal: remainingBytes(index, missing),
    });
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await putManifest({ ...manifest, state: 'paused', reason, updatedAt: Date.now() });
    notifyChanged(vod.hash);
    throw err;
  }
}

async function liveRegistration(hash: string): Promise<BgFetchRegistration | undefined> {
  const reg = await navigator.serviceWorker?.getRegistration(`${BASE}/`);
  const bg = bgFetchOf(reg);
  if (!bg) return undefined;
  const id = (await bg.getIds()).find((i) => hashFromBgFetchId(i) === hash);
  return id ? bg.get(id) : undefined;
}

/** Cancel: the worker's abort handler saves what finished and marks it paused. */
export async function cancelDownload(hash: string): Promise<void> {
  const live = await liveRegistration(hash);
  if (live) await live.abort();
}

/** Live byte progress of a running download, from Chrome. Returns an unsubscribe. */
export async function watchProgress(hash: string, onProgress: (downloaded: number, total: number) => void): Promise<() => void> {
  const live = await liveRegistration(hash);
  if (!live) return () => undefined;
  const handler = () => onProgress(live.downloaded, live.downloadTotal);
  live.addEventListener('progress', handler);
  handler();
  return () => live.removeEventListener('progress', handler);
}

/** On app load: fix up downloads whose background fetch is gone. */
export async function reconcileDownloads(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration(`${BASE}/`);
    const ids = (await bgFetchOf(reg)?.getIds()) ?? [];
    await reconcile(ids);
  } catch {
    // Nothing stored or no worker yet.
  }
}

/**
 * One automatic round for a download paused by a failure (see AUTO_RESUME_DELAYS_MS).
 * Skips quietly when offline or when the index is gone (the user can still Resume by hand).
 */
export async function autoResume(m: DownloadManifest): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const index = await getCachedIndex(m.hash);
  if (!index) return false;
  await putManifest(recordAutoResume(m, Date.now()));
  await startDownload({ hash: m.hash, url: m.url, title: m.title, thumbnailUrl: m.thumbnailUrl }, index);
  return true;
}

/** Finished listening → free the space. Only for complete downloads; never mid-download. */
export async function autoDeleteIfFinished(hash: string): Promise<boolean> {
  if (!isFinished(readPosition(hash))) return false;
  const m = await getManifest(hash);
  if (!m || m.state !== 'ready') return false;
  await deleteDownload(hash);
  return true;
}
