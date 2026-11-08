# Listen Mode — Phase 2 (Background Download) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Download** button on `/watch` saves a VOD's audio to the phone in the background, using Chrome's Background Fetch so it keeps going with the phone locked or Chrome closed. Listen then plays with zero data. A diary chip (`⬇ 3 offline · 1.2 GB`) opens a downloads list with delete, there's a 2 GB cap, and a VOD is auto-deleted when finished.

**Architecture:**
- **Download:** the page starts **one Background Fetch per VOD** with a bounded `Range` request for every missing audio run (Listen's runs from Phase 1).
- **Saving:** a minimal service worker, background-fetch events only and no `fetch` handler, saves completed runs to IndexedDB on success, failure or cancel. Resume fetches only what's missing.
- **Playback:** the Listen engine reads stored runs before touching the network.
- **Code layout:** all logic lives in testable TypeScript modules under `lib/listen/`. The worker is a thin JS entry bundled by esbuild into `public/sw.js`.

**Tech Stack:** As Phase 1, plus Background Fetch API, Service Worker, BroadcastChannel, IndexedDB (via `fake-indexeddb` in tests), and a Playwright `pixel-chrome` project (real Chrome; Playwright's bundled Chromium never completes background fetches).

**Spec:** `docs/superpowers/specs/2026-11-08-listen-mode-design.md`, sections *Storage counter and downloads (Phase 2)* and **Downloads: revised 2026-11-08, Background Fetch**. Read that section first.

---

## Facts this plan relies on (spiked 2026-11-08, real Chrome, real archive)

- **Background Fetch:**
  - accepts `Range` requests: 48/48 returned `206`, every byte count exact;
  - runs ~1.61 runs/s from one registration, so ~55 min for a 6 h VOD;
  - parallel registrations are slower, and 8 at once fails ("too many active fetches for this origin").
- **What the service worker can and can't do:**
  - it **can** write `backgroundfetchsuccess` results into IndexedDB;
  - it **cannot** call `backgroundFetch.fetch()` ("not allowed in service worker environments"), so the page starts every fetch.
- **Records** come back in a different order from the requests. Identify each one by its request's `Range` header.
- **Playwright's bundled Chromium** accepts a background fetch but never completes it. Use `channel: 'chrome'`.
- **From Phase 1:**
  - a run is a byte-contiguous group of AAC samples (`AudioIndex.runOffset/runSize`);
  - `getCachedIndex(hash)` returns the parsed index;
  - positions live in `lib/listen/positions.ts`.

## File structure

```
web-new/
  lib/listen/
    db.ts                 shared IndexedDB open (v2): audio-index, downloads, audio-runs
    index-cache.ts        (modify) use db.ts; never prune indexes of downloaded VODs
    download-model.ts     pure: manifest, missing runs, progress, totals, cap plan, ids, range→run
    offline-store.ts      IndexedDB: manifests + stored run bytes (page AND service worker)
    background-fetch.ts   minimal Background Fetch types + feature detection
    sw-handlers.ts        what the worker does when a background fetch ends (testable)
    downloads.ts          page side: register worker, preflight, start/cancel, reconcile, progress
    downloads-store.ts    live list of manifests for React (useSyncExternalStore)
    listen-engine.ts      (modify) read stored runs before the network
  scripts/
    sw/service-worker.js  thin worker entry (events → sw-handlers)
    build-sw.mjs          esbuild → public/sw.js (prebuild / predev)
  components/listen/
    DownloadButton.tsx    watch page: Download / 42% / Resume / Saved
    DownloadsChip.tsx     diary masthead chip
    DownloadsSheet.tsx    the downloads list
    AudioCard.tsx         (modify) "Playing from your phone", touch lastListened, auto-delete
  components/video/VideoDetailView.tsx   (modify) add DownloadButton
  components/layout/Masthead.tsx         (modify) slot for the chip
  components/vod-diary/VodDiaryScreen.tsx (modify) pass the chip
  app/layout.tsx         (modify) reconcile downloads on load
  next.config.ts         (modify) expose NEXT_PUBLIC_BASE_PATH
  playwright.config.ts   (modify) pixel-chrome project
  tests/unit/listen/{db,download-model,offline-store,sw-handlers,downloads}.test.ts
  tests/unit/DownloadButton.test.tsx
  tests/listen-download.spec.ts
docs/listen-mode-phone-checklist.md (modify)
CLAUDE.md (modify)
```

All `lib/listen/` files keep **relative** imports (esbuild bundles them into the worker without the `@/` alias).

Commands run from `web-new/`. Gates for every task: `npx vitest run <file>`, then `npx tsc --noEmit` (0 errors; `next build` type-checks tests).

---

### Task 1: Shared IndexedDB (v2) and pinned indexes

**Files:**
- Create: `web-new/lib/listen/db.ts`
- Modify: `web-new/lib/listen/index-cache.ts`
- Test: `web-new/tests/unit/listen/db.test.ts`; the existing `tests/unit/listen/index-cache.test.ts` must keep passing

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/listen/db.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openListenDb, STORES } from '@/lib/listen/db';
import { putCachedIndex, getCachedIndex, CACHE_KEEP } from '@/lib/listen/index-cache';
import type { AudioIndex } from '@/lib/listen/types';

const index = (tag: number): AudioIndex => ({
  version: 1, lastModified: `LM${tag}`, timescale: 48000, durationSec: 10, sampleRate: 48000, channelCount: 2,
  codec: 'mp4a.40.2', audioSpecificConfig: Uint8Array.of(0x11, 0x90),
  sampleSizes: Uint16Array.of(1), sttsCounts: Uint32Array.of(1), sttsDeltas: Uint32Array.of(1024),
  runFirst: Uint32Array.of(0), runCount: Uint32Array.of(1), runOffset: Float64Array.of(0), runSize: Uint32Array.of(1), runStartTicks: Float64Array.of(0),
});

beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
});

describe('openListenDb', () => {
  it('has the index, downloads and runs stores', async () => {
    const db = await openListenDb();
    expect([...db.objectStoreNames].sort()).toEqual([STORES.runs, STORES.index, STORES.downloads].sort());
    db.close();
  });

  it('upgrades a v1 database (index cache only) without losing it', async () => {
    await new Promise<void>((resolve) => {
      const q = indexedDB.open('wubby-listen', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('audio-index', { keyPath: 'hash' }).put({ hash: 'old', savedAt: 1, index: index(9) });
      q.onsuccess = () => {
        q.result.close();
        resolve();
      };
    });
    expect((await getCachedIndex('old'))?.lastModified).toBe('LM9');
  });
});

describe('index-cache pruning', () => {
  it('never prunes the index of a VOD that has a download', async () => {
    const db = await openListenDb();
    await new Promise<void>((r) => {
      const tx = db.transaction(STORES.downloads, 'readwrite');
      tx.objectStore(STORES.downloads).put({ hash: 'h0' });
      tx.oncomplete = () => r();
    });
    db.close();
    for (let i = 0; i < CACHE_KEEP + 3; i++) await putCachedIndex(`h${i}`, index(i), 1000 + i);
    expect(await getCachedIndex('h0')).not.toBeNull(); // oldest, but downloaded
    expect(await getCachedIndex('h1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/db.test.ts`

- [ ] **Step 3: Implement `db.ts`**

```ts
// lib/listen/db.ts
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
```

- [ ] **Step 4: Point `index-cache.ts` at it**

Replace the body of `lib/listen/index-cache.ts` with:

```ts
// About 2 MB per VOD (997k 16-bit sample sizes for a 6 h stream). Saves re-downloading the 23.6 MB moov.
// Every function swallows storage errors: a broken cache must never break Listen.
// Indexes of downloaded VODs are never pruned: offline playback and the worker need them.
import { inTransaction, STORES } from './db';
import type { AudioIndex } from './types';

export const CACHE_KEEP = 10;

interface Entry {
  hash: string;
  savedAt: number;
  index: AudioIndex;
}

export async function getCachedIndex(hash: string): Promise<AudioIndex | null> {
  try {
    const entry = await inTransaction<Entry | undefined>(STORES.index, 'readonly', (tx) => tx.objectStore(STORES.index).get(hash) as IDBRequest<Entry | undefined>);
    return entry?.index ?? null;
  } catch {
    return null;
  }
}

export async function putCachedIndex(hash: string, index: AudioIndex, now = Date.now()): Promise<void> {
  try {
    await inTransaction(STORES.index, 'readwrite', (tx) => tx.objectStore(STORES.index).put({ hash, savedAt: now, index } satisfies Entry));
    const all = (await inTransaction<Entry[]>(STORES.index, 'readonly', (tx) => tx.objectStore(STORES.index).getAll() as IDBRequest<Entry[]>)) ?? [];
    const pinned = new Set(((await inTransaction<IDBValidKey[]>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).getAllKeys())) ?? []).map(String));
    const stale = all.filter((e) => !pinned.has(e.hash)).sort((a, b) => b.savedAt - a.savedAt).slice(CACHE_KEEP);
    if (stale.length) {
      await inTransaction(STORES.index, 'readwrite', (tx) => {
        for (const e of stale) tx.objectStore(STORES.index).delete(e.hash);
      });
    }
  } catch {
    // Quota or private mode: Listen re-downloads the moov next time. Acceptable.
  }
}

export async function deleteCachedIndex(hash: string): Promise<void> {
  try {
    await inTransaction(STORES.index, 'readwrite', (tx) => tx.objectStore(STORES.index).delete(hash));
  } catch {
    // ignore
  }
}
```

- [ ] **Step 5: Run — expect PASS** for both files, then tsc

Run: `npx vitest run tests/unit/listen/db.test.ts tests/unit/listen/index-cache.test.ts && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/listen/db.ts lib/listen/index-cache.ts tests/unit/listen/db.test.ts
git commit -m "feat(listen): shared IndexedDB v2 (downloads, audio-runs); pin indexes of downloaded VODs"
```

---

### Task 2: Download model (pure)

**Files:**
- Create: `web-new/lib/listen/download-model.ts`
- Test: `web-new/tests/unit/listen/download-model.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/download-model.test.ts
import { describe, it, expect } from 'vitest';
import {
  newManifest, missingRuns, markDone, progress, totals, planForCap, runFromRange, rangeForRun,
  bgFetchId, hashFromBgFetchId, CAP_BYTES, type DownloadManifest,
} from '@/lib/listen/download-model';
import type { AudioIndex } from '@/lib/listen/types';

const index = (sizes: number[]): AudioIndex => {
  const offsets: number[] = [];
  let o = 1000;
  for (const s of sizes) {
    offsets.push(o);
    o += s + 5000; // video bytes between runs
  }
  return {
    version: 1, lastModified: 'LM', timescale: 48000, durationSec: sizes.length * 4, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2',
    audioSpecificConfig: new Uint8Array(2), sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
    runFirst: new Uint32Array(sizes.length), runCount: new Uint32Array(sizes.length),
    runOffset: Float64Array.from(offsets), runSize: Uint32Array.from(sizes), runStartTicks: new Float64Array(sizes.length),
  };
};
const idx = index([100, 200, 300, 400]);
const base = () => newManifest({ hash: 'h', title: 'T', url: 'u', index: idx, now: 10 });

describe('manifest', () => {
  it('starts empty, downloading, sized from the index', () => {
    const m = base();
    expect(m).toMatchObject({ hash: 'h', runCount: 4, bytesTotal: 1000, bytesDone: 0, state: 'downloading', lastModified: 'LM', lastListenedAt: 10 });
    expect(missingRuns(m)).toEqual([0, 1, 2, 3]);
  });

  it('marks runs done, tracks bytes, and becomes ready when complete', () => {
    let m = markDone(base(), [1, 3], idx.runSize, 20);
    expect(missingRuns(m)).toEqual([0, 2]);
    expect(m.bytesDone).toBe(600);
    expect(progress(m)).toBeCloseTo(0.6);
    expect(m.state).toBe('downloading');
    m = markDone(m, [0, 2, 2], idx.runSize, 30); // duplicates are harmless
    expect(m.bytesDone).toBe(1000);
    expect(m.state).toBe('ready');
    expect(m.updatedAt).toBe(30);
  });

  it('does not mutate its input', () => {
    const m = base();
    markDone(m, [0], idx.runSize, 1);
    expect(m.bytesDone).toBe(0);
    expect(m.done[0]).toBe(0);
  });
});

describe('totals and cap', () => {
  const m = (hash: string, bytesDone: number, state: DownloadManifest['state'], lastListenedAt: number) =>
    ({ ...base(), hash, bytesDone, bytesTotal: bytesDone, state, lastListenedAt }) as DownloadManifest;

  it('totals counts ready and partial downloads and their bytes', () => {
    expect(totals([m('a', 100, 'ready', 1), m('b', 50, 'paused', 2), m('c', 0, 'downloading', 3)])).toEqual({ count: 3, ready: 1, partial: 2, bytesStored: 150 });
  });

  it('fits when under the cap', () => {
    expect(planForCap([m('a', 100, 'ready', 1)], 100, 1000)).toEqual({ fits: true, suggest: [] });
  });

  it('suggests least-recently-listened downloads to delete until it fits', () => {
    const plan = planForCap([m('new', 400, 'ready', 50), m('old', 400, 'ready', 10), m('mid', 400, 'paused', 30)], 500, 1000);
    expect(plan).toEqual({ fits: false, suggest: ['old', 'mid'] });
  });

  it('cap default is 2 GB', () => {
    expect(CAP_BYTES).toBe(2 * 1024 ** 3);
  });
});

describe('ranges and ids', () => {
  it('maps a Range header back to its run, and builds one', () => {
    expect(rangeForRun(idx, 2)).toBe(`bytes=${idx.runOffset[2]}-${idx.runOffset[2] + 299}`);
    expect(runFromRange(idx, rangeForRun(idx, 2))).toBe(2);
    expect(runFromRange(idx, 'bytes=5-9')).toBe(-1);
    expect(runFromRange(idx, null)).toBe(-1);
  });

  it('round-trips a background fetch id', () => {
    const id = bgFetchId('abc', 123);
    expect(id).toBe('listen:abc:123');
    expect(hashFromBgFetchId(id)).toBe('abc');
    expect(hashFromBgFetchId('other:thing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/download-model.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/download-model.ts
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

export function progress(m: DownloadManifest): number {
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
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/download-model.ts tests/unit/listen/download-model.test.ts
git commit -m "feat(listen): pure download model (manifest, progress, cap plan, range<->run)"
```

---

### Task 3: Offline store (IndexedDB, page + worker)

**Files:**
- Create: `web-new/lib/listen/offline-store.ts`
- Test: `web-new/tests/unit/listen/offline-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/offline-store.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { newManifest } from '@/lib/listen/download-model';
import {
  getManifest, putManifest, listManifests, saveRuns, readStoredRun, deleteDownload, setState, touchListened, reconcile,
} from '@/lib/listen/offline-store';
import type { AudioIndex } from '@/lib/listen/types';

const sizes = [3, 4, 5];
const idx = { runSize: Uint32Array.from(sizes), runOffset: Float64Array.of(0, 100, 200), lastModified: 'LM' } as unknown as AudioIndex;
const bytes = (n: number, v: number) => new Uint8Array(n).fill(v);

beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
  await putManifest(newManifest({ hash: 'h', title: 'T', url: 'u', index: idx, now: 1 }));
});

describe('offline-store', () => {
  it('saves runs, reads them back, and updates the manifest', async () => {
    const m = await saveRuns('h', [{ run: 2, bytes: bytes(5, 7) }, { run: 0, bytes: bytes(3, 1) }], idx.runSize, 5);
    expect(m?.bytesDone).toBe(8);
    expect(Array.from((await readStoredRun('h', 2))!)).toEqual([7, 7, 7, 7, 7]);
    expect(await readStoredRun('h', 1)).toBeNull();
    expect((await getManifest('h'))?.done[0]).toBe(1);
  });

  it('rejects a run whose length does not match the index', async () => {
    const m = await saveRuns('h', [{ run: 1, bytes: bytes(2, 9) }], idx.runSize, 5);
    expect(m?.bytesDone).toBe(0);
    expect(await readStoredRun('h', 1)).toBeNull();
  });

  it('becomes ready once every run is stored', async () => {
    const m = await saveRuns('h', sizes.map((n, run) => ({ run, bytes: bytes(n, run) })), idx.runSize, 9);
    expect(m?.state).toBe('ready');
  });

  it('deletes a download completely', async () => {
    await saveRuns('h', [{ run: 0, bytes: bytes(3, 1) }], idx.runSize, 5);
    await deleteDownload('h');
    expect(await getManifest('h')).toBeNull();
    expect(await readStoredRun('h', 0)).toBeNull();
    expect(await listManifests()).toEqual([]);
  });

  it('sets state, touches last-listened', async () => {
    await setState('h', 'paused', 'connection lost', 7);
    await touchListened('h', 99);
    expect(await getManifest('h')).toMatchObject({ state: 'paused', reason: 'connection lost', lastListenedAt: 99 });
  });

  it('reconcile: a downloading manifest with no live background fetch becomes paused', async () => {
    await reconcile([], 50);
    expect((await getManifest('h'))?.state).toBe('paused');
    await setState('h', 'downloading', undefined, 51);
    await reconcile(['listen:h:123'], 52);
    expect((await getManifest('h'))?.state).toBe('downloading');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/offline-store.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/offline-store.ts
// Download manifests + stored audio runs in IndexedDB. Runs in the page AND the service worker,
// so: relative imports only, no window/DOM APIs. Writes are batched per transaction.
import { inTransaction, STORES } from './db';
import { hashFromBgFetchId, markDone, type DownloadManifest, type DownloadState } from './download-model';
import type { Bytes } from './types';

export const DOWNLOADS_CHANNEL = 'listen-downloads';
const RUNS_PER_TX = 200;

const runKey = (hash: string, run: number) => `${hash}:${String(run).padStart(6, '0')}`;
const runRange = (hash: string) => IDBKeyRange.bound(`${hash}:`, `${hash}:\uffff`);

/** Tell every open page (and the worker) that a download changed. */
export function notifyChanged(hash: string): void {
  try {
    const ch = new BroadcastChannel(DOWNLOADS_CHANNEL);
    ch.postMessage({ hash });
    ch.close();
  } catch {
    // BroadcastChannel missing: pages refresh on next load instead.
  }
}

export async function getManifest(hash: string): Promise<DownloadManifest | null> {
  return ((await inTransaction<DownloadManifest | undefined>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).get(hash) as IDBRequest<DownloadManifest | undefined>)) ?? null);
}

export async function putManifest(m: DownloadManifest): Promise<void> {
  await inTransaction(STORES.downloads, 'readwrite', (tx) => tx.objectStore(STORES.downloads).put(m));
}

export async function listManifests(): Promise<DownloadManifest[]> {
  return (await inTransaction<DownloadManifest[]>(STORES.downloads, 'readonly', (tx) => tx.objectStore(STORES.downloads).getAll() as IDBRequest<DownloadManifest[]>)) ?? [];
}

/**
 * Store fetched runs (skipping any whose length doesn't match the index) and mark them done.
 * Returns the updated manifest, or null if the download was deleted meanwhile.
 */
export async function saveRuns(hash: string, entries: ReadonlyArray<{ run: number; bytes: Uint8Array }>, runSize: ArrayLike<number>, now = Date.now()): Promise<DownloadManifest | null> {
  const valid = entries.filter((e) => e.run >= 0 && e.run < runSize.length && e.bytes.byteLength === runSize[e.run]);
  for (let i = 0; i < valid.length; i += RUNS_PER_TX) {
    const chunk = valid.slice(i, i + RUNS_PER_TX);
    await inTransaction(STORES.runs, 'readwrite', (tx) => {
      for (const e of chunk) tx.objectStore(STORES.runs).put(e.bytes, runKey(hash, e.run));
    });
  }
  const m = await getManifest(hash);
  if (!m) return null;
  const updated = markDone(m, valid.map((e) => e.run), runSize, now);
  await putManifest(updated);
  return updated;
}

export async function readStoredRun(hash: string, run: number): Promise<Bytes | null> {
  try {
    const v = await inTransaction<Uint8Array | undefined>(STORES.runs, 'readonly', (tx) => tx.objectStore(STORES.runs).get(runKey(hash, run)) as IDBRequest<Uint8Array | undefined>);
    return v ? (new Uint8Array(v) as Bytes) : null;
  } catch {
    return null;
  }
}

export async function deleteDownload(hash: string): Promise<void> {
  await inTransaction([STORES.runs, STORES.downloads], 'readwrite', (tx) => {
    tx.objectStore(STORES.runs).delete(runRange(hash));
    tx.objectStore(STORES.downloads).delete(hash);
  });
  notifyChanged(hash);
}

export async function setState(hash: string, state: DownloadState, reason?: string, now = Date.now()): Promise<void> {
  const m = await getManifest(hash);
  if (!m) return;
  await putManifest({ ...m, state, reason, updatedAt: now });
}

export async function touchListened(hash: string, now = Date.now()): Promise<void> {
  const m = await getManifest(hash);
  if (m) await putManifest({ ...m, lastListenedAt: now });
}

/** On app load: anything "downloading" without a live background fetch is really paused. */
export async function reconcile(activeIds: readonly string[], now = Date.now()): Promise<void> {
  const live = new Set(activeIds.map(hashFromBgFetchId).filter(Boolean));
  for (const m of await listManifests()) {
    if (m.state === 'downloading' && !live.has(m.hash)) await putManifest({ ...m, state: 'paused', reason: m.reason ?? 'interrupted', updatedAt: now });
  }
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/offline-store.ts tests/unit/listen/offline-store.test.ts
git commit -m "feat(listen): offline store for download manifests and audio runs"
```

---

### Task 4: Worker-side handling and the service worker build

**Files:**
- Create: `web-new/lib/listen/background-fetch.ts`, `web-new/lib/listen/sw-handlers.ts`
- Create: `web-new/scripts/sw/service-worker.js`, `web-new/scripts/build-sw.mjs`
- Modify: `web-new/package.json` (scripts), `web-new/.gitignore`
- Test: `web-new/tests/unit/listen/sw-handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/sw-handlers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleBackgroundFetchEnd, type BgRegistrationLike } from '@/lib/listen/sw-handlers';
import { rangeForRun } from '@/lib/listen/download-model';
import type { AudioIndex } from '@/lib/listen/types';

const idx = { runOffset: Float64Array.of(1000, 9000, 20000), runSize: Uint32Array.of(3, 4, 5), lastModified: 'LM' } as unknown as AudioIndex;
const record = (run: number, status = 206, len = idx.runSize[run]) => ({
  request: { headers: { get: (n: string) => (n.toLowerCase() === 'range' ? rangeForRun(idx, run) : null) } },
  responseReady: Promise.resolve({ status, arrayBuffer: async () => new ArrayBuffer(len) }),
});
const reg = (records: ReturnType<typeof record>[], id = 'listen:h:1'): BgRegistrationLike => ({ id, matchAll: async () => records });

function deps(state: 'downloading' | 'ready' = 'downloading') {
  const saveRuns = vi.fn(async (_h: string, entries: { run: number }[]) => ({ hash: 'h', title: 'T', state: entries.length === 3 ? 'ready' : state, done: new Uint8Array(3) }));
  return { getIndex: vi.fn(async () => idx), saveRuns, setState: vi.fn(async () => {}), notify: vi.fn(), getManifest: vi.fn(async () => ({ hash: 'h', title: 'T' })) };
}

describe('handleBackgroundFetchEnd', () => {
  it('on success saves every valid record (any order) and reports ready', async () => {
    const d = deps();
    const r = await handleBackgroundFetchEnd('success', reg([record(2), record(0), record(1)]), d as never);
    expect(d.saveRuns.mock.calls[0][1].map((e: { run: number }) => e.run).sort()).toEqual([0, 1, 2]);
    expect(r).toMatchObject({ hash: 'h', state: 'ready', saved: 3 });
    expect(d.notify).toHaveBeenCalledWith('h');
  });

  it('skips non-206 and wrong-length records and leaves the rest for Resume', async () => {
    const d = deps();
    const r = await handleBackgroundFetchEnd('success', reg([record(0), record(1, 200), record(2, 206, 1)]), d as never);
    expect(d.saveRuns.mock.calls[0][1].map((e: { run: number }) => e.run)).toEqual([0]);
    expect(d.setState).toHaveBeenCalledWith('h', 'paused', expect.stringMatching(/2 parts failed/));
    expect(r?.state).toBe('paused');
  });

  it('on fail/abort saves what completed and pauses', async () => {
    const d = deps();
    const r = await handleBackgroundFetchEnd('abort', reg([record(1)]), d as never);
    expect(d.saveRuns).toHaveBeenCalled();
    expect(d.setState).toHaveBeenCalledWith('h', 'paused', 'cancelled');
    expect(r?.state).toBe('paused');
  });

  it('ignores background fetches that are not ours', async () => {
    const d = deps();
    expect(await handleBackgroundFetchEnd('success', reg([], 'something-else'), d as never)).toBeNull();
    expect(d.saveRuns).not.toHaveBeenCalled();
  });

  it('pauses with a reason when the index is gone', async () => {
    const d = deps();
    d.getIndex.mockResolvedValueOnce(null as never);
    await handleBackgroundFetchEnd('success', reg([record(0)]), d as never);
    expect(d.setState).toHaveBeenCalledWith('h', 'paused', 'audio index missing; reopen the VOD');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/sw-handlers.test.ts`

- [ ] **Step 3: Implement the types and handler**

```ts
// lib/listen/background-fetch.ts
// Minimal Background Fetch types (not in TypeScript's DOM lib) and feature detection.
export interface BgFetchRegistration extends EventTarget {
  readonly id: string;
  readonly downloaded: number;
  readonly downloadTotal: number;
  readonly result: '' | 'success' | 'failure';
  readonly failureReason: string;
  abort(): Promise<boolean>;
}
export interface BgFetchOptions {
  title?: string;
  icons?: { src: string; sizes?: string; type?: string }[];
  downloadTotal?: number;
}
export interface BgFetchManager {
  fetch(id: string, requests: RequestInfo[], options?: BgFetchOptions): Promise<BgFetchRegistration>;
  get(id: string): Promise<BgFetchRegistration | undefined>;
  getIds(): Promise<string[]>;
}

export function bgFetchOf(reg: ServiceWorkerRegistration | null | undefined): BgFetchManager | null {
  return (reg as (ServiceWorkerRegistration & { backgroundFetch?: BgFetchManager }) | null | undefined)?.backgroundFetch ?? null;
}

export function backgroundFetchSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'BackgroundFetchManager' in window;
}
```

```ts
// lib/listen/sw-handlers.ts
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
  const complete = !!last && last.state === 'ready';
  if (!complete) {
    const reason = kind === 'abort' ? 'cancelled' : kind === 'fail' ? 'connection lost' : `${failed} parts failed; resume to retry them`;
    await deps.setState(hash, 'paused', reason);
  }
  deps.notify(hash);
  return { hash, title, state: complete ? 'ready' : 'paused', saved };
}
```

- [ ] **Step 4: Worker entry and build script**

```js
// scripts/sw/service-worker.js
// The Wubby Archive service worker. Background-fetch events ONLY: there is deliberately no
// `fetch` handler (no caching, no interception) until Phase 3. Bundled to public/sw.js by
// scripts/build-sw.mjs. Logic lives in lib/listen/sw-handlers.ts (unit-tested).
import { handleBackgroundFetchEnd } from '../../lib/listen/sw-handlers';
import { hashFromBgFetchId } from '../../lib/listen/download-model';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

for (const [type, kind] of [['backgroundfetchsuccess', 'success'], ['backgroundfetchfail', 'fail'], ['backgroundfetchabort', 'abort']]) {
  self.addEventListener(type, (event) => {
    event.waitUntil(
      (async () => {
        const result = await handleBackgroundFetchEnd(kind, event.registration);
        if (result && typeof event.updateUI === 'function') {
          const title = result.state === 'ready' ? `Saved for offline: ${result.title}` : `Download paused: ${result.title}`;
          await event.updateUI({ title }).catch(() => undefined);
        }
      })(),
    );
  });
}

self.addEventListener('backgroundfetchclick', (event) => {
  const hash = hashFromBgFetchId(event.registration.id);
  if (hash) event.waitUntil(self.clients.openWindow(`${self.registration.scope}watch?id=${hash}`));
});
```

```js
// scripts/build-sw.mjs
// Bundles scripts/sw/service-worker.js (+ lib/listen modules) into public/sw.js.
// Runs automatically before `npm run build` and `npm run dev` (prebuild/predev).
import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/sw/service-worker.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outfile: 'public/sw.js',
  banner: { js: '/* Generated by scripts/build-sw.mjs: do not edit. */' },
});
console.log('built public/sw.js');
```

In `package.json` `"scripts"` add:

```json
    "build:sw": "node scripts/build-sw.mjs",
    "prebuild": "node scripts/build-sw.mjs",
    "predev": "node scripts/build-sw.mjs",
```

Append to `web-new/.gitignore`:

```
# Generated service worker (scripts/build-sw.mjs)
/public/sw.js
```

- [ ] **Step 5: Run — expect PASS**; build the worker

Run: `npx vitest run tests/unit/listen/sw-handlers.test.ts && npm run build:sw && npx tsc --noEmit`
Expected: tests pass; `built public/sw.js`; 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/listen/background-fetch.ts lib/listen/sw-handlers.ts scripts/sw/service-worker.js scripts/build-sw.mjs package.json .gitignore tests/unit/listen/sw-handlers.test.ts
git commit -m "feat(listen): service worker that saves background-fetch results (no fetch handler)"
```

---

### Task 5: Page-side downloads API

**Files:**
- Create: `web-new/lib/listen/downloads.ts`
- Modify: `web-new/next.config.ts`
- Test: `web-new/tests/unit/listen/downloads.test.ts`

- [ ] **Step 1: Expose the base path**

In `next.config.ts`, hoist the base path and expose it:

```ts
const basePath = process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '';

const nextConfig: NextConfig = {
  output: 'export', // Required for static GitHub Pages deployment
  basePath, // Only use basePath in production
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // the service worker URL and scope need it
```

(Keep the rest of the config unchanged.)

- [ ] **Step 2: Write the failing tests**

```ts
// tests/unit/listen/downloads.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startDownload, cancelDownload, preflight } from '@/lib/listen/downloads';
import { getManifest, putManifest } from '@/lib/listen/offline-store';
import { newManifest, markDone } from '@/lib/listen/download-model';
import type { AudioIndex } from '@/lib/listen/types';

const idx = {
  version: 1, lastModified: 'LM', runOffset: Float64Array.of(100, 900, 2000), runSize: Uint32Array.of(10, 20, 30),
  timescale: 48000, durationSec: 12, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2', audioSpecificConfig: new Uint8Array(2),
  sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
  runFirst: new Uint32Array(3), runCount: new Uint32Array(3), runStartTicks: new Float64Array(3),
} as AudioIndex;

let bgFetch: { fetch: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; getIds: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
  bgFetch = { fetch: vi.fn(async (id: string) => ({ id })), get: vi.fn(), getIds: vi.fn(async () => []) };
  const reg = { backgroundFetch: bgFetch };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => reg), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => reg) } });
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist: vi.fn(async () => true), estimate: vi.fn(async () => ({ quota: 10_000, usage: 0 })) } });
});

const vod = { hash: 'h', url: 'https://a/v.mp4', title: 'T' };

describe('startDownload', () => {
  it('starts one background fetch with a bounded Range request per missing run', async () => {
    await startDownload(vod, idx);
    const [id, requests, opts] = bgFetch.fetch.mock.calls[0];
    expect(id).toMatch(/^listen:h:\d+$/);
    expect((requests as Request[]).map((r) => r.headers.get('range'))).toEqual(['bytes=100-109', 'bytes=900-919', 'bytes=2000-2029']);
    expect(opts.downloadTotal).toBe(60);
    expect((await getManifest('h'))?.state).toBe('downloading');
    expect(navigator.storage.persist).toHaveBeenCalled();
  });

  it('resumes with only the missing runs', async () => {
    await putManifest(markDone(newManifest({ ...vod, index: idx, now: 1 }), [0, 2], idx.runSize, 2));
    await startDownload(vod, idx);
    const requests = bgFetch.fetch.mock.calls[0][1] as Request[];
    expect(requests.map((r) => r.headers.get('range'))).toEqual(['bytes=900-919']);
  });

  it('marks the download paused with a reason if Chrome refuses', async () => {
    bgFetch.fetch.mockRejectedValueOnce(new DOMException('nope', 'QuotaExceededError'));
    await expect(startDownload(vod, idx)).rejects.toThrow();
    expect(await getManifest('h')).toMatchObject({ state: 'paused', reason: expect.stringMatching(/QuotaExceededError/) });
  });
});

describe('cancelDownload', () => {
  it('aborts the live background fetch for that VOD only', async () => {
    const abort = vi.fn(async () => true);
    bgFetch.getIds.mockResolvedValue(['listen:other:1', 'listen:h:2']);
    bgFetch.get.mockImplementation(async (id: string) => (id === 'listen:h:2' ? { id, abort } : undefined));
    await cancelDownload('h');
    expect(bgFetch.get).toHaveBeenCalledWith('listen:h:2');
    expect(abort).toHaveBeenCalled();
  });
});

describe('preflight', () => {
  it('needs twice the remaining bytes plus 10% free (background-fetch storage + saved copy)', async () => {
    (navigator.storage.estimate as ReturnType<typeof vi.fn>).mockResolvedValue({ quota: 100, usage: 0 });
    expect((await preflight('h', idx)).quotaOk).toBe(false); // 60 * 2 * 1.1 = 132 > 100
    (navigator.storage.estimate as ReturnType<typeof vi.fn>).mockResolvedValue({ quota: 1000, usage: 0 });
    expect(await preflight('h', idx)).toMatchObject({ quotaOk: true, bytesNeeded: 60, cap: { fits: true } });
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/downloads.test.ts`

- [ ] **Step 4: Implement**

```ts
// lib/listen/downloads.ts
// Page side of offline downloads: register the worker, check space, start/resume/cancel a
// Background Fetch, reconcile on load, auto-delete finished VODs. The worker saves results.
import { bgFetchOf, type BgFetchRegistration } from './background-fetch';
import { bgFetchId, hashFromBgFetchId, missingRuns, newManifest, planForCap, rangeForRun } from './download-model';
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

const remainingBytes = (index: AudioIndex, missing: number[]) => missing.reduce((a, r) => a + index.runSize[r], 0);

/** Before Download: how much is left, does it fit the 2 GB cap, is there room on the phone. */
export async function preflight(hash: string, index: AudioIndex) {
  const manifests = await listManifests();
  const existing = manifests.find((m) => m.hash === hash);
  const missing = existing ? missingRuns(existing) : Array.from(index.runSize, (_, r) => r);
  const bytesNeeded = remainingBytes(index, missing);
  const bytesTotal = remainingBytes(index, Array.from(index.runSize, (_, r) => r));
  const cap = planForCap(manifests.filter((m) => m.hash !== hash), bytesTotal);
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

/** Start (or resume) the background download of every missing run. */
export async function startDownload(vod: VodRef, index: AudioIndex, now = Date.now()): Promise<void> {
  await navigator.storage?.persist?.().catch(() => false);
  const manifest = (await getManifest(vod.hash)) ?? newManifest({ ...vod, index, now });
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

/** Finished listening → free the space. Only for complete downloads; never mid-download. */
export async function autoDeleteIfFinished(hash: string): Promise<boolean> {
  if (!isFinished(readPosition(hash))) return false;
  const m = await getManifest(hash);
  if (!m || m.state !== 'ready') return false;
  await deleteDownload(hash);
  return true;
}
```

- [ ] **Step 5: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/listen/downloads.ts next.config.ts tests/unit/listen/downloads.test.ts
git commit -m "feat(listen): page-side background downloads (preflight, start/resume, cancel, reconcile)"
```

---

### Task 6: Listen plays stored runs first

**Files:**
- Modify: `web-new/lib/listen/listen-engine.ts`
- Modify: `web-new/components/listen/AudioCard.tsx`

- [ ] **Step 1: Engine reads the offline store before the network**

In `listen-engine.ts`:

Add the import:

```ts
import { readStoredRun } from './offline-store';
```

Extend `ListenEngineDeps`:

```ts
  readStoredRun?: (hash: string, run: number) => Promise<Bytes | null>;
```

Extend `ListenSnapshot`:

```ts
  /** Runs played from the phone's storage instead of the network. */
  storedRuns: number;
```

Add a field next to `bytesFetched`:

```ts
  private storedRuns = 0;
```

At the top of the `try` block in `fetchRun` (before calling `fetchRange`):

```ts
      const stored = await (this.opts.deps?.readStoredRun ?? readStoredRun)(this.opts.hash, r);
      if (gen !== this.gen || this.disposed) return;
      if (stored && stored.byteLength === index.runSize[r]) {
        this.storedRuns++;
        await this.appendRun(r, stored);
        return;
      }
```

In `computeSnapshot` add `storedRuns: this.storedRuns,`.

- [ ] **Step 2: Status line, last-listened, auto-delete in AudioCard**

In `AudioCard.tsx`:

Change `statusLine`'s final return to:

```ts
  if (s.storedRuns > 0 && s.bytesFetched === 0) return 'Playing from your phone · 0 MB used';
  return `Streaming · ${mb(s.bytesFetched)} MB used`;
```

Add the import:

```ts
import { autoDeleteIfFinished } from '@/lib/listen/downloads';
import { touchListened } from '@/lib/listen/offline-store';
```

In the position-saving effect's `save` function, after `writePosition(...)`:

```ts
      void touchListened(hash).catch(() => undefined);
      void autoDeleteIfFinished(hash).catch(() => undefined);
```

- [ ] **Step 3: Gates**

Run: `npx tsc --noEmit && npx vitest run && npx playwright test tests/listen.spec.ts --project=pixel --reporter=line --workers=1`
Expected: 0 type errors; all unit tests pass; 6/6 Listen E2E still pass (with no downloads, the engine behaves exactly as before).

- [ ] **Step 4: Commit**

```bash
git add lib/listen/listen-engine.ts components/listen/AudioCard.tsx
git commit -m "feat(listen): play downloaded runs from the phone; touch last-listened; auto-delete when finished"
```

---

### Task 7: Live downloads list for React

**Files:**
- Create: `web-new/lib/listen/downloads-store.ts`

- [ ] **Step 1: Implement (exercised by Task 8's component tests)**

```ts
// lib/listen/downloads-store.ts
'use client';

import { useSyncExternalStore } from 'react';
import type { DownloadManifest } from './download-model';
import { DOWNLOADS_CHANNEL, listManifests } from './offline-store';

type Listener = () => void;
let snapshot: readonly DownloadManifest[] = [];
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;
let loading: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    snapshot = await listManifests();
  } catch {
    snapshot = [];
  }
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(DOWNLOADS_CHANNEL);
    channel.onmessage = () => void refresh();
  }
  loading ??= refresh();
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      channel?.close();
      channel = null;
      loading = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = (): readonly DownloadManifest[] => [];

/** All download manifests, live across tabs and the service worker. */
export function useDownloads(): readonly DownloadManifest[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Force a reload (after this tab changed something without a broadcast). */
export const refreshDownloads = refresh;
```

- [ ] **Step 2: tsc, commit**

```bash
npx tsc --noEmit
git add lib/listen/downloads-store.ts
git commit -m "feat(listen): live downloads list hook"
```

---

### Task 8: Download button, diary chip, downloads sheet

**Files:**
- Create: `web-new/components/listen/DownloadButton.tsx`, `DownloadsChip.tsx`, `DownloadsSheet.tsx`
- Modify: `web-new/components/video/VideoDetailView.tsx`, `web-new/components/layout/Masthead.tsx`, `web-new/components/vod-diary/VodDiaryScreen.tsx`, `web-new/app/layout.tsx`
- Test: `web-new/tests/unit/DownloadButton.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
// tests/unit/DownloadButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DownloadManifest } from '@/lib/listen/download-model';

const state = vi.hoisted(() => ({ manifests: [] as Partial<DownloadManifest>[], supported: true, cellular: false }));
vi.mock('@/lib/listen/downloads-store', () => ({ useDownloads: () => state.manifests, refreshDownloads: vi.fn() }));
vi.mock('@/lib/listen/background-fetch', () => ({ backgroundFetchSupported: () => state.supported }));
const api = vi.hoisted(() => ({
  startDownload: vi.fn(async () => {}),
  cancelDownload: vi.fn(async () => {}),
  preflight: vi.fn(async () => ({ bytesNeeded: 400e6, cap: { fits: true, suggest: [] as string[] }, quotaOk: true })),
  onMobileData: vi.fn(() => state.cellular),
  watchProgress: vi.fn(async () => () => {}),
}));
vi.mock('@/lib/listen/downloads', () => api);
vi.mock('@/lib/listen/index-cache', () => ({ getCachedIndex: vi.fn(async () => ({ runSize: Uint32Array.of(1) })), putCachedIndex: vi.fn() }));
vi.mock('@/lib/listen/offline-store', () => ({ deleteDownload: vi.fn(async () => {}) }));

import { DownloadButton } from '@/components/listen/DownloadButton';

const vod = { hash: 'h', url: 'u', title: 'T' };
beforeEach(() => {
  state.manifests = [];
  state.supported = true;
  state.cellular = false;
  vi.clearAllMocks();
});

describe('DownloadButton', () => {
  it('renders nothing where background downloads are unsupported', () => {
    state.supported = false;
    const { container } = render(<DownloadButton vod={vod} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts a download', async () => {
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    await waitFor(() => expect(api.startDownload).toHaveBeenCalled());
  });

  it('asks first on mobile data', async () => {
    state.cellular = true;
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByText(/mobile data/i)).toBeInTheDocument();
    expect(api.startDownload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /download anyway/i }));
    await waitFor(() => expect(api.startDownload).toHaveBeenCalled());
  });

  it('offers to delete old downloads when over the 2 GB cap', async () => {
    state.manifests = [{ hash: 'old', title: 'Old stream', bytesDone: 1.9e9, state: 'ready' }];
    api.preflight.mockResolvedValueOnce({ bytesNeeded: 400e6, cap: { fits: false, suggest: ['old'] }, quotaOk: true });
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByText(/Old stream/)).toBeInTheDocument();
    expect(api.startDownload).not.toHaveBeenCalled();
  });

  it('shows progress with a cancel, a resume when paused, and a saved state', () => {
    state.manifests = [{ hash: 'h', state: 'downloading', bytesDone: 42, bytesTotal: 100 }];
    const { rerender } = render(<DownloadButton vod={vod} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel download/i })).toBeInTheDocument();
    state.manifests = [{ hash: 'h', state: 'paused', bytesDone: 63, bytesTotal: 100, reason: 'cancelled' }];
    rerender(<DownloadButton vod={vod} />);
    expect(screen.getByRole('button', { name: /resume.*63%/i })).toBeInTheDocument();
    state.manifests = [{ hash: 'h', state: 'ready', bytesDone: 100, bytesTotal: 100 }];
    rerender(<DownloadButton vod={vod} />);
    expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/DownloadButton.test.tsx`

- [ ] **Step 3: Implement the button**

```tsx
// components/listen/DownloadButton.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backgroundFetchSupported } from '@/lib/listen/background-fetch';
import { cancelDownload, onMobileData, preflight, startDownload, watchProgress, type VodRef } from '@/lib/listen/downloads';
import { progress } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';
import { getCachedIndex, putCachedIndex } from '@/lib/listen/index-cache';
import { loadAudioIndex } from '@/lib/listen/index-loader';
import { deleteDownload } from '@/lib/listen/offline-store';

const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

type Prompt = { kind: 'cellular' } | { kind: 'cap'; suggest: string[] } | { kind: 'space' } | { kind: 'error'; message: string } | null;

export function DownloadButton({ vod }: { vod: VodRef }) {
  const manifests = useDownloads();
  const mine = manifests.find((m) => m.hash === vod.hash);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [live, setLive] = useState<number | null>(null);

  // Chrome reports byte progress live while the page is open; the manifest only moves at the end.
  useEffect(() => {
    if (mine?.state !== 'downloading') return;
    let off: () => void = () => undefined;
    void watchProgress(vod.hash, (done, total) => setLive(total ? done / total : null)).then((u) => (off = u));
    return () => off();
  }, [mine?.state, vod.hash]);

  if (!backgroundFetchSupported()) return null;

  const begin = async (skipCellularCheck = false) => {
    setPrompt(null);
    if (!skipCellularCheck && onMobileData()) return setPrompt({ kind: 'cellular' });
    setBusy(true);
    try {
      let index = await getCachedIndex(vod.hash);
      if (!index) {
        index = await loadAudioIndex(vod.url);
        await putCachedIndex(vod.hash, index);
      }
      const pre = await preflight(vod.hash, index);
      if (!pre.quotaOk) return setPrompt({ kind: 'space' });
      if (!pre.cap.fits) return setPrompt({ kind: 'cap', suggest: pre.cap.suggest });
      await startDownload(vod, index);
    } catch (err) {
      setPrompt({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.round(100 * (live ?? (mine ? progress(mine) : 0)));

  let control: ReactNode;
  if (mine?.state === 'ready') {
    control = (
      <p className="flex h-12 items-center justify-center gap-2 rounded-md border border-accent-green/50 text-sm text-accent-green">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Saved offline · {gb(mine.bytesDone)}
      </p>
    );
  } else if (mine?.state === 'downloading') {
    control = (
      <div className="flex h-12 items-center gap-2 rounded-md border border-rule px-3">
        <div className="h-1.5 flex-1 rounded bg-muted" aria-hidden>
          <div className="h-1.5 rounded bg-accent-green" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-ink-muted">Downloading {pct}%</span>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancel download" onClick={() => void cancelDownload(vod.hash)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  } else {
    const label = mine?.state === 'paused' ? `Resume download · ${pct}%` : 'Download for offline';
    control = (
      <Button type="button" variant="outline" disabled={busy} className="h-12 w-full gap-2 text-base" onClick={() => void begin()}>
        <Download className="h-4 w-4" aria-hidden />
        {busy ? 'Preparing…' : label}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {control}
      {mine?.state === 'paused' && mine.reason ? <p className="font-mono text-xs text-ink-muted">Paused: {mine.reason}</p> : null}
      {prompt?.kind === 'cellular' && (
        <div role="alert" className="space-y-2 rounded-md border border-rule p-3 text-sm">
          <p>You&apos;re on mobile data. A long VOD is around 400 MB. Download anyway?</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void begin(true)}>Download anyway</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPrompt(null)}>Not now</Button>
          </div>
        </div>
      )}
      {prompt?.kind === 'cap' && (
        <div role="alert" className="space-y-2 rounded-md border border-rule p-3 text-sm">
          <p>Downloads are capped at 2 GB. Delete these first (least recently listened)?</p>
          <ul className="list-disc pl-5 text-ink-muted">
            {prompt.suggest.map((h) => {
              const m = manifests.find((x) => x.hash === h);
              return <li key={h}>{m?.title ?? h} · {gb(m?.bytesDone ?? 0)}</li>;
            })}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                for (const h of prompt.suggest) await deleteDownload(h);
                await begin(true);
              }}
            >
              Delete and download
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPrompt(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {prompt?.kind === 'space' && <p role="alert" className="text-sm text-destructive">Not enough free space on this phone for this download.</p>}
      {prompt?.kind === 'error' && <p role="alert" className="text-sm text-destructive">Couldn&apos;t start the download: {prompt.message}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Chip, sheet, wiring**

```tsx
// components/listen/DownloadsSheet.tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { progress, type DownloadManifest } from '@/lib/listen/download-model';
import { deleteDownload } from '@/lib/listen/offline-store';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);
const stateLabel = (m: DownloadManifest) =>
  m.state === 'ready' ? 'Ready' : m.state === 'downloading' ? `Downloading ${Math.round(progress(m) * 100)}%` : m.state === 'stale' ? 'Changed on the archive' : `Paused ${Math.round(progress(m) * 100)}%`;

export function DownloadsSheet({ open, onOpenChange, manifests }: { open: boolean; onOpenChange: (o: boolean) => void; manifests: readonly DownloadManifest[] }) {
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  useEffect(() => {
    if (open) void navigator.storage?.estimate?.().then(setEstimate).catch(() => setEstimate(null));
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto border-t border-rule bg-background">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground">Saved for offline</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 divide-y divide-rule">
          {manifests.map((m) => (
            <li key={m.hash} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{m.title}</p>
                <p className="font-mono text-xs text-ink-muted">
                  {stateLabel(m)} · {size(m.bytesDone)} · listened {new Date(m.lastListenedAt).toLocaleDateString()}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${m.title}`} onClick={() => void deleteDownload(m.hash)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        {manifests.length > 1 && (
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={async () => { for (const m of manifests) await deleteDownload(m.hash); }}>
            Delete all
          </Button>
        )}
        {estimate?.quota ? (
          <p className="mt-4 font-mono text-xs text-ink-muted">
            This site uses {size(estimate.usage ?? 0)} of {size(estimate.quota)} available.
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

```tsx
// components/listen/DownloadsChip.tsx
'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { totals } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';
import { DownloadsSheet } from '@/components/listen/DownloadsSheet';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

/** "⬇ 3 offline · 1.2 GB" in the diary masthead; nothing when nothing is stored. */
export function DownloadsChip() {
  const manifests = useDownloads();
  const [open, setOpen] = useState(false);
  if (!manifests.length) return null;
  const t = totals(manifests);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 font-mono text-xs text-ink-muted transition-colors hover:border-accent-green hover:text-accent-green"
      >
        <Download className="h-3 w-3" aria-hidden />
        {t.ready} offline{t.partial ? ` · ${t.partial} partial` : ''} · {size(t.bytesStored)}
      </button>
      <DownloadsSheet open={open} onOpenChange={setOpen} manifests={manifests} />
    </>
  );
}
```

**Masthead** (`components/layout/Masthead.tsx`): add `extra?: React.ReactNode` to `MastheadProps` and destructure it. Render it in the meta-line `div`, after the `dateLabel` paragraph:

```tsx
        {extra}
```

**VodDiaryScreen** (`components/vod-diary/VodDiaryScreen.tsx:254`):

```tsx
      <Masthead edition="VOD Diary" count={total ?? videos.length} dateLabel={dateLabel} extra={<DownloadsChip />} />
```

Also add `import { DownloadsChip } from '@/components/listen/DownloadsChip';`.

**VideoDetailView**: import `DownloadButton`. In the `!engine && hash` block, replace `<SpeedToggle … className="w-full" />` with:

```tsx
          <div className="grid grid-cols-2 gap-2">
            <SpeedToggle rate={rate} onChange={changeRate} className="w-full" />
            <DownloadButton vod={{ hash, url: video.url, title: video.title, thumbnailUrl: video.thumbnailUrl }} />
          </div>
```

**Layout** (`app/layout.tsx`): mount a tiny client component that reconciles once on load.

```tsx
// components/listen/DownloadsReconciler.tsx
'use client';

import { useEffect } from 'react';
import { reconcileDownloads } from '@/lib/listen/downloads';
import { refreshDownloads } from '@/lib/listen/downloads-store';

/** Once per app load: downloads whose background fetch vanished become "paused". */
export function DownloadsReconciler() {
  useEffect(() => {
    void reconcileDownloads().then(() => refreshDownloads());
  }, []);
  return null;
}
```

Add `<DownloadsReconciler />` inside `<body>` in `app/layout.tsx` (it renders nothing) and import it. Also add `components/listen/DownloadsReconciler.tsx` to the Task 8 commit.

- [ ] **Step 5: Run — expect PASS; full gates**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass; the build prints `built public/sw.js` (prebuild), and `out/sw.js` exists.

- [ ] **Step 6: Look at it (mobile first)**

Use the browser pane at 375×812 with `npm run dev`. Check:
- the watch page has `1.5×` and `Download for offline` side by side;
- tapping Download shows "Downloading x%";
- the diary masthead shows the chip, and the chip opens the sheet.

Screenshot each. Remember the hidden pane freezes animations.

- [ ] **Step 7: Commit**

```bash
git add components/listen/DownloadButton.tsx components/listen/DownloadsChip.tsx components/listen/DownloadsSheet.tsx components/listen/DownloadsReconciler.tsx components/layout/Masthead.tsx components/vod-diary/VodDiaryScreen.tsx components/video/VideoDetailView.tsx app/layout.tsx tests/unit/DownloadButton.test.tsx
git commit -m "feat(listen): Download button, diary offline chip and downloads sheet"
```

---

### Task 9: E2E on real Chrome

**Files:**
- Modify: `web-new/playwright.config.ts`
- Create: `web-new/tests/listen-download.spec.ts`

- [ ] **Step 1: Add the project**

In `playwright.config.ts` projects, after `pixel`:

```ts
    // Background Fetch only completes in real Chrome (Playwright's bundled Chromium never finishes it).
    {
      name: 'pixel-chrome',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
      testMatch: '**/listen-download.spec.ts',
    },
```

The spec also skips itself on every other project (see its `beforeEach`), so a full
`playwright test` run never tries it on Firefox, WebKit, or Playwright's bundled Chromium.

- [ ] **Step 2: Write the spec**

```ts
// tests/listen-download.spec.ts
/**
 * Background downloads on real Chrome (Pixel 7 profile). Needs `npm run dev` and the e2e fixture
 * (`npm run fixtures:listen -- e2e`, 179 audio runs). Reuses the archive-imitating range server.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's Android phone; docs/listen-mode-phone-checklist.md):
 * - that the download keeps going with the screen locked, Chrome closed, or the phone rebooted
 * - Android's download notification: title, thumbnail, progress, cancel from the notification
 * - behaviour on mobile data vs Wi-Fi, and real storage freed after Delete (Settings → Apps → Chrome)
 * - a real ~55 min, 430 MB download completing on home Wi-Fi
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const FIXTURES = path.resolve(__dirname, 'fixtures/listen');
const PORT = 4320;
const MEDIA_URL = `http://localhost:${PORT}/e2e-12min.mp4`;
const HASH = 'd'.repeat(64);
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  server = spawn(process.execPath, [path.resolve(__dirname, 'support/range-server.mjs'), FIXTURES, String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${PORT}/ping`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});
test.afterAll(() => {
  server?.kill();
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-chrome', 'Background Fetch needs real Chrome');
  await page.route(/\/rest\/v1\/wubby_summary/, (route) =>
    route.fulfill({ json: [{ video_hash: HASH, video_url: MEDIA_URL, pleb_title: 'Fixture stream', summary: 's', tags: [], platform: 'twitch', upload_date: '2026-11-07T00:00:00Z' }] }),
  );
});

async function downloadToReady(page: Page) {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /download for offline/i }).click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 180_000 });
}

test('downloads in the background, then Listen plays with zero network', async ({ page }) => {
  await downloadToReady(page);
  let mediaRequests = 0;
  await page.route(MEDIA_URL, (route) => {
    mediaRequests++;
    return route.abort();
  });
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLAudioElement>('audio[data-testid="listen-audio"]')?.currentTime ?? 0), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect(page.getByText(/playing from your phone/i)).toBeVisible();
  expect(mediaRequests).toBe(0);
});

test('cancel keeps what finished; resume completes it', async ({ page }) => {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /download for offline/i }).click();
  await expect(page.getByText(/downloading/i)).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /cancel download/i }).click();
  const resume = page.getByRole('button', { name: /resume download/i });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  await resume.click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 180_000 });
});

test('the diary chip counts the download and the sheet deletes it', async ({ page }) => {
  await downloadToReady(page);
  await page.route(/\/rest\/v1\/wubby_summary\?select=/, (route) => route.fulfill({ json: [], headers: { 'content-range': '*/0' } }));
  await page.goto('/');
  const chip = page.getByRole('button', { name: /1 offline/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await page.getByRole('button', { name: /delete fixture stream/i }).click();
  await expect(chip).toHaveCount(0);
});
```

- [ ] **Step 3: Run**

Start the dev server (browser pane `preview_start` → `web-new`), then:

Run: `npx playwright test --project=pixel-chrome --reporter=line --workers=1`
Expected: 3 passed. Then the Phase 1 suite: `npx playwright test tests/listen.spec.ts --project=pixel --workers=1` → 6 passed.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/listen-download.spec.ts
git commit -m "test(listen): background download E2E on real Chrome (download, offline play, cancel/resume, delete)"
```

---

### Task 10: Docs

**Files:**
- Modify: `docs/listen-mode-phone-checklist.md`, `CLAUDE.md`

- [ ] **Step 1: Add phone checks** (append rows to the checklist table)

```markdown
| 10 | Download a long VOD on Wi-Fi, lock the phone: the Android notification shows progress and it completes (~1 h for 6 h of audio) | |
| 11 | Close Chrome mid-download: it keeps going, or resumes, and finishes; reopening shows "Saved offline" | |
| 12 | Cancel from the notification: the watch page shows "Resume download · x%", and Resume finishes it | |
| 13 | Airplane mode with the site open: a downloaded VOD plays via Listen ("Playing from your phone · 0 MB used") | |
| 14 | Diary chip shows count and size; deleting in the sheet frees space (Settings → Apps → Chrome → Storage) | |
| 15 | Finish a downloaded VOD (last 2 min): it disappears from the list | |
```

- [ ] **Step 2: CLAUDE.md**
- **Listen section:** add a Phase 2 bullet covering Background Fetch, the worker with no fetch handler, `public/sw.js` generated by `prebuild` (gitignored), the IndexedDB stores, the 2 GB cap, auto-delete, and that real Chrome is needed for its E2E (`pixel-chrome`).
- **Storage Keys:** add `downloads` and `audio-runs`.
- **Remaining Tasks item 2:** change it to "Phase 3: installable offline app (app-shell caching)". Note that the worker exists, but there's still no `fetch` handler, so opening the site with no signal doesn't work yet.

- [ ] **Step 3: Final gates and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build && npx playwright test --project=pixel-chrome --workers=1 && npx playwright test tests/listen.spec.ts --project=pixel --workers=1`

```bash
git add ../docs/listen-mode-phone-checklist.md ../CLAUDE.md
git commit -m "docs: Phase 2 phone checklist and CLAUDE.md"
```

---

## Phase 3: installable offline app (outline; own plan)

- **App-shell caching:** add a `fetch` handler to the existing worker that precaches the static export (`/`, `/watch`, `_next/static/**`) from a build-time manifest written by `build-sw.mjs`. Also runtime-cache the Supabase rows and thumbnails of downloaded VODs.
- **Never intercept `archive.wubby.tv`:** offline audio comes from IndexedDB.
- **Never cache or serve a `206`** (the Next 16.0.7 incident).
- **Web app manifest and icons**, so the site installs to the home screen.
- **Phone check:** airplane mode → open from the home screen → the diary shows saved VODs → Listen plays.
