/**
 * Phase 3b, the installable offline app, against the PRODUCTION build (`npm run build` first):
 * out/ is served the way GitHub Pages serves it, under the real /wubbyParasocialWorkbench path,
 * because the worker only caches the app shell in a production build.
 *
 * Runs on `pixel-chrome` (Background Fetch needs real Chrome). Needs `npm run build` and
 * `npm run fixtures:listen -- e2e` once. No dev server.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's Android phone; docs/listen-mode-phone-checklist.md rows 20–24):
 * - installing to the home screen: Chrome's prompt, the icon, the splash, opening standalone
 * - airplane mode on a real phone, opened cold from the home screen after Chrome was killed
 * - picking up a new deploy: the old version keeps working, the next open runs the new one
 * - that the icon reads as "the Wubby Archive" among other apps
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

test.describe.configure({ mode: 'serial', timeout: 300_000 });

const SITE = 4370;
const MEDIA = 4371;
const BASE = `http://localhost:${SITE}/wubbyParasocialWorkbench`;
const HASH = 'e'.repeat(64);
const OTHER = '9'.repeat(64);
let servers: ChildProcess[] = [];

const row = (hash: string, title: string) => ({
  video_hash: hash,
  video_url: `http://localhost:${MEDIA}/e2e-12min.mp4`,
  pleb_title: title,
  summary: `${title}: a summary that only the API knows.`,
  tags: ['offline'],
  platform: 'twitch',
  upload_date: new Date().toISOString(),
});

async function waitUp(url: string) {
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`${url} did not come up`);
}

test.beforeAll(async () => {
  servers = [
    spawn(process.execPath, [path.resolve(__dirname, 'support/static-site.mjs'), path.resolve(__dirname, '../out'), String(SITE)], { stdio: 'ignore' }),
    spawn(process.execPath, [path.resolve(__dirname, 'support/range-server.mjs'), path.resolve(__dirname, 'fixtures/listen'), String(MEDIA)], { stdio: 'ignore' }),
  ];
  await waitUp(`${BASE}/`);
  await waitUp(`http://localhost:${MEDIA}/ping`);
});
test.afterAll(() => servers.forEach((s) => s.kill()));

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'pixel-chrome', 'Background Fetch and the installed-app checks need real Chrome');
  await page.route(/\/rest\/v1\/wubby_summary/, (route) => {
    const url = route.request().url();
    const rows = url.includes(OTHER) ? [row(OTHER, 'Not saved stream')] : url.includes(HASH) ? [row(HASH, 'Offline stream')] : [row(HASH, 'Offline stream'), row(OTHER, 'Not saved stream')];
    return route.fulfill({ json: rows, headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` } });
  });
});

async function shellReady(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const shell = names.find((n) => n.startsWith('shell-') && n !== 'shell-meta');
          return !!navigator.serviceWorker.controller && !!shell && (await (await caches.open(shell)).keys()).length > 50;
        }),
      { timeout: 60_000 },
    )
    .toBe(true);
}

const audioTime = (page: Page) => page.evaluate(() => document.querySelector<HTMLAudioElement>('audio[data-testid="listen-audio"]')?.currentTime ?? 0);

test('the production build is installable (manifest, icons, worker)', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await shellReady(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
  // Playwright contexts are incognito, where Chrome never installs; anything else is a real problem.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);
  const { url, errors } = (await cdp.send('Page.getAppManifest')) as { url: string; errors: unknown[] };
  expect(url).toBe(`${BASE}/manifest.webmanifest`);
  expect(errors).toEqual([]);
});

test('airplane mode: the app opens, the diary shows saved VODs, and Listen plays from the phone', async ({ page, context }) => {
  // Online: open a VOD, download it, and let the worker cache the app.
  await page.goto(`${BASE}/watch?id=${HASH}`);
  await shellReady(page);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 180_000 });

  // No network at all from here on.
  await context.setOffline(true);

  // The diary opens from the cache and lists what's saved on the phone.
  await page.goto(`${BASE}/`);
  await expect(page.getByRole('heading', { name: 'Saved on your phone' })).toBeVisible({ timeout: 30_000 });
  const card = page.getByRole('link', { name: 'Play Offline stream' });
  await expect(card).toBeVisible();
  await expect(page.getByText('Not saved stream')).toHaveCount(0);

  // The card opens /watch (cached page + saved summary), and Listen plays with zero network.
  const href = await card.getAttribute('href');
  await page.goto(new URL(href!, `${BASE}/`).href.replace('/wubbyParasocialWorkbench/wubbyParasocialWorkbench', '/wubbyParasocialWorkbench'));
  await expect(page.getByRole('heading', { name: 'Offline stream' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/a summary that only the API knows/)).toBeVisible();
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(() => audioTime(page), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect(page.getByText(/playing from your phone/i)).toBeVisible();

  // A VOD that isn't saved says so, instead of loading forever.
  await page.goto(`${BASE}/watch?id=${OTHER}`);
  await expect(page.getByRole('heading', { name: /you.re offline/i })).toBeVisible({ timeout: 30_000 });

  // Back online, the live diary returns.
  await context.setOffline(false);
  await page.goto(`${BASE}/`);
  await expect(page.getByText('Not saved stream').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Saved on your phone' })).toHaveCount(0);
});

test('the worker never touches a Range request (the 206 blank-tab incident)', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await shellReady(page);
  const result = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/watch.html`, { headers: { Range: 'bytes=0-63' } });
    const cached = await caches.match(`${base}/watch.html`);
    return { status: r.status, fromWorker: r.headers.get('content-length'), cachedOk: cached?.status, cachedLen: (await cached?.text())?.length ?? 0 };
  }, BASE);
  // Our static server ignores Range (answers 200 with the whole page); what matters is that the
  // cached copy is a complete 200 page, never a 64-byte fragment.
  expect(result.cachedOk).toBe(200);
  expect(result.cachedLen).toBeGreaterThan(1000);
});
