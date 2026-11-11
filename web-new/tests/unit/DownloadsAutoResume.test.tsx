import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { DownloadManifest } from '@/lib/listen/download-model';

const state = vi.hoisted(() => ({ manifests: [] as DownloadManifest[] }));
vi.mock('@/lib/listen/downloads-store', () => ({ useDownloads: () => state.manifests }));
const api = vi.hoisted(() => ({ autoResume: vi.fn(async () => true), watchdogTick: vi.fn(async () => [] as string[]), resetStallWatch: vi.fn() }));
vi.mock('@/lib/listen/downloads', () => api);

import { DownloadsAutoResume, WATCHDOG_EVERY_MS } from '@/components/listen/DownloadsAutoResume';

const paused = (over: Partial<DownloadManifest> = {}) =>
  ({ hash: 'h', title: 'T', url: 'u', runCount: 1, bytesTotal: 10, done: new Uint8Array(1), bytesDone: 5, state: 'paused', reason: 'connection lost', lastModified: null, createdAt: 0, updatedAt: Date.now(), lastListenedAt: 0, ...over }) as DownloadManifest;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DownloadsAutoResume', () => {
  it('resumes a download paused by a network failure after 3 s', async () => {
    state.manifests = [paused()];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(2_900));
    expect(api.autoResume).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(api.autoResume).toHaveBeenCalledWith(state.manifests[0]);
  });

  it('never resumes one the user cancelled', async () => {
    state.manifests = [paused({ reason: 'cancelled' })];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(api.autoResume).not.toHaveBeenCalled();
  });

  it('waits while offline and resumes when the connection comes back', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    state.manifests = [paused()];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(api.autoResume).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await act(() => vi.advanceTimersByTimeAsync(10)); // the re-render scheduled a 0 ms timer (3 s already passed)
    expect(api.autoResume).toHaveBeenCalledTimes(1);
  });
});

describe('DownloadsAutoResume: watchdog for a round stuck in Chrome', () => {
  const downloading = () => ({ ...paused(), state: 'downloading', reason: undefined }) as DownloadManifest;
  const visibility = (v: 'visible' | 'hidden') => vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(v);

  it('checks running downloads at once and then every WATCHDOG_EVERY_MS while the app is visible', async () => {
    visibility('visible');
    state.manifests = [downloading()];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(api.watchdogTick).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(WATCHDOG_EVERY_MS));
    expect(api.watchdogTick).toHaveBeenCalledTimes(2);
  });

  it('does nothing while hidden, and on return starts a fresh baseline before checking', async () => {
    const vis = visibility('hidden');
    state.manifests = [downloading()];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(WATCHDOG_EVERY_MS * 3));
    expect(api.watchdogTick).not.toHaveBeenCalled();
    vis.mockReturnValue('visible');
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    expect(api.resetStallWatch).toHaveBeenCalled();
    expect(api.watchdogTick).toHaveBeenCalledTimes(1);
  });

  it('never runs when nothing is downloading', async () => {
    visibility('visible');
    state.manifests = [paused({ reason: 'cancelled' })];
    render(<DownloadsAutoResume />);
    await act(() => vi.advanceTimersByTimeAsync(WATCHDOG_EVERY_MS * 2));
    expect(api.watchdogTick).not.toHaveBeenCalled();
  });
});
