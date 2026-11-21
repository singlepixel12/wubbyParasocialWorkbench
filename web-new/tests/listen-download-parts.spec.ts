/**
 * A download bigger than one Background Fetch can hold, in real Chrome (Pixel 7 profile).
 *
 * Chrome's BackgroundFetchRegistration.matchAll() silently returns NO records above ~8,000
 * requests (measured 2026-11-21: OK at 8,500 and empty at 9,000 with a short URL). The worker reads
 * records with it, so a 12 h VOD (~10,850 runs) in one fetch downloaded 880 MB and saved nothing.
 * Downloads are now split into parts of at most 4,000 runs, one Background Fetch each.
 *
 * Fixture: `npm run fixtures:listen -- many` → e2e-many-runs.mp4 (10 min, 12,492 tiny audio runs,
 * ~10 MB, gitignored). Needs `npm run dev`. Reuses the archive-imitating range server.
 *
 * Chrome runs the parts one after another, not together (the later ones sit at 0 bytes until their
 * turn), which is why the watchdog judges a VOD by the sum of its parts.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's Android phone; docs/listen-mode-phone-checklist.md):
 * - a real 12 h VOD (~880 MB, ~2 h) completing with the phone locked
 * - Android showing one notification per part ("… (1/3)", "(2/3)", "(3/3)"), and that cancelling
 *   one part from its notification stops the whole VOD
 * - that Chrome on Android has the same matchAll() limit (measured on desktop Chrome)
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

// Chrome runs the parts one after another; 12,492 tiny local requests take ~70 s per part.
test.describe.configure({ mode: 'serial', timeout: 720_000 });

const FIXTURES = path.resolve(__dirname, 'fixtures/listen');
const PORT = 4325;
const MEDIA_URL = `http://localhost:${PORT}/e2e-many-runs.mp4`;
const HASH = 'c'.repeat(64);
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  server = spawn(process.execPath, [path.resolve(__dirname, 'support/range-server.mjs'), FIXTURES, String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${PORT}/ping`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});
test.afterAll(() => {
  server?.kill();
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-chrome', 'Background Fetch needs real Chrome');
  await page.route(/\/rest\/v1\/wubby_summary/, (route) =>
    route.fulfill({ json: [{ video_hash: HASH, video_url: MEDIA_URL, pleb_title: 'Many runs stream', summary: 's', tags: [], platform: 'twitch', upload_date: '2026-11-07T00:00:00Z' }] }),
  );
});

/**
 * The live parts of this VOD: their ids and download sizes. Deliberately not matchAll() from the
 * page: polling it on live parts left the last part hanging in Chrome. The worker's own
 * matchAll() is what gets proved, by every run ending up saved.
 */
const liveParts = (page: Page) =>
  page.evaluate(async (hash) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const bg = (reg as ServiceWorkerRegistration & { backgroundFetch?: { getIds(): Promise<string[]>; get(id: string): Promise<{ downloadTotal: number } | undefined> } })?.backgroundFetch;
    if (!bg) return [];
    const ids = (await bg.getIds()).filter((id) => id.startsWith(`listen:${hash}:`)).sort();
    return Promise.all(ids.map(async (id) => ({ id, bytes: (await bg.get(id))?.downloadTotal ?? 0 })));
  }, HASH);

const manifest = (page: Page) =>
  page.evaluate(
    (hash) =>
      new Promise<{ state: string; runCount: number; doneRuns: number; reason?: string } | null>((res) => {
        const q = indexedDB.open('wubby-listen');
        q.onsuccess = () => {
          const g = q.result.transaction('downloads').objectStore('downloads').get(hash);
          g.onsuccess = () => res(g.result ? { state: g.result.state, runCount: g.result.runCount, reason: g.result.reason, doneRuns: (g.result.done as Uint8Array).reduce((a, b) => a + b, 0) } : null);
        };
        q.onerror = () => res(null);
      }),
    HASH,
  );

test('a 12,492-run download runs as parts of at most 4,000, saves every run, then plays with zero network', async ({ page }) => {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  // 12,492 runs → 4 parts of ≤ 4,000 (as one fetch, Chrome's matchAll() would list none of them).
  await expect.poll(async () => (await liveParts(page)).length, { timeout: 90_000 }).toBe(4);
  const parts = await liveParts(page);
  expect(parts.map((p) => p.id.split('-').pop())).toEqual(['0', '1', '2', '3']);
  expect(parts.every((p) => p.bytes > 0)).toBe(true);

  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 540_000 });
  const m = await manifest(page);
  expect(m).toMatchObject({ state: 'ready', runCount: 12_492, doneRuns: 12_492 });

  let mediaRequests = 0;
  await page.route(MEDIA_URL, (route) => {
    mediaRequests++;
    return route.abort();
  });
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLAudioElement>('audio[data-testid="listen-audio"]')?.currentTime ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(2);
  await expect(page.getByText(/playing from your phone/i)).toBeVisible();
  expect(mediaRequests).toBe(0);
});

test('cancel stops every part and keeps what they finished; Resume completes it', async ({ page }) => {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect.poll(async () => (await liveParts(page)).length, { timeout: 90_000 }).toBe(4);
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /cancel download/i }).click();
  await expect.poll(async () => (await liveParts(page)).length, { timeout: 30_000 }).toBe(0); // all parts stopped
  await expect.poll(async () => (await manifest(page))?.state, { timeout: 30_000 }).toBe('paused');
  const kept = await manifest(page);
  expect(kept?.reason).toBe('cancelled');
  expect(kept!.doneRuns, 'runs kept after cancel').toBeGreaterThan(0);

  const resume = page.getByRole('button', { name: /resume download/i });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  await resume.click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 540_000 });
  expect(await manifest(page)).toMatchObject({ state: 'ready', doneRuns: 12_492 });
});
