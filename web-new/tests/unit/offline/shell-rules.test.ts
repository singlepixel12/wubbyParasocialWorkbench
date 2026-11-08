import { describe, expect, it } from 'vitest';
import { isThumbnailUrl, pageFor, planFetch, type RequestLike } from '@/lib/offline/shell-rules';

const ORIGIN = 'https://singlepixel12.github.io';
const BASE = '/wubbyParasocialWorkbench';
const files = new Set(['index.html', 'watch.html', '404.html', 'watch.txt', 'watch/__next.watch/__PAGE__.txt', '_next/static/chunks/app.js', 'manifest.webmanifest']);
const ctx = { base: BASE, origin: ORIGIN, files };
const THUMB = `https://xyz.supabase.co/storage/v1/object/public/wubbytranscript/${'a'.repeat(64)}/thumbnail.webp`;

const req = (url: string, over: Partial<RequestLike> = {}): RequestLike => ({ method: 'GET', url, mode: 'no-cors', hasRange: false, ...over });

describe('planFetch', () => {
  it('never touches a Range request, even for a shell file (the 206 incident)', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/watch.html`, { hasRange: true }), ctx)).toEqual({ kind: 'pass' });
    expect(planFetch(req(`${ORIGIN}${BASE}/watch`, { mode: 'navigate', hasRange: true }), ctx)).toEqual({ kind: 'pass' });
  });

  it('passes non-GET requests', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/watch.html`, { method: 'POST' }), ctx)).toEqual({ kind: 'pass' });
  });

  it('never intercepts the archive or the Supabase REST API', () => {
    expect(planFetch(req('https://archive.wubby.tv/vods/public/a.mp4'), ctx)).toEqual({ kind: 'pass' });
    expect(planFetch(req('https://xyz.supabase.co/rest/v1/wubby_summary?select=*'), ctx)).toEqual({ kind: 'pass' });
  });

  it('claims VOD thumbnails', () => {
    expect(planFetch(req(THUMB), ctx)).toEqual({ kind: 'thumb' });
  });

  it('navigations are network-first with the right cached page', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'page', fallback: 'index.html' });
    expect(planFetch(req(`${ORIGIN}${BASE}`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'page', fallback: 'index.html' });
    expect(planFetch(req(`${ORIGIN}${BASE}/watch?id=${'b'.repeat(64)}`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'page', fallback: 'watch.html' });
    expect(planFetch(req(`${ORIGIN}${BASE}/watch/`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'page', fallback: 'watch.html' });
    expect(planFetch(req(`${ORIGIN}${BASE}/nope`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'page', fallback: '404.html' });
  });

  it('RSC payloads are network-first, falling back to themselves', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/watch/__next.watch/__PAGE__.txt?_rsc=abc`), ctx)).toEqual({ kind: 'page', fallback: 'watch/__next.watch/__PAGE__.txt' });
  });

  it('build-hashed assets are cache-first', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/_next/static/chunks/app.js`), ctx)).toEqual({ kind: 'static' });
  });

  it('passes same-origin files outside the shell and outside the scope', () => {
    expect(planFetch(req(`${ORIGIN}${BASE}/sw.js`), ctx)).toEqual({ kind: 'pass' });
    expect(planFetch(req(`${ORIGIN}/other-repo/index.html`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'pass' });
    expect(planFetch(req(`${ORIGIN}${BASE}-evil/index.html`, { mode: 'navigate' }), ctx)).toEqual({ kind: 'pass' });
  });

  it('works with no basePath (dev / root deploy)', () => {
    expect(planFetch(req(`${ORIGIN}/watch?id=x`, { mode: 'navigate' }), { ...ctx, base: '' })).toEqual({ kind: 'page', fallback: 'watch.html' });
  });
});

describe('isThumbnailUrl / pageFor', () => {
  it('only matches a real VOD thumbnail path', () => {
    expect(isThumbnailUrl(THUMB)).toBe(true);
    expect(isThumbnailUrl(THUMB.replace('thumbnail.webp', 'subtitle.vtt'))).toBe(false);
    expect(isThumbnailUrl('not a url')).toBe(false);
  });
  it('maps paths to cached pages', () => {
    expect(pageFor('index.html', files)).toBe('index.html');
    expect(pageFor('watch.html', files)).toBe('watch.html');
    expect(pageFor('transcript', files)).toBe('404.html');
  });
});
