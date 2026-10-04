/**
 * Unit tests for lib/api/supabase.ts — the list fetchers' request behaviour.
 *
 * `fetch` is stubbed, so these pin down what URL is built, how cancellation and
 * timeouts surface, and what the fetchers return. No network is touched.
 *
 * WHAT THIS FILE CANNOT COVER (needs a human or the E2E suite against live Supabase):
 * - That PostgREST actually accepts the generated query strings and filters the
 *   rows the way the URL claims (operator syntax, timestamp comparison).
 * - That a real browser's fetch rejects with an AbortError the instant a
 *   superseded request is cancelled (jsdom/undici stand in for it here).
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

type Api = typeof import('@/lib/api/supabase');
let api: Api;

beforeAll(async () => {
  // The module throws at import time without the anon key
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  api = await import('@/lib/api/supabase');
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A fetch that never settles on its own but rejects like a browser when aborted. */
function hangUntilAborted() {
  fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      })
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('cancellation (superseded requests)', () => {
  it('rejects with an AbortError — not the timeout message — when the caller aborts', async () => {
    hangUntilAborted();
    const controller = new AbortController();

    const pending = api.fetchRecentVideos({ signal: controller.signal });
    controller.abort();

    const error = await pending.catch((e) => e);
    expect(api.isAbortError(error)).toBe(true);
    expect(String(error.message)).not.toMatch(/timed out/i);
  });

  it('does not call fetch at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await api.searchVideos({ searchTerm: 'x', signal: controller.signal }).catch((e) => e);

    expect(api.isAbortError(error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the cancellation through searchVideos too', async () => {
    hangUntilAborted();
    const controller = new AbortController();

    const pending = api.searchVideos({ searchTerm: 'cooking', signal: controller.signal });
    controller.abort();

    expect(api.isAbortError(await pending.catch((e) => e))).toBe(true);
  });
});

describe('timeout', () => {
  it('maps its own 10s timeout to a user-facing timeout error', async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const pending = api.fetchRecentVideos({}).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);

    const error = await pending;
    expect(api.isAbortError(error)).toBe(false);
    expect(error.message).toMatch(/timed out/i);
  });

  it('still times out when a caller signal is supplied but never fires', async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const pending = api
      .fetchRecentVideos({ signal: new AbortController().signal })
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);

    expect((await pending).message).toMatch(/timed out/i);
  });
});

describe('fetchRecentVideos', () => {
  it('maps rows to videos', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          pleb_title: 'A title',
          platform: 'kick',
          tags: ['a', 'b'],
          summary: 'Summary.',
          upload_date: '2026-10-03T07:26:00+00:00',
          video_url: 'https://archive.wubby.tv/x.mp4',
          video_hash: 'a'.repeat(64),
        },
      ])
    );

    const videos = await api.fetchRecentVideos({});

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ title: 'A title', platform: 'kick', tags: ['a', 'b'] });
    expect(videos[0].thumbnailUrl).toContain(`${'a'.repeat(64)}/thumbnail.webp`);
  });

  it('queries whole local days: gte start-of-from, lt start-of-day-after-to', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const from = new Date(2026, 8, 1, 14, 0); // time-of-day must not leak into the query
    const to = new Date(2026, 8, 30);

    await api.fetchRecentVideos({ fromDate: from, toDate: to });

    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`upload_date=gte.${new Date(2026, 8, 1).toISOString()}`);
    expect(url).toContain(`upload_date=lt.${new Date(2026, 9, 1).toISOString()}`);
    expect(url).not.toContain('upload_date=lte.');
  });

  it('filters a from-only range to that single day', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await api.fetchRecentVideos({ fromDate: new Date(2026, 8, 15) });

    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`upload_date=gte.${new Date(2026, 8, 15).toISOString()}`);
    expect(url).toContain(`upload_date=lt.${new Date(2026, 8, 16).toISOString()}`);
  });

  it('throws on an out-of-range platform instead of returning unfiltered data', async () => {
    // @ts-expect-error — exercising the runtime whitelist for untyped callers
    await expect(api.fetchRecentVideos({ platform: 'youtube' })).rejects.toThrow(/Invalid platform/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
