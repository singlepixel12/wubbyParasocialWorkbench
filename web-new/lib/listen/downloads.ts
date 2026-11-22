// Page side of offline downloads: register the worker, check space, start/resume/cancel a
// Background Fetch, reconcile on load, auto-delete finished VODs. The worker saves results.
import { bgFetchOf, type BgFetchRegistration } from './background-fetch';
import { hashFromBgFetchId, missingRuns, newManifest, partBgFetchId, planForCap, rangeForRun, recordAutoResume, splitIntoParts, trackStall, type DownloadManifest, type ProgressSample } from './download-model';
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
 *
 * One Background Fetch per part of at most MAX_REQUESTS_PER_FETCH runs (Chrome's matchAll()
 * returns nothing above ~8,000, so a 12 h VOD in one fetch saved nothing). All parts start now, so
 * the download still runs with the phone locked; the worker pauses the VOD only once no part of it
 * is still running.
 */
export async function startDownload(vod: VodRef, index: AudioIndex, now = Date.now(), { manual = false } = {}): Promise<void> {
  await navigator.storage?.persist?.().catch(() => false);
  // One transaction: the worker may still be saving an earlier round into this manifest.
  const manifest = (await updateManifest(vod.hash, (existing) => {
    const stored = existing ? { ...existing, video: vod.video ?? existing.video } : newManifest({ ...vod, index, now });
    const m = manual ? { ...stored, autoRetries: 0, bytesAtLastAutoRetry: undefined } : stored;
    // Nothing left to fetch (every run is stored): it's simply ready, no round to start.
    const state = missingRuns(m).length ? 'downloading' : 'ready';
    return { ...m, state, reason: undefined, restartRequested: undefined, updatedAt: now };
  }))!;
  if (manifest.state === 'ready') {
    notifyChanged(vod.hash);
    return;
  }
  void cacheThumbnail(vod.thumbnailUrl); // best effort, for the offline diary
  const missing = missingRuns(manifest);
  notifyChanged(vod.hash);
  const registered: BgFetchRegistration[] = [];
  try {
    const bg = bgFetchOf(await ensureWorker());
    if (!bg) throw new Error('Background downloads are not supported in this browser');
    const parts = splitIntoParts(missing);
    for (const [k, runs] of parts.entries()) {
      const requests = runs.map((r) => new Request(vod.url, { headers: { Range: rangeForRun(index, r) }, mode: 'cors' }));
      registered.push(
        await bg.fetch(partBgFetchId(vod.hash, now, k), requests, {
          title: parts.length > 1 ? `Wubby Archive · ${vod.title} (${k + 1}/${parts.length})` : `Wubby Archive · ${vod.title}`,
          icons: vod.thumbnailUrl ? [{ src: vod.thumbnailUrl, sizes: '512x288', type: 'image/webp' }] : [],
          downloadTotal: remainingBytes(index, runs),
        }),
      );
    }
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // Pause first: the worker keeps a pause it finds in place, so the aborts below (which save
    // whatever finished) don't turn this into "cancelled" or start another part's round.
    await updateManifest(vod.hash, (m) => (m ? { ...m, state: 'paused', reason, updatedAt: Date.now() } : null));
    await Promise.all(registered.map((r) => r.abort().catch(() => false)));
    notifyChanged(vod.hash);
    throw err;
  }
}

/** Every live part of this VOD's download (one per MAX_REQUESTS_PER_FETCH runs). */
async function liveRegistrations(hash: string): Promise<BgFetchRegistration[]> {
  const reg = await navigator.serviceWorker?.getRegistration(`${BASE}/`);
  const bg = bgFetchOf(reg);
  if (!bg) return [];
  const ids = (await bg.getIds()).filter((i) => hashFromBgFetchId(i) === hash);
  const live = await Promise.all(ids.map((id) => bg.get(id)));
  return live.filter((r): r is BgFetchRegistration => !!r);
}

const abortAll = (parts: BgFetchRegistration[]) => Promise.all(parts.map((p) => p.abort().catch(() => false)));

/** Cancel: every part stops; the worker's abort handler saves what finished and marks it paused. */
export async function cancelDownload(hash: string): Promise<void> {
  await abortAll(await liveRegistrations(hash));
}

/**
 * Delete a download, stopping it first if it's still running. Without the abort, Chrome kept
 * downloading (up to ~400 MB) after the row was gone. The worker's abort handler then finds no
 * manifest and stores nothing (saveRuns).
 */
export async function removeDownload(hash: string): Promise<void> {
  try {
    await abortAll(await liveRegistrations(hash));
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
      const [live, m] = await Promise.all([liveRegistrations(hash), getManifest(hash)]);
      if (stopped || !live.length || !m) return;
      // This round covers only the missing runs; add what earlier rounds (and finished parts of
      // this one) already stored. A finished part leaves the live list as its bytes reach bytesDone.
      onProgress(Math.min(m.bytesTotal, m.bytesDone + live.reduce((a, p) => a + p.downloaded, 0)), m.bytesTotal);
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

/** Progress baselines per VOD, only ever sampled while the app is visible. */
const stallSamples = new Map<string, ProgressSample>();

/** Forget the baselines: call when the app becomes visible again (it saw nothing while hidden). */
export function resetStallWatch(): void {
  stallSamples.clear();
}

/** A download that only just started may not have its registration yet; leave it this long. */
const RECONCILE_GRACE_MS = 60_000;

/**
 * One watchdog look, while the app is open, visible and online (DownloadsAutoResume):
 * - a "downloading" VOD whose background fetch is gone becomes paused, so a bar never sits frozen
 *   on a fetch that no longer exists (and auto-resume can pick it up);
 * - a live round with no new bytes for STALL_RESTART_MS is aborted with `restartRequested` set.
 *   The worker saves what finished and pauses it as stalled, and auto-resume starts a fresh round
 *   for only the missing runs.
 * Returns the VODs it restarted.
 */
export async function watchdogTick(now = Date.now()): Promise<string[]> {
  const reg = await navigator.serviceWorker?.getRegistration(`${BASE}/`);
  const bg = bgFetchOf(reg);
  if (!bg) return [];
  const ids = await bg.getIds();
  for (const hash of await reconcile(ids, now, RECONCILE_GRACE_MS)) notifyChanged(hash);

  // All parts of a VOD count as one download: it's stalled when their summed bytes stop moving.
  const partsByHash = new Map<string, BgFetchRegistration[]>();
  for (const id of ids) {
    const hash = hashFromBgFetchId(id);
    if (!hash) continue;
    const live = await bg.get(id);
    if (!live) continue;
    partsByHash.set(hash, [...(partsByHash.get(hash) ?? []), live]);
  }
  const liveHashes = new Set(partsByHash.keys());
  const restarted: string[] = [];
  for (const [hash, parts] of partsByHash) {
    const downloaded = parts.reduce((a, p) => a + p.downloaded, 0);
    const { sample, stalled } = trackStall(stallSamples.get(hash), downloaded, now);
    stallSamples.set(hash, sample);
    if (!stalled) continue;
    stallSamples.delete(hash);
    const m = await updateManifest(hash, (cur) => (cur ? { ...cur, restartRequested: true } : null));
    if (!m) continue; // deleted meanwhile
    await abortAll(parts);
    restarted.push(hash);
  }
  for (const hash of [...stallSamples.keys()]) if (!liveHashes.has(hash)) stallSamples.delete(hash);
  return restarted;
}

/**
 * One automatic round for a download paused by a failure (see AUTO_RESUME_DELAYS_MS).
 * Skips quietly when offline, on mobile data, or when the index is gone (the user can still
 * Resume by hand).
 */
export async function autoResume(m: DownloadManifest): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  // Never spend mobile data unasked: Download and Resume ask first, so an automatic round waits
  // for Wi-Fi (DownloadsAutoResume looks again when the connection changes).
  if (onMobileData()) return false;
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
