import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateShell, installShell, respond, type ShellDeps } from '@/lib/offline/shell-cache';
import { THUMBS_CACHE } from '@/lib/offline/thumbs';
import { FakeCacheStorage, asCacheStorage } from './fake-caches';

const SCOPE = 'https://site.test/app/';
const ok = (body: string, status = 200) => new Response(body, { status });

function deps(store: FakeCacheStorage, fetchImpl: (r: Request) => Promise<Response>, over: Partial<ShellDeps> = {}): ShellDeps {
  return { caches: asCacheStorage(store), fetch: fetchImpl, scope: SCOPE, version: 'v2', files: ['index.html', 'watch.html', '_next/static/a.js'], timeoutMs: 50, ...over };
}

afterEach(() => vi.useRealTimers());

describe('installShell', () => {
  it('precaches every file, bypassing the HTTP cache', async () => {
    const store = new FakeCacheStorage();
    const seen: Request[] = [];
    await installShell(deps(store, async (r) => (seen.push(r), ok(`body of ${r.url}`))));
    expect(seen.map((r) => r.cache)).toEqual(['reload', 'reload', 'reload']);
    const cache = await store.open('shell-v2');
    expect(await (await cache.match(`${SCOPE}watch.html`))!.text()).toBe(`body of ${SCOPE}watch.html`);
  });

  it('fails the install on anything but a 200, including a 206', async () => {
    const store = new FakeCacheStorage();
    await expect(installShell(deps(store, async (r) => (r.url.endsWith('watch.html') ? ok('part', 206) : ok('x'))))).rejects.toThrow(/206/);
    await expect(installShell(deps(store, async () => ok('gone', 404)))).rejects.toThrow(/404/);
  });

  it('fails the install when the network drops', async () => {
    await expect(installShell(deps(new FakeCacheStorage(), async () => Promise.reject(new TypeError('Failed to fetch'))))).rejects.toThrow();
  });
});

describe('activateShell', () => {
  it('keeps this version and the previous one, deletes older shells, leaves other caches', async () => {
    const store = new FakeCacheStorage();
    for (const v of ['v1', 'v2', 'v3']) {
      await store.open(`shell-${v}`);
      await activateShell(deps(store, async () => ok(''), { version: v }));
    }
    await store.open(THUMBS_CACHE);
    await store.open('shell-v4');
    await activateShell(deps(store, async () => ok(''), { version: 'v4' }));
    const names = await store.keys();
    expect(names).toContain('shell-v3');
    expect(names).toContain('shell-v4');
    expect(names).not.toContain('shell-v1');
    expect(names).not.toContain('shell-v2');
    expect(names).toContain(THUMBS_CACHE);
  });
});

describe('respond', () => {
  async function installed(fetchImpl: (r: Request) => Promise<Response>) {
    const store = new FakeCacheStorage();
    await installShell(deps(store, async (r) => ok(`cached ${new URL(r.url).pathname}`)));
    return deps(store, fetchImpl);
  }

  it('page: the network answer when it comes in time', async () => {
    const d = await installed(async () => ok('fresh'));
    expect(await (await respond(d, new Request(`${SCOPE}watch?id=1`), { kind: 'page', fallback: 'watch.html' })).text()).toBe('fresh');
  });

  it('page: the cached copy when offline', async () => {
    const d = await installed(async () => Promise.reject(new TypeError('offline')));
    expect(await (await respond(d, new Request(`${SCOPE}watch?id=1`), { kind: 'page', fallback: 'watch.html' })).text()).toBe('cached /app/watch.html');
  });

  it('page: the cached copy when the network is slower than the timeout (lie-fi)', async () => {
    const d = await installed(() => new Promise(() => undefined));
    expect(await (await respond(d, new Request(`${SCOPE}`), { kind: 'page', fallback: 'index.html' })).text()).toBe('cached /app/index.html');
  });

  it('page: the cached copy on a 5xx, but a 404 from the network is honest', async () => {
    const d = await installed(async () => ok('down', 503));
    expect(await (await respond(d, new Request(`${SCOPE}`), { kind: 'page', fallback: 'index.html' })).text()).toBe('cached /app/index.html');
    const d2 = await installed(async () => ok('missing', 404));
    expect((await respond(d2, new Request(`${SCOPE}x`), { kind: 'page', fallback: '404.html' })).status).toBe(404);
  });

  it('page: nothing cached and offline → the network error stands', async () => {
    const d = deps(new FakeCacheStorage(), async () => Promise.reject(new TypeError('offline')));
    await expect(respond(d, new Request(`${SCOPE}`), { kind: 'page', fallback: 'index.html' })).rejects.toThrow('offline');
  });

  it('page: a previous version still serves when this one lacks the file', async () => {
    const store = new FakeCacheStorage();
    await (await store.open('shell-v1')).put(`${SCOPE}old.html`, ok('old version'));
    const d = deps(store, async () => Promise.reject(new TypeError('offline')));
    expect(await (await respond(d, new Request(`${SCOPE}old.html`), { kind: 'page', fallback: 'old.html' })).text()).toBe('old version');
  });

  it('static: cache first, never the network when cached', async () => {
    const net = vi.fn(async () => ok('net'));
    const d = await installed(net);
    expect(await (await respond(d, new Request(`${SCOPE}_next/static/a.js`), { kind: 'static' })).text()).toBe('cached /app/_next/static/a.js');
    expect(net).not.toHaveBeenCalled();
  });

  it('thumb: the thumbs cache, else the network', async () => {
    const store = new FakeCacheStorage();
    const url = 'https://x.supabase.co/thumb.webp';
    await (await store.open(THUMBS_CACHE)).put(url, ok('saved thumb'));
    const d = deps(store, async () => ok('net thumb'));
    expect(await (await respond(d, new Request(url), { kind: 'thumb' })).text()).toBe('saved thumb');
    expect(await (await respond(d, new Request('https://x.supabase.co/other.webp'), { kind: 'thumb' })).text()).toBe('net thumb');
  });
});
