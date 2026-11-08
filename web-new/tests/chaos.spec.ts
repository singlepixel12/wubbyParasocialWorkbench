/**
 * Every network path, under a flaky mobile network.
 *
 * tests/support/chaos-proxy.mjs sits between the browser and the archive imitation and injects
 * what phones really see:
 * - connection resets, before the response and mid-body;
 * - 25 s stalls, longer than our 15 s idle timeout;
 * - 503 and 429 responses;
 * - 1–3 s of latency;
 * - full outages.
 * It's seeded, so a failure reproduces. The Supabase API is stubbed per test with dropped requests
 * and outages. Listen and API tests run on `pixel`; download tests run on `pixel-chrome`, because
 * Background Fetch needs real Chrome.
 *
 * Needs `npm run dev` on :3000 and `npm run fixtures:listen -- e2e` once.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's Android phone; docs/listen-mode-phone-checklist.md):
 * - real radio behaviour: cell handover, Wi-Fi ↔ 4G switches, captive portals, Android's
 *   own network-loss handling of Background Fetch, which may pause instead of fail
 * - that the retry/backoff *feels* right: whether "Reconnecting…" or "trying again" reads as
 *   calm, and how long a real gap goes before audio stops
 * - battery and data cost of retries over hours
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

// Retries, backoff and Chrome's own background-fetch retries take real time (a flaky download
// measured ~3.5 min), so each test gets 6 minutes.
test.describe.configure({ mode: 'serial', timeout: 360_000 });

const FIXTURES = path.resolve(__dirname, 'fixtures/listen');
let ORIGIN = 0;
let PROXY = 0;
let servers: ChildProcess[] = [];
const media = () => `http://localhost:${PROXY}/e2e-12min.mp4`;
const HASH = 'f'.repeat(64);
const row = () => ({ video_hash: HASH, video_url: media(), pleb_title: 'Chaos stream', summary: 'A flaky stream.', tags: [], platform: 'twitch', upload_date: '2026-11-07T00:00:00Z' });

async function waitUp(port: number) {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${port}/__chaos/stats`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`port ${port} did not come up`);
}
const chaos = (profile: string) => fetch(`http://localhost:${PROXY}/__chaos?profile=${profile}`);
const faults = async () => (await (await fetch(`http://localhost:${PROXY}/__chaos/stats`)).json()) as { requests: number; faults: Record<string, number> };

test.beforeAll(async ({}, testInfo) => {
  // Own ports per project so pixel and pixel-chrome can run side by side.
  const base = testInfo.project.name === 'pixel-chrome' ? 4360 : 4350;
  ORIGIN = base;
  PROXY = base + 1;
  servers = [
    spawn(process.execPath, [path.resolve(__dirname, 'support/range-server.mjs'), FIXTURES, String(ORIGIN)], { stdio: 'ignore' }),
    spawn(process.execPath, [path.resolve(__dirname, 'support/chaos-proxy.mjs'), String(PROXY), String(ORIGIN), 'clean', '42'], { stdio: 'ignore' }),
  ];
  await waitUp(PROXY);
});
test.afterAll(() => servers.forEach((s) => s.kill()));

const onPixel = (name: string) => test.skip(name !== 'pixel', 'Listen and API chaos run on the phone profile');
const onChrome = (name: string) => test.skip(name !== 'pixel-chrome', 'Background Fetch chaos needs real Chrome');

async function stubApi(page: Page, plan: { dropFirst?: number; downUntil?: () => boolean } = {}) {
  let n = 0;
  await page.route(/\/rest\/v1\/wubby_summary/, (route) => {
    n++;
    if ((plan.dropFirst && n <= plan.dropFirst) || plan.downUntil?.()) return route.abort('connectionreset');
    return route.fulfill({ json: [row()], headers: { 'content-range': '0-0/1' } });
  });
  return () => n;
}
const audioTime = (page: Page) => page.evaluate(() => document.querySelector<HTMLAudioElement>('audio[data-testid="listen-audio"]')?.currentTime ?? 0);
const FATAL = /Listen stopped|didn't send just the audio|answered with an error|no longer on the archive|unexpected error/i;

async function listenThroughSeeks(page: Page, coldStartMs = 90_000) {
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /^Listen/ }).click(); // cold: the audio index also loads through chaos
  await expect.poll(() => audioTime(page), { timeout: coldStartMs }).toBeGreaterThan(10);
  for (const to of [300, 600]) {
    await page.getByRole('slider', { name: 'Seek' }).fill(String(to));
    await expect.poll(() => audioTime(page), { timeout: 90_000 }).toBeGreaterThan(to + 8);
  }
  await expect(page.getByText(FATAL)).toHaveCount(0);
}

test('Listen plays through a flaky network (resets, stalls, 503s, latency) with seeks', async ({ page }, info) => {
  onPixel(info.project.name);
  await stubApi(page);
  const before = await faults();
  await chaos('flaky');
  await listenThroughSeeks(page);
  const after = await faults();
  expect(after.requests - before.requests).toBeGreaterThan(20);
  expect(Object.values(after.faults).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(before.faults).reduce((a, b) => a + b, 0));
});

test('Listen plays through a brutal network (about half of requests fail), cold start included', async ({ page }, info) => {
  onPixel(info.project.name);
  await stubApi(page);
  await chaos('brutal');
  // A cold start can meet several 15 s stalls in a row when half of all requests fail.
  await listenThroughSeeks(page, 150_000);
});

test('Listen recovers on its own from a 30 s total outage (no taps)', async ({ page }, info) => {
  onPixel(info.project.name);
  await stubApi(page);
  await chaos('clean');
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(() => audioTime(page), { timeout: 30_000 }).toBeGreaterThan(2);
  await chaos('offline');
  await page.getByRole('slider', { name: 'Seek' }).fill('500'); // past the buffer, into the outage
  await expect(page.getByText(/reconnecting|trying again/i)).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(30_000);
  await chaos('clean');
  await expect.poll(() => audioTime(page), { timeout: 60_000 }).toBeGreaterThan(505); // nobody tapped Retry
  await expect(page.getByText(FATAL)).toHaveCount(0);
});

test('watch page loads when the API drops its first two requests', async ({ page }, info) => {
  onPixel(info.project.name);
  const calls = await stubApi(page, { dropFirst: 2 });
  await page.goto(`/watch?id=${HASH}`);
  await expect(page.getByRole('heading', { name: 'Chaos stream' })).toBeVisible({ timeout: 30_000 });
  expect(calls()).toBeGreaterThanOrEqual(3);
});

test('diary loads when the API drops its first two requests (no error toast)', async ({ page }, info) => {
  onPixel(info.project.name);
  await stubApi(page, { dropFirst: 2 });
  await page.goto('/');
  await expect(page.getByText('Chaos stream').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/failed to load/i)).toHaveCount(0);
});

test('a full API outage shows "Connection problem" with Retry, and Retry recovers', async ({ page }, info) => {
  onPixel(info.project.name);
  let down = true;
  await stubApi(page, { downUntil: () => down });
  await page.goto(`/watch?id=${HASH}`);
  await expect(page.getByRole('heading', { name: /connection problem/i })).toBeVisible({ timeout: 60_000 });
  down = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Chaos stream' })).toBeVisible({ timeout: 30_000 });
});

test('a download on a flaky network completes by auto-resuming, then plays with zero network', async ({ page }, info) => {
  onChrome(info.project.name);
  await stubApi(page);
  await chaos('flaky');
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 300_000 });
  await chaos('offline'); // prove playback needs no network at all
  await page.getByRole('button', { name: /^Listen/ }).click();
  await expect.poll(() => audioTime(page), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect(page.getByText(/playing from your phone/i)).toBeVisible();
});

test('a download survives a 30 s outage in the middle and finishes when the network returns', async ({ page }, info) => {
  onChrome(info.project.name);
  await stubApi(page);
  await chaos('clean');
  await page.goto(`/watch?id=${HASH}`);
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByRole('button', { name: /cancel download/i })).toBeVisible({ timeout: 60_000 });
  await chaos('offline');
  // Chrome holds the round and keeps retrying (or the round fails and we auto-resume): nothing is
  // lost, and it must not claim to be finished.
  await page.waitForTimeout(30_000);
  await expect(page.getByText(/saved offline/i)).toHaveCount(0);
  await chaos('clean');
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 240_000 });
});

test('Download tapped during a 30 s outage still finishes once the network returns', async ({ page }, info) => {
  onChrome(info.project.name);
  await stubApi(page);
  await chaos('clean');
  await page.goto(`/watch?id=${HASH}`);
  await chaos('offline');
  await page.getByRole('button', { name: 'Download for offline' }).click(); // the audio index load retries through it
  await page.waitForTimeout(30_000);
  await chaos('clean');
  await expect(page.getByText(/saved offline/i)).toBeVisible({ timeout: 240_000 });
});
