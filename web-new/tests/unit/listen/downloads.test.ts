import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startDownload, cancelDownload, preflight, removeDownload, autoResume, watchdogTick, resetStallWatch } from '@/lib/listen/downloads';
import { getManifest, putManifest, saveRuns } from '@/lib/listen/offline-store';
import { putCachedIndex } from '@/lib/listen/index-cache';
import { newManifest, markDone, STALL_RESTART_MS } from '@/lib/listen/download-model';
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

describe('removeDownload', () => {
  it('aborts the running background fetch before deleting, so Chrome stops downloading', async () => {
    await putManifest(newManifest({ ...vod, index: idx, now: 1 }));
    const order: string[] = [];
    const abort = vi.fn(async () => { order.push('abort'); expect(await getManifest('h')).not.toBeNull(); return true; });
    bgFetch.getIds.mockResolvedValue(['listen:h:2']);
    bgFetch.get.mockResolvedValue({ id: 'listen:h:2', abort });
    await removeDownload('h');
    expect(abort).toHaveBeenCalled();
    expect(await getManifest('h')).toBeNull();
    // The worker's abort handler arrives after the delete: it must store nothing.
    expect(await saveRuns('h', [{ run: 0, bytes: new Uint8Array(10) }], idx.runSize)).toBeNull();
  });

  it('still deletes when there is no worker or nothing running', async () => {
    await putManifest(newManifest({ ...vod, index: idx, now: 1 }));
    (navigator.serviceWorker.getRegistration as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no worker'));
    await removeDownload('h');
    expect(await getManifest('h')).toBeNull();
  });
});

describe('autoResume', () => {
  it('records the round against the stored manifest, not the stale copy the scheduler saw', async () => {
    const stale = { ...newManifest({ ...vod, index: idx, now: 1 }), state: 'paused' as const, reason: 'connection lost' };
    await putManifest(stale);
    await putCachedIndex('h', idx);
    await saveRuns('h', [{ run: 1, bytes: new Uint8Array(20) }], idx.runSize, 2); // the worker saved more meanwhile
    expect(await autoResume(stale)).toBe(true);
    const m = await getManifest('h');
    expect(m?.done[1]).toBe(1);
    expect(m).toMatchObject({ state: 'downloading', bytesAtLastAutoRetry: 20, autoRetries: 1 });
    expect((bgFetch.fetch.mock.calls[0][1] as Request[]).map((r) => r.headers.get('range'))).toEqual(['bytes=100-109', 'bytes=2000-2029']);
  });

  it('does nothing for a download deleted (or resumed elsewhere) before its timer fired', async () => {
    const stale = { ...newManifest({ ...vod, index: idx, now: 1 }), state: 'paused' as const };
    await putCachedIndex('h', idx);
    expect(await autoResume(stale)).toBe(false); // never stored = deleted
    expect(await getManifest('h')).toBeNull();
    expect(bgFetch.fetch).not.toHaveBeenCalled();
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

describe('watchProgress', () => {
  it('polls Chrome and reports whole-VOD progress (earlier rounds + this round), even if the round starts late', async () => {
    await putManifest(markDone(newManifest({ ...vod, index: idx, now: 1 }), [0], idx.runSize, 2)); // 10 of 60 stored
    // Fake only the poll interval: fake-indexeddb needs real timers to complete its requests.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const settle = () => new Promise((r) => setTimeout(r, 50));
    const seen: number[] = [];
    const stop = (await import('@/lib/listen/downloads')).watchProgress('h', (done) => seen.push(done), 1000);
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    await settle(); // no live registration yet: nothing reported
    expect(seen).toEqual([]);
    bgFetch.getIds.mockResolvedValue(['listen:h:9']);
    bgFetch.get.mockResolvedValue({ id: 'listen:h:9', downloaded: 25, downloadTotal: 50 });
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(seen.at(-1)).toBe(35); // 10 stored + 25 this round
    stop();
    vi.useRealTimers();
  });
});

describe('watchdogTick (download stuck in Chrome)', () => {
  const t0 = 1_000_000;
  const live = (downloaded: number) => {
    const abort = vi.fn(async () => true);
    bgFetch.getIds.mockResolvedValue(['listen:h:2']);
    bgFetch.get.mockResolvedValue({ id: 'listen:h:2', downloaded, abort });
    return abort;
  };

  beforeEach(() => resetStallWatch());

  it('restarts a live round with no new bytes for STALL_RESTART_MS, marked as a restart (not a cancel)', async () => {
    await putManifest({ ...newManifest({ ...vod, index: idx, now: 1 }), state: 'downloading' });
    const abort = live(6);
    expect(await watchdogTick(t0)).toEqual([]); // first look: the baseline
    expect(await watchdogTick(t0 + STALL_RESTART_MS - 1)).toEqual([]);
    expect(abort).not.toHaveBeenCalled();
    expect(await watchdogTick(t0 + STALL_RESTART_MS)).toEqual(['h']);
    expect(abort).toHaveBeenCalledTimes(1);
    expect((await getManifest('h'))?.restartRequested).toBe(true);
  });

  it('leaves a round alone while its bytes keep moving', async () => {
    await putManifest({ ...newManifest({ ...vod, index: idx, now: 1 }), state: 'downloading' });
    const abort = live(6);
    await watchdogTick(t0);
    bgFetch.get.mockResolvedValue({ id: 'listen:h:2', downloaded: 7, abort });
    await watchdogTick(t0 + STALL_RESTART_MS);
    await watchdogTick(t0 + STALL_RESTART_MS + 1000);
    expect(abort).not.toHaveBeenCalled();
  });

  it('after resetStallWatch (the page was hidden) it waits a full STALL_RESTART_MS again', async () => {
    await putManifest({ ...newManifest({ ...vod, index: idx, now: 1 }), state: 'downloading' });
    const abort = live(6);
    await watchdogTick(t0);
    resetStallWatch();
    await watchdogTick(t0 + STALL_RESTART_MS);
    expect(abort).not.toHaveBeenCalled();
  });

  it('a "downloading" manifest whose fetch is gone becomes paused, unless it only just started', async () => {
    await putManifest({ ...newManifest({ ...vod, index: idx, now: t0 - 120_000 }), state: 'downloading' });
    bgFetch.getIds.mockResolvedValue([]);
    await watchdogTick(t0 - 119_000); // started a second ago: the registration may not exist yet
    expect((await getManifest('h'))?.state).toBe('downloading');
    await watchdogTick(t0);
    expect(await getManifest('h')).toMatchObject({ state: 'paused', reason: 'interrupted' });
  });

  it('a new round clears the restart flag, so a later cancel from the notification stays a cancel', async () => {
    await putManifest({ ...newManifest({ ...vod, index: idx, now: 1 }), state: 'paused', restartRequested: true });
    await startDownload(vod, idx);
    expect((await getManifest('h'))?.restartRequested).toBeUndefined();
  });
});
