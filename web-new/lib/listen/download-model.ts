// Pure download bookkeeping, shared by the page and the service worker. No I/O.
import type { AudioIndex } from './types';
import type { Video } from '../../types/video';

export type DownloadState = 'downloading' | 'paused' | 'ready' | 'stale';

export interface DownloadManifest {
  hash: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  runCount: number;
  /** Audio bytes for the whole VOD. */
  bytesTotal: number;
  /** One byte per run: 1 = stored. */
  done: Uint8Array;
  bytesDone: number;
  state: DownloadState;
  /** Why it's paused/stale, for the list. */
  reason?: string;
  lastModified: string | null;
  createdAt: number;
  updatedAt: number;
  lastListenedAt: number;
  /** Auto-resume rounds since the last one that saved new bytes. */
  autoRetries?: number;
  /** bytesDone when the last auto-resume started (to tell if that round made progress). */
  bytesAtLastAutoRetry?: number;
  /** The VOD's row (summary, tags, date), so /watch and the diary work offline (Phase 3b). */
  video?: Video;
  /**
   * Set by the page's watchdog just before it aborts a stuck round, so the worker pauses it as
   * stalled (auto-resumes) rather than cancelled (waits for the user). A new round clears it.
   */
  restartRequested?: boolean;
}

/**
 * Background Fetch doesn't retry: one failed request ends the round (the worker saves the rest).
 * On a flaky phone network we start another round for what's missing, backing off while rounds
 * make no progress, and stop after this schedule until the user taps Resume.
 */
export const AUTO_RESUME_DELAYS_MS = [3_000, 10_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000] as const;

/** Rounds already tried without progress (the counter restarts when a round saved new bytes). */
function roundsWithoutProgress(m: DownloadManifest): number {
  const progressed = m.bytesAtLastAutoRetry !== undefined && m.bytesDone > m.bytesAtLastAutoRetry;
  return progressed ? 0 : (m.autoRetries ?? 0);
}

/** ms until this paused download should auto-resume; null = never (cancelled, done, or out of rounds). */
export function autoResumeDelay(m: DownloadManifest, now: number): number | null {
  if (m.state !== 'paused' || m.reason === 'cancelled') return null;
  const rounds = roundsWithoutProgress(m);
  if (rounds >= AUTO_RESUME_DELAYS_MS.length) return null;
  return Math.max(0, m.updatedAt + AUTO_RESUME_DELAYS_MS[rounds] - now);
}

/**
 * A round can sit alive in Chrome with no bytes moving: an S22 on battery saver, locked overnight,
 * held one at 10% until morning, and auto-resume never saw it (it only handles paused rounds).
 * With the app open, visible and online, no new bytes for this long means: restart the round.
 * Chrome's own retries inside a round wait ~30 s, so this is several of those.
 */
export const STALL_RESTART_MS = 2 * 60_000;
/** The paused reason of a round the watchdog restarted. Not 'cancelled', so it auto-resumes. */
export const STALLED_REASON = 'stalled; restarting';

export interface ProgressSample {
  downloaded: number;
  since: number;
}

/** Feed the round's `downloaded` in; stalled once it hasn't moved for `limit` ms. Pure. */
export function trackStall(prev: ProgressSample | undefined, downloaded: number, now: number, limit = STALL_RESTART_MS): { sample: ProgressSample; stalled: boolean } {
  if (!prev || downloaded !== prev.downloaded) return { sample: { downloaded, since: now }, stalled: false };
  return { sample: prev, stalled: now - prev.since >= limit };
}

/** The manifest as an auto-resume round starts. */
export function recordAutoResume(m: DownloadManifest, now: number): DownloadManifest {
  return { ...m, autoRetries: roundsWithoutProgress(m) + 1, bytesAtLastAutoRetry: m.bytesDone, updatedAt: now };
}

/** Fixed total for downloads (about 4–5 long VODs). No settings UI on purpose. */
export const CAP_BYTES = 2 * 1024 ** 3;

export function newManifest(a: { hash: string; title: string; url: string; thumbnailUrl?: string; video?: Video; index: AudioIndex; now: number }): DownloadManifest {
  let bytesTotal = 0;
  for (const s of a.index.runSize) bytesTotal += s;
  return {
    hash: a.hash,
    title: a.title,
    url: a.url,
    thumbnailUrl: a.thumbnailUrl,
    video: a.video,
    runCount: a.index.runSize.length,
    bytesTotal,
    done: new Uint8Array(a.index.runSize.length),
    bytesDone: 0,
    state: 'downloading',
    lastModified: a.index.lastModified,
    createdAt: a.now,
    updatedAt: a.now,
    lastListenedAt: a.now,
  };
}

export function missingRuns(m: DownloadManifest): number[] {
  const out: number[] = [];
  for (let r = 0; r < m.runCount; r++) if (!m.done[r]) out.push(r);
  return out;
}

/** Copy of `m` with `runs` marked stored; `ready` once every run is. */
export function markDone(m: DownloadManifest, runs: Iterable<number>, runSize: ArrayLike<number>, now: number): DownloadManifest {
  const done = m.done.slice();
  let bytesDone = m.bytesDone;
  for (const r of runs) {
    if (r < 0 || r >= m.runCount || done[r]) continue;
    done[r] = 1;
    bytesDone += runSize[r];
  }
  const complete = done.every((d) => d === 1);
  return { ...m, done, bytesDone, updatedAt: now, state: complete ? 'ready' : m.state === 'ready' ? 'downloading' : m.state, reason: complete ? undefined : m.reason };
}

export function progress(m: Pick<DownloadManifest, 'bytesDone' | 'bytesTotal'>): number {
  return m.bytesTotal > 0 ? m.bytesDone / m.bytesTotal : 0;
}

export function totals(ms: readonly DownloadManifest[]) {
  let ready = 0;
  let bytesStored = 0;
  for (const m of ms) {
    if (m.state === 'ready') ready++;
    bytesStored += m.bytesDone;
  }
  return { count: ms.length, ready, partial: ms.length - ready, bytesStored };
}

/** Would `newBytes` more fit under `cap`? If not, which downloads to delete, least-recently-listened first. */
export function planForCap(others: readonly DownloadManifest[], newBytes: number, cap = CAP_BYTES): { fits: boolean; suggest: string[] } {
  let used = others.reduce((a, m) => a + m.bytesDone, 0);
  if (used + newBytes <= cap) return { fits: true, suggest: [] };
  const suggest: string[] = [];
  for (const m of [...others].sort((a, b) => a.lastListenedAt - b.lastListenedAt)) {
    suggest.push(m.hash);
    used -= m.bytesDone;
    if (used + newBytes <= cap) break;
  }
  return { fits: false, suggest };
}

export function rangeForRun(index: AudioIndex, r: number): string {
  const start = index.runOffset[r];
  return `bytes=${start}-${start + index.runSize[r] - 1}`;
}

/** Which run a background-fetch record belongs to (records come back unordered). -1 if none. */
export function runFromRange(index: AudioIndex, header: string | null): number {
  const m = header ? /^bytes=(\d+)-(\d+)$/.exec(header) : null;
  if (!m) return -1;
  const start = Number(m[1]);
  let lo = 0;
  let hi = index.runOffset.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = index.runOffset[mid];
    if (v === start) return Number(m[2]) === start + index.runSize[mid] - 1 ? mid : -1;
    if (v < start) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

const PREFIX = 'listen:';
export const bgFetchId = (hash: string, now = Date.now()) => `${PREFIX}${hash}:${now}`;
export function hashFromBgFetchId(id: string): string | null {
  if (!id.startsWith(PREFIX)) return null;
  const rest = id.slice(PREFIX.length);
  const i = rest.lastIndexOf(':');
  return i > 0 ? rest.slice(0, i) : null;
}
