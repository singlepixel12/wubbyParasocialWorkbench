// Page side of offline downloads: register the worker, check space, start/resume/cancel a
// Background Fetch, reconcile on load, auto-delete finished VODs. The worker saves results.
import { bgFetchOf, type BgFetchRegistration } from './background-fetch';
import { bgFetchId, hashFromBgFetchId, missingRuns, newManifest, planForCap, rangeForRun, recordAutoResume, type DownloadManifest } from './download-model';
import { getCachedIndex } from './index-cache';
import { deleteDownload, getManifest, listManifests, notifyChanged, reconcile, updateManifest } from './offline-store';
import { isFinished, readPosition } from './positions';
import type { AudioIndex } from './types';
import type { Video } from '../../types/video';
import { cacheThumbnail } from '../offline/thumbs';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface VodRef {
  hash: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  /** The full row, saved with the download so it opens offline. */
  video?: Video;
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
  // One transaction: the worker may still be saving an earlier round into this manifest.
  const manifest = (await updateManifest(vod.hash, (existing) => {
    const stored = existing ? { ...existing, video: vod.video ?? existing.video } : newManifest({ ...vod, index, now });
    const m = manual ? { ...stored, autoRetries: 0, bytesAtLastAutoRetry: undefined } : stored;
    return { ...m, state: 'downloading', reason: undefined, updatedAt: now };
  }))!;
  void cacheThumbnail(vod.thumbnailUrl); // best effort, for the offline diary
  const missing = missingRuns(manifest);
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
    await updateManifest(vod.hash, (m) => (m ? { ...m, state: 'paused', reason, updatedAt: Date.now() } : null));
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

/**
 * Delete a download, stopping it first if it's still running. Without the abort, Chrome kept
 * downloading (up to ~400 MB) after the row was gone. The worker's abort handler then finds no
 * manifest and stores nothing (saveRuns).
 */
export async function removeDownload(hash: string): Promise<void> {
  try {
    const live = await liveRegistration(hash);
    if (live) await live.abort();
  } catch {
    // No worker or no Background Fetch: nothing is running.
  }
  await deleteDownload(hash);
}

/**
 * Live progress of a running download, polled from Chrome every `everyMs`. Polling, not the
 * `progress` event: the event proved unreliable, and the registration may not exist yet when the
 * button first looks (it used to stick at 0% for a whole download).
 * `onProgress(done, total)` gets bytes for the whole VOD (stored before this round + this round).
 */
export function watchProgress(hash: string, onProgress: (done: number, total: number) => void, everyMs = 2000): () => void {
  let stopped = false;
  const tick = async () => {
    try {
      const [live, m] = await Promise.all([liveRegistration(hash), getManifest(hash)]);
      if (stopped || !live || !m) return;
      // This round covers only the missing runs; add what earlier rounds already stored.
      onProgress(m.bytesDone + live.downloaded, m.bytesTotal);
    } catch {
      // The next tick tries again.
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), everyMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
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
  // Recorded against the stored manifest, not the (possibly stale) one the scheduler saw.
  const current = await updateManifest(m.hash, (cur) => (cur?.state === 'paused' ? recordAutoResume(cur, Date.now()) : null));
  if (current?.state !== 'paused') return false; // deleted, or resumed elsewhere meanwhile
  await startDownload({ hash: m.hash, url: m.url, title: m.title, thumbnailUrl: m.thumbnailUrl, video: m.video }, index);
  return true;
}

/**
 * Resume by hand from the downloads list (the user tapped Resume): restarts the auto-resume
 * schedule. False when the audio index isn't cached any more; opening the VOD rebuilds it.
 */
export async function resumeDownload(m: DownloadManifest): Promise<boolean> {
  const index = await getCachedIndex(m.hash);
  if (!index) return false;
  await startDownload({ hash: m.hash, url: m.url, title: m.title, thumbnailUrl: m.thumbnailUrl, video: m.video }, index, Date.now(), { manual: true });
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

/** Online, with a fresh row for a VOD: if it's downloaded, refresh its saved details + thumbnail. */
export async function rememberVodDetails(video: Video): Promise<void> {
  if (!video.videoHash) return;
  try {
    // Only the details change; `done` and `state` are whatever is stored now (the worker may be
    // saving this very download: the "Saved for offline" notification opens this page).
    const m = await updateManifest(video.videoHash, (cur) => (cur ? { ...cur, video, thumbnailUrl: video.thumbnailUrl ?? cur.thumbnailUrl } : null));
    if (!m) return;
    await cacheThumbnail(m.thumbnailUrl);
  } catch {
    // Not stored: it still works online, and the next visit tries again.
  }
}

/**
 * On app load, online: downloads saved before Phase 3b have no `video`. Fetch each row once
 * (`fetchRow` is the API lookup, injected so this module stays free of the API client).
 */
export async function backfillVodDetails(fetchRow: (hash: string) => Promise<Video | null>): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  let filled = 0;
  for (const m of await listManifests().catch(() => [])) {
    if (m.video) continue;
    try {
      const video = await fetchRow(m.hash);
      if (!video) continue;
      await rememberVodDetails(video);
      filled++;
    } catch {
      // Offline or flaky: the next app load tries again.
    }
  }
  return filled;
}
