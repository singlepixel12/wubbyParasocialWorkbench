# Listen Mode — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/watch`, a full-width **Listen** button streams only the audio of a multi-GB VOD MP4 (≈73 MB/h instead of ≈4.5 GB/h). It keeps playing with an Android phone locked, has lock-screen controls and a 1×↔1.5× toggle, and resumes where you stopped.

**Architecture:** Everything is client-side under `web-new/lib/listen/`, with no server change. We read the remote MP4's `moov` box by HTTP Range, parse only the audio track into an *AudioIndex* (byte-contiguous "runs" of AAC samples), and cache it in IndexedDB. Then we fetch audio runs by Range as playback needs them, wrap each run as a fragmented-MP4 segment (no re-encoding), and append it to a `MediaSource` attached to a real `<audio>` element. Our own `range-fetch` owns all HTTP (retries, timeouts, validation), and every request is a bounded Range.

**Tech Stack:** Next.js 16 static export, React 19 (React Compiler), TypeScript 5.9, Tailwind 4, Vitest + jsdom + `fake-indexeddb`, Playwright (`Pixel 7` project), ffmpeg/ffprobe (fixtures only), Media Source Extensions, Media Session API.

**Spec:** `docs/superpowers/specs/2026-11-08-listen-mode-design.md`. Read its *Failure handling* and *Hard constraint* sections before starting.

---

## Facts this plan relies on (all verified 2026-11-08)

- **The real VOD** (`archive.wubby.tv/vods/public/nov_2026/6_no-title_1794002258_000.mp4`):
  - Layout: `ftyp` → `mdat` (27 GB) → `moov` (23.6 MB) at the **end**.
  - Audio: AAC-LC, 48 kHz stereo, 162 kbps; 997,035 samples in 5,340 byte-contiguous runs (~4 s each), 430.8 MB in total.
  - The largest audio sample is 1,449 bytes, so sizes fit `Uint16Array`.
- **CORS from the site:**
  - `Range` works; status 206 is readable.
  - The **only readable response headers** are `cache-control`, `content-length`, `content-type` and `last-modified`. `Content-Range` and `ETag` are unreadable.
  - `If-Range` triggers a preflight the server rejects, so **never send it**.
  - Multi-range requests get **416**.
- **The prototype of the parser and fMP4 writer** in this plan was run:
  - It matched `ffprobe` sample offsets, sizes and durations exactly on moov-at-end and faststart files.
  - Its output played through MSE in Playwright Chromium and real Chrome (single buffered range, 1.5×, seek, no errors).
  - It parses the real 23.6 MB `moov` in 67 ms, so no worker is needed.

## File structure

```
web-new/
  lib/listen/
    types.ts            AudioIndex, ListenError, PlaybackRate, Bytes
    boxes.ts            ISO-BMFF box header reading/walking
    mp4-index.ts        parseAudioTrack(moov) -> AudioIndex; sampleDurations; sampleOffsets
    fmp4.ts             buildInitSegment / buildMediaSegment / buildRunSegment
    range-fetch.ts      fetchRange: the only audio HTTP; retries, idle timeout, validation
    concurrency.ts      mapLimit
    index-loader.ts     locateMoov + loadAudioIndex (moov in 1 MiB pieces, progress)
    index-cache.ts      IndexedDB cache of AudioIndex (10 most recent)
    positions.ts        per-VOD position + global speed in localStorage, formatClock
    useSavedPosition.ts useSyncExternalStore hook over positions
    buffer-planner.ts   pure: which runs to fetch / evict
    media-session.ts    lock-screen metadata + actions + position state
    listen-engine.ts    owns <audio> + MediaSource; buffering, seeking, failures, cleanup
    measure-entry.ts    bundle entry for the throughput script
  components/listen/
    ListenButton.tsx  SpeedToggle.tsx  AudioCard.tsx  ResumeMarker.tsx
  components/video/VidstackPlayer.tsx     (modify: pin CDN, startTime, playbackRate, onTimeUpdate)
  components/video/VideoDetailView.tsx    (modify: layout, Listen/Watch switching)
  components/Header.tsx                   (modify: back arrow on /watch)
  components/vod-diary/VideoCard.tsx      (modify: resume marker)
  scripts/make-listen-fixtures.mjs  scripts/measure-archive-throughput.mjs
  tests/fixtures/listen/  (tiny*.mp4 committed; e2e-12min.* generated, gitignored)
  tests/support/range-server.mjs
  tests/unit/listen/*.test.ts  tests/unit/Header.test.tsx  tests/unit/VidstackPlayer.test.tsx
  tests/listen.spec.ts
  playwright.config.ts  package.json  .gitignore
docs/listen-mode-phone-checklist.md
CLAUDE.md
```

Every file under `lib/listen/` imports its siblings **relatively** (`./types`), never via `@/`, so `measure-entry.ts` can be bundled by esbuild without the path alias.

All commands run from `web-new/` unless stated. Unit tests: `npx vitest run <file>`. Type check: `npx tsc --noEmit`, which must stay at 0 errors because `next build` type-checks test files.

---

### Task 1: Mobile-first test setup

**Files:**
- Modify: `web-new/playwright.config.ts` (projects array)
- Modify: `web-new/package.json` (scripts, devDependencies)
- Modify: `web-new/.gitignore`

- [ ] **Step 1: Add the `pixel` Playwright project first in the list**

In `playwright.config.ts`, make the first entry of `projects`:

```ts
    // Lee's main device is an Android phone in Chrome: verify here first.
    {
      name: 'pixel',
      use: { ...devices['Pixel 7'] },
    },
```

- [ ] **Step 2: Add scripts and the IndexedDB test double**

In `package.json` `"scripts"` add:

```json
    "test:e2e:mobile": "playwright test --project=pixel",
    "fixtures:listen": "node scripts/make-listen-fixtures.mjs",
    "measure:archive": "node scripts/measure-archive-throughput.mjs"
```

Run: `npm install --save-dev fake-indexeddb@^6.2.7`
Expected: `fake-indexeddb` appears in `devDependencies`.

- [ ] **Step 3: Ignore the large generated E2E fixture**

Append to `web-new/.gitignore`:

```
# Listen-mode E2E fixture (generated by `npm run fixtures:listen`, ~190 MB)
/tests/fixtures/listen/e2e-*
```

- [ ] **Step 4: Verify config still loads**

Run: `npx playwright test --list --project=pixel tests/smoke.spec.ts`
Expected: lists tests under `[pixel]`, no config error.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts package.json package-lock.json .gitignore
git commit -m "test: add Pixel 7 Playwright project and Listen fixture scripts"
```

---

### Task 2: Pin the Vidstack CDN version

`VidstackPlayer.tsx:466-492` loads `cdn.jsdelivr.net/npm/vidstack/...` with no version, so the player can change under us. jsdelivr currently resolves it to 0.6.15.

**Files:**
- Modify: `web-new/components/video/VidstackPlayer.tsx:459-502`
- Test: `web-new/tests/unit/VidstackPlayer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/VidstackPlayer.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { VidstackPlayer, VIDSTACK_CDN } from '@/components/video/VidstackPlayer';

describe('VidstackPlayer CDN assets', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link, script').forEach((el) => el.remove());
  });

  it('pins an exact Vidstack version', () => {
    expect(VIDSTACK_CDN).toBe('https://cdn.jsdelivr.net/npm/vidstack@0.6.15');
  });

  it('loads the pinned CSS and JS', () => {
    render(<VidstackPlayer videoUrl="https://example.com/v.mp4" />);
    expect(document.head.querySelector(`link[href="${VIDSTACK_CDN}/styles/defaults.css"]`)).not.toBeNull();
    expect(document.head.querySelector(`link[href="${VIDSTACK_CDN}/styles/community-skin/video.css"]`)).not.toBeNull();
    expect(document.head.querySelector(`script[src="${VIDSTACK_CDN}/dist/cdn/prod.js"]`)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`VIDSTACK_CDN` is not exported)

Run: `npx vitest run tests/unit/VidstackPlayer.test.tsx`

- [ ] **Step 3: Implement**

Below the imports in `VidstackPlayer.tsx` add:

```ts
/** Pinned: an unversioned CDN URL let the player change under us. Bump deliberately. */
export const VIDSTACK_CDN = 'https://cdn.jsdelivr.net/npm/vidstack@0.6.15';
```

In the "Load Vidstack CSS and JS from CDN" effect replace the three selectors and three URLs:

```ts
    const existingDefaultsCSS = document.querySelector(`link[href="${VIDSTACK_CDN}/styles/defaults.css"]`);
    const existingSkinCSS = document.querySelector(`link[href="${VIDSTACK_CDN}/styles/community-skin/video.css"]`);
    const existingScript = document.querySelector(`script[src="${VIDSTACK_CDN}/dist/cdn/prod.js"]`);
```

```ts
      defaultsLink.href = `${VIDSTACK_CDN}/styles/defaults.css`;
```

```ts
      skinLink.href = `${VIDSTACK_CDN}/styles/community-skin/video.css`;
```

```ts
      script.src = `${VIDSTACK_CDN}/dist/cdn/prod.js`;
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/unit/VidstackPlayer.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/video/VidstackPlayer.tsx tests/unit/VidstackPlayer.test.tsx
git commit -m "fix: pin the Vidstack CDN to 0.6.15"
```

---

### Task 3: Test fixtures (ffmpeg) and the range server

**Files:**
- Create: `web-new/scripts/make-listen-fixtures.mjs`
- Create: `web-new/tests/support/range-server.mjs`
- Create (generated, committed): `web-new/tests/fixtures/listen/tiny.mp4`, `tiny-faststart.mp4`, `tiny-noaudio.mp4`, `tiny.audio-packets.json`

- [ ] **Step 1: Write the fixture generator**

```js
// scripts/make-listen-fixtures.mjs
// Generates Listen-mode fixtures with ffmpeg + ffprobe (both on PATH).
//   node scripts/make-listen-fixtures.mjs        -> tiny (committed) + e2e (gitignored)
//   node scripts/make-listen-fixtures.mjs tiny   -> tiny only
//   node scripts/make-listen-fixtures.mjs e2e    -> e2e only
// tiny*.mp4 mirror the real VODs' layout: moov at the END (ffmpeg's default), H.264 + AAC-LC 48 kHz stereo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('tests/fixtures/listen');
fs.mkdirSync(dir, { recursive: true });
const at = (f) => path.join(dir, f);
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const audioPackets = (file) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'packet=pos,size,duration', '-of', 'json', file]).toString(),
  ).packets.map((p) => ({ pos: Number(p.pos), size: Number(p.size), duration: Number(p.duration) }));
const only = process.argv[2];

if (only !== 'e2e') {
  ff('-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '12', '-c:v', 'libx264', '-b:v', '100k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', at('tiny.mp4'));
  ff('-i', at('tiny.mp4'), '-c', 'copy', '-movflags', '+faststart', at('tiny-faststart.mp4'));
  ff('-i', at('tiny.mp4'), '-c', 'copy', '-an', at('tiny-noaudio.mp4'));
  fs.writeFileSync(at('tiny.audio-packets.json'), JSON.stringify(audioPackets(at('tiny.mp4'))));
  console.log('tiny fixtures written');
}

if (only !== 'tiny') {
  const out = at('e2e-12min.mp4');
  if (!fs.existsSync(out)) {
    ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000',
      '-t', '720', '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '2M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-ac', '2', out);
  }
  // Byte layout the E2E test checks every request against.
  const buf = fs.readFileSync(out);
  const boxes = [];
  for (let o = 0; o < buf.length; ) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(o + 8));
    boxes.push({ type, start: o, size });
    o += size;
  }
  const runs = [];
  for (const p of audioPackets(out)) {
    const last = runs.at(-1);
    if (last && last[0] + last[1] === p.pos) last[1] += p.size;
    else runs.push([p.pos, p.size]);
  }
  fs.writeFileSync(at('e2e-12min.layout.json'), JSON.stringify({ boxes, runs, audioBytes: runs.reduce((a, r) => a + r[1], 0) }));
  console.log(`e2e fixture: ${(buf.length / 1e6).toFixed(0)} MB, ${runs.length} audio runs`);
}
```

- [ ] **Step 2: Write the range server that behaves like archive.wubby.tv**

```js
// tests/support/range-server.mjs
// Static server that imitates archive.wubby.tv for Listen-mode tests:
//  - single closed Range -> 206 with Content-Length; multi/open-ended range -> 416
//  - Access-Control-Allow-Origin: * but NO Access-Control-Expose-Headers, so the page can read
//    only cache-control / content-length / content-type / last-modified
//  - preflight (OPTIONS) answers without CORS headers, so If-Range and friends fail like the real server
// usage: node tests/support/range-server.mjs <dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , rootArg, port = '4320'] = process.argv;
const root = path.resolve(rootArg);
const cors = { 'Access-Control-Allow-Origin': '*' };

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }
    const file = path.resolve(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, cors);
      return res.end();
    }
    const stat = fs.statSync(file);
    const headers = {
      ...cors,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'no-store',
    };
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    }
    const m = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!m || Number(m[1]) >= stat.size) {
      res.writeHead(416, { ...cors, 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    const start = Number(m[1]);
    const end = Math.min(Number(m[2]), stat.size - 1);
    res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
    fs.createReadStream(file, { start, end }).pipe(res);
  })
  .listen(Number(port), () => console.log(`range-server ${root} on :${port}`));
```

- [ ] **Step 3: Generate the tiny fixtures and check them**

Run: `npm run fixtures:listen -- tiny`
Expected: `tiny fixtures written`. Then:

Run: `node -e "const p=require('./tests/fixtures/listen/tiny.audio-packets.json'); console.log(p.length, p.at(-1))"`
Expected: about 564 packets; the last packet's `duration` is 512, not 1024. That gives the tests a multi-entry `stts` to exercise.

Run: `node -e "const b=require('fs').readFileSync('tests/fixtures/listen/tiny.mp4'); let o=0; while(o<b.length){let s=b.readUInt32BE(o); const t=b.toString('latin1',o+4,o+8); if(s===1)s=Number(b.readBigUInt64BE(o+8)); console.log(t); o+=s;}"`
Expected: `ftyp`, (`free`), `mdat`, `moov`, in that order. **moov last.**

- [ ] **Step 4: Commit**

```bash
git add scripts/make-listen-fixtures.mjs tests/support/range-server.mjs tests/fixtures/listen/tiny.mp4 tests/fixtures/listen/tiny-faststart.mp4 tests/fixtures/listen/tiny-noaudio.mp4 tests/fixtures/listen/tiny.audio-packets.json
git commit -m "test: Listen fixtures (moov-at-end MP4s) and an archive-like range server"
```

---

### Task 4: Types and box reading

**Files:**
- Create: `web-new/lib/listen/types.ts`
- Create: `web-new/lib/listen/boxes.ts`
- Test: `web-new/tests/unit/listen/boxes.test.ts`

- [ ] **Step 1: Create the shared types (no test; exercised by every later task)**

```ts
// lib/listen/types.ts
export type PlaybackRate = 1 | 1.5;

/** Bytes we created ourselves: always ArrayBuffer-backed, so MSE's appendBuffer accepts them. */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * The audio track of a remote MP4, reduced to what Listen needs. Typed arrays clone into IndexedDB as-is.
 * A *run* is a byte-contiguous group of audio samples: one Range request, one fMP4 segment.
 */
export interface AudioIndex {
  version: 1;
  /** Last-Modified of the remote file when indexed. Every later range must match it. */
  lastModified: string | null;
  timescale: number;
  durationSec: number;
  sampleRate: number;
  channelCount: number;
  /** e.g. "mp4a.40.2" */
  codec: string;
  audioSpecificConfig: Uint8Array;
  sampleSizes: Uint16Array;
  sttsCounts: Uint32Array;
  sttsDeltas: Uint32Array;
  runFirst: Uint32Array;
  runCount: Uint32Array;
  runOffset: Float64Array;
  runSize: Uint32Array;
  runStartTicks: Float64Array;
}

export type ListenErrorCode = 'no-moov' | 'no-audio-track' | 'unsupported-audio' | 'malformed-mp4';

export class ListenError extends Error {
  readonly code: ListenErrorCode;
  constructor(code: ListenErrorCode, message: string) {
    super(message);
    this.name = 'ListenError';
    this.code = code;
  }
}
```

- [ ] **Step 2: Write the failing box tests**

```ts
// tests/unit/listen/boxes.test.ts
import { describe, it, expect } from 'vitest';
import { readBoxHeader, childBoxes, findPath } from '@/lib/listen/boxes';
import { ListenError } from '@/lib/listen/types';

function box(type: string, payload: number[] = []): number[] {
  const size = 8 + payload.length;
  return [size >>> 24, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type, (c) => c.charCodeAt(0)), ...payload];
}
const bytes = (a: number[]) => Uint8Array.from(a);

describe('readBoxHeader', () => {
  it('reads a 32-bit size header', () => {
    expect(readBoxHeader(bytes(box('free', [1, 2, 3])), 0)).toEqual({ type: 'free', start: 0, size: 11, headerSize: 8 });
  });

  it('reads a 64-bit largesize header', () => {
    const b = new Uint8Array(16);
    const v = new DataView(b.buffer);
    v.setUint32(0, 1);
    b.set([0x6d, 0x64, 0x61, 0x74], 4); // 'mdat'
    v.setBigUint64(8, BigInt(27_039_093_331));
    expect(readBoxHeader(b, 0)).toEqual({ type: 'mdat', start: 0, size: 27_039_093_331, headerSize: 16 });
  });

  it('returns null when the header is truncated', () => {
    expect(readBoxHeader(bytes([0, 0, 0, 9, 0x66]), 0)).toBeNull();
  });
});

describe('childBoxes / findPath', () => {
  const tree = bytes(box('moov', [...box('mvhd', [0, 0, 0, 0]), ...box('trak', box('mdia', box('hdlr', [9])))]));

  it('lists children in order', () => {
    const root = readBoxHeader(tree, 0)!;
    expect(childBoxes(tree, root.start + root.headerSize, root.size).map((b) => b.type)).toEqual(['mvhd', 'trak']);
  });

  it('finds a nested box by path', () => {
    const hdlr = findPath(tree, readBoxHeader(tree, 0)!, ['trak', 'mdia', 'hdlr']);
    expect(hdlr?.type).toBe('hdlr');
    expect(tree[hdlr!.start + 8]).toBe(9);
  });

  it('returns null for a missing path', () => {
    expect(findPath(tree, readBoxHeader(tree, 0)!, ['trak', 'minf'])).toBeNull();
  });

  it('throws ListenError when a child overruns its parent', () => {
    const bad = bytes(box('moov', [0, 0, 0, 99, 0x66, 0x72, 0x65, 0x65]));
    expect(() => childBoxes(bad, 8, bad.length)).toThrow(ListenError);
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/unit/listen/boxes.test.ts`

- [ ] **Step 4: Implement**

```ts
// lib/listen/boxes.ts
import { ListenError } from './types';

export interface BoxHeader {
  type: string;
  start: number;
  /** Whole box size including header. Size 0 ("to end of parent") is resolved by childBoxes. */
  size: number;
  headerSize: number;
}

/** Read one ISO-BMFF box header at `offset`, or null if it doesn't fit in `bytes`. */
export function readBoxHeader(bytes: Uint8Array, offset: number): BoxHeader | null {
  if (offset + 8 > bytes.byteLength) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(offset);
  const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > bytes.byteLength) return null;
    size = Number(view.getBigUint64(offset + 8));
    headerSize = 16;
  }
  return { type, start: offset, size, headerSize };
}

/** The boxes laid end to end in bytes[start, end). */
export function childBoxes(bytes: Uint8Array, start: number, end: number): BoxHeader[] {
  const out: BoxHeader[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const header = readBoxHeader(bytes, offset);
    if (!header) break;
    const size = header.size === 0 ? end - offset : header.size;
    if (size < header.headerSize || offset + size > end) {
      throw new ListenError('malformed-mp4', `Box "${header.type}" at ${offset} (size ${size}) overruns its parent`);
    }
    out.push({ ...header, size });
    offset += size;
  }
  return out;
}

export function findChild(bytes: Uint8Array, parent: BoxHeader, type: string): BoxHeader | null {
  return childBoxes(bytes, parent.start + parent.headerSize, parent.start + parent.size).find((b) => b.type === type) ?? null;
}

export function findPath(bytes: Uint8Array, parent: BoxHeader, types: readonly string[]): BoxHeader | null {
  let current: BoxHeader | null = parent;
  for (const type of types) {
    if (!current) return null;
    current = findChild(bytes, current, type);
  }
  return current;
}
```

- [ ] **Step 5: Run — expect PASS**, then `npx tsc --noEmit` (0 errors)

- [ ] **Step 6: Commit**

```bash
git add lib/listen/types.ts lib/listen/boxes.ts tests/unit/listen/boxes.test.ts
git commit -m "feat(listen): ISO-BMFF box reading"
```

---

### Task 5: Parse the audio track into an AudioIndex

**Files:**
- Create: `web-new/lib/listen/mp4-index.ts`
- Test: `web-new/tests/unit/listen/mp4-index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/mp4-index.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes, findPath, readBoxHeader, type BoxHeader } from '@/lib/listen/boxes';
import { parseAudioTrack, sampleDurations, sampleOffsets } from '@/lib/listen/mp4-index';
import { ListenError } from '@/lib/listen/types';

const dir = path.resolve(__dirname, '../../fixtures/listen');
const load = (f: string) => new Uint8Array(readFileSync(path.join(dir, f)));
const golden: { pos: number; size: number; duration: number }[] = JSON.parse(readFileSync(path.join(dir, 'tiny.audio-packets.json'), 'utf8'));

function moovOf(file: Uint8Array): Uint8Array {
  const moov = childBoxes(file, 0, file.byteLength).find((b) => b.type === 'moov');
  if (!moov) throw new Error('fixture has no moov');
  return file.subarray(moov.start, moov.start + moov.size);
}

/** Rewrite the audio track's stco as co64 with every offset + 2^32, fixing ancestor sizes. */
function withCo64(moov: Uint8Array): Uint8Array {
  const root = readBoxHeader(moov, 0)!;
  const traks = childBoxes(moov, root.headerSize, root.size).filter((b) => b.type === 'trak');
  for (const trak of traks) {
    const hdlr = findPath(moov, trak, ['mdia', 'hdlr'])!;
    if (String.fromCharCode(...moov.subarray(hdlr.start + 16, hdlr.start + 20)) !== 'soun') continue;
    const chain: BoxHeader[] = [root, trak];
    for (const t of ['mdia', 'minf', 'stbl']) chain.push(findPath(moov, chain.at(-1)!, [t])!);
    const stco = findPath(moov, chain.at(-1)!, ['stco'])!;
    const v = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const n = v.getUint32(stco.start + 12);
    const co64 = new Uint8Array(16 + n * 8);
    const cv = new DataView(co64.buffer);
    cv.setUint32(0, co64.length);
    co64.set([0x63, 0x6f, 0x36, 0x34], 4); // 'co64'
    cv.setUint32(12, n);
    for (let i = 0; i < n; i++) cv.setBigUint64(16 + i * 8, BigInt(v.getUint32(stco.start + 16 + i * 4)) + BigInt(2 ** 32));
    const delta = co64.length - stco.size;
    const out = new Uint8Array(moov.length + delta);
    out.set(moov.subarray(0, stco.start), 0);
    out.set(co64, stco.start);
    out.set(moov.subarray(stco.start + stco.size), stco.start + co64.length);
    const ov = new DataView(out.buffer);
    for (const b of chain) ov.setUint32(b.start, ov.getUint32(b.start) + delta);
    return out;
  }
  throw new Error('no audio trak');
}

describe('parseAudioTrack', () => {
  const index = parseAudioTrack(moovOf(load('tiny.mp4')), 'LM');

  it('reads the codec setup', () => {
    expect(index.codec).toBe('mp4a.40.2');
    expect(index.sampleRate).toBe(48000);
    expect(index.channelCount).toBe(2);
    expect(index.timescale).toBe(48000);
    expect(index.durationSec).toBeCloseTo(12.02, 1);
    expect(index.lastModified).toBe('LM');
    expect(index.audioSpecificConfig.length).toBeGreaterThanOrEqual(2);
  });

  it('matches ffprobe sample offsets, sizes and durations exactly', () => {
    expect(index.sampleSizes.length).toBe(golden.length);
    expect(Array.from(sampleOffsets(index))).toEqual(golden.map((p) => p.pos));
    expect(Array.from(index.sampleSizes)).toEqual(golden.map((p) => p.size));
    expect(Array.from(sampleDurations(index, 0, golden.length))).toEqual(golden.map((p) => p.duration));
  });

  it('groups samples into byte-contiguous runs that cover every sample once', () => {
    let next = 0;
    for (let r = 0; r < index.runFirst.length; r++) {
      expect(index.runFirst[r]).toBe(next);
      let bytes = 0;
      for (let k = 0; k < index.runCount[r]; k++) bytes += index.sampleSizes[next + k];
      expect(index.runSize[r]).toBe(bytes);
      next += index.runCount[r];
    }
    expect(next).toBe(golden.length);
    expect(index.runStartTicks[0]).toBe(0);
    for (let r = 1; r < index.runStartTicks.length; r++) expect(index.runStartTicks[r]).toBeGreaterThan(index.runStartTicks[r - 1]);
  });

  it('gives the same index for a faststart (moov-first) file', () => {
    const fast = parseAudioTrack(moovOf(load('tiny-faststart.mp4')), null);
    expect(Array.from(fast.sampleSizes)).toEqual(Array.from(index.sampleSizes));
    expect(fast.runFirst.length).toBe(index.runFirst.length);
  });

  it('reads 64-bit chunk offsets (co64), as in files over 4 GB', () => {
    const big = parseAudioTrack(withCo64(moovOf(load('tiny.mp4'))), null);
    expect(Array.from(sampleOffsets(big))).toEqual(golden.map((p) => p.pos + 2 ** 32));
  });

  it('throws no-audio-track for a video-only file', () => {
    let error: unknown;
    try {
      parseAudioTrack(moovOf(load('tiny-noaudio.mp4')), null);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ListenError);
    expect(error).toMatchObject({ code: 'no-audio-track' });
  });

  it('throws malformed-mp4 when given something that is not a moov', () => {
    expect(() => parseAudioTrack(Uint8Array.from([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]), null)).toThrow(ListenError);
  });
});

describe('sampleDurations', () => {
  it('crosses stts entry boundaries (last AAC frame is shorter)', () => {
    const index = parseAudioTrack(moovOf(load('tiny.mp4')), null);
    const n = index.sampleSizes.length;
    const tail = sampleDurations(index, n - 3, 3);
    expect(Array.from(tail)).toEqual(golden.slice(-3).map((p) => p.duration));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/unit/listen/mp4-index.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/mp4-index.ts
import { childBoxes, findChild, findPath, readBoxHeader, type BoxHeader } from './boxes';
import { ListenError, type AudioIndex } from './types';

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

/**
 * Parse the first AAC audio track of a `moov` box. Only the audio trak's tables are read, so a
 * 23.6 MB moov with a 1.3M-sample video track parses in tens of milliseconds.
 */
export function parseAudioTrack(moov: Uint8Array, lastModified: string | null): AudioIndex {
  const root = readBoxHeader(moov, 0);
  if (!root || root.type !== 'moov') throw new ListenError('malformed-mp4', 'Expected a moov box');
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const traks = childBoxes(moov, root.headerSize, root.size).filter((b) => b.type === 'trak');

  for (const trak of traks) {
    const hdlr = findPath(moov, trak, ['mdia', 'hdlr']);
    if (!hdlr || fourcc(moov, hdlr.start + 16) !== 'soun') continue;
    return parseSoundTrak(moov, view, trak, lastModified);
  }
  throw new ListenError('no-audio-track', 'This file has no audio track');
}

function need(box: BoxHeader | null, what: string): BoxHeader {
  if (!box) throw new ListenError('malformed-mp4', `Audio track is missing ${what}`);
  return box;
}

function parseSoundTrak(moov: Uint8Array, v: DataView, trak: BoxHeader, lastModified: string | null): AudioIndex {
  const mdhd = need(findPath(moov, trak, ['mdia', 'mdhd']), 'mdhd');
  const v1 = moov[mdhd.start + 8] === 1;
  const timescale = v.getUint32(mdhd.start + (v1 ? 28 : 20));
  const durationTicks = v1 ? Number(v.getBigUint64(mdhd.start + 32)) : v.getUint32(mdhd.start + 24);

  const stbl = need(findPath(moov, trak, ['mdia', 'minf', 'stbl']), 'stbl');
  const stsd = need(findChild(moov, stbl, 'stsd'), 'stsd');
  const entry = need(readBoxHeader(moov, stsd.start + 16), 'a sample entry');
  if (entry.type !== 'mp4a') throw new ListenError('unsupported-audio', `Audio codec "${entry.type}" isn't supported`);
  const channelCount = v.getUint16(entry.start + 24);
  const sampleRate = v.getUint32(entry.start + 32) >>> 16;
  const esds = childBoxes(moov, entry.start + 36, entry.start + entry.size).find((b) => b.type === 'esds');
  const audioSpecificConfig = readAudioSpecificConfig(need(esds ?? null, 'esds'), moov);
  const objectType = audioSpecificConfig[0] >> 3;
  if (objectType === 0 || objectType === 31) throw new ListenError('unsupported-audio', `AAC object type ${objectType} isn't supported`);

  // stts: sample durations as (count, delta) runs
  const stts = need(findChild(moov, stbl, 'stts'), 'stts');
  const sttsN = v.getUint32(stts.start + 12);
  const sttsCounts = new Uint32Array(sttsN);
  const sttsDeltas = new Uint32Array(sttsN);
  for (let i = 0; i < sttsN; i++) {
    sttsCounts[i] = v.getUint32(stts.start + 16 + i * 8);
    sttsDeltas[i] = v.getUint32(stts.start + 20 + i * 8);
  }

  // stsz: sample sizes
  const stsz = findChild(moov, stbl, 'stsz');
  if (!stsz) throw new ListenError('unsupported-audio', 'Compact sample sizes (stz2) are not supported');
  const fixedSize = v.getUint32(stsz.start + 12);
  const sampleCount = v.getUint32(stsz.start + 16);
  const sampleSizes = new Uint16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const size = fixedSize || v.getUint32(stsz.start + 20 + i * 4);
    if (size > 0xffff) throw new ListenError('unsupported-audio', `Audio sample ${i} is ${size} bytes; expected AAC frames under 64 KB`);
    sampleSizes[i] = size;
  }

  // stco / co64: chunk offsets; stsc: samples per chunk
  const co = need(findChild(moov, stbl, 'co64') ?? findChild(moov, stbl, 'stco'), 'stco/co64');
  const wide = co.type === 'co64';
  const chunkCount = v.getUint32(co.start + 12);
  const chunkOffset = (i: number) => (wide ? Number(v.getBigUint64(co.start + 16 + i * 8)) : v.getUint32(co.start + 16 + i * 4));
  const stsc = need(findChild(moov, stbl, 'stsc'), 'stsc');
  const stscN = v.getUint32(stsc.start + 12);
  const stscFirst = new Uint32Array(stscN);
  const stscPer = new Uint32Array(stscN);
  for (let i = 0; i < stscN; i++) {
    stscFirst[i] = v.getUint32(stsc.start + 16 + i * 12);
    stscPer[i] = v.getUint32(stsc.start + 20 + i * 12);
  }

  // Walk chunks, merging byte-contiguous samples into runs (one Range request each).
  const runFirst: number[] = [];
  const runCount: number[] = [];
  const runOffset: number[] = [];
  const runSize: number[] = [];
  let sample = 0;
  let entryIdx = 0;
  for (let c = 0; c < chunkCount && sample < sampleCount; c++) {
    while (entryIdx + 1 < stscN && c + 1 >= stscFirst[entryIdx + 1]) entryIdx++;
    let offset = chunkOffset(c);
    for (let k = 0; k < stscPer[entryIdx] && sample < sampleCount; k++, sample++) {
      const last = runFirst.length - 1;
      if (last >= 0 && runOffset[last] + runSize[last] === offset) {
        runCount[last]++;
        runSize[last] += sampleSizes[sample];
      } else {
        runFirst.push(sample);
        runCount.push(1);
        runOffset.push(offset);
        runSize.push(sampleSizes[sample]);
      }
      offset += sampleSizes[sample];
    }
  }
  if (sample !== sampleCount) throw new ListenError('malformed-mp4', `Chunk tables cover ${sample} of ${sampleCount} samples`);

  // Start tick of each run.
  const runStartTicks = new Float64Array(runFirst.length);
  let ticks = 0;
  let run = 0;
  let sttsIdx = 0;
  let left = sttsN ? sttsCounts[0] : 0;
  for (let s = 0; s < sampleCount; s++) {
    if (run < runFirst.length && runFirst[run] === s) runStartTicks[run++] = ticks;
    while (left === 0 && sttsIdx + 1 < sttsN) left = sttsCounts[++sttsIdx];
    ticks += sttsDeltas[sttsIdx];
    left--;
  }

  return {
    version: 1,
    lastModified,
    timescale,
    durationSec: durationTicks / timescale,
    sampleRate,
    channelCount,
    codec: `mp4a.40.${objectType}`,
    audioSpecificConfig,
    sampleSizes,
    sttsCounts,
    sttsDeltas,
    runFirst: Uint32Array.from(runFirst),
    runCount: Uint32Array.from(runCount),
    runOffset: Float64Array.from(runOffset),
    runSize: Uint32Array.from(runSize),
    runStartTicks,
  };
}

/** esds -> ES_Descriptor(0x03) -> DecoderConfigDescriptor(0x04) -> DecoderSpecificInfo(0x05) = AudioSpecificConfig. */
function readAudioSpecificConfig(esds: BoxHeader, moov: Uint8Array): Uint8Array {
  const d = moov.subarray(esds.start + 12, esds.start + esds.size);
  let p = 0;
  const readDescriptor = () => {
    const tag = d[p++];
    let len = 0;
    for (let i = 0; i < 4; i++) {
      const b = d[p++];
      len = (len << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return { tag, len };
  };
  if (readDescriptor().tag !== 0x03) throw new ListenError('malformed-mp4', 'esds has no ES_Descriptor');
  p += 2; // ES_ID
  const flags = d[p++];
  if (flags & 0x80) p += 2; // dependsOn_ES_ID
  if (flags & 0x40) p += 1 + d[p]; // URL
  if (flags & 0x20) p += 2; // OCR_ES_Id
  if (readDescriptor().tag !== 0x04) throw new ListenError('malformed-mp4', 'esds has no DecoderConfigDescriptor');
  if (d[p] !== 0x40) throw new ListenError('unsupported-audio', `Audio object type 0x${d[p].toString(16)} is not AAC`);
  p += 13; // objectTypeIndication, streamType, bufferSizeDB(3), maxBitrate(4), avgBitrate(4)
  const info = readDescriptor();
  if (info.tag !== 0x05) throw new ListenError('malformed-mp4', 'esds has no DecoderSpecificInfo');
  return d.slice(p, p + info.len);
}

/** Durations (in timescale ticks) of `count` samples starting at `first`. */
export function sampleDurations(index: AudioIndex, first: number, count: number): Uint32Array {
  const out = new Uint32Array(count);
  let i = 0;
  let base = 0;
  while (i < index.sttsCounts.length && base + index.sttsCounts[i] <= first) base += index.sttsCounts[i++];
  let left = index.sttsCounts[i] - (first - base);
  for (let k = 0; k < count; k++) {
    while (left === 0) left = index.sttsCounts[++i];
    out[k] = index.sttsDeltas[i];
    left--;
  }
  return out;
}

/** Absolute byte offset of every sample. For tests and diagnostics, not the hot path. */
export function sampleOffsets(index: AudioIndex): Float64Array {
  const out = new Float64Array(index.sampleSizes.length);
  for (let r = 0; r < index.runFirst.length; r++) {
    let offset = index.runOffset[r];
    for (let k = 0; k < index.runCount[r]; k++) {
      const s = index.runFirst[r] + k;
      out[s] = offset;
      offset += index.sampleSizes[s];
    }
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit` (0 errors)

- [ ] **Step 5: Commit**

```bash
git add lib/listen/mp4-index.ts tests/unit/listen/mp4-index.test.ts
git commit -m "feat(listen): parse an MP4's audio track into byte-contiguous runs"
```

---

### Task 6: Fragmented-MP4 writer

**Files:**
- Create: `web-new/lib/listen/fmp4.ts`
- Test: `web-new/tests/unit/listen/fmp4.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/fmp4.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes, findPath, readBoxHeader } from '@/lib/listen/boxes';
import { parseAudioTrack } from '@/lib/listen/mp4-index';
import { buildInitSegment, buildMediaSegment, buildRunSegment } from '@/lib/listen/fmp4';

const file = new Uint8Array(readFileSync(path.resolve(__dirname, '../../fixtures/listen/tiny.mp4')));
const moovBox = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
const index = parseAudioTrack(file.subarray(moovBox.start, moovBox.start + moovBox.size), null);
const indexOf = (hay: Uint8Array, needle: Uint8Array) => {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

describe('buildInitSegment', () => {
  const init = buildInitSegment(index);
  const top = childBoxes(init, 0, init.length);

  it('is ftyp + moov with an mvex (fragmented)', () => {
    expect(top.map((b) => b.type)).toEqual(['ftyp', 'moov']);
    expect(findPath(init, top[1], ['mvex', 'trex'])).not.toBeNull();
  });

  it('carries the original AudioSpecificConfig inside mp4a/esds', () => {
    const stsd = findPath(init, top[1], ['trak', 'mdia', 'minf', 'stbl', 'stsd'])!;
    const mp4a = readBoxHeader(init, stsd.start + 16)!;
    expect(mp4a.type).toBe('mp4a');
    expect(indexOf(init.subarray(mp4a.start, mp4a.start + mp4a.size), index.audioSpecificConfig)).toBeGreaterThan(0);
  });
});

describe('buildMediaSegment', () => {
  const payload = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const seg = buildMediaSegment({ sequenceNumber: 7, baseDecodeTime: 2 ** 33, sizes: [2, 4], durations: [1024, 512], payload });
  const [moof, mdat] = childBoxes(seg, 0, seg.length);
  const v = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);

  it('is moof + mdat holding the payload verbatim', () => {
    expect([moof.type, mdat.type]).toEqual(['moof', 'mdat']);
    expect(Array.from(seg.subarray(mdat.start + 8, mdat.start + mdat.size))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('points trun.data_offset at the first payload byte', () => {
    const trun = findPath(seg, moof, ['traf', 'trun'])!;
    expect(v.getUint32(trun.start + 12)).toBe(2); // sample_count
    expect(v.getUint32(trun.start + 16)).toBe(mdat.start + 8 - moof.start); // data_offset
    expect([v.getUint32(trun.start + 20), v.getUint32(trun.start + 24)]).toEqual([1024, 2]);
    expect([v.getUint32(trun.start + 28), v.getUint32(trun.start + 32)]).toEqual([512, 4]);
  });

  it('writes a 64-bit tfdt and the sequence number', () => {
    const tfdt = findPath(seg, moof, ['traf', 'tfdt'])!;
    expect(seg[tfdt.start + 8]).toBe(1); // version 1
    expect(Number(v.getBigUint64(tfdt.start + 12))).toBe(2 ** 33);
    const mfhd = findPath(seg, moof, ['mfhd'])!;
    expect(v.getUint32(mfhd.start + 12)).toBe(7);
  });
});

describe('buildRunSegment', () => {
  it('uses the run\'s sample sizes, durations and start tick', () => {
    const r = 3;
    const payload = file.slice(index.runOffset[r], index.runOffset[r] + index.runSize[r]);
    const seg = buildRunSegment(index, r, payload, 1);
    const [moof, mdat] = childBoxes(seg, 0, seg.length);
    const v = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);
    const trun = findPath(seg, moof, ['traf', 'trun'])!;
    expect(v.getUint32(trun.start + 12)).toBe(index.runCount[r]);
    expect(Number(v.getBigUint64(findPath(seg, moof, ['traf', 'tfdt'])!.start + 12))).toBe(index.runStartTicks[r]);
    expect(mdat.size - 8).toBe(index.runSize[r]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/fmp4.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/fmp4.ts
// Minimal fragmented-MP4 writer for ONE AAC audio track: an init segment (ftyp+moov with mvex)
// and media segments (moof+mdat). The AAC frames are copied, never re-encoded.
import { sampleDurations } from './mp4-index';
import type { AudioIndex, Bytes } from './types';

const ascii = (s: string): Bytes => Uint8Array.from(s, (c) => c.charCodeAt(0));
const u8 = (n: number): Bytes => Uint8Array.of(n & 255);
const u16 = (n: number): Bytes => Uint8Array.of((n >>> 8) & 255, n & 255);
const u32 = (n: number): Bytes => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const u64 = (n: number): Bytes => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
};
const zeros = (n: number): Bytes => new Uint8Array(n);

function concat(parts: readonly Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const box = (type: string, ...parts: Uint8Array[]): Bytes => {
  const body = concat(parts);
  return concat([u32(8 + body.length), ascii(type), body]);
};
const fullBox = (type: string, version: number, flags: number, ...parts: Uint8Array[]): Bytes =>
  box(type, u8(version), Uint8Array.of((flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255), ...parts);
const descriptor = (tag: number, body: Uint8Array): Bytes => concat([u8(tag), Uint8Array.of(0x80, 0x80, 0x80, body.length & 0x7f), body]);
const MATRIX = concat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

type InitFields = Pick<AudioIndex, 'timescale' | 'sampleRate' | 'channelCount' | 'audioSpecificConfig'>;

export function buildInitSegment(index: InitFields): Bytes {
  const esds = fullBox(
    'esds', 0, 0,
    descriptor(0x03, concat([
      u16(1), u8(0),
      descriptor(0x04, concat([u8(0x40), u8(0x15), zeros(3), u32(0), u32(0), descriptor(0x05, index.audioSpecificConfig)])),
      descriptor(0x06, u8(0x02)),
    ])),
  );
  const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(index.channelCount), u16(16), zeros(4), u32((index.sampleRate * 65536) >>> 0), esds);
  const stbl = box(
    'stbl',
    fullBox('stsd', 0, 0, u32(1), mp4a),
    fullBox('stts', 0, 0, u32(0)),
    fullBox('stsc', 0, 0, u32(0)),
    fullBox('stsz', 0, 0, u32(0), u32(0)),
    fullBox('stco', 0, 0, u32(0)),
  );
  const minf = box('minf', fullBox('smhd', 0, 0, zeros(4)), box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))), stbl);
  const mdia = box(
    'mdia',
    fullBox('mdhd', 0, 0, u32(0), u32(0), u32(index.timescale), u32(0), u16(0x55c4), u16(0)),
    fullBox('hdlr', 0, 0, u32(0), ascii('soun'), zeros(12), ascii('SoundHandler\0')),
    minf,
  );
  const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(0), zeros(8), u16(0), u16(0), u16(0x0100), u16(0), MATRIX, u32(0), u32(0));
  const mvhd = fullBox('mvhd', 0, 0, u32(0), u32(0), u32(index.timescale), u32(0), u32(0x10000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2));
  const mvex = box('mvex', fullBox('trex', 0, 0, u32(1), u32(1), u32(0), u32(0), u32(0)));
  return concat([box('ftyp', ascii('iso6'), u32(0), ascii('iso6'), ascii('mp41')), box('moov', mvhd, box('trak', tkhd, mdia), mvex)]);
}

export interface MediaSegmentInput {
  sequenceNumber: number;
  baseDecodeTime: number;
  sizes: ArrayLike<number>;
  durations: ArrayLike<number>;
  payload: Uint8Array;
}

export function buildMediaSegment({ sequenceNumber, baseDecodeTime, sizes, durations, payload }: MediaSegmentInput): Bytes {
  const entries: Bytes[] = [];
  for (let i = 0; i < sizes.length; i++) entries.push(u32(durations[i]), u32(sizes[i]));
  const moof = (dataOffset: number) =>
    box(
      'moof',
      fullBox('mfhd', 0, 0, u32(sequenceNumber)),
      box(
        'traf',
        fullBox('tfhd', 0, 0x020000, u32(1)), // default-base-is-moof
        fullBox('tfdt', 1, 0, u64(baseDecodeTime)),
        fullBox('trun', 0, 0x000301, u32(sizes.length), u32(dataOffset), ...entries), // data-offset, duration, size
      ),
    );
  const moofSize = moof(0).length;
  return concat([moof(moofSize + 8), box('mdat', payload)]);
}

/** One run of the index (fetched as `payload`) as a media segment. */
export function buildRunSegment(index: AudioIndex, run: number, payload: Uint8Array, sequenceNumber: number): Bytes {
  const first = index.runFirst[run];
  const count = index.runCount[run];
  return buildMediaSegment({
    sequenceNumber,
    baseDecodeTime: index.runStartTicks[run],
    sizes: index.sampleSizes.subarray(first, first + count),
    durations: sampleDurations(index, first, count),
    payload,
  });
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/fmp4.ts tests/unit/listen/fmp4.test.ts
git commit -m "feat(listen): fragmented-MP4 writer for AAC runs (no re-encode)"
```

---

### Task 7: `range-fetch`, the only audio HTTP

**Files:**
- Create: `web-new/lib/listen/range-fetch.ts`
- Test: `web-new/tests/unit/listen/range-fetch.test.ts`

These rules come from the spec's *Failure handling* section, adjusted for what the browser can actually read cross-site:
- **Validate on** status 206, `Content-Length`, and `Last-Modified`.
- **Timeout:** an idle timeout that resets on every received chunk.
- **Retry with backoff:** network errors, idle timeouts, 408/429/5xx, and wrong or short body lengths. Browsers make a CORS failure look identical to a network error, so it lands here too.
- **Fail immediately:** 200 (the server ignored the Range and is about to send the whole file), 404/410, 416, other 4xx, and a changed `Last-Modified`.
- **Caller abort:** never retried.
- **Offline:** waits for the `online` event without spending attempts.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/range-fetch.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRange, backoffDelay, RangeFetchError, type FetchRangeDeps } from '@/lib/listen/range-fetch';

const LM = 'Sun, 04 Oct 2026 09:47:31 GMT';
const bytesOf = (n: number) => Uint8Array.from({ length: n }, (_, i) => i & 255);
const ok = (n: number, headers: Record<string, string> = {}) =>
  new Response(bytesOf(n), { status: 206, headers: { 'content-length': String(n), 'last-modified': LM, ...headers } });
const status = (code: number) => new Response('x', { status: code });

function deps(responses: Array<Response | Error>, extra: Partial<FetchRangeDeps> = {}) {
  const fetch = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra fetch');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch, sleep: vi.fn(async () => {}), isOnline: () => true, waitForOnline: vi.fn(async () => {}), random: () => 0.5, ...extra };
}

afterEach(() => vi.useRealTimers());

describe('fetchRange', () => {
  it('returns the bytes and Last-Modified, asking for an exact closed range', async () => {
    const d = deps([ok(10)]);
    const r = await fetchRange('https://a/v.mp4', 100, 109, { deps: d });
    expect(Array.from(r.bytes)).toEqual(Array.from(bytesOf(10)));
    expect(r.lastModified).toBe(LM);
    expect(d.fetch).toHaveBeenCalledWith('https://a/v.mp4', expect.objectContaining({ headers: { Range: 'bytes=100-109' } }));
  });

  it('refuses a 200 (whole file) without retrying', async () => {
    const d = deps([new Response(bytesOf(4096), { status: 200 })]);
    await expect(fetchRange('u', 0, 9, { deps: d })).rejects.toMatchObject({ code: 'range-unsupported', status: 200 });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 410])('treats %i as not-found without retrying', async (code) => {
    const d = deps([status(code)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).rejects.toMatchObject({ code: 'not-found' });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries 503 with backoff and reports each retry', async () => {
    const onRetry = vi.fn();
    const d = deps([status(503), status(503), ok(10)]);
    await fetchRange('u', 0, 9, { deps: d, onRetry });
    expect(d.fetch).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([i]) => i.delayMs)).toEqual([1000, 2000]);
    expect(d.sleep).toHaveBeenCalledTimes(2);
  });

  it('retries a network TypeError (also what a CORS failure looks like)', async () => {
    const d = deps([new TypeError('Failed to fetch'), ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
  });

  it('gives up with "exhausted" after maxAttempts', async () => {
    const d = deps([status(500), status(500), status(500)]);
    await expect(fetchRange('u', 0, 9, { deps: d, maxAttempts: 3 })).rejects.toMatchObject({ code: 'exhausted' });
    expect(d.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries when Content-Length is not the requested length', async () => {
    const d = deps([ok(10, { 'content-length': '11' }), ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('fails with file-changed when Last-Modified differs from the pinned one', async () => {
    const d = deps([ok(10, { 'last-modified': 'Mon, 05 Oct 2026 00:00:00 GMT' })]);
    await expect(fetchRange('u', 0, 9, { deps: d, expectedLastModified: LM })).rejects.toMatchObject({ code: 'file-changed' });
  });

  it('retries a short body', async () => {
    const short = new Response(bytesOf(4), { status: 206, headers: { 'last-modified': LM } });
    const d = deps([short, ok(10)]);
    await expect(fetchRange('u', 0, 9, { deps: d })).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry or report when the caller aborts', async () => {
    const controller = new AbortController();
    const onRetry = vi.fn();
    const d = deps([], {
      fetch: vi.fn(async (_u: string, init?: RequestInit) => {
        controller.abort();
        throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError');
      }),
    });
    await expect(fetchRange('u', 0, 9, { deps: d, signal: controller.signal, onRetry })).rejects.toMatchObject({ code: 'aborted' });
    expect(onRetry).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for the network instead of burning attempts while offline', async () => {
    let online = false;
    const onOffline = vi.fn();
    const d = deps([ok(10)], {
      isOnline: () => online,
      waitForOnline: vi.fn(async () => {
        online = true;
      }),
    });
    await fetchRange('u', 0, 9, { deps: d, onOffline });
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(d.waitForOnline).toHaveBeenCalledTimes(1);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries when the body stalls past the idle timeout', async () => {
    vi.useFakeTimers();
    const stalled = new Response(
      new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(Uint8Array.of(1, 2)) }),
      { status: 206, headers: { 'content-length': '10', 'last-modified': LM } },
    );
    const d = deps([stalled, ok(10)]);
    const pending = fetchRange('u', 0, 9, { deps: d, idleTimeoutMs: 15_000 });
    await vi.advanceTimersByTimeAsync(15_001);
    await expect(pending).resolves.toBeTruthy();
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('backoffDelay', () => {
  it('doubles from 1 s, caps at 16 s, with ±30% jitter', () => {
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(2, () => 0.5)).toBe(2000);
    expect(backoffDelay(9, () => 0.5)).toBe(16000);
    expect(backoffDelay(1, () => 0)).toBe(700);
    expect(backoffDelay(1, () => 1)).toBe(1300);
  });
});

describe('RangeFetchError', () => {
  it('is an Error with a code', () => {
    const e = new RangeFetchError('not-found', 'gone', 404);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('not-found');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/range-fetch.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/range-fetch.ts
// The ONLY code that touches HTTP for Listen audio. See the spec's "Failure handling".
// Cross-origin, the page can read only cache-control / content-length / content-type /
// last-modified, so validation uses status + Content-Length + Last-Modified.
import type { Bytes } from './types';

export type RangeErrorCode = 'aborted' | 'not-found' | 'range-unsupported' | 'file-changed' | 'bad-status' | 'exhausted';

export class RangeFetchError extends Error {
  readonly code: RangeErrorCode;
  readonly status?: number;
  constructor(code: RangeErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'RangeFetchError';
    this.code = code;
    this.status = status;
  }
}

export interface RangeResult {
  bytes: Bytes;
  lastModified: string | null;
}
export interface RetryInfo {
  attempt: number;
  delayMs: number;
  reason: string;
}
export interface FetchRangeDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  isOnline: () => boolean;
  waitForOnline: (signal?: AbortSignal) => Promise<void>;
  random: () => number;
}
export interface FetchRangeOptions {
  signal?: AbortSignal;
  /** Last-Modified pinned when the index was built; a different value is fatal "file-changed". */
  expectedLastModified?: string | null;
  /** Abort an attempt after this long with no bytes arriving. Default 15 s. */
  idleTimeoutMs?: number;
  /** Default 5. */
  maxAttempts?: number;
  onRetry?: (info: RetryInfo) => void;
  onOffline?: () => void;
  deps?: Partial<FetchRangeDeps>;
}

/** A failure worth another attempt. Internal: never escapes fetchRange. */
class Transient extends Error {}

const aborted = () => new RangeFetchError('aborted', 'Aborted');

const defaultDeps: FetchRangeDeps = {
  fetch: (url, init) => globalThis.fetch(url, init),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(aborted());
      }, { once: true });
    }),
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  waitForOnline: (signal) =>
    new Promise((resolve, reject) => {
      const done = () => {
        window.removeEventListener('online', done);
        resolve();
      };
      window.addEventListener('online', done);
      signal?.addEventListener('abort', () => {
        window.removeEventListener('online', done);
        reject(aborted());
      }, { once: true });
    }),
  random: Math.random,
};

/** 1 s, 2 s, 4 s, 8 s, 16 s (cap), each ±30%. */
export function backoffDelay(attempt: number, random: () => number): number {
  const base = Math.min(16_000, 1000 * 2 ** (attempt - 1));
  return Math.round(base * (0.7 + 0.6 * random()));
}

export async function fetchRange(url: string, start: number, endInclusive: number, opts: FetchRangeOptions = {}): Promise<RangeResult> {
  const deps: FetchRangeDeps = { ...defaultDeps, ...opts.deps };
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastReason = 'unknown';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw aborted();
    if (!deps.isOnline()) {
      opts.onOffline?.();
      await deps.waitForOnline(opts.signal);
    }
    try {
      return await attemptOnce(url, start, endInclusive, opts, deps);
    } catch (err) {
      if (err instanceof RangeFetchError) throw err;
      if (opts.signal?.aborted) throw aborted();
      lastReason = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) break;
      const delayMs = backoffDelay(attempt, deps.random);
      opts.onRetry?.({ attempt, delayMs, reason: lastReason });
      await deps.sleep(delayMs, opts.signal);
    }
  }
  throw new RangeFetchError('exhausted', `Gave up after ${maxAttempts} attempts: ${lastReason}`);
}

async function attemptOnce(url: string, start: number, end: number, opts: FetchRangeOptions, deps: FetchRangeDeps): Promise<RangeResult> {
  const length = end - start + 1;
  const idleMs = opts.idleTimeoutMs ?? 15_000;
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onCallerAbort, { once: true });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const armIdle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      void reader?.cancel().catch(() => undefined);
    }, idleMs);
  };
  const discard = (res: Response) => void res.body?.cancel().catch(() => undefined);

  try {
    armIdle();
    let res: Response;
    try {
      res = await deps.fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal });
    } catch (err) {
      if (opts.signal?.aborted) throw aborted();
      if (timedOut) throw new Transient('no response within the idle timeout');
      throw new Transient(`network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (res.status !== 206) {
      discard(res);
      if (res.status === 200) throw new RangeFetchError('range-unsupported', 'The server ignored Range (200); refusing to download the whole file', 200);
      if (res.status === 404 || res.status === 410) throw new RangeFetchError('not-found', `VOD not found (${res.status})`, res.status);
      if (res.status === 416) throw new RangeFetchError('range-unsupported', 'Range not satisfiable (416)', 416);
      if (res.status === 408 || res.status === 429 || res.status >= 500) throw new Transient(`HTTP ${res.status}`);
      throw new RangeFetchError('bad-status', `Unexpected HTTP ${res.status}`, res.status);
    }

    const lastModified = res.headers.get('last-modified');
    if (opts.expectedLastModified && lastModified && lastModified !== opts.expectedLastModified) {
      discard(res);
      throw new RangeFetchError('file-changed', `The VOD changed on the server (${lastModified}, expected ${opts.expectedLastModified})`);
    }
    const declared = res.headers.get('content-length');
    if (declared !== null && Number(declared) !== length) {
      discard(res);
      throw new Transient(`Content-Length ${declared}, requested ${length}`);
    }
    if (!res.body) throw new Transient('response has no body');

    const out = new Uint8Array(length);
    let received = 0;
    reader = res.body.getReader();
    for (;;) {
      armIdle();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (opts.signal?.aborted) throw aborted();
        if (timedOut) throw new Transient('idle timeout while reading');
        throw new Transient(`read failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (chunk.done) break;
      if (received + chunk.value.byteLength > length) {
        void reader.cancel().catch(() => undefined);
        throw new Transient(`body longer than the requested ${length} bytes`);
      }
      out.set(chunk.value, received);
      received += chunk.value.byteLength;
    }
    if (opts.signal?.aborted) throw aborted();
    if (timedOut) throw new Transient('idle timeout while reading');
    if (received !== length) throw new Transient(`short read: ${received} of ${length} bytes`);
    return { bytes: out, lastModified };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onCallerAbort);
  }
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/range-fetch.ts tests/unit/listen/range-fetch.test.ts
git commit -m "feat(listen): range-fetch with idle timeout, backoff, and 206/length/Last-Modified validation"
```

---

### Task 8: `mapLimit` and the index loader

**Files:**
- Create: `web-new/lib/listen/concurrency.ts`, `web-new/lib/listen/index-loader.ts`
- Test: `web-new/tests/unit/listen/concurrency.test.ts`, `web-new/tests/unit/listen/index-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/concurrency.test.ts
import { describe, it, expect } from 'vitest';
import { mapLimit } from '@/lib/listen/concurrency';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapLimit', () => {
  it('keeps result order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([5, 4, 3, 2, 1], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      return n * 10;
    });
    expect(out).toEqual([50, 40, 30, 20, 10]);
    expect(peak).toBe(2);
  });

  it('rejects on the first error and starts no new items', async () => {
    const started: number[] = [];
    await expect(
      mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n);
        await tick();
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(started.length).toBeLessThanOrEqual(3);
  });
});
```

```ts
// tests/unit/listen/index-loader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes } from '@/lib/listen/boxes';
import { locateMoov, loadAudioIndex, type FetchRangeFn } from '@/lib/listen/index-loader';
import { parseAudioTrack } from '@/lib/listen/mp4-index';
import { RangeFetchError } from '@/lib/listen/range-fetch';

const fixture = (f: string) => new Uint8Array(readFileSync(path.resolve(__dirname, '../../fixtures/listen', f)));

function fakeFetch(file: Uint8Array): FetchRangeFn & { calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  const fn = vi.fn(async (_url: string, start: number, end: number) => {
    calls.push([start, end]);
    if (start >= file.length) throw new RangeFetchError('range-unsupported', '416', 416);
    return { bytes: file.slice(start, Math.min(end, file.length - 1) + 1), lastModified: 'LM' };
  });
  return Object.assign(fn, { calls });
}

describe('locateMoov', () => {
  it('walks top-level boxes with 16-byte reads to the moov at the end', async () => {
    const file = fixture('tiny.mp4');
    const expected = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    const fetchRange = fakeFetch(file);
    const loc = await locateMoov('u', { fetchRange });
    expect(loc).toEqual({ start: expected.start, size: expected.size, lastModified: 'LM' });
    expect(fetchRange.calls.every(([s, e]) => e - s === 15)).toBe(true);
  });

  it('finds an early moov in a faststart file', async () => {
    const fetchRange = fakeFetch(fixture('tiny-faststart.mp4'));
    await locateMoov('u', { fetchRange });
    expect(fetchRange.calls.length).toBeLessThanOrEqual(3);
  });

  it('reports no-moov when the file ends without one', async () => {
    const file = fixture('tiny.mp4');
    const moov = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    await expect(locateMoov('u', { fetchRange: fakeFetch(file.slice(0, moov.start)) })).rejects.toMatchObject({ code: 'no-moov' });
  });

  it('reports no-moov when a box runs to end-of-file (size 0)', async () => {
    const file = Uint8Array.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x6d, 0x64, 0x61, 0x74, 9, 9, 9, 9, 9, 9, 9, 9]);
    await expect(locateMoov('u', { fetchRange: fakeFetch(file) })).rejects.toMatchObject({ code: 'no-moov' });
  });
});

describe('loadAudioIndex', () => {
  it('downloads the moov in pieces, reports progress, and parses it', async () => {
    const file = fixture('tiny.mp4');
    const moov = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    const fetchRange = fakeFetch(file);
    const progress = vi.fn();
    const index = await loadAudioIndex('u', { fetchRange, pieceSize: 1000, onProgress: progress });
    const direct = parseAudioTrack(file.subarray(moov.start, moov.start + moov.size), 'LM');
    expect(Array.from(index.sampleSizes)).toEqual(Array.from(direct.sampleSizes));
    expect(index.lastModified).toBe('LM');
    expect(progress).toHaveBeenLastCalledWith(moov.size, moov.size);
    const pieces = fetchRange.calls.filter(([s]) => s >= moov.start);
    expect(pieces.length).toBe(Math.ceil(moov.size / 1000));
    expect(pieces.every(([s, e]) => e - s < 1000)).toBe(true);
  });

  it('pins Last-Modified on every moov piece', async () => {
    const file = fixture('tiny.mp4');
    const fetchRange = fakeFetch(file);
    await loadAudioIndex('u', { fetchRange, pieceSize: 4000 });
    const opts = (fetchRange as unknown as { mock: { calls: unknown[][] } }).mock.calls.slice(1).map((c) => c[3] as { expectedLastModified?: string });
    expect(opts.every((o) => o.expectedLastModified === 'LM')).toBe(true);
  });
});
```

- [ ] **Step 2: Run both — expect FAIL**

Run: `npx vitest run tests/unit/listen/concurrency.test.ts tests/unit/listen/index-loader.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/concurrency.ts
/** Map with at most `limit` promises in flight. Rejects on the first error and starts nothing new after it. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
```

```ts
// lib/listen/index-loader.ts
import { readBoxHeader } from './boxes';
import { mapLimit } from './concurrency';
import { parseAudioTrack } from './mp4-index';
import { fetchRange as defaultFetchRange, RangeFetchError, type FetchRangeOptions, type RangeResult } from './range-fetch';
import { ListenError, type AudioIndex } from './types';

export type FetchRangeFn = (url: string, start: number, endInclusive: number, opts?: FetchRangeOptions) => Promise<RangeResult>;

export interface MoovLocation {
  start: number;
  size: number;
  lastModified: string | null;
}

export interface LoadIndexOptions {
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
  onRetry?: FetchRangeOptions['onRetry'];
  onOffline?: () => void;
  fetchRange?: FetchRangeFn;
  /** moov is fetched in pieces this big so a slow link isn't one giant request. Default 1 MiB. */
  pieceSize?: number;
  /** Default 4. */
  concurrency?: number;
}

const MAX_TOP_LEVEL_BOXES = 32;

/** Find the moov by reading 16-byte box headers from the start of the file (ftyp, mdat, …). */
export async function locateMoov(url: string, opts: LoadIndexOptions = {}): Promise<MoovLocation> {
  const fetchRange = opts.fetchRange ?? defaultFetchRange;
  let offset = 0;
  let lastModified: string | null = null;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
    let head: RangeResult;
    try {
      head = await fetchRange(url, offset, offset + 15, { signal: opts.signal, expectedLastModified: lastModified, onRetry: opts.onRetry, onOffline: opts.onOffline });
    } catch (err) {
      if (i > 0 && err instanceof RangeFetchError && err.status === 416) {
        throw new ListenError('no-moov', 'Reached the end of the file without finding the moov box');
      }
      throw err;
    }
    lastModified ??= head.lastModified;
    const header = readBoxHeader(head.bytes, 0);
    if (!header) throw new ListenError('malformed-mp4', `Unreadable box header at byte ${offset}`);
    if (header.type === 'moov') return { start: offset, size: header.size, lastModified };
    if (header.size === 0) throw new ListenError('no-moov', `Box "${header.type}" runs to the end of the file before any moov`);
    if (header.size < header.headerSize) throw new ListenError('malformed-mp4', `Box "${header.type}" at ${offset} has size ${header.size}`);
    offset += header.size;
  }
  throw new ListenError('no-moov', `No moov in the first ${MAX_TOP_LEVEL_BOXES} boxes`);
}

/** Locate, download and parse the audio track. The one-off cost per VOD (23.6 MB on a 6 h stream). */
export async function loadAudioIndex(url: string, opts: LoadIndexOptions = {}): Promise<AudioIndex> {
  const fetchRange = opts.fetchRange ?? defaultFetchRange;
  const loc = await locateMoov(url, opts);
  const pieceSize = opts.pieceSize ?? 1 << 20;
  const pieces: Array<[number, number]> = [];
  for (let s = 0; s < loc.size; s += pieceSize) pieces.push([s, Math.min(loc.size, s + pieceSize)]);

  const moov = new Uint8Array(loc.size);
  let loaded = 0;
  opts.onProgress?.(0, loc.size);
  await mapLimit(pieces, opts.concurrency ?? 4, async ([s, e]) => {
    const { bytes } = await fetchRange(url, loc.start + s, loc.start + e - 1, {
      signal: opts.signal,
      expectedLastModified: loc.lastModified,
      onRetry: opts.onRetry,
      onOffline: opts.onOffline,
    });
    moov.set(bytes, s);
    loaded += bytes.byteLength;
    opts.onProgress?.(loaded, loc.size);
  });
  return parseAudioTrack(moov, loc.lastModified);
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/concurrency.ts lib/listen/index-loader.ts tests/unit/listen/concurrency.test.ts tests/unit/listen/index-loader.test.ts
git commit -m "feat(listen): locate and load the moov in pieces with progress"
```

---

### Task 9: IndexedDB cache of AudioIndex

**Files:**
- Create: `web-new/lib/listen/index-cache.ts`
- Test: `web-new/tests/unit/listen/index-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/index-cache.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedIndex, putCachedIndex, deleteCachedIndex, CACHE_KEEP } from '@/lib/listen/index-cache';
import type { AudioIndex } from '@/lib/listen/types';

const index = (tag: number): AudioIndex => ({
  version: 1, lastModified: `LM${tag}`, timescale: 48000, durationSec: 10, sampleRate: 48000, channelCount: 2,
  codec: 'mp4a.40.2', audioSpecificConfig: Uint8Array.of(0x11, 0x90),
  sampleSizes: Uint16Array.of(tag, 2, 3), sttsCounts: Uint32Array.of(3), sttsDeltas: Uint32Array.of(1024),
  runFirst: Uint32Array.of(0), runCount: Uint32Array.of(3), runOffset: Float64Array.of(2 ** 33), runSize: Uint32Array.of(6), runStartTicks: Float64Array.of(0),
});

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('wubby-listen');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('index-cache', () => {
  it('round-trips an index with its typed arrays intact', async () => {
    await putCachedIndex('h1', index(1));
    const got = await getCachedIndex('h1');
    expect(got?.lastModified).toBe('LM1');
    expect(got?.sampleSizes).toBeInstanceOf(Uint16Array);
    expect(got?.runOffset[0]).toBe(2 ** 33);
  });

  it('returns null for an unknown VOD', async () => {
    expect(await getCachedIndex('nope')).toBeNull();
  });

  it(`keeps only the ${10} most recently saved`, async () => {
    for (let i = 0; i < CACHE_KEEP + 3; i++) await putCachedIndex(`h${i}`, index(i), 1000 + i);
    expect(await getCachedIndex('h0')).toBeNull();
    expect(await getCachedIndex('h2')).toBeNull();
    expect(await getCachedIndex(`h${CACHE_KEEP + 2}`)).not.toBeNull();
  });

  it('deletes an entry', async () => {
    await putCachedIndex('h1', index(1));
    await deleteCachedIndex('h1');
    expect(await getCachedIndex('h1')).toBeNull();
  });

  it('never throws when IndexedDB is unavailable (Listen still works, just uncached)', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });
    await expect(getCachedIndex('h1')).resolves.toBeNull();
    await expect(putCachedIndex('h1', index(1))).resolves.toBeUndefined();
    open.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/index-cache.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/index-cache.ts
// About 2 MB per VOD (997k 16-bit sample sizes for a 6 h stream). Saves re-downloading the 23.6 MB moov.
// Every function swallows storage errors: a broken cache must never break Listen.
import type { AudioIndex } from './types';

const DB_NAME = 'wubby-listen';
const STORE = 'audio-index';
export const CACHE_KEEP = 10;

interface Entry {
  hash: string;
  savedAt: number;
  index: AudioIndex;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'hash' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getCachedIndex(hash: string): Promise<AudioIndex | null> {
  try {
    const entry = (await withStore<Entry | undefined>('readonly', (s) => s.get(hash) as IDBRequest<Entry | undefined>)) ?? null;
    return entry?.index ?? null;
  } catch {
    return null;
  }
}

export async function putCachedIndex(hash: string, index: AudioIndex, now = Date.now()): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.put({ hash, savedAt: now, index } satisfies Entry));
    const all = (await withStore<Entry[]>('readonly', (s) => s.getAll() as IDBRequest<Entry[]>)) ?? [];
    const stale = all.sort((a, b) => b.savedAt - a.savedAt).slice(CACHE_KEEP);
    if (stale.length) {
      await withStore('readwrite', (s) => {
        for (const e of stale) s.delete(e.hash);
        return null;
      });
    }
  } catch {
    // Quota or private mode: Listen re-downloads the moov next time. Acceptable.
  }
}

export async function deleteCachedIndex(hash: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(hash));
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/index-cache.ts tests/unit/listen/index-cache.test.ts
git commit -m "feat(listen): cache parsed audio indexes in IndexedDB"
```

---

### Task 10: Positions, speed and the saved-position hook

**Files:**
- Create: `web-new/lib/listen/positions.ts`, `web-new/lib/listen/useSavedPosition.ts`
- Test: `web-new/tests/unit/listen/positions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/positions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  readPosition, writePosition, resumeTime, isFinished, readRate, writeRate, formatClock, positionKey,
} from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';

beforeEach(() => localStorage.clear());

describe('positions', () => {
  it('round-trips a position', () => {
    writePosition('h', 8054.6, 21270, localStorage, 1000);
    expect(readPosition('h')).toEqual({ t: 8055, d: 21270, at: 1000 });
  });

  it('ignores the first 5 seconds (an accidental tap is not a listen)', () => {
    writePosition('h', 4, 100);
    expect(readPosition('h')).toBeNull();
  });

  it('survives garbage in storage', () => {
    localStorage.setItem(positionKey('h'), '{nope');
    expect(readPosition('h')).toBeNull();
  });

  it('resumes 3 s early, and from 0 once within the last 2 minutes', () => {
    expect(resumeTime(null)).toBe(0);
    expect(resumeTime({ t: 100, d: 1000, at: 0 })).toBe(97);
    expect(isFinished({ t: 900, d: 1000, at: 0 })).toBe(true);
    expect(resumeTime({ t: 900, d: 1000, at: 0 })).toBe(0);
  });

  it('remembers the speed, defaulting to 1×', () => {
    expect(readRate()).toBe(1);
    writeRate(1.5);
    expect(readRate()).toBe(1.5);
    writeRate(1);
    expect(readRate()).toBe(1);
  });

  it('formats clocks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(8045)).toBe('2:14:05');
  });
});

describe('useSavedPosition', () => {
  it('updates when a position is written in the same tab', () => {
    const { result } = renderHook(() => useSavedPosition('h'));
    expect(result.current).toBeNull();
    act(() => writePosition('h', 120, 1000));
    expect(result.current?.t).toBe(120);
  });

  it('returns null with no hash', () => {
    const { result } = renderHook(() => useSavedPosition(undefined));
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/positions.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/positions.ts
// Per-VOD listening/watching position and the global speed, in localStorage.
// Storage failures (quota, private mode) are swallowed: losing a position is acceptable, crashing is not.
import type { PlaybackRate } from './types';

export interface SavedPosition {
  t: number;
  d: number;
  at: number;
}

const POS_PREFIX = 'listen:pos:';
export const RATE_KEY = 'listen:rate';
/** Fired on window after a same-tab write (the `storage` event only fires in OTHER tabs). */
export const POSITION_EVENT = 'listen-position';
/** Within this many seconds of the end counts as finished. */
export const FINISHED_WITHIN_SEC = 120;

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const positionKey = (hash: string) => POS_PREFIX + hash;

export function parsePosition(raw: string | null): SavedPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SavedPosition>;
    if (typeof p.t !== 'number' || !Number.isFinite(p.t) || typeof p.d !== 'number') return null;
    return { t: p.t, d: p.d, at: Number(p.at) || 0 };
  } catch {
    return null;
  }
}

export function readPosition(hash: string, storage: Reader | null = safeStorage()): SavedPosition | null {
  return storage ? parsePosition(storage.getItem(positionKey(hash))) : null;
}

export function writePosition(hash: string, t: number, d: number, storage: Writer | null = safeStorage(), now = Date.now()): void {
  if (!storage || !Number.isFinite(t) || t < 5) return;
  try {
    storage.setItem(positionKey(hash), JSON.stringify({ t: Math.round(t), d: Number.isFinite(d) ? Math.round(d) : 0, at: now }));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(POSITION_EVENT));
}

export function isFinished(p: SavedPosition | null): boolean {
  return !!p && p.d > 0 && p.t >= p.d - FINISHED_WITHIN_SEC;
}

/** Where to start: 3 s before the saved spot for context, or 0 if none or finished. */
export function resumeTime(p: SavedPosition | null): number {
  if (!p || isFinished(p)) return 0;
  return Math.max(0, p.t - 3);
}

export function readRate(storage: Reader | null = safeStorage()): PlaybackRate {
  return storage?.getItem(RATE_KEY) === '1.5' ? 1.5 : 1;
}

export function writeRate(rate: PlaybackRate, storage: Writer | null = safeStorage()): void {
  try {
    storage?.setItem(RATE_KEY, String(rate));
  } catch {
    // ignore
  }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
```

```ts
// lib/listen/useSavedPosition.ts
'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { parsePosition, positionKey, POSITION_EVENT, type SavedPosition } from './positions';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(POSITION_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(POSITION_EVENT, onChange);
  };
}

/** The saved position for a VOD, live-updating. Null on the server and before any save. */
export function useSavedPosition(hash: string | undefined): SavedPosition | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      if (!hash) return null;
      try {
        return window.localStorage.getItem(positionKey(hash));
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => parsePosition(raw), [raw]);
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/positions.ts lib/listen/useSavedPosition.ts tests/unit/listen/positions.test.ts
git commit -m "feat(listen): per-VOD positions, remembered speed, live saved-position hook"
```

---

### Task 11: Buffer planner (pure)

**Files:**
- Create: `web-new/lib/listen/buffer-planner.ts`
- Test: `web-new/tests/unit/listen/buffer-planner.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/buffer-planner.test.ts
import { describe, it, expect } from 'vitest';
import { runIndexAt, runStartSec, runEndSec, planFetches, evictionEnd, runsStartingBefore } from '@/lib/listen/buffer-planner';
import type { AudioIndex } from '@/lib/listen/types';

/** n runs of 4 s each at 48 kHz. */
function fakeIndex(n: number): AudioIndex {
  return {
    version: 1, lastModified: null, timescale: 48000, durationSec: n * 4, sampleRate: 48000, channelCount: 2, codec: 'mp4a.40.2',
    audioSpecificConfig: new Uint8Array(2), sampleSizes: new Uint16Array(0), sttsCounts: new Uint32Array(0), sttsDeltas: new Uint32Array(0),
    runFirst: new Uint32Array(n), runCount: new Uint32Array(n), runOffset: new Float64Array(n), runSize: new Uint32Array(n),
    runStartTicks: Float64Array.from({ length: n }, (_, i) => i * 4 * 48000),
  };
}
const idx = fakeIndex(100); // 400 s

describe('run timing', () => {
  it('finds the run containing a time', () => {
    expect(runIndexAt(idx, 0)).toBe(0);
    expect(runIndexAt(idx, 3.99)).toBe(0);
    expect(runIndexAt(idx, 4)).toBe(1);
    expect(runIndexAt(idx, 9999)).toBe(99);
    expect(runStartSec(idx, 2)).toBe(8);
    expect(runEndSec(idx, 2)).toBe(12);
    expect(runEndSec(idx, 99)).toBe(400);
  });
});

describe('planFetches', () => {
  const base = { index: idx, aheadSec: 20, maxInFlight: 6, appended: new Set<number>(), inFlight: new Set<number>() };

  it('fetches from the playhead run up to aheadSec', () => {
    expect(planFetches({ ...base, playheadSec: 10 })).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('skips appended and in-flight runs and respects the in-flight cap', () => {
    expect(planFetches({ ...base, playheadSec: 10, appended: new Set([2, 3]), inFlight: new Set([4, 5, 6]) })).toEqual([7, 8, 9]);
  });

  it('plans nothing when the read-ahead is full', () => {
    expect(planFetches({ ...base, playheadSec: 0, appended: new Set([0, 1, 2, 3, 4]) })).toEqual([]);
  });

  it('stops at the last run', () => {
    expect(planFetches({ ...base, playheadSec: 396 })).toEqual([99]);
  });
});

describe('eviction', () => {
  it('evicts behind the playhead only once 60 s have built up, keeping 30 s', () => {
    expect(evictionEnd(100, null)).toBeNull();
    expect(evictionEnd(100, 50)).toBeNull();
    expect(evictionEnd(100, 30)).toBe(70);
  });

  it('lists every run touched by an eviction so it is fetched again if needed', () => {
    expect(runsStartingBefore(idx, new Set([0, 1, 2, 3, 10]), 9)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/buffer-planner.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/buffer-planner.ts
// Pure decisions for the engine: which runs to fetch next and what to evict. No I/O.
import type { AudioIndex } from './types';

export const KEEP_BEHIND_SEC = 30;
export const EVICT_WHEN_BEHIND_SEC = 60;

export const runStartSec = (index: AudioIndex, r: number) => index.runStartTicks[r] / index.timescale;
export const runEndSec = (index: AudioIndex, r: number) =>
  r + 1 < index.runStartTicks.length ? index.runStartTicks[r + 1] / index.timescale : index.durationSec;

/** Index of the run whose start is the last one ≤ sec (clamped). -1 for an empty index. */
export function runIndexAt(index: AudioIndex, sec: number): number {
  const ticks = sec * index.timescale;
  let lo = 0;
  let hi = index.runStartTicks.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (index.runStartTicks[mid] <= ticks) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface PlanInput {
  index: AudioIndex;
  playheadSec: number;
  aheadSec: number;
  appended: ReadonlySet<number>;
  inFlight: ReadonlySet<number>;
  maxInFlight: number;
}

/** Runs to start fetching now, in playback order. */
export function planFetches(p: PlanInput): number[] {
  const out: number[] = [];
  const budget = p.maxInFlight - p.inFlight.size;
  if (budget <= 0) return out;
  const limit = p.playheadSec + p.aheadSec;
  const n = p.index.runStartTicks.length;
  for (let r = Math.max(0, runIndexAt(p.index, p.playheadSec)); r < n && runStartSec(p.index, r) < limit && out.length < budget; r++) {
    if (!p.appended.has(r) && !p.inFlight.has(r)) out.push(r);
  }
  return out;
}

/** End of the [0, end) range to remove from the SourceBuffer, or null when nothing is old enough. */
export function evictionEnd(playheadSec: number, bufferedStartSec: number | null): number | null {
  if (bufferedStartSec === null) return null;
  return bufferedStartSec < playheadSec - EVICT_WHEN_BEHIND_SEC ? playheadSec - KEEP_BEHIND_SEC : null;
}

/** Appended runs that an eviction of [0, sec) touches, so they are no longer complete in the buffer. */
export function runsStartingBefore(index: AudioIndex, appended: Iterable<number>, sec: number): number[] {
  return [...appended].filter((r) => runStartSec(index, r) < sec).sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/buffer-planner.ts tests/unit/listen/buffer-planner.test.ts
git commit -m "feat(listen): pure buffer planner (read-ahead, in-flight cap, eviction)"
```

---

### Task 12: Media Session binding

**Files:**
- Create: `web-new/lib/listen/media-session.ts`
- Test: `web-new/tests/unit/listen/media-session.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/listen/media-session.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bindMediaSession } from '@/lib/listen/media-session';

type Handler = ((details: MediaSessionActionDetails) => void) | null;
let handlers: Record<string, Handler>;
let session: { metadata: unknown; playbackState: string; setActionHandler: ReturnType<typeof vi.fn>; setPositionState: ReturnType<typeof vi.fn> };

beforeEach(() => {
  handlers = {};
  session = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, h: Handler) => {
      handlers[action] = h;
    }),
    setPositionState: vi.fn(),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  vi.stubGlobal('MediaMetadata', class {
    constructor(public init: unknown) {}
  });
});
afterEach(() => vi.unstubAllGlobals());

function fakeAudio() {
  const audio = document.createElement('audio');
  Object.defineProperty(audio, 'duration', { value: 3600, configurable: true });
  Object.defineProperty(audio, 'currentTime', { value: 120, writable: true, configurable: true });
  return audio;
}

describe('bindMediaSession', () => {
  it('sets title and artwork and wires the lock-screen actions', () => {
    const h = { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() };
    bindMediaSession(fakeAudio(), { title: 'Costco Pizzas', artist: 'PayMoneyWubby', artworkUrl: 'https://x/t.webp' }, h);
    expect(session.metadata).toMatchObject({ init: { title: 'Costco Pizzas', artist: 'PayMoneyWubby', artwork: [{ src: 'https://x/t.webp' }] } });
    handlers.play!({ action: 'play' });
    handlers.pause!({ action: 'pause' });
    handlers.seekbackward!({ action: 'seekbackward' });
    handlers.seekforward!({ action: 'seekforward', seekOffset: 10 });
    handlers.seekto!({ action: 'seekto', seekTime: 600 });
    expect(h.play).toHaveBeenCalled();
    expect(h.pause).toHaveBeenCalled();
    expect(h.seekBy.mock.calls).toEqual([[-30], [10]]);
    expect(h.seekTo).toHaveBeenCalledWith(600);
  });

  it('reports position including playback rate on play/ratechange/seeked', () => {
    const audio = fakeAudio();
    bindMediaSession(audio, { title: 't' }, { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() });
    audio.playbackRate = 1.5;
    audio.dispatchEvent(new Event('ratechange'));
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 3600, position: 120, playbackRate: 1.5 });
  });

  it('unbinds everything', () => {
    const unbind = bindMediaSession(fakeAudio(), { title: 't' }, { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() });
    unbind();
    expect(session.metadata).toBeNull();
    expect(handlers.play).toBeNull();
    expect(handlers.seekto).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/listen/media-session.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/listen/media-session.ts
// Lock-screen / notification controls for Listen. Returns an unbind function.
export interface SessionMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}
export interface SessionHandlers {
  play(): void;
  pause(): void;
  seekBy(deltaSec: number): void;
  seekTo(sec: number): void;
}

const ACTIONS: MediaSessionAction[] = ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'];
const SKIP_SEC = 30;

export function bindMediaSession(audio: HTMLMediaElement, meta: SessionMeta, h: SessionHandlers): () => void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return () => undefined;
  const session = navigator.mediaSession;

  try {
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist ?? 'PayMoneyWubby',
        album: 'The Wubby Archive',
        artwork: meta.artworkUrl ? [{ src: meta.artworkUrl, sizes: '512x288', type: 'image/webp' }] : [],
      });
    }
  } catch {
    // Metadata is cosmetic; controls still work without it.
  }

  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Older browsers throw for unsupported actions.
    }
  };
  set('play', () => h.play());
  set('pause', () => h.pause());
  set('seekbackward', (d) => h.seekBy(-(d.seekOffset ?? SKIP_SEC)));
  set('seekforward', (d) => h.seekBy(d.seekOffset ?? SKIP_SEC));
  set('seekto', (d) => {
    if (typeof d.seekTime === 'number') h.seekTo(d.seekTime);
  });

  const updatePosition = () => {
    session.playbackState = audio.paused ? 'paused' : 'playing';
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !session.setPositionState) return;
    try {
      session.setPositionState({ duration, position: Math.min(Math.max(0, audio.currentTime), duration), playbackRate: audio.playbackRate || 1 });
    } catch {
      // A transiently inconsistent position must not break playback.
    }
  };
  const events = ['play', 'pause', 'ratechange', 'seeked', 'durationchange'] as const;
  for (const e of events) audio.addEventListener(e, updatePosition);
  updatePosition();

  return () => {
    for (const e of events) audio.removeEventListener(e, updatePosition);
    for (const a of ACTIONS) set(a, null);
    try {
      session.metadata = null;
      session.playbackState = 'none';
    } catch {
      // ignore
    }
  };
}
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/listen/media-session.ts tests/unit/listen/media-session.test.ts
git commit -m "feat(listen): lock-screen Media Session controls with rate-aware position"
```

---

### Task 13: The Listen engine (MSE)

`MediaSource` doesn't exist in jsdom, so this file has **no unit test**. Its pure decisions are tested in Task 11, and its behaviour is covered by the Playwright spec in Task 18. Read the spec's *Failure handling → Streaming playback* before writing it.

**Files:**
- Create: `web-new/lib/listen/listen-engine.ts`

- [ ] **Step 1: Implement**

```ts
// lib/listen/listen-engine.ts
// Owns one <audio> + MediaSource for one VOD: index loading, read-ahead, seeking, eviction,
// failures, Media Session, and cleanup. UI subscribes via subscribe/getSnapshot.
import { evictionEnd, planFetches, runIndexAt, runStartSec, runsStartingBefore } from './buffer-planner';
import { buildInitSegment, buildRunSegment } from './fmp4';
import { deleteCachedIndex, getCachedIndex, putCachedIndex } from './index-cache';
import { loadAudioIndex, type FetchRangeFn, type LoadIndexOptions } from './index-loader';
import { bindMediaSession } from './media-session';
import { fetchRange as defaultFetchRange, RangeFetchError } from './range-fetch';
import { ListenError, type AudioIndex, type Bytes, type PlaybackRate } from './types';

export type ListenPhase = 'preparing' | 'ready' | 'stalled' | 'error';

export interface ListenSnapshot {
  phase: ListenPhase;
  prepare: { loaded: number; total: number } | null;
  errorMessage: string | null;
  playing: boolean;
  /** Playing but starved of data. */
  waiting: boolean;
  /** A fetch is retrying or waiting for the network. */
  reconnecting: boolean;
  currentTime: number;
  duration: number;
  rate: PlaybackRate;
  bytesFetched: number;
  bufferedAheadSec: number;
}

export interface ListenEngineDeps {
  fetchRange?: FetchRangeFn;
  loadIndex?: (url: string, opts: LoadIndexOptions) => Promise<AudioIndex>;
  getCached?: (hash: string) => Promise<AudioIndex | null>;
  putCached?: (hash: string, index: AudioIndex) => Promise<void>;
  deleteCached?: (hash: string) => Promise<void>;
}

export interface ListenEngineOptions {
  url: string;
  hash: string;
  title: string;
  artworkUrl?: string;
  startAt: number;
  rate: PlaybackRate;
  /** Read-ahead target. Default 180 s. */
  aheadSec?: number;
  /** Concurrent run fetches. Default 6. */
  maxInFlight?: number;
  deps?: ListenEngineDeps;
}

/** Playing yet starved for this long → "stalled" with a Retry button. */
const STALL_AFTER_MS = 30_000;

type Op =
  | { kind: 'append'; data: Bytes; resolve: () => void; reject: (e: unknown) => void }
  | { kind: 'remove'; start: number; end: number; resolve: () => void; reject: (e: unknown) => void };

const isAbort = (err: unknown) =>
  (err instanceof RangeFetchError && err.code === 'aborted') || (err instanceof DOMException && err.name === 'AbortError');
const isQuota = (err: unknown) => err instanceof DOMException && err.name === 'QuotaExceededError';
const superseded = () => new DOMException('Superseded', 'AbortError');

export function describeListenError(err: unknown): string {
  if (err instanceof RangeFetchError) {
    switch (err.code) {
      case 'not-found':
        return 'This VOD is no longer on the archive.';
      case 'file-changed':
        return 'This VOD changed on the archive. Close Listen and open it again.';
      case 'range-unsupported':
        return "The archive didn't send just the audio, so Listen stopped rather than download the whole video.";
      case 'exhausted':
        return "Couldn't reach the archive. Check your connection and retry.";
      default:
        return `The archive answered with an error (${err.status ?? err.code}).`;
    }
  }
  if (err instanceof ListenError) {
    if (err.code === 'no-audio-track') return 'This VOD has no audio track.';
    if (err.code === 'unsupported-audio') return "This VOD's audio format isn't supported for Listen.";
    return "This VOD's file couldn't be read for Listen.";
  }
  return 'Listen hit an unexpected error. Switch to Watch, or retry.';
}

export class ListenEngine {
  readonly audio: HTMLAudioElement;
  private readonly opts: ListenEngineOptions;
  private readonly maxInFlight: number;
  private aheadSec: number;
  private readonly mediaSource = new MediaSource();
  private readonly objectUrl: string;
  private readonly life = new AbortController();
  private gen = 0;
  private genController = new AbortController();
  private index: AudioIndex | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private readonly appended = new Set<number>();
  private readonly inFlight = new Set<number>();
  private ops: Op[] = [];
  private current: Op | null = null;
  private currentFailed = false;
  private sequence = 0;
  private desiredRate: PlaybackRate;
  private phase: ListenPhase = 'preparing';
  private prepare: { loaded: number; total: number } | null = null;
  private errorMessage: string | null = null;
  private reconnecting = false;
  private bytesFetched = 0;
  private starvedSince: number | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private unbindSession: (() => void) | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: ListenSnapshot;

  constructor(opts: ListenEngineOptions) {
    this.opts = opts;
    this.maxInFlight = opts.maxInFlight ?? 6;
    this.aheadSec = opts.aheadSec ?? 180;
    this.desiredRate = opts.rate;
    this.audio = document.createElement('audio');
    this.audio.preload = 'auto';
    this.audio.hidden = true;
    this.audio.dataset.testid = 'listen-audio';
    document.body.appendChild(this.audio);
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.audio.src = this.objectUrl;
    this.snapshot = this.computeSnapshot();
  }

  // ---- public API -------------------------------------------------------------------------

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  getSnapshot = (): ListenSnapshot => this.snapshot;

  /** Call inside the tap handler, before start(), so Chrome treats playback as user-initiated. */
  play(): void {
    this.audio.playbackRate = this.desiredRate;
    void this.audio.play().catch(() => this.emit());
  }

  pause(): void {
    this.audio.pause();
  }

  toggle(): void {
    if (this.audio.paused) this.play();
    else this.pause();
  }

  seekTo(sec: number): void {
    const end = this.index ? Math.max(0, this.index.durationSec - 0.5) : sec;
    this.audio.currentTime = Math.min(Math.max(0, sec), end);
  }

  seekBy(deltaSec: number): void {
    this.seekTo(this.audio.currentTime + deltaSec);
  }

  setRate(rate: PlaybackRate): void {
    this.desiredRate = rate;
    this.audio.playbackRate = rate;
    this.emit();
  }

  retry(): void {
    if (this.disposed) return;
    if (!this.index) {
      void this.start();
      return;
    }
    this.phase = 'ready';
    this.errorMessage = null;
    this.starvedSince = null;
    this.restartGeneration();
    this.pump();
    this.emit();
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    this.phase = 'preparing';
    this.errorMessage = null;
    this.emit();
    const deps = this.opts.deps ?? {};
    try {
      let index = await (deps.getCached ?? getCachedIndex)(this.opts.hash);
      if (!index) {
        index = await (deps.loadIndex ?? loadAudioIndex)(this.opts.url, {
          signal: this.life.signal,
          fetchRange: deps.fetchRange,
          onProgress: (loaded, total) => {
            this.prepare = { loaded, total };
            this.reconnecting = false;
            this.emit();
          },
          onRetry: () => this.setReconnecting(true),
          onOffline: () => this.setReconnecting(true),
        });
        void (deps.putCached ?? putCachedIndex)(this.opts.hash, index);
      }
      if (this.disposed) return;
      this.index = index;
      this.prepare = null;
      this.reconnecting = false;
      await this.openSourceBuffer(index);
      if (this.disposed) return;
      this.audio.currentTime = Math.min(Math.max(0, this.opts.startAt), Math.max(0, index.durationSec - 1));
      this.attachListeners();
      this.unbindSession = bindMediaSession(
        this.audio,
        { title: this.opts.title, artworkUrl: this.opts.artworkUrl },
        { play: () => this.play(), pause: () => this.pause(), seekBy: (s) => this.seekBy(s), seekTo: (s) => this.seekTo(s) },
      );
      this.phase = 'ready';
      this.tick = setInterval(() => this.onTick(), 1000);
      this.pump();
      this.emit();
    } catch (err) {
      this.fail(err);
    }
  }

  /** Idempotent. Aborts all fetches, detaches MSE, clears Media Session, removes the element. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.tick) clearInterval(this.tick);
    this.genController.abort();
    this.life.abort();
    this.dropPendingAppends();
    this.current?.reject(superseded());
    this.current = null;
    this.ops = [];
    this.unbindSession?.();
    this.audio.pause();
    try {
      if (this.mediaSource.readyState === 'open' && !this.sourceBuffer?.updating) this.mediaSource.endOfStream();
    } catch {
      // already closing
    }
    this.audio.removeAttribute('src');
    this.audio.load();
    URL.revokeObjectURL(this.objectUrl);
    this.audio.remove();
    this.listeners.clear();
  }

  // ---- setup ------------------------------------------------------------------------------

  private async openSourceBuffer(index: AudioIndex): Promise<void> {
    if (this.mediaSource.readyState !== 'open') {
      await new Promise<void>((resolve) => this.mediaSource.addEventListener('sourceopen', () => resolve(), { once: true }));
    }
    const mime = `audio/mp4; codecs="${index.codec}"`;
    if (!MediaSource.isTypeSupported(mime)) throw new ListenError('unsupported-audio', `This browser can't play ${index.codec}`);
    const sb = this.mediaSource.addSourceBuffer(mime);
    sb.mode = 'segments';
    sb.addEventListener('updateend', () => this.runOps());
    sb.addEventListener('error', () => {
      this.currentFailed = true;
    });
    this.sourceBuffer = sb;
    await this.enqueue({ kind: 'append', data: buildInitSegment(index) });
    this.mediaSource.duration = index.durationSec;
  }

  private attachListeners(): void {
    const signal = this.life.signal;
    const a = this.audio;
    a.addEventListener('seeking', () => this.onSeeking(), { signal });
    a.addEventListener('play', () => {
      // Some lock-screen resumes reset the rate; the user's choice wins.
      if (a.playbackRate !== this.desiredRate) a.playbackRate = this.desiredRate;
      this.emit();
    }, { signal });
    for (const e of ['pause', 'playing', 'waiting', 'timeupdate', 'ratechange', 'durationchange', 'ended'] as const) {
      a.addEventListener(e, () => this.emit(), { signal });
    }
    window.addEventListener('online', () => this.pump(), { signal });
  }

  // ---- fetching ---------------------------------------------------------------------------

  private pump(): void {
    const index = this.index;
    if (!index || this.disposed || this.phase !== 'ready' || !this.sourceBuffer) return;
    const playhead = this.audio.currentTime;

    // The browser may evict on its own; trust the buffer, not our bookkeeping.
    for (const r of [...this.appended]) if (!this.isBuffered(runStartSec(index, r) + 0.01)) this.appended.delete(r);

    const evictTo = evictionEnd(playhead, this.bufferedStart());
    if (evictTo !== null && evictTo > 0) void this.evict(evictTo);

    const runs = planFetches({ index, playheadSec: playhead, aheadSec: this.aheadSec, appended: this.appended, inFlight: this.inFlight, maxInFlight: this.maxInFlight });
    const gen = this.gen;
    const signal = this.genController.signal;
    for (const r of runs) {
      this.inFlight.add(r);
      void this.fetchRun(r, gen, signal);
    }
  }

  private async fetchRun(r: number, gen: number, signal: AbortSignal): Promise<void> {
    const index = this.index!;
    const fetchRange = this.opts.deps?.fetchRange ?? defaultFetchRange;
    const start = index.runOffset[r];
    try {
      const { bytes } = await fetchRange(this.opts.url, start, start + index.runSize[r] - 1, {
        signal,
        expectedLastModified: index.lastModified,
        onRetry: () => this.setReconnecting(true),
        onOffline: () => this.setReconnecting(true),
      });
      if (gen !== this.gen || this.disposed) return;
      this.bytesFetched += bytes.byteLength;
      this.setReconnecting(false);
      await this.appendRun(r, bytes);
    } catch (err) {
      if (gen !== this.gen || this.disposed || isAbort(err)) return;
      if (err instanceof RangeFetchError && err.code === 'exhausted') {
        this.phase = 'stalled';
        this.emit();
        return;
      }
      if (err instanceof RangeFetchError && err.code === 'file-changed') {
        void (this.opts.deps?.deleteCached ?? deleteCachedIndex)(this.opts.hash);
      }
      this.fail(err);
    } finally {
      if (gen === this.gen) {
        this.inFlight.delete(r);
        this.pump();
      }
    }
  }

  private async appendRun(r: number, bytes: Bytes): Promise<void> {
    const segment = buildRunSegment(this.index!, r, bytes, ++this.sequence);
    try {
      await this.enqueue({ kind: 'append', data: segment });
    } catch (err) {
      if (isQuota(err)) {
        // Memory pressure: shrink the read-ahead, drop more history; the run is refetched later.
        this.aheadSec = Math.max(60, Math.floor(this.aheadSec / 2));
        await this.evict(this.audio.currentTime - 10).catch(() => undefined);
        return;
      }
      throw err;
    }
    this.appended.add(r);
    this.maybeEndOfStream();
    this.emit();
  }

  private async evict(end: number): Promise<void> {
    if (end <= 0 || !this.index) return;
    for (const r of runsStartingBefore(this.index, this.appended, end)) this.appended.delete(r);
    await this.enqueue({ kind: 'remove', start: 0, end });
  }

  private maybeEndOfStream(): void {
    const index = this.index!;
    const last = index.runStartTicks.length - 1;
    if (!this.appended.has(last) || this.ops.length || this.sourceBuffer?.updating) return;
    for (let r = Math.max(0, runIndexAt(index, this.audio.currentTime)); r <= last; r++) if (!this.appended.has(r)) return;
    try {
      if (this.mediaSource.readyState === 'open') this.mediaSource.endOfStream();
    } catch {
      // A later append reopens the stream; nothing to do.
    }
  }

  // ---- SourceBuffer op queue (never append while updating) --------------------------------

  private enqueue(op: { kind: 'append'; data: Bytes } | { kind: 'remove'; start: number; end: number }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.ops.push({ ...op, resolve, reject } as Op);
      this.runOps();
    });
  }

  private runOps(): void {
    const sb = this.sourceBuffer;
    if (!sb || sb.updating) return;
    if (this.current) {
      const done = this.current;
      this.current = null;
      if (this.currentFailed) done.reject(new Error('SourceBuffer rejected the data'));
      else done.resolve();
      this.currentFailed = false;
    }
    while (!sb.updating && !this.current && this.ops.length) {
      const op = this.ops.shift()!;
      try {
        if (op.kind === 'append') sb.appendBuffer(op.data);
        else sb.remove(op.start, op.end);
        this.current = op;
      } catch (err) {
        op.reject(err);
      }
    }
  }

  private dropPendingAppends(): void {
    this.ops = this.ops.filter((op) => {
      if (op.kind !== 'append') return true;
      op.reject(superseded());
      return false;
    });
  }

  // ---- events -----------------------------------------------------------------------------

  private onSeeking(): void {
    if (!this.isBuffered(this.audio.currentTime)) this.restartGeneration();
    this.pump();
    this.emit();
  }

  /** Abandon in-flight work for the old position; stale results are dropped by the gen check. */
  private restartGeneration(): void {
    this.gen++;
    this.genController.abort();
    this.genController = new AbortController();
    this.inFlight.clear();
    this.dropPendingAppends();
  }

  private onTick(): void {
    this.pump();
    const starving = !this.audio.paused && this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    if (!starving) this.starvedSince = null;
    else if (this.starvedSince === null) this.starvedSince = Date.now();
    else if (this.phase === 'ready' && Date.now() - this.starvedSince > STALL_AFTER_MS) this.phase = 'stalled';
    this.emit();
  }

  private setReconnecting(value: boolean): void {
    if (this.reconnecting === value) return;
    this.reconnecting = value;
    this.emit();
  }

  private fail(err: unknown): void {
    if (this.disposed || isAbort(err)) return;
    this.phase = 'error';
    this.errorMessage = describeListenError(err);
    this.genController.abort();
    this.emit();
  }

  // ---- buffer inspection ------------------------------------------------------------------

  private isBuffered(t: number): boolean {
    try {
      const b = this.sourceBuffer?.buffered;
      if (!b) return false;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= t && t < b.end(i)) return true;
    } catch {
      // SourceBuffer removed
    }
    return false;
  }

  private bufferedStart(): number | null {
    try {
      const b = this.sourceBuffer?.buffered;
      return b && b.length ? b.start(0) : null;
    } catch {
      return null;
    }
  }

  private bufferedAhead(t: number): number {
    try {
      const b = this.sourceBuffer?.buffered;
      if (b) for (let i = 0; i < b.length; i++) if (b.start(i) <= t && t < b.end(i)) return b.end(i) - t;
    } catch {
      // ignore
    }
    return 0;
  }

  // ---- snapshot ---------------------------------------------------------------------------

  private emit(): void {
    if (this.disposed) return;
    this.snapshot = this.computeSnapshot();
    for (const l of this.listeners) l();
  }

  private computeSnapshot(): ListenSnapshot {
    const t = this.audio.currentTime || 0;
    return {
      phase: this.phase,
      prepare: this.prepare,
      errorMessage: this.errorMessage,
      playing: !this.audio.paused,
      waiting: !this.audio.paused && this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
      reconnecting: this.reconnecting,
      currentTime: t,
      duration: this.index?.durationSec ?? 0,
      rate: this.desiredRate,
      bytesFetched: this.bytesFetched,
      bufferedAheadSec: this.bufferedAhead(t),
    };
  }
}
```

- [ ] **Step 2: Type check and lint the new file**

Run: `npx tsc --noEmit && npx eslint lib/listen`
Expected: 0 type errors, no lint *errors* in `lib/listen`.

- [ ] **Step 3: Commit**

```bash
git add lib/listen/listen-engine.ts
git commit -m "feat(listen): MSE engine with read-ahead, seek generations, eviction, failure states, cleanup"
```

---

### Task 14: Minimal Listen wiring for the spike

Just enough UI to test on the phone before building the real screen: a Listen button and a bare audio card.

**Files:**
- Create: `web-new/components/listen/SpeedToggle.tsx`, `web-new/components/listen/ListenButton.tsx`, `web-new/components/listen/AudioCard.tsx`
- Modify: `web-new/components/video/VideoDetailView.tsx`

- [ ] **Step 1: SpeedToggle and ListenButton**

```tsx
// components/listen/SpeedToggle.tsx
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlaybackRate } from '@/lib/listen/types';

export function SpeedToggle({ rate, onChange, className }: { rate: PlaybackRate; onChange: (rate: PlaybackRate) => void; className?: string }) {
  const fast = rate === 1.5;
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={fast}
      aria-label={fast ? 'Speed 1.5×, tap for normal speed' : 'Speed 1×, tap for 1.5×'}
      onClick={() => onChange(fast ? 1 : 1.5)}
      className={cn('h-12 font-mono text-base', fast && 'border-accent-green bg-accent-green/15 text-accent-green', className)}
    >
      {fast ? '1.5× on' : '1.5×'}
    </Button>
  );
}
```

```tsx
// components/listen/ListenButton.tsx
'use client';

import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ListenButton({ onClick, resumeLabel }: { onClick: () => void; resumeLabel?: string }) {
  return (
    <Button type="button" onClick={onClick} className="h-14 w-full gap-2 bg-accent-green text-base text-white hover:bg-accent-green/90">
      <Headphones className="h-5 w-5" aria-hidden />
      Listen
      {resumeLabel ? <span className="font-mono text-sm">· from {resumeLabel}</span> : null}
    </Button>
  );
}
```

- [ ] **Step 2: AudioCard (complete: the Task 15 UI work only touches VideoDetailView/Header/VideoCard)**

```tsx
// components/listen/AudioCard.tsx
'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Headphones, Pause, Play, RotateCcw, RotateCw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpeedToggle } from '@/components/listen/SpeedToggle';
import type { ListenEngine, ListenSnapshot } from '@/lib/listen/listen-engine';
import { formatClock, writePosition } from '@/lib/listen/positions';
import type { PlaybackRate } from '@/lib/listen/types';

const mb = (bytes: number) => (bytes / 1e6).toFixed(1);

function statusLine(s: ListenSnapshot): string {
  if (s.phase === 'preparing') return s.prepare ? `Preparing audio · ${mb(s.prepare.loaded)} / ${mb(s.prepare.total)} MB` : 'Preparing audio…';
  if (s.phase === 'error') return s.errorMessage ?? 'Listen stopped.';
  if (s.phase === 'stalled') return "Can't reach the archive.";
  if (s.reconnecting) return 'Reconnecting…';
  if (s.waiting) return 'Buffering…';
  return `Streaming · ${mb(s.bytesFetched)} MB used`;
}

export interface AudioCardProps {
  engine: ListenEngine;
  hash: string;
  thumbnailUrl?: string;
  onWatch: (atSec: number) => void;
  onRateChange: (rate: PlaybackRate) => void;
}

export function AudioCard({ engine, hash, thumbnailUrl, onWatch, onRateChange }: AudioCardProps) {
  const s = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [drag, setDrag] = useState<number | null>(null);
  const pointerDown = useRef(false);

  // Save the position every 5 s while playing, and whenever the page is hidden or playback pauses.
  useEffect(() => {
    let last = 0;
    const save = () => {
      const snap = engine.getSnapshot();
      writePosition(hash, snap.currentTime, snap.duration);
    };
    const unsubscribe = engine.subscribe(() => {
      const now = Date.now();
      if (now - last >= 5000) {
        last = now;
        save();
      }
    });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    engine.audio.addEventListener('pause', save);
    return () => {
      save();
      unsubscribe();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
      engine.audio.removeEventListener('pause', save);
    };
  }, [engine, hash]);

  const shown = drag ?? s.currentTime;
  const commit = (value: number) => {
    engine.seekTo(value);
    setDrag(null);
  };
  const canRetry = s.phase === 'stalled' || s.phase === 'error';

  return (
    <section aria-label="Listening" className="space-y-5 border-y border-rule bg-background px-4 py-6">
      <div className="flex items-center gap-4">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized
          <img src={thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover grayscale" />
        ) : (
          <div className="flex h-16 w-28 items-center justify-center rounded bg-muted">
            <Headphones className="h-6 w-6 text-ink-muted" aria-hidden />
          </div>
        )}
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-green">Audio only</p>
      </div>

      <div>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.floor(s.duration))}
          step={1}
          value={Math.floor(shown)}
          disabled={s.duration === 0}
          onPointerDown={() => {
            pointerDown.current = true;
          }}
          onPointerUp={(e) => {
            pointerDown.current = false;
            commit(Number(e.currentTarget.value));
          }}
          onChange={(e) => {
            const value = Number(e.currentTarget.value);
            setDrag(value);
            if (!pointerDown.current) commit(value);
          }}
          className="h-8 w-full accent-[hsl(var(--accent-green))]"
        />
        <div className="flex justify-between font-mono text-xs text-ink-muted">
          <span>{formatClock(shown)}</span>
          <span>{formatClock(s.duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8">
        <Button type="button" variant="ghost" size="icon" className="h-14 w-14" aria-label="Back 30 seconds" onClick={() => engine.seekBy(-30)}>
          <RotateCcw className="h-7 w-7" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-16 w-16 rounded-full bg-accent-green text-white hover:bg-accent-green/90"
          aria-label={s.playing ? 'Pause' : 'Play'}
          onClick={() => engine.toggle()}
        >
          {s.playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-14 w-14" aria-label="Forward 30 seconds" onClick={() => engine.seekBy(30)}>
          <RotateCw className="h-7 w-7" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SpeedToggle
          rate={s.rate}
          onChange={(rate) => {
            engine.setRate(rate);
            onRateChange(rate);
          }}
        />
        <Button type="button" variant="outline" className="h-12 gap-2 text-base" onClick={() => onWatch(engine.getSnapshot().currentTime)}>
          <Video className="h-4 w-4" aria-hidden />
          Watch
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3" role="status" aria-live="polite">
        <p className={s.phase === 'error' ? 'text-sm text-destructive' : 'font-mono text-xs text-ink-muted'}>{statusLine(s)}</p>
        {canRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={() => engine.retry()}>
            Retry
          </Button>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire a bare Listen into VideoDetailView (temporary layout, replaced in Task 15)**

In `components/video/VideoDetailView.tsx` add these imports:

```tsx
import { useEffect, useState } from 'react';
import { AudioCard } from '@/components/listen/AudioCard';
import { ListenButton } from '@/components/listen/ListenButton';
import { ListenEngine } from '@/lib/listen/listen-engine';
import { readPosition, readRate, resumeTime, writeRate } from '@/lib/listen/positions';
import type { PlaybackRate } from '@/lib/listen/types';
```

At the top of the component body add:

```tsx
  const hash = video.videoHash;
  const [rate, setRate] = useState<PlaybackRate>(() => readRate());
  const [engine, setEngine] = useState<ListenEngine | null>(null);
  useEffect(() => () => engine?.dispose(), [engine]);

  const changeRate = (next: PlaybackRate) => {
    setRate(next);
    writeRate(next);
  };
  const startListening = () => {
    if (!hash) return;
    const e = new ListenEngine({ url: video.url, hash, title: video.title, artworkUrl: video.thumbnailUrl, startAt: resumeTime(readPosition(hash)), rate });
    e.play(); // inside the tap, so Chrome allows audio
    void e.start();
    setEngine(e);
  };
```

Replace the `<VidstackPlayer … />` element inside the player `motion.div` with:

```tsx
        {engine && hash ? (
          <AudioCard engine={engine} hash={hash} thumbnailUrl={video.thumbnailUrl} onRateChange={changeRate} onWatch={() => setEngine(null)} />
        ) : (
          <>
            <VidstackPlayer videoUrl={video.url} subtitleUrl={subtitleUrl} poster={video.thumbnailUrl} />
            <div className="px-2 pt-3 md:px-0">
              <ListenButton onClick={startListening} />
            </div>
          </>
        )}
```

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 0 type errors; all unit tests pass (the old 173 plus the new Listen tests); build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/listen components/video/VideoDetailView.tsx
git commit -m "feat(listen): bare Listen button and audio card for the phone spike"
```

---

### Task 15: CHECKPOINT: phone spike and throughput (stop here until Lee reports)

This is the spec's decision gate. **Don't start Task 16 until Lee has reported on Steps 2–3.**

**Files:**
- Create: `web-new/lib/listen/measure-entry.ts`
- Create: `web-new/scripts/measure-archive-throughput.mjs`

- [ ] **Step 1: Write and run the throughput measurement (real Chrome, real archive)**

```ts
// lib/listen/measure-entry.ts
// Bundle entry for scripts/measure-archive-throughput.mjs (esbuild). Not imported by the app.
export { loadAudioIndex } from './index-loader';
export { fetchRange } from './range-fetch';
export { mapLimit } from './concurrency';
```

```js
// scripts/measure-archive-throughput.mjs
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
```

Run: `npm run measure:archive -- https://archive.wubby.tv/vods/public/nov_2026/6_no-title_1794002258_000.mp4`
Expected: JSON with `indexSec`, and `runsPerSec`/`fullDownloadMin` for concurrency 6/12/24. Record it in the spec's **Open risks** (replace the "Download speed is an estimate" bullet with the measured numbers) and pick the Phase 2 download concurrency from it.

- [ ] **Step 2: Lee: 15-minute locked-screen test on the Android phone**

On the laptop: `npm run dev` (port 3000). Then:
1. Connect the phone by USB with USB debugging on.
2. Open `chrome://inspect#devices` on the laptop, click **Port forwarding…**, and add `3000` → `localhost:3000`. Tick **Enable port forwarding**.
3. On the phone's Chrome, open `http://localhost:3000`, pick a long VOD, and tap the thumbnail, then **Listen**.
   Because it's `localhost`, this is a secure context, which MSE and Media Session need.
4. Tap **1.5×**, then lock the phone for **15 minutes**. Also switch to another app for a couple of minutes.

Report, yes/no each:
- Audio played the whole 15 minutes.
- The notification shows the title and thumbnail, with working play/pause and ±30 s.
- Still 1.5× after pausing and resuming from the lock screen.
- "Preparing audio" took how long, on Wi-Fi vs mobile data.

- [ ] **Step 3: Decision**

- **All yes:** continue to Task 16.
- **Audio stops when locked:** stop. MSE-in-background has failed on this phone. Bring the result back to design before building more UI. The likely fallback is assembling runs into a Blob-backed `<audio src>`, which still uses the same index, fetching and fMP4 code.

- [ ] **Step 4: Commit the measurement script and the recorded numbers**

```bash
git add lib/listen/measure-entry.ts scripts/measure-archive-throughput.mjs ../docs/superpowers/specs/2026-11-08-listen-mode-design.md
git commit -m "chore(listen): archive throughput measurement and recorded spike results"
```

---

### Task 16: VidstackPlayer: start time, speed and time reporting

**Files:**
- Modify: `web-new/components/video/VidstackPlayer.tsx`
- Test: `web-new/tests/unit/VidstackPlayer.test.tsx`

- [ ] **Step 1: Add the failing tests (append to the file from Task 2)**

```tsx
import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';

describe('VidstackPlayer video hooks', () => {
  it('applies the playback rate and reports time updates from the inner <video>', async () => {
    const onTimeUpdate = vi.fn();
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" playbackRate={1.5} onTimeUpdate={onTimeUpdate} />);
    const video = document.createElement('video');
    container.querySelector('media-player')!.appendChild(video); // Vidstack would create this
    await waitFor(() => expect(video.playbackRate).toBe(1.5));
    video.dispatchEvent(new Event('timeupdate'));
    expect(onTimeUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (the props don't exist)

Run: `npx vitest run tests/unit/VidstackPlayer.test.tsx`

- [ ] **Step 3: Implement**

Add to `VidstackPlayerProps`:

```ts
  /** Seek here once metadata loads (Listen → Watch handoff, resume). */
  startTime?: number;
  /** 1 or 1.5; re-applied on every play. */
  playbackRate?: number;
  /** Called on the inner video's timeupdate. */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
```

Destructure them with defaults: `startTime = 0, playbackRate = 1, onTimeUpdate,`.

After the `useTouchGestures(...)` call add:

```ts
  const startTimeRef = useRef(startTime);
  const rateRef = useRef(playbackRate);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Reach the <video> Vidstack creates inside <media-player>: start time, rate, time reporting.
  useEffect(() => {
    if (!videoUrl) return;
    const controller = new AbortController();
    const { signal } = controller;
    let attempts = 0;
    const timer = setInterval(() => {
      const video = containerRef.current?.querySelector('video');
      if (!video) {
        if (++attempts > 100) clearInterval(timer); // give up after ~10 s
        return;
      }
      clearInterval(timer);
      video.playbackRate = rateRef.current;
      video.addEventListener('play', () => {
        if (video.playbackRate !== rateRef.current) video.playbackRate = rateRef.current;
      }, { signal });
      video.addEventListener('timeupdate', () => onTimeUpdateRef.current?.(video.currentTime, video.duration), { signal });
      const start = startTimeRef.current;
      if (start > 0) {
        const seek = () => {
          video.currentTime = start;
        };
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
        else video.addEventListener('loadedmetadata', seek, { once: true, signal });
      }
    }, 100);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [videoUrl]);

  useEffect(() => {
    rateRef.current = playbackRate;
    const video = containerRef.current?.querySelector('video');
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);
```

- [ ] **Step 4: Run — expect PASS**, then `npx tsc --noEmit && npx eslint components/video/VidstackPlayer.tsx`
Expected: no *new* lint errors (the file already has pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add components/video/VidstackPlayer.tsx tests/unit/VidstackPlayer.test.tsx
git commit -m "feat(player): start time, playback rate and time reporting for the inner video"
```

---

### Task 17: The real watch screen, back arrow, resume markers

**Files:**
- Modify: `web-new/components/video/VideoDetailView.tsx` (full replacement below)
- Modify: `web-new/components/Header.tsx`
- Create: `web-new/components/listen/ResumeMarker.tsx`
- Modify: `web-new/components/vod-diary/VideoCard.tsx:68-76`
- Test: `web-new/tests/unit/Header.test.tsx`, `web-new/tests/unit/VideoCard.test.tsx` (add one test)

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/Header.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const pathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));
import { Header } from '@/components/Header';

describe('Header', () => {
  it('shows a back arrow to the diary on /watch', () => {
    pathname.value = '/watch';
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Back to VOD Diary' })).toHaveAttribute('href', '/');
  });

  it('has no back arrow on the diary', () => {
    pathname.value = '/';
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Back to VOD Diary' })).toBeNull();
  });
});
```

Append to `tests/unit/VideoCard.test.tsx` (inside the top-level `describe`):

```tsx
  describe('Resume marker', () => {
    it('shows where listening stopped', () => {
      localStorage.setItem(`listen:pos:${'a'.repeat(64)}`, JSON.stringify({ t: 8045, d: 21270, at: 1 }));
      renderWithProviders(<VideoCard video={createMockVideo()} />);
      expect(screen.getByText('Resume 2:14:05')).toBeInTheDocument();
      localStorage.clear();
    });

    it('shows nothing for a finished or unheard VOD', () => {
      localStorage.setItem(`listen:pos:${'a'.repeat(64)}`, JSON.stringify({ t: 21200, d: 21270, at: 1 }));
      renderWithProviders(<VideoCard video={createMockVideo()} />);
      expect(screen.queryByText(/Resume/)).toBeNull();
      localStorage.clear();
    });
  });
```

(`createMockVideo` defaults `videoHash` to `'a'.repeat(64)`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/Header.test.tsx tests/unit/VideoCard.test.tsx`

- [ ] **Step 3: Header back arrow**

In `components/Header.tsx` change the lucide import to `import { Menu, FileText, ArrowLeft } from 'lucide-react';`. Then replace the wordmark `<Link …>The Wubby <span…>Archive</span></Link>` with:

```tsx
          <div className="flex items-center gap-1">
            {pathname === '/watch' && (
              <Link
                href="/"
                aria-label="Back to VOD Diary"
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <Link
              href="/"
              className="font-display text-xl tracking-tight text-foreground transition-colors hover:text-accent-green"
            >
              The Wubby <span className="italic text-accent-green">Archive</span>
            </Link>
          </div>
```

- [ ] **Step 4: ResumeMarker and VideoCard**

```tsx
// components/listen/ResumeMarker.tsx
'use client';

import { Headphones } from 'lucide-react';
import { formatClock, isFinished } from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';

export function ResumeMarker({ hash }: { hash?: string }) {
  const position = useSavedPosition(hash);
  if (!position || isFinished(position)) return null;
  return (
    <span className="flex items-center gap-1 text-accent-green">
      <Headphones className="h-3 w-3" aria-hidden />
      Resume {formatClock(position.t)}
    </span>
  );
}
```

In `components/vod-diary/VideoCard.tsx` import `import { ResumeMarker } from '@/components/listen/ResumeMarker';` and add `<ResumeMarker hash={video.videoHash} />` as the last child of the meta-rail `div` (after the date `span`, around line 75).

- [ ] **Step 5: Replace VideoDetailView with the final layout**

```tsx
// components/video/VideoDetailView.tsx
'use client';

/**
 * VideoDetailView — /watch. Video by default; Listen swaps the player for an audio-only card
 * that streams just the AAC runs (see lib/listen). Back navigation lives in the sticky Header.
 */

import { useEffect, useRef, useState } from 'react';
import { Tag, Calendar, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Video } from '@/types/video';
import { Badge } from '@/components/ui/badge';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { AudioCard } from '@/components/listen/AudioCard';
import { ListenButton } from '@/components/listen/ListenButton';
import { SpeedToggle } from '@/components/listen/SpeedToggle';
import { ListenEngine } from '@/lib/listen/listen-engine';
import { formatClock, isFinished, readPosition, readRate, resumeTime, writePosition, writeRate } from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';
import type { PlaybackRate } from '@/lib/listen/types';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { SUPABASE_URL } from '@/lib/constants';

interface VideoDetailViewProps {
  video: Video;
}

const videoVariants = { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };
const metadataVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { delay: 0.15, duration: 0.3 } } };

export function VideoDetailView({ video }: VideoDetailViewProps) {
  const hash = video.videoHash;
  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);
  const subtitleUrl = hash ? `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt` : undefined;

  const [rate, setRate] = useState<PlaybackRate>(() => readRate());
  const [engine, setEngine] = useState<ListenEngine | null>(null);
  const [videoStart, setVideoStart] = useState(() => (hash ? resumeTime(readPosition(hash)) : 0));
  const videoTime = useRef({ t: 0, d: 0 });
  const lastVideoSave = useRef(0);
  const saved = useSavedPosition(hash);

  // Disposing on change/unmount stops all audio fetching when leaving Listen or the page.
  useEffect(() => () => engine?.dispose(), [engine]);

  const changeRate = (next: PlaybackRate) => {
    setRate(next);
    writeRate(next);
  };

  const onVideoTime = (t: number, d: number) => {
    videoTime.current = { t, d };
    const now = Date.now();
    if (hash && now - lastVideoSave.current >= 5000) {
      lastVideoSave.current = now;
      writePosition(hash, t, d);
    }
  };

  const startListening = () => {
    if (!hash) return;
    const fromVideo = videoTime.current.t;
    if (fromVideo > 0) writePosition(hash, fromVideo, videoTime.current.d);
    const e = new ListenEngine({
      url: video.url,
      hash,
      title: video.title,
      artworkUrl: video.thumbnailUrl,
      startAt: fromVideo > 0 ? fromVideo : resumeTime(readPosition(hash)),
      rate,
    });
    e.play(); // inside the tap, so Chrome allows audio
    void e.start();
    setEngine(e);
  };

  const backToWatch = (atSec: number) => {
    videoTime.current = { t: 0, d: 0 };
    setVideoStart(atSec);
    setEngine(null);
  };

  const resumeLabel = saved && !isFinished(saved) ? formatClock(saved.t) : undefined;

  return (
    <div className="space-y-4 px-0 py-4 md:space-y-6 md:px-4 md:py-6">
      <motion.div className="w-full" variants={videoVariants} initial="initial" animate="animate">
        {engine && hash ? (
          <AudioCard engine={engine} hash={hash} thumbnailUrl={video.thumbnailUrl} onWatch={backToWatch} onRateChange={changeRate} />
        ) : (
          <VidstackPlayer
            videoUrl={video.url}
            subtitleUrl={subtitleUrl}
            poster={video.thumbnailUrl}
            title={video.title}
            startTime={videoStart}
            playbackRate={rate}
            onTimeUpdate={onVideoTime}
          />
        )}
      </motion.div>

      {!engine && hash && (
        <div className="space-y-2 px-2 md:px-0">
          <ListenButton onClick={startListening} resumeLabel={resumeLabel} />
          <SpeedToggle rate={rate} onChange={changeRate} className="w-full" />
          <p className="font-mono text-xs text-ink-muted">Listen streams audio only · about 73 MB per hour</p>
        </div>
      )}

      <motion.div className="space-y-3 px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
        <div className="space-y-2">
          <h1 className="font-display text-2xl leading-tight text-foreground md:text-3xl">{video.title}</h1>
          {originalTitle && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <FileText className="h-4 w-4" />
              <span className="font-mono">{originalTitle}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="mx-2 h-px bg-rule md:mx-0" />

      <motion.div className="px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
        <div className="border-l-2 border-accent-green/50 pl-4 md:pl-5">
          <p className="whitespace-pre-line leading-relaxed text-foreground/80">{video.summary || 'No summary available for this video.'}</p>
        </div>
      </motion.div>

      {video.tags && video.tags.length > 0 && (
        <motion.div className="space-y-3 px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
          <h3 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.25em] text-ink-muted">Topics &amp; Tags</h3>
          <div className="flex flex-wrap gap-2">
            {video.tags
              .filter((tag) => tag !== video.platform)
              .map((tag, index) => (
                <Badge key={index} variant="tag" className="cursor-default transition-colors hover:border-accent-green hover:bg-accent-green hover:text-white">
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run — expect PASS; full gates**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit tests pass; 0 type errors; build succeeds.

- [ ] **Step 7: Look at it (mobile first)**

Start the dev server with the browser pane (`preview_start` → `web-new`), set the viewport to `mobile` (375×812), open a VOD from the diary, and screenshot:
- (a) the watch page: back arrow in the header, nothing above the video, a big Listen button;
- (b) after tapping Listen: the audio card with status "Streaming · x MB used";
- (c) the diary card showing "Resume …" after listening for more than 5 s.

Remember the hidden-pane caveat: take 2–3 screenshots to force frames before judging anything animated.

- [ ] **Step 8: Commit**

```bash
git add components/video/VideoDetailView.tsx components/Header.tsx components/listen/ResumeMarker.tsx components/vod-diary/VideoCard.tsx tests/unit/Header.test.tsx tests/unit/VideoCard.test.tsx
git commit -m "feat(listen): mobile-first watch screen, header back arrow, diary resume markers"
```

---

### Task 18: Listen E2E on the Pixel profile

**Files:**
- Create: `web-new/tests/listen.spec.ts`

- [ ] **Step 1: Generate the E2E fixture (once, ~1–2 min)**

Run: `npm run fixtures:listen -- e2e`
Expected: `e2e fixture: ~190 MB, N audio runs`, plus `tests/fixtures/listen/e2e-12min.layout.json`. Both are gitignored.

- [ ] **Step 2: Write the spec**

```ts
// tests/listen.spec.ts
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
    if (req.url().startsWith(MEDIA_URL)) headers.push(req.headers()['range']);
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
    .poll(() => page.evaluate(() => document.querySelector('media-player video')?.currentTime ?? 0), { timeout: 30_000 })
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
```

- [ ] **Step 3: Run it**

Start the dev server via the browser pane (`preview_start` → `web-new`), then:

Run: `npx playwright test tests/listen.spec.ts --project=pixel --reporter=line`
Expected: 6 passed. If one fails, read the trace (`npx playwright show-trace`) before changing code. Remember these run against a dev server, so check console errors with `read_console_messages` too.

- [ ] **Step 4: Confirm no regressions in the existing E2E (baseline 33/73 on Chromium)**

Run: `npx playwright test tests/navigation.spec.ts tests/vod-diary.spec.ts tests/accessibility.spec.ts tests/mobile.spec.ts --project=chromium --reporter=line`
Expected: no test that passed on `main` now fails. A test that clicked the old "Back to VOD Diary" *button* still finds the header *link*, which has the same accessible name. Compare pass/fail sets as in the Next 16.4.5 upgrade (scratch copy of main with `web-new/.env.local` copied in).

- [ ] **Step 5: Commit**

```bash
git add tests/listen.spec.ts
git commit -m "test(listen): Pixel E2E: audio-only bytes, 1.5×, resume, handoff, dropout, 5xx, 200"
```

---

### Task 19: Docs: phone checklist and CLAUDE.md

**Files:**
- Create: `docs/listen-mode-phone-checklist.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the real-phone checklist**

```markdown
# Listen mode: real-phone checklist (Android, Chrome)

Automated tests can't prove these. Run them on the phone before merging a Listen change.
Test a branch from the laptop with USB + `chrome://inspect#devices` → Port forwarding
`3000 → localhost:3000`, then open `http://localhost:3000` on the phone (a secure context;
a `http://192.168…` LAN address is not, and MSE/Media Session will mislead).

| # | Check | Pass? |
|---|-------|-------|
| 1 | Listen, 1.5×, lock the screen for 15 min: audio never stops | |
| 2 | Switch to another app for 5 min: audio continues | |
| 3 | Notification shows title + thumbnail; play/pause and ±30 s work | |
| 4 | Lock-screen seek bar moves at 1.5× speed; still 1.5× after pause/resume from the lock screen | |
| 5 | Data: Settings → Network → Data usage → Chrome, before/after 30 min at 1.5× ≈ 25–40 MB (plus a one-off ~24 MB the first time a VOD is opened) | |
| 6 | Airplane mode for 30 s mid-listen: audio continues from the buffer, "Reconnecting…" shows, then recovers | |
| 7 | Reopen the VOD later: Listen shows "from h:mm:ss" and resumes there; the diary card shows "Resume …" | |
| 8 | Tap targets are easy one-handed; the status line is readable outdoors | |
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`:
- **Core Features → Video Player:** add a bullet:
  "**Listen mode (`lib/listen/`)**: audio-only streaming of the VOD MP4 via Range requests + MSE (~73 MB/h vs ~4.5 GB/h), lock-screen playback, 1×↔1.5× toggle, auto-resume. See `docs/superpowers/specs/2026-11-08-listen-mode-design.md`."
- **File Structure:** add `lib/listen/` and `components/listen/` with one-line descriptions matching this plan's file structure.
- **Testing:** add a "Mobile first" paragraph:
  "Lee's main device is an Android phone in Chrome. Run browser checks on the `pixel` Playwright project first (`npm run test:e2e:mobile`), desktop second. Listen E2E needs `npm run fixtures:listen -- e2e` once. What emulation can't prove is in `docs/listen-mode-phone-checklist.md`; test a branch on the phone via USB port forwarding (`chrome://inspect`)."
- **Remaining Tasks:** item 2 ("`/watch` doesn't save or resume playback position") becomes:
  "Done for /watch via `lib/listen/positions` (shared by video and Listen). The old `vds-` keys and `cleanupOldPlaybackPositions` are unused; delete them in a cleanup."
- **Key Technical Details → Storage Keys:** add `listen:pos:{hash}`, `listen:rate`, and IndexedDB `wubby-listen/audio-index`.
- **Last Updated** → the merge date.

- [ ] **Step 3: Final gates**

Run (from `web-new/`): `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass. Report the unit test count.

- [ ] **Step 4: Commit**

```bash
git add ../docs/listen-mode-phone-checklist.md ../CLAUDE.md
git commit -m "docs: Listen mode phone checklist and CLAUDE.md update"
```

---

## Phase 2 — Download for offline (outline; gets its own plan after Phase 1 ships)

Builds on Phase 1 without changing the engine's interface: `chunk-source` becomes the place runs come from, either OPFS or the network.

- **`lib/listen/offline-store.ts`:**
  - OPFS file `{hash}.audio` holding the concatenated run payloads in run order (offsets derived from `runSize`), plus a manifest in IndexedDB `wubby-listen/downloads`: `{hash, title, bytesTotal, state: downloading|paused|ready|failed|stale, chunkBitmap, lastListenedAt, lastModified}`.
  - Writes go to `{hash}.part` and become `.audio` only when every run's length matches the index.
  - Startup reconciliation as in the spec. `navigator.storage.persist()` on the first download. Quota check with 10% headroom.
  - A fixed 2 GB cap, with least-recently-listened offered for deletion.
- **`lib/listen/download-job.ts`:** concurrency taken from the Task 15 measurement; resumable from the bitmap; Screen Wake Lock while active; pauses (doesn't fail) when `range-fetch` is exhausted; `Last-Modified` changes mark the download `stale`.
- **Engine:** before fetching run `r`, ask the offline store; if present, read the payload from OPFS (zero network). The status line shows `Offline · downloaded`.
- **UI:**
  - A **Download** button beside 1.5× (with a mobile-data confirmation via `navigator.connection.type === 'cellular'`).
  - The diary masthead chip `⬇ N offline · X GB` (counts paused/partial downloads), which opens a downloads sheet (size, state, last listened, Delete, Delete all, `storage.estimate()` footer).
  - Auto-delete when the saved position reaches the last 2 minutes.
- **Tests:**
  - **Unit:** reconciliation rules and cap selection (pure), plus the bitmap.
  - **Pixel E2E:** download → offline → play; kill mid-download → resume; quota error → paused with the cap dialog.
  - **Phone checklist:** a full 430 MB download on home Wi-Fi (record the time), airplane-mode playback, and storage actually freed after deleting.

## Phase 3 — Offline app (outline; own plan)

- **Service worker:** precaches the static export's app shell (`/`, `/watch`, `_next/static/**`) and runtime-caches the Supabase rows and thumbnails of downloaded VODs. It **never intercepts `archive.wubby.tv`**: audio comes from OPFS.
  - Choose between `@serwist/next` (if it supports Turbopack and `output: 'export'` at that time) and a small hand-written SW plus a build-time precache manifest script. Decide by trying `@serwist/next` first in a 30-minute timebox.
- **Web app manifest** and icons so Android can install it to the home screen; installed PWAs are also less likely to have storage evicted.
- **Guardrail:** the SW must not reintroduce the cached-partial-response class of bug from the Next 16.0.7 incident. Never cache a `206`, and never serve one to a navigation.
- **Phone checklist:** airplane mode → open the installed app from the home screen → the diary shows downloaded VODs → a downloaded VOD plays.
