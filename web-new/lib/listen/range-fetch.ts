// The ONLY code that touches HTTP for Listen audio. See the spec's "Failure handling".
// Cross-origin, the page can read only cache-control / content-length / content-type /
// last-modified, so validation uses status + Content-Length + Last-Modified.
import type { Bytes } from './types';

export type RangeErrorCode = 'aborted' | 'not-found' | 'range-unsupported' | 'file-changed' | 'bad-status' | 'exhausted';

export class RangeFetchError extends Error {
  readonly code: RangeErrorCode;
  readonly status?: number;
  constructor(code: RangeErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'RangeFetchError';
    this.code = code;
    this.status = status;
  }
}

export interface RangeResult {
  bytes: Bytes;
  lastModified: string | null;
}
export interface RetryInfo {
  attempt: number;
  delayMs: number;
  reason: string;
}
export interface FetchRangeDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  isOnline: () => boolean;
  waitForOnline: (signal?: AbortSignal) => Promise<void>;
  random: () => number;
}
export interface FetchRangeOptions {
  signal?: AbortSignal;
  /** Last-Modified pinned when the index was built; a different value is fatal "file-changed". */
  expectedLastModified?: string | null;
  /** Abort an attempt after this long with no bytes arriving. Default 15 s. */
  idleTimeoutMs?: number;
  /** Default 5. */
  maxAttempts?: number;
  onRetry?: (info: RetryInfo) => void;
  onOffline?: () => void;
  deps?: Partial<FetchRangeDeps>;
}

/** A failure worth another attempt. Internal: never escapes fetchRange. */
class Transient extends Error {}

const aborted = () => new RangeFetchError('aborted', 'Aborted');

const defaultDeps: FetchRangeDeps = {
  fetch: (url, init) => globalThis.fetch(url, init),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(aborted());
      }, { once: true });
    }),
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  waitForOnline: (signal) =>
    new Promise((resolve, reject) => {
      const done = () => {
        window.removeEventListener('online', done);
        resolve();
      };
      window.addEventListener('online', done);
      signal?.addEventListener('abort', () => {
        window.removeEventListener('online', done);
        reject(aborted());
      }, { once: true });
    }),
  random: Math.random,
};

/** 1 s, 2 s, 4 s, 8 s, 16 s (cap), each ±30%. */
export function backoffDelay(attempt: number, random: () => number): number {
  const base = Math.min(16_000, 1000 * 2 ** (attempt - 1));
  return Math.round(base * (0.7 + 0.6 * random()));
}

export async function fetchRange(url: string, start: number, endInclusive: number, opts: FetchRangeOptions = {}): Promise<RangeResult> {
  const deps: FetchRangeDeps = { ...defaultDeps, ...opts.deps };
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastReason = 'unknown';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw aborted();
    if (!deps.isOnline()) {
      opts.onOffline?.();
      await deps.waitForOnline(opts.signal);
    }
    try {
      return await attemptOnce(url, start, endInclusive, opts, deps);
    } catch (err) {
      if (err instanceof RangeFetchError) throw err;
      if (opts.signal?.aborted) throw aborted();
      lastReason = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) break;
      const delayMs = backoffDelay(attempt, deps.random);
      opts.onRetry?.({ attempt, delayMs, reason: lastReason });
      await deps.sleep(delayMs, opts.signal);
    }
  }
  throw new RangeFetchError('exhausted', `Gave up after ${maxAttempts} attempts: ${lastReason}`);
}

async function attemptOnce(url: string, start: number, end: number, opts: FetchRangeOptions, deps: FetchRangeDeps): Promise<RangeResult> {
  const length = end - start + 1;
  const idleMs = opts.idleTimeoutMs ?? 15_000;
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onCallerAbort, { once: true });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const armIdle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      void reader?.cancel().catch(() => undefined);
    }, idleMs);
  };
  const discard = (res: Response) => void res.body?.cancel().catch(() => undefined);

  try {
    armIdle();
    let res: Response;
    try {
      res = await deps.fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal });
    } catch (err) {
      if (opts.signal?.aborted) throw aborted();
      if (timedOut) throw new Transient('no response within the idle timeout');
      throw new Transient(`network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (res.status !== 206) {
      discard(res);
      if (res.status === 200) throw new RangeFetchError('range-unsupported', 'The server ignored Range (200); refusing to download the whole file', 200);
      if (res.status === 404 || res.status === 410) throw new RangeFetchError('not-found', `VOD not found (${res.status})`, res.status);
      if (res.status === 416) throw new RangeFetchError('range-unsupported', 'Range not satisfiable (416)', 416);
      if (res.status === 408 || res.status === 429 || res.status >= 500) throw new Transient(`HTTP ${res.status}`);
      throw new RangeFetchError('bad-status', `Unexpected HTTP ${res.status}`, res.status);
    }

    const lastModified = res.headers.get('last-modified');
    if (opts.expectedLastModified && lastModified && lastModified !== opts.expectedLastModified) {
      discard(res);
      throw new RangeFetchError('file-changed', `The VOD changed on the server (${lastModified}, expected ${opts.expectedLastModified})`);
    }
    const declared = res.headers.get('content-length');
    if (declared !== null && Number(declared) !== length) {
      discard(res);
      throw new Transient(`Content-Length ${declared}, requested ${length}`);
    }
    if (!res.body) throw new Transient('response has no body');

    const out = new Uint8Array(length);
    let received = 0;
    reader = res.body.getReader();
    for (;;) {
      armIdle();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (opts.signal?.aborted) throw aborted();
        if (timedOut) throw new Transient('idle timeout while reading');
        throw new Transient(`read failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (chunk.done) break;
      if (received + chunk.value.byteLength > length) {
        void reader.cancel().catch(() => undefined);
        throw new Transient(`body longer than the requested ${length} bytes`);
      }
      out.set(chunk.value, received);
      received += chunk.value.byteLength;
    }
    if (opts.signal?.aborted) throw aborted();
    if (timedOut) throw new Transient('idle timeout while reading');
    if (received !== length) throw new Transient(`short read: ${received} of ${length} bytes`);
    return { bytes: out, lastModified };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onCallerAbort);
  }
}
