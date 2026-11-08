// The app-shell cache: install (precache), activate (prune), respond (serve a FetchPlan).
// Runs in the service worker; dependencies are injected so it's unit-tested with fakes.
// Relative imports only (bundled into sw.js by scripts/build-sw.mjs).
import type { FetchPlan } from './shell-rules';
import { THUMBS_CACHE } from './thumbs';

export const SHELL_PREFIX = 'shell-';
const META_CACHE = 'shell-meta';
const META_KEY = '/__shell-versions';
/** How long a page waits for the network before the cached copy is used. */
export const PAGE_TIMEOUT_MS = 3000;
const INSTALL_CONCURRENCY = 8;

export interface ShellDeps {
  caches: CacheStorage;
  fetch: (req: Request) => Promise<Response>;
  /** Absolute URL of the app root with a trailing slash, i.e. the worker's scope. */
  scope: string;
  version: string;
  files: readonly string[];
  timeoutMs?: number;
}

const shellName = (version: string) => `${SHELL_PREFIX}${version}`;
const urlOf = (d: ShellDeps, rel: string) => new URL(rel, d.scope).href;

/**
 * Precache every shell file. Anything but a 200 throws, which fails the worker's install: the
 * old worker (and its complete shell) stays in charge instead of a half-cached new one.
 */
export async function installShell(d: ShellDeps): Promise<void> {
  const cache = await d.caches.open(shellName(d.version));
  const queue = [...d.files];
  const worker = async () => {
    for (let rel = queue.shift(); rel !== undefined; rel = queue.shift()) {
      const res = await d.fetch(new Request(urlOf(d, rel), { cache: 'reload' }));
      if (res.status !== 200) throw new Error(`precache ${rel}: HTTP ${res.status}`);
      await cache.put(urlOf(d, rel), res);
    }
  };
  await Promise.all(Array.from({ length: INSTALL_CONCURRENCY }, worker));
}

/**
 * Keep this version's shell and the one before it; delete older ones. GitHub Pages removes old
 * chunks on every deploy, so a tab still running the previous version needs its cache.
 */
export async function activateShell(d: ShellDeps): Promise<void> {
  const meta = await d.caches.open(META_CACHE);
  const prev = await meta.match(META_KEY);
  const known: string[] = prev ? await prev.json().catch(() => []) : [];
  const keep = [...known.filter((v) => v !== d.version), d.version].slice(-2);
  await meta.put(META_KEY, new Response(JSON.stringify(keep), { headers: { 'content-type': 'application/json' } }));
  const keepNames = new Set(keep.map(shellName));
  for (const name of await d.caches.keys()) {
    if (name.startsWith(SHELL_PREFIX) && name !== META_CACHE && !keepNames.has(name)) await d.caches.delete(name);
  }
}

/** A cached shell file, this version first, then the previous one. */
async function cachedShell(d: ShellDeps, rel: string): Promise<Response | undefined> {
  const url = urlOf(d, rel);
  const own = await (await d.caches.open(shellName(d.version))).match(url);
  if (own) return own;
  for (const name of await d.caches.keys()) {
    if (!name.startsWith(SHELL_PREFIX) || name === META_CACHE) continue;
    const hit = await (await d.caches.open(name)).match(url);
    if (hit) return hit;
  }
  return undefined;
}

/** Network first; after `timeoutMs` (or a failure, or a 5xx) the cached copy, if there is one. */
async function networkFirst(d: ShellDeps, req: Request, fallback: string): Promise<Response> {
  const network = d.fetch(req);
  network.catch(() => undefined); // observed below; never an unhandled rejection
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), d.timeoutMs ?? PAGE_TIMEOUT_MS);
  });
  try {
    const first = await Promise.race([network.then((r) => r, () => 'error' as const), timedOut]);
    if (first !== 'timeout' && first !== 'error' && first.status < 500) return first;
    const cached = await cachedShell(d, fallback);
    if (cached) return cached;
    if (first !== 'timeout' && first !== 'error') return first; // a 5xx and nothing cached
    return await network; // slow or failing, and nothing cached: let the network decide
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(d: ShellDeps, req: Request, rel: string): Promise<Response> {
  return (await cachedShell(d, rel)) ?? d.fetch(req);
}

async function thumb(d: ShellDeps, req: Request): Promise<Response> {
  const hit = await (await d.caches.open(THUMBS_CACHE)).match(req.url);
  return hit ?? d.fetch(req);
}

/** Serve a request the rules claimed (never called for `pass`). */
export function respond(d: ShellDeps, req: Request, plan: Exclude<FetchPlan, { kind: 'pass' }>): Promise<Response> {
  switch (plan.kind) {
    case 'page':
      return networkFirst(d, req, plan.fallback);
    case 'static':
      return cacheFirst(d, req, new URL(req.url).pathname.slice(new URL(d.scope).pathname.length));
    case 'thumb':
      return thumb(d, req);
  }
}
