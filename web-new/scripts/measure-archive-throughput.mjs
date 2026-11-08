// Measures how fast real Chrome can pull audio runs from archive.wubby.tv, from the site's origin,
// at several concurrency levels. Uses the production lib/listen code, bundled with esbuild.
// usage: node scripts/measure-archive-throughput.mjs <vod-mp4-url> [runsPerLevel=48]
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const url = process.argv[2];
const perLevel = Number(process.argv[3] ?? 48);
if (!url) throw new Error('usage: node scripts/measure-archive-throughput.mjs <vod-mp4-url> [runsPerLevel]');

const bundle = await build({ entryPoints: ['lib/listen/measure-entry.ts'], bundle: true, format: 'iife', globalName: 'ListenLib', write: false, platform: 'browser' });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('https://singlepixel12.github.io/wubbyParasocialWorkbench/');
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const result = await page.evaluate(async ({ url, perLevel }) => {
  const { loadAudioIndex, fetchRange, mapLimit } = window.ListenLib;
  const t0 = performance.now();
  const index = await loadAudioIndex(url, {});
  const indexSec = (performance.now() - t0) / 1000;
  const levels = [];
  for (const [i, concurrency] of [6, 12, 24].entries()) {
    const runs = Array.from({ length: perLevel }, (_, k) => 1000 + i * perLevel * 3 + k * 3); // spread out, uncached
    const start = performance.now();
    let bytes = 0;
    await mapLimit(runs, concurrency, async (r) => {
      const off = index.runOffset[r];
      const { bytes: b } = await fetchRange(url, off, off + index.runSize[r] - 1, { expectedLastModified: index.lastModified });
      bytes += b.byteLength;
    });
    const sec = (performance.now() - start) / 1000;
    const runsPerSec = perLevel / sec;
    levels.push({ concurrency, runsPerSec: +runsPerSec.toFixed(2), MBps: +(bytes / 1e6 / sec).toFixed(2), fullDownloadMin: +(index.runFirst.length / runsPerSec / 60).toFixed(1) });
  }
  const protocol = performance.getEntriesByType('resource').find((e) => e.name.includes('archive.wubby.tv'))?.nextHopProtocol || 'not exposed';
  return { indexSec: +indexSec.toFixed(1), runs: index.runFirst.length, hours: +(index.durationSec / 3600).toFixed(2), protocol, levels };
}, { url, perLevel });

console.log(JSON.stringify(result, null, 2));
await browser.close();
