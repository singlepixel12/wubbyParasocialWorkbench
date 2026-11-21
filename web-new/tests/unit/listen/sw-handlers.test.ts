import { describe, it, expect, vi } from 'vitest';
import { handleBackgroundFetchEnd, type BgRegistrationLike } from '@/lib/listen/sw-handlers';
import { NO_RECORDS_REASON, rangeForRun, STALLED_REASON } from '@/lib/listen/download-model';
import type { AudioIndex } from '@/lib/listen/types';

const idx = { runOffset: Float64Array.of(1000, 9000, 20000), runSize: Uint32Array.of(3, 4, 5), lastModified: 'LM' } as unknown as AudioIndex;
const record = (run: number, status = 206, len = idx.runSize[run]) => ({
  request: { headers: { get: (n: string) => (n.toLowerCase() === 'range' ? rangeForRun(idx, run) : null) } },
  responseReady: Promise.resolve({ status, arrayBuffer: async () => new ArrayBuffer(len) }),
});
const reg = (records: ReturnType<typeof record>[], id = 'listen:h:1', downloaded?: number): BgRegistrationLike => ({ id, downloaded, matchAll: async () => records });

function deps(state: 'downloading' | 'ready' = 'downloading') {
  const saveRuns = vi.fn(async (_h: string, entries: { run: number }[]) => ({ hash: 'h', title: 'T', state: entries.length === 3 ? 'ready' : state, done: new Uint8Array(3) }));
  return { getIndex: vi.fn(async () => idx), saveRuns, pause: vi.fn(async () => {}), notify: vi.fn(), getManifest: vi.fn(async () => ({ hash: 'h', title: 'T' })), liveIds: vi.fn(async (): Promise<string[]> => []), abortParts: vi.fn(async () => {}) };
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
    expect(d.pause).toHaveBeenCalledWith('h', expect.stringMatching(/2 parts failed/));
    expect(r?.state).toBe('paused');
  });

  it('on fail/abort saves what completed and pauses', async () => {
    const d = deps();
    const r = await handleBackgroundFetchEnd('abort', reg([record(1)]), d as never);
    expect(d.saveRuns).toHaveBeenCalled();
    expect(d.pause).toHaveBeenCalledWith('h', 'cancelled');
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
    expect(d.pause).toHaveBeenCalledWith('h', 'audio index missing; reopen the VOD');
  });

  it('says nothing for a download deleted while it ran (its runs were not stored)', async () => {
    const d = deps();
    d.saveRuns.mockResolvedValue(null as never);
    d.getManifest.mockResolvedValue(null as never);
    expect(await handleBackgroundFetchEnd('abort', reg([record(0)]), d as never)).toBeNull();
  });
});

describe('handleBackgroundFetchEnd: a watchdog restart is not a user cancel', () => {
  it('an abort the watchdog asked for pauses as stalled, so auto-resume picks it up', async () => {
    const d = deps();
    d.saveRuns.mockResolvedValue({ hash: 'h', title: 'T', state: 'downloading', done: new Uint8Array(3), restartRequested: true } as never);
    await handleBackgroundFetchEnd('abort', reg([record(0)]), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', STALLED_REASON);
  });

  it('a stalled round with nothing new to save still pauses as stalled', async () => {
    const d = deps();
    d.getManifest.mockResolvedValue({ hash: 'h', title: 'T', restartRequested: true } as never);
    await handleBackgroundFetchEnd('abort', reg([]), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', STALLED_REASON);
  });
});

describe('handleBackgroundFetchEnd: a download in parts (one Background Fetch per ≤4,000 runs)', () => {
  it('a part that ends while another part of the VOD still runs leaves it downloading', async () => {
    const d = deps();
    d.liveIds.mockResolvedValue(['listen:h:5-0', 'listen:h:5-1', 'listen:other:9-0']);
    const r = await handleBackgroundFetchEnd('success', reg([record(0)], 'listen:h:5-0'), d as never);
    expect(d.saveRuns).toHaveBeenCalled(); // its own runs are saved
    expect(d.pause).not.toHaveBeenCalled();
    expect(r?.state).toBe('downloading');
    expect(d.notify).toHaveBeenCalledWith('h');
  });

  it("a failed part doesn't pause the VOD while its sibling still runs", async () => {
    const d = deps();
    d.liveIds.mockResolvedValue(['listen:h:5-1']);
    expect((await handleBackgroundFetchEnd('fail', reg([record(0)], 'listen:h:5-0'), d as never))?.state).toBe('downloading');
    expect(d.pause).not.toHaveBeenCalled();
  });

  it('the last part to end decides: pauses with its reason', async () => {
    const d = deps();
    d.liveIds.mockResolvedValue(['listen:h:5-1', 'listen:other:9-0']); // only its own id and another VOD's
    const r = await handleBackgroundFetchEnd('fail', reg([record(0)], 'listen:h:5-1'), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', 'connection lost');
    expect(r?.state).toBe('paused');
  });

  it('the last part completes the VOD: ready, whatever else is live', async () => {
    const d = deps();
    d.liveIds.mockResolvedValue(['listen:h:5-0']);
    expect((await handleBackgroundFetchEnd('success', reg([record(0), record(1), record(2)], 'listen:h:5-1'), d as never))?.state).toBe('ready');
    expect(d.pause).not.toHaveBeenCalled();
  });

  it("cancelling one part (its own Android notification) cancels the VOD and stops the other parts", async () => {
    const d = deps();
    d.liveIds.mockResolvedValue(['listen:h:5-0', 'listen:h:5-1', 'listen:h:5-2', 'listen:other:9-0']);
    const r = await handleBackgroundFetchEnd('abort', reg([record(0)], 'listen:h:5-0'), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', 'cancelled');
    expect(d.abortParts).toHaveBeenCalledWith(['listen:h:5-1', 'listen:h:5-2']);
    expect(d.pause.mock.invocationCallOrder[0]).toBeLessThan(d.abortParts.mock.invocationCallOrder[0]); // pause first
    expect(r?.state).toBe('paused');
  });
});

describe('handleBackgroundFetchEnd: Chrome lists no records', () => {
  it('bytes were downloaded but matchAll() is empty: pauses with a reason auto-resume never retries', async () => {
    const d = deps();
    const r = await handleBackgroundFetchEnd('success', reg([], 'listen:h:5-0', 10_500_000), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', NO_RECORDS_REASON);
    expect(r?.state).toBe('paused');
  });

  it('nothing downloaded and nothing listed (a quick cancel) is still an ordinary cancel', async () => {
    const d = deps();
    await handleBackgroundFetchEnd('abort', reg([], 'listen:h:5-0', 0), d as never);
    expect(d.pause).toHaveBeenCalledWith('h', 'cancelled');
  });
});
