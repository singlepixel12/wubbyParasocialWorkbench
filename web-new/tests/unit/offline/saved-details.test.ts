import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillVodDetails, rememberVodDetails, startDownload } from '@/lib/listen/downloads';
import { deleteDownload, getManifest, putManifest } from '@/lib/listen/offline-store';
import { newManifest } from '@/lib/listen/download-model';
import { savedVideo, videoFromManifest } from '@/lib/offline/saved-vods';
import { cacheThumbnail, THUMBS_CACHE } from '@/lib/offline/thumbs';
import type { AudioIndex } from '@/lib/listen/types';
import type { Video } from '@/types/video';
import { FakeCacheStorage, asCacheStorage } from './fake-caches';

const idx = {
  version: 1, lastModified: 'LM', runOffset: Float64Array.of(100, 900), runSize: Uint32Array.of(10, 20),
  timescale: 48000, durationSec: 8, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2', audioSpecificConfig: new Uint8Array(2),
  sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
  runFirst: new Uint32Array(2), runCount: new Uint32Array(2), runStartTicks: new Float64Array(2),
} as AudioIndex;
const THUMB = 'https://x.supabase.co/thumb.webp';
const video: Video = { url: 'https://a/v.mp4', title: 'Costco Pizzas', platform: 'twitch', summary: 'A long summary.', tags: ['food'], date: '2026-11-01T00:00:00Z', videoHash: 'h', thumbnailUrl: THUMB };

let store: FakeCacheStorage;
beforeEach(async () => {
  await new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase('wubby-listen');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
  store = new FakeCacheStorage();
  vi.stubGlobal('caches', asCacheStorage(store));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('img', { status: 200 })));
  const bg = { fetch: vi.fn(async (id: string) => ({ id })), get: vi.fn(), getIds: vi.fn(async () => []) };
  const reg = { backgroundFetch: bg };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => reg), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => reg) } });
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist: vi.fn(async () => true) } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const thumbCached = async () => !!(await (await store.open(THUMBS_CACHE)).match(THUMB));

describe('saved VOD details (Phase 3b)', () => {
  it('a download saves the full row and caches the thumbnail', async () => {
    await startDownload({ hash: 'h', url: video.url, title: video.title, thumbnailUrl: THUMB, video }, idx);
    expect((await getManifest('h'))?.video).toEqual(video);
    await vi.waitFor(async () => expect(await thumbCached()).toBe(true));
    expect(await savedVideo('h')).toEqual(video);
  });

  it('resuming without a row keeps the saved one', async () => {
    await putManifest(newManifest({ hash: 'h', url: video.url, title: video.title, video, index: idx, now: 1 }));
    await startDownload({ hash: 'h', url: video.url, title: video.title }, idx);
    expect((await getManifest('h'))?.video).toEqual(video);
  });

  it('deleting a download deletes its thumbnail', async () => {
    await putManifest(newManifest({ hash: 'h', url: video.url, title: video.title, thumbnailUrl: THUMB, video, index: idx, now: 1 }));
    await cacheThumbnail(THUMB);
    await deleteDownload('h');
    expect(await thumbCached()).toBe(false);
    expect(await savedVideo('h')).toBeNull();
  });

  it('rememberVodDetails refreshes a downloaded VOD and ignores others', async () => {
    await putManifest(newManifest({ hash: 'h', url: video.url, title: video.title, index: idx, now: 1 }));
    await rememberVodDetails(video);
    await rememberVodDetails({ ...video, videoHash: 'not-downloaded' });
    expect((await getManifest('h'))?.video).toEqual(video);
    expect(await getManifest('not-downloaded')).toBeNull();
  });

  it('backfill fetches rows only for downloads without one, and survives a failing lookup', async () => {
    await putManifest(newManifest({ hash: 'h', url: video.url, title: video.title, index: idx, now: 1 }));
    await putManifest(newManifest({ hash: 'done', url: 'u', title: 't', video: { ...video, videoHash: 'done' }, index: idx, now: 1 }));
    await putManifest(newManifest({ hash: 'flaky', url: 'u', title: 't', index: idx, now: 1 }));
    const fetchRow = vi.fn(async (hash: string) => {
      if (hash === 'flaky') throw new TypeError('Failed to fetch');
      return video;
    });
    expect(await backfillVodDetails(fetchRow)).toBe(1);
    expect(fetchRow.mock.calls.map((c) => c[0]).sort()).toEqual(['flaky', 'h']);
    expect((await getManifest('h'))?.video).toEqual(video);
  });

  it('backfill does nothing offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchRow = vi.fn();
    expect(await backfillVodDetails(fetchRow)).toBe(0);
    expect(fetchRow).not.toHaveBeenCalled();
  });

  it('a download from before Phase 3b still becomes a playable card', () => {
    const v = videoFromManifest(newManifest({ hash: 'h', url: 'u', title: 'Old one', thumbnailUrl: THUMB, index: idx, now: 0 }));
    expect(v).toMatchObject({ videoHash: 'h', title: 'Old one', url: 'u', thumbnailUrl: THUMB, tags: [] });
  });
});

describe('cacheThumbnail', () => {
  it('never caches a CORS answer that is not a 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    expect(await cacheThumbnail(THUMB)).toBe(false);
    expect(await thumbCached()).toBe(false);
  });

  it('falls back to an opaque fetch only when CORS itself fails', async () => {
    const opaque = { type: 'opaque', status: 0, clone: () => new Response('x') } as unknown as Response;
    const f = vi.fn(async (_u: string, init?: RequestInit) => (init?.mode === 'cors' ? Promise.reject(new TypeError('CORS')) : opaque));
    vi.stubGlobal('fetch', f);
    expect(await cacheThumbnail(THUMB)).toBe(true);
    expect(f.mock.calls.map((c) => c[1]?.mode)).toEqual(['cors', 'no-cors']);
  });

  it('never throws with no Cache API', async () => {
    vi.stubGlobal('caches', undefined);
    expect(await cacheThumbnail(THUMB)).toBe(false);
  });
});
