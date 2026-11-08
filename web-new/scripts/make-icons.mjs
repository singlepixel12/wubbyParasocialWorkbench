// One-off: renders the app icons (public/icons/*.png) in Chromium with the real Fraunces font.
// Re-run only to change the icon: `node scripts/make-icons.mjs` (needs network for the font).
// The italic W is centred on its measured ink, not its text box (the italic overhangs).
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const SIZES = [
  { file: 'icon-192.png', size: 192, ink: 0.62 },
  { file: 'icon-512.png', size: 512, ink: 0.62 },
  // Maskable: Android crops to a circle/squircle, so the glyph stays well inside the 80% safe zone.
  { file: 'maskable-512.png', size: 512, ink: 0.48 },
  { file: 'apple-touch-icon.png', size: 180, ink: 0.6 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,600&display=block" rel="stylesheet"><p style="font-family:Fraunces;font-style:italic;font-weight:600">W</p>`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.load('italic 600 100px Fraunces'));
for (const { file, size, ink } of SIZES) {
  const dataUrl = await page.evaluate(({ size, ink }) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0e0d0b';
    ctx.fillRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size * 0.42, size * 0.62);
    g.addColorStop(0, 'hsla(142, 38%, 45%, 0.22)');
    g.addColorStop(1, 'hsla(142, 38%, 45%, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const measure = (px) => {
      ctx.font = `italic 600 ${px}px Fraunces`;
      return ctx.measureText('W');
    };
    let m = measure(100);
    const px = (100 * ink * size) / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    m = measure(px);
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    ctx.fillStyle = 'hsl(142, 38%, 52%)';
    ctx.fillText('W', (size - w) / 2 + m.actualBoundingBoxLeft, (size - h) / 2 + m.actualBoundingBoxAscent);
    return c.toDataURL('image/png');
  }, { size, ink });
  writeFileSync(`public/icons/${file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', file);
}
await browser.close();
