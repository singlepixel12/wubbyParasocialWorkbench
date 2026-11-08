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
