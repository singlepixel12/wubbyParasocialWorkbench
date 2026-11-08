/**
 * Background downloads on real Chrome (Pixel 7 profile). Needs `npm run dev` and the e2e fixture
 * (`npm run fixtures:listen -- e2e`, 179 audio runs). Reuses the archive-imitating range server.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's Android phone; docs/listen-mode-phone-checklist.md):
 * - that the download keeps going with the screen locked, Chrome closed, or the phone rebooted
 * - Android's download notification: title, thumbnail, progress, cancel from the notification
 * - behaviour on mobile data vs Wi-Fi, and real storage freed after Delete (Settings → Apps → Chrome)
 * - a real ~55 min, 430 MB download completing on home Wi-Fi
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const FIXTURES = path.resolve(__dirname, 'fixtures/listen');
const PORT = 4320;
const MEDIA_URL = `http://localhost:${PORT}/e2e-12min.mp4`;
const HASH = 'd'.repeat(64);
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
    route.fulfill({ json: [{ video_hash: HASH, video_url: MEDIA_URL, pleb_title: 'Fixture stream', summary: 's', tags: [], platform: 'twitch', upload_date: '2026-11-07T00:00:00Z' }] }),
  );
});

async function downloadToReady(page: Page) {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 180_000 });
}

test('downloads in the background, then Listen plays with zero network', async ({ page }) => {
  await downloadToReady(page);
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

test('cancel keeps what finished; resume completes it', async ({ page }) => {
  // Slow every audio run down so there's time to cancel mid-download.
  await page.context().route(MEDIA_URL, async (route) => {
    await new Promise((r) => setTimeout(r, 150));
    return route.continue();
  });
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  const cancel = page.getByRole('button', { name: /cancel download/i });
  await expect(cancel).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  await cancel.click();
  const resume = page.getByRole('button', { name: /resume download/i });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  // What finished before the cancel was kept, not thrown away.
  const kept = Number(/(\d+)% saved/.exec((await resume.getAttribute('aria-label')) ?? '')?.[1] ?? 0);
  expect(kept, 'percent kept after cancel').toBeGreaterThan(0);
  await page.context().unrouteAll({ behavior: 'ignoreErrors' });
  await resume.click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 180_000 });
});

test('the diary chip counts the download and the sheet deletes it', async ({ page }) => {
  await downloadToReady(page);
  await page.route(/\/rest\/v1\/wubby_summary\?select=/, (route) => route.fulfill({ json: [], headers: { 'content-range': '*/0' } }));
  await page.goto('/');
  const chip = page.getByRole('button', { name: /1 offline/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await page.getByRole('button', { name: /delete fixture stream/i }).click();
  await expect(chip).toHaveCount(0);
});
