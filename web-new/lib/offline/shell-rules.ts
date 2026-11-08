// What the service worker does with each request. Pure, so it's unit-tested; the worker runs it
// for every fetch. Relative imports only (bundled into sw.js by scripts/build-sw.mjs).
//
// Hard constraints (spec: Phase 3b):
// - never touch a Range request, and never cache or serve a 206 (the Next 16.0.7 blank tab);
// - never intercept the archive or the Supabase REST API;
// - online, pages come from the network (3 s budget), so nothing goes stale.

export type FetchPlan =
  /** Not ours: no respondWith, the browser handles it exactly as without a worker. */
  | { kind: 'pass' }
  /** A VOD thumbnail: the thumbs cache (downloaded VODs only), else the network. */
  | { kind: 'thumb' }
  /** Network first (with a timeout), then this cached shell file. */
  | { kind: 'page'; fallback: string }
  /** A build-hashed asset: cache first, then the network. */
  | { kind: 'static' };

export interface RequestLike {
  method: string;
  url: string;
  mode?: string;
  hasRange: boolean;
}

export interface ShellContext {
  /** Same-origin path the app lives under, no trailing slash: '' or '/wubbyParasocialWorkbench'. */
  base: string;
  origin: string;
  /** Shell file paths relative to the base, e.g. 'watch.html', '_next/static/chunks/a.js'. */
  files: ReadonlySet<string>;
}

const THUMBNAIL = /\/storage\/v1\/object\/public\/wubbytranscript\/[0-9a-f]{64}\/thumbnail\.webp$/;

export function isThumbnailUrl(url: string): boolean {
  try {
    return THUMBNAIL.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** The cached page a navigation falls back to: `/watch?id=…` → `watch.html`. */
export function pageFor(relPath: string, files: ReadonlySet<string>): string {
  const p = relPath.replace(/\/+$/, '');
  if (p === '' || p === 'index.html') return 'index.html';
  if (files.has(p) && p.endsWith('.html')) return p;
  if (files.has(`${p}.html`)) return `${p}.html`;
  return '404.html';
}

export function planFetch(req: RequestLike, ctx: ShellContext): FetchPlan {
  if (req.method !== 'GET' || req.hasRange) return { kind: 'pass' };
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return { kind: 'pass' };
  }
  if (url.origin !== ctx.origin) return isThumbnailUrl(req.url) ? { kind: 'thumb' } : { kind: 'pass' };

  const prefix = `${ctx.base}/`;
  if (url.pathname !== ctx.base && !url.pathname.startsWith(prefix)) return { kind: 'pass' };
  const rel = decodeURIComponent(url.pathname.slice(prefix.length));

  if (req.mode === 'navigate') return { kind: 'page', fallback: pageFor(rel, ctx.files) };
  if (!ctx.files.has(rel)) return { kind: 'pass' };
  if (rel.startsWith('_next/static/')) return { kind: 'static' };
  return { kind: 'page', fallback: rel };
}
