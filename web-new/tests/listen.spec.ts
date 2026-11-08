/**
 * Listen mode on the phone profile (Pixel 7).
 *
 * Needs: `npm run dev` on :3000 and `npm run fixtures:listen -- e2e` run once.
 * Starts its own range server on :4320 that behaves like archive.wubby.tv (206 ranges, CORS *
 * without exposed headers, multi-range refused, preflight refused). Supabase is stubbed so
 * /watch?id=… plays the fixture.
 *
 * WHAT THIS FILE CANNOT COVER (Lee checks on his Android phone; see docs/listen-mode-phone-checklist.md):
 * - audio continuing with the screen locked for 10+ minutes, and with Chrome in the background
 * - the lock-screen / notification controls: title, thumbnail, play/pause, ±30 s, and a seek bar
 *   that moves at the right speed at 1.5×
 * - 1.5× surviving a pause/resume from the lock screen
 * - real mobile data use (Android Settings → Data usage) and real dropouts walking out of signal
 * - how it feels: tap targets with a thumb, legibility outdoors, "Reconnecting…" reading as calm, not broken
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = path.resolve(__dirname, 'fixtures/listen');
const LAYOUT_FILE = path.join(FIXTURES, 'e2e-12min.layout.json');
const PORT = 4320;
const MEDIA_URL = `http://localhost:${PORT}/e2e-12min.mp4`;
const HASH = 'e'.repeat(64);

interface Layout {
  boxes: { type: string; start: number; size: number }[];
  runs: [number, number][];
  audioBytes: number;
}
let layout: Layout;
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  if (!fs.existsSync(LAYOUT_FILE)) throw new Error('Run `npm run fixtures:listen -- e2e` first');
  layout = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf8'));
  server = spawn(process.execPath, [path.resolve(__dirname, 'support/range-server.mjs'), FIXTURES, String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${PORT}/ping`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('range server did not start');
});
test.afterAll(() => {
  server?.kill();
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel', 'Listen mode is verified on the phone profile');
  await page.route(/\/rest\/v1\/wubby_summary\?video_hash=eq\./, (route) =>
    route.fulfill({
      json: [{ video_hash: HASH, video_url: MEDIA_URL, pleb_title: 'Fixture stream', summary: 'A test stream.', tags: ['test'], platform: 'twitch', upload_date: '2026-11-07T00:00:00Z' }],
    }),
  );
});

const parseRange = (header: string | undefined): [number, number] | null => {
  const m = header ? /^bytes=(\d+)-(\d+)$/.exec(header) : null;
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const moov = () => layout.boxes.find((b) => b.type === 'moov')!;
const isIndexRead = ([s, e]: [number, number]) =>
  (e - s === 15 && layout.boxes.some((b) => b.start === s)) || (s >= moov().start && e < moov().start + moov().size);
const insideAudioRun = ([s, e]: [number, number]) => layout.runs.some(([o, n]) => s >= o && e < o + n);
const isAudioRunStart = (header: string | undefined) => {
  const r = parseRange(header);
  return !!r && layout.runs.some(([o]) => o === r[0]);
};

async function audio(page: Page) {
  return page.evaluate(() => {
    const a = document.querySelector<HTMLAudioElement>('audio[data-testid="listen-audio"]');
    if (!a) return null;
    let ahead = 0;
    for (let i = 0; i < a.buffered.length; i++) if (a.buffered.start(i) <= a.currentTime && a.currentTime < a.buffered.end(i)) ahead = a.buffered.end(i) - a.currentTime;
    return { t: a.currentTime, rate: a.playbackRate, ahead };
  });
}
async function openAndListen(page: Page) {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(async () => (await audio(page))?.t ?? 0, { timeout: 30_000 }).toBeGreaterThan(1);
}
async function seek(page: Page, sec: number) {
  await page.getByRole('slider', { name: 'Seek' }).fill(String(sec));
}

test('Listen streams audio only and never touches video bytes', async ({ page }) => {
  const headers: (string | undefined)[] = [];
  page.on('request', (req) => {
    // Listen's own requests are fetch(); the video player's <video> requests are 'media' and not Listen's.
    if (req.url().startsWith(MEDIA_URL) && req.resourceType() === 'fetch') headers.push(req.headers()['range']);
  });
  await openAndListen(page);
  await page.waitForTimeout(5_000); // let the 3-minute read-ahead fill

  const ranges = headers.map(parseRange);
  expect(ranges.every(Boolean), `unbounded request among ${JSON.stringify(headers)}`).toBe(true);
  const audioRanges = (ranges as [number, number][]).filter((r) => !isIndexRead(r));
  expect(audioRanges.length).toBeGreaterThan(5);
  for (const r of audioRanges) expect(insideAudioRun(r), `range ${r} touches video bytes`).toBe(true);

  const fetched = audioRanges.reduce((a, [s, e]) => a + e - s + 1, 0);
  const fileSize = layout.boxes.at(-1)!.start + layout.boxes.at(-1)!.size;
  expect(fetched).toBeLessThan(layout.audioBytes * (200 / 720) * 1.2); // ≈ read-ahead window + slack
  expect(fetched).toBeLessThan(fileSize / 10);
});

test('1.5× sticks and Listen resumes where it stopped', async ({ page }) => {
  await openAndListen(page);
  await page.getByRole('button', { name: /Speed 1×/ }).click();
  await expect.poll(async () => (await audio(page))?.rate).toBe(1.5);
  await seek(page, 240);
  await expect.poll(async () => (await audio(page))?.t ?? 0, { timeout: 20_000 }).toBeGreaterThan(241);
  await page.waitForTimeout(6_000); // positions are saved every 5 s
  await page.reload();
  await expect(page.getByRole('button', { name: /^Listen.*from 4:/ })).toBeVisible();
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(async () => (await audio(page))?.t ?? 0, { timeout: 30_000 }).toBeGreaterThan(236);
  expect((await audio(page))?.rate).toBe(1.5);
});

test('Watch picks up at the time Listen reached', async ({ page }) => {
  await openAndListen(page);
  await seek(page, 300);
  await expect.poll(async () => (await audio(page))?.t ?? 0, { timeout: 20_000 }).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Watch' }).click();
  await expect(page.locator('audio[data-testid="listen-audio"]')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('media-player video')?.currentTime ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(295);
});

test('a dropout plays on from the buffer, shows Reconnecting…, and recovers', async ({ page, context }) => {
  await openAndListen(page);
  await expect.poll(async () => (await audio(page))?.ahead ?? 0, { timeout: 30_000 }).toBeGreaterThan(30);
  await context.setOffline(true);
  const before = (await audio(page))!.t;
  await page.waitForTimeout(5_000);
  expect((await audio(page))!.t).toBeGreaterThan(before + 3); // still playing from the buffer
  await seek(page, 600); // past the buffer while offline
  await expect(page.getByText('Reconnecting…')).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
  await expect.poll(async () => (await audio(page))?.t ?? 0, { timeout: 45_000 }).toBeGreaterThan(601);
  await expect(page.getByText('Reconnecting…')).toHaveCount(0);
});

test('server errors on audio runs are retried, not fatal', async ({ page }) => {
  let failures = 0;
  await page.route(MEDIA_URL, async (route) => {
    if (isAudioRunStart(route.request().headers()['range']) && failures < 3) {
      failures++;
      return route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'busy' });
    }
    return route.continue();
  });
  await openAndListen(page);
  expect(failures).toBe(3);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('a whole-file answer stops Listen instead of downloading the video', async ({ page }) => {
  await page.route(MEDIA_URL, async (route) => {
    if (isAudioRunStart(route.request().headers()['range'])) {
      return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'video/mp4' }, body: Buffer.alloc(1024) });
    }
    return route.continue();
  });
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect(page.getByText(/didn't send just the audio/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Watch' })).toBeVisible();
});
