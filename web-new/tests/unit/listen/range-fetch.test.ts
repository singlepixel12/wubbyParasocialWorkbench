import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRange, backoffDelay, RangeFetchError, type FetchRangeDeps } from '@/lib/listen/range-fetch';

const LM = 'Sun, 04 Oct 2026 09:47:31 GMT';
const bytesOf = (n: number) => Uint8Array.from({ length: n }, (_, i) => i & 255);
const ok = (n: number, headers: Record<string, string> = {}) =>
  new Response(bytesOf(n), { status: 206, headers: { 'content-length': String(n), 'last-modified': LM, ...headers } });
const status = (code: number) => new Response('x', { status: code });

function deps(responses: Array<Response | Error>, extra: Partial<FetchRangeDeps> = {}) {
  const fetch = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra fetch');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch, sleep: vi.fn(async () => {}), isOnline: () => true, waitForOnline: vi.fn(async () => {}), random: () => 0.5, ...extra };
}

afterEach(() => vi.useRealTimers());

describe('fetchRange', () => {
  it('returns the bytes and Last-Modified, asking for an exact closed range', async () => {
    const d = deps([ok(10)]);
    const r = await fetchRange('https://a/v.mp4', 100, 109, { deps: d });
    expect(Array.from(r.bytes)).toEqual(Array.from(bytesOf(10)));
    expect(r.lastModified).toBe(LM);
    expect(d.fetch).toHaveBeenCalledWith('https://a/v.mp4', expect.objectContaining({ headers: { Range: 'bytes=100-109' } }));
  });

  it('refuses a 200 (whole file) without retrying', async () => {
    const d = deps([new Response(bytesOf(4096), { status: 200 })]);
    await expect(fetchRange('u', 0, 9, { deps: d })).rejects.toMatchObject({ code: 'range-unsupported', status: 200 });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 410])('treats %i as not-found without retrying', async (code) => {
    const d = deps([status(code)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).rejects.toMatchObject({ code: 'not-found' });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries 503 with backoff and reports each retry', async () => {
    const onRetry = vi.fn();
    const d = deps([status(503), status(503), ok(10)]);
    await fetchRange('u', 0, 9, { deps: d, onRetry });
    expect(d.fetch).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([i]) => i.delayMs)).toEqual([1000, 2000]);
    expect(d.sleep).toHaveBeenCalledTimes(2);
  });

  it('retries a network TypeError (also what a CORS failure looks like)', async () => {
    const d = deps([new TypeError('Failed to fetch'), ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
  });

  it('gives up with "exhausted" after maxAttempts', async () => {
    const d = deps([status(500), status(500), status(500)]);
    await expect(fetchRange('u', 0, 9, { deps: d, maxAttempts: 3 })).rejects.toMatchObject({ code: 'exhausted' });
    expect(d.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries when Content-Length is not the requested length', async () => {
    const d = deps([ok(10, { 'content-length': '11' }), ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('fails with file-changed when Last-Modified differs from the pinned one', async () => {
    const d = deps([ok(10, { 'last-modified': 'Mon, 05 Oct 2026 00:00:00 GMT' })]);
    await expect(fetchRange('u', 0, 9, { deps: d, expectedLastModified: LM })).rejects.toMatchObject({ code: 'file-changed' });
  });

  it('retries a short body', async () => {
    const short = new Response(bytesOf(4), { status: 206, headers: { 'last-modified': LM } });
    const d = deps([short, ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry or report when the caller aborts', async () => {
    const controller = new AbortController();
    const onRetry = vi.fn();
    const d = deps([], {
      fetch: vi.fn(async (_u: string, init?: RequestInit) => {
        controller.abort();
        throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError');
      }),
    });
    await expect(fetchRange('u', 0, 9, { deps: d, signal: controller.signal, onRetry })).rejects.toMatchObject({ code: 'aborted' });
    expect(onRetry).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for the network instead of burning attempts while offline', async () => {
    let online = false;
    const onOffline = vi.fn();
    const d = deps([ok(10)], {
      isOnline: () => online,
      waitForOnline: vi.fn(async () => {
        online = true;
      }),
    });
    await fetchRange('u', 0, 9, { deps: d, onOffline });
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(d.waitForOnline).toHaveBeenCalledTimes(1);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries when the body stalls past the idle timeout', async () => {
    vi.useFakeTimers();
    const stalled = new Response(
      new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(Uint8Array.of(1, 2)) }),
      { status: 206, headers: { 'content-length': '10', 'last-modified': LM } },
    );
    const d = deps([stalled, ok(10)]);
    const pending = fetchRange('u', 0, 9, { deps: d, idleTimeoutMs: 15_000 });
    await vi.advanceTimersByTimeAsync(15_001);
    await expect(pending).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('backoffDelay', () => {
  it('doubles from 1 s, caps at 16 s, with ±30% jitter', () => {
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(2, () => 0.5)).toBe(2000);
    expect(backoffDelay(9, () => 0.5)).toBe(16000);
    expect(backoffDelay(1, () => 0)).toBe(700);
    expect(backoffDelay(1, () => 1)).toBe(1300);
  });
});

describe('RangeFetchError', () => {
  it('is an Error with a code', () => {
    const e = new RangeFetchError('not-found', 'gone', 404);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('not-found');
  });
});
