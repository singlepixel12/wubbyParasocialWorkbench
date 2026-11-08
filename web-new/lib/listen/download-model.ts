// Pure download bookkeeping, shared by the page and the service worker. No I/O.
import type { AudioIndex } from './types';

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
}

/** Fixed total for downloads (about 4–5 long VODs). No settings UI on purpose. */
export const CAP_BYTES = 2 * 1024 ** 3;

export function newManifest(a: { hash: string; title: string; url: string; thumbnailUrl?: string; index: AudioIndex; now: number }): DownloadManifest {
  let bytesTotal = 0;
  for (const s of a.index.runSize) bytesTotal += s;
  return {
    hash: a.hash,
    title: a.title,
    url: a.url,
    thumbnailUrl: a.thumbnailUrl,
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
