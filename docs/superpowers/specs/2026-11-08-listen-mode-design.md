# Listen mode: audio-only, mobile-first playback for `/watch`

**Date:** 2026-11-08 · **Status:** design approved in conversation, awaiting spec review
**Primary device:** Android phone, Chrome. Desktop is secondary.

## Goal

Find a VOD, open it, tap **Listen**, tap **1.5×**, lock the phone, and keep listening, on
mobile data. Optionally download a VOD's audio on Wi-Fi first and then listen with no data at
all.

## Facts that shape the design

Measured on `nov_2026/6_no-title_1794002258_000.mp4` (2026-11-08):

| Fact | Value | Consequence |
|---|---|---|
| File size | 27.06 GB, 5h54m | Streaming the MP4 "with the video hidden" still downloads it: ~4.5 GB/h |
| Streams | H.264 1080p ~10 Mbps · AAC-LC 48 kHz stereo 162 kbps | The audio alone is ~73 MB/h |
| Layout | `ftyp` → `mdat` (27 GB) → `moov` (23.6 MB) **at the end** | The index must be fetched by range from the end of the file |
| Audio chunks | 5,340 chunks, avg 78.8 KB (~4 s each), 430.8 MB total | ~1 range request per 4 s of audio |
| Gap between audio chunks | ~4.8 MB of video (p10–p90: 4.7–5.0 MB) | Chunks can't be merged; each is its own request |
| Server | Cloudflare, `Accept-Ranges: bytes`, `Access-Control-Allow-Origin: *`, `alt-svc: h3` | Cross-origin range fetches work from the site (verified 120/120 from `github.io`) |
| Multi-range (`bytes=a-b,c-d`) | **416** | One request per chunk |
| Latency | TTFB ~1.3–1.9 s per uncached range; ~1.4 MB/s once flowing | Throughput comes from concurrency, not request size |
| Caching | `Cache-Control: max-age=86400`, stable `ETag` | The ETag identifies the file version |

No server-side change, no new storage. Everything happens on the phone.

## Phases

| Phase | Delivers | Proves the goal? |
|---|---|---|
| **1. Listen mode** | New watch layout · Listen (audio-only streaming) · background/lock-screen playback · Media Session controls · 1.5× toggle · auto-resume · resume markers on diary cards | Yes, on mobile data |
| **2. Download for offline** | Wi-Fi download to the phone · offline playback with zero data · auto-delete on finish · **storage counter on the diary** · downloads list · storage cap | Listen with zero data |
| **3. Offline app** | Installable PWA with app-shell caching so `/` and `/watch` open with no signal; downloaded VODs playable offline | Works with no reception |

Each phase is shippable on its own and gets its own implementation plan and PR.

## UX

### Watch page (all phases)

- **Slim sticky top bar:** back arrow + truncated title (+ existing menu). Replaces the
  "Back to VOD Diary" button that currently sits above the video
  (`VideoDetailView.tsx:52-60`).
- Video player (unchanged Vidstack).
- **Listen:** a full-width primary button directly under the video, with a minimum height of
  56px.
- Row: **1.5×** toggle | **Download** (Phase 2).
- Meta line: `Resume 2:14:05 · audio ~73 MB/h` (or `Downloaded · 0 MB/h` in Phase 2).
- Title, summary, tags as today.

### Listening state

- The video pauses and unloads its source, so it stops fetching.
- The player area becomes an **audio card**: thumbnail, a large seek bar with elapsed and
  total time, **−30s / play-pause / +30s** with targets ≥ 48px, the **1.5×** toggle, and a
  **Watch** button.
- **Watch** switches back to the video at the current timestamp, and audio stops. Only one is
  ever playing.
- The status line shows `Streaming · 4.1 MB used`, `Reconnecting…`, `Offline · downloaded`
  or `Buffering…`.

### Speed

- One **1× ↔ 1.5×** toggle that applies to both video and Listen.
- Remembered per phone (`localStorage`).
- Pitch is preserved (`preservesPitch`, the browser default).

### Resume

- Position and speed are saved per VOD every 5 s while playing and on `pause`, `pagehide`
  and `visibilitychange`.
- Opening Listen on a VOD with a saved position resumes automatically.
- Diary cards show a small `Resume 2:14:05` marker when a position exists.
- Video playback reads and writes the same position, so watching and listening share it.
  This also closes the existing "`/watch` doesn't save position" item.

### Storage counter and downloads (Phase 2)

Lee may never finish a VOD, so auto-delete-on-finish can't be the only cleanup.

- **Diary counter:** when anything is stored, the masthead meta line shows a chip,
  `⬇ 3 offline · 1.2 GB`. Partial downloads count, shown as e.g. `1 paused`. Tapping it opens
  the downloads list.
- **Downloads list (sheet):** each entry shows title, size, state (Downloading 42% / Paused
  63% / Ready / Failed), last listened, and **Delete**. There's also **Delete all** and a
  footer with phone storage from `navigator.storage.estimate()`.
- **Cap:** a fixed total of **2 GB** (about 4–5 long VODs), a single constant in
  `offline-store.ts` with no settings UI for now. Starting a download that would
  exceed it opens a dialog listing the least-recently-listened downloads to delete first.
  Never silently deletes something unfinished.
- **Auto-delete:** a download is deleted when its saved position reaches the final 2 minutes.
- **Wi-Fi hint:** the Download button works anywhere but shows "You're on mobile data (~430 MB).
  Download anyway?" when `navigator.connection.type === 'cellular'`. On an unknown connection
  it doesn't warn.

## Architecture

Pure client code under `web-new/lib/listen/`, React UI under `web-new/components/listen/`.
Each unit has one job and can be tested without the others.

| Unit | Job | Depends on |
|---|---|---|
| `range-fetch.ts` | **The only code that touches HTTP for audio.** `fetchRange(url, start, end, {signal, etag})`: per-attempt timeout, retries, response validation (see Failure handling). | `fetch` |
| `mp4-index.ts` | Find `moov` via small reads of top-level box headers. Fetch `moov`, parse the audio track (codec config + sample table), and produce an **AudioIndex**: `{etag, durationSec, codec, audioSpecificConfig, chunks: [{offset, size, firstSample, startSec, durSec}], samples: [{size, durTicks}]}` (compact typed arrays). Handles `moov` at the start or the end, and `stco` or `co64`. | `range-fetch`, MP4 library |
| `index-cache.ts` | Persist the AudioIndex in IndexedDB keyed by `videoHash`, validated by `etag`. ~100 KB per VOD, so the 23.6 MB `moov` is fetched once per VOD per phone. | IndexedDB |
| `fmp4.ts` | Build a fragmented MP4 init segment (audio track only) and media segments (`moof`+`mdat`) from raw AAC samples. **No re-encoding.** Pure function: bytes in, bytes out. | MP4 library or hand-written |
| `chunk-source.ts` | `getChunks(range)` returns sample bytes, from the offline store (Phase 2) or the network via `range-fetch`, with bounded concurrency (default 6, tunable). | `range-fetch`, `offline-store` |
| `listen-engine.ts` | Owns one `<audio>` + `MediaSource`. Buffer-ahead target 180 s with a low-water mark of 60 s, eviction behind the playhead, seek handling, play/pause/rate, status events. A seek starts a new **generation**: in-flight work for older generations is aborted and its results are dropped. | `fmp4`, `chunk-source` |
| `media-session.ts` | Metadata (title, artwork = thumbnail), handlers for play/pause/seekbackward/seekforward (30 s)/seekto, and `setPositionState({duration, position, playbackRate})` on every rate change, seek and play. | `navigator.mediaSession` |
| `positions.ts` | Per-VOD position + global speed in `localStorage`. Throttled writes, read for diary markers. | `localStorage` |
| `offline-store.ts` (P2) | Downloads in OPFS (`{hash}.audio` raw sample payload + manifest). Resumable chunk bitmap, quota checks, reconciliation on startup, deletion, cap enforcement. | OPFS, IndexedDB |
| `download-job.ts` (P2) | Runs a download: concurrency, progress, pause/resume, Screen Wake Lock while active, persists progress so a killed tab resumes. | `chunk-source`, `offline-store` |
| SW + manifest (P3) | Precache the static export's app shell; runtime-cache Supabase rows/thumbnails for downloaded VODs. Never intercepts `archive.wubby.tv`. | Serwist or hand-written SW |

**Why MSE and not a plain `<audio src>`:** there's no audio-only file to point at. MSE lets the
rebuilt fMP4 segments stream into a real `<audio>` element, which Android Chrome keeps
playing when the screen is locked or Chrome is in the background, and which the Media
Session notification controls. Offline playback (Phase 2) feeds the same engine from OPFS
instead of the network, so there is one playback path, not two.

**Watch ↔ Listen handoff:** the video element's `currentTime` → `listen-engine.seek(t)`, then
the video is paused and its source removed (`removeAttribute('src'); load()`) so it stops
fetching. The reverse sets the video's `currentTime` and disposes the engine.

### Library choice (first task of Phase 1)

A short timeboxed spike decides between **`mediabunny`**, **`mp4box.js`** and a small
**hand-written** `moov` parser + fMP4 writer. Selection criteria, in order:

1. **Our `range-fetch` owns all HTTP.** The library must accept bytes we fetched (or a
   custom source we control). It must not do its own range reading or read-ahead, which
   could pull video bytes and would hide retries and errors from us.
2. **Data budget:** 10 minutes of *audio* (media time, whatever the speed) fetches ≤ 15 MB
   after the one-off index. The source rate is 12.2 MB per 10 minutes. Measured, not assumed.
3. Handles a 23.6 MB `moov` with ~1.3M video samples without freezing the main thread: run it
   in a Web Worker or keep parsing to the audio track only.
4. Bundle size and maintenance: the library is only loaded on `/watch`.

If no library meets criterion 1, the parser and writer are hand-written. MP4 parsing for one
AAC track is small and well specified, and the measurement script in this session already
parses the sample tables.

## Failure handling

Lee's explicit requirement: dropouts, poor connections, retries, errors, and cleanup after
failed runs are designed in, not bolted on.

### Every range request (`range-fetch`)

- **Timeout per attempt:** 15 s (TTFB is ~1.5 s, so 10× headroom), via an `AbortController`
  chained to the caller's signal. A caller abort is **not** retried and **not** reported as
  an error.
- **Retries:** up to 5 attempts, exponential backoff 1 s → 16 s with ±30% jitter.
  - **Retriable:** network `TypeError`, timeout, 408, 429 (honour `Retry-After`), 5xx.
  - **Fatal:** 404/410 (VOD gone), 416, a CORS failure on the *first* request, or a malformed
    response.
- **Validation before reading the body:** the status must be **206**, `Content-Range` must
  match the requested start and end, and the total must equal the indexed file size.
  - **A 200 means the server ignored the range and is about to send 27 GB**: abort at once
    and treat it as fatal (`FileChangedOrRangeUnsupported`).
  - After reading, the body length must equal the requested length; a short read is
    retriable.
- **Version pinning:** each request sends `If-Range: <etag from the index>`. If the file
  changed, the server answers 200, which the rule above catches. The cached index is then
  invalidated and Listen rebuilds it once.
- **Offline:** when `navigator.onLine === false`, don't burn retries. Park the request and
  resume on the `online` event or a `navigator.connection` `change` event.

### Streaming playback (`listen-engine`)

- **Dropouts:** playback continues from the buffer (up to 3 minutes at 1×, 2 minutes at
  1.5×). Status shows `Reconnecting…`, and fetching resumes on its own when the network
  returns. Position is never lost.
- **Stall:** on `waiting`, show `Buffering…`; if it's stuck for more than 30 s with no network
  progress, show **Retry**. Never a silent spinner.
- **Seek during in-flight fetches:** new generation, old fetches aborted, stale results
  dropped. Appends to the `SourceBuffer` are serialized through one queue (never `append`
  while `updating`).
- **`QuotaExceededError` on append:** evict everything more than 30 s behind the playhead and
  retry once. If it fails again, lower the buffer-ahead target and log it.
- **Fatal errors** (VOD gone, non-AAC audio, no audio track, `moov` unparseable): a plain
  message on the audio card and the Watch button still works. A toast goes through the
  existing `useToast`.
- **Cleanup:** on unmount, route change or switching to Watch, abort all fetches, call
  `MediaSource.endOfStream`/detach, revoke the object URL, clear Media Session handlers and
  release the Wake Lock. No orphaned network activity after leaving the page.

### Downloads (`offline-store`, `download-job`, Phase 2)

- **Writes go to a temp entry** (`{hash}.part` + manifest `state: downloading`). The download
  is marked `ready` only after every chunk is present and each chunk's length matches the
  index.
- **Resumable:** a persisted chunk bitmap. A killed tab, phone reboot or network loss resumes
  from the bitmap, not from zero. Failed chunks are retried by `range-fetch`; after its
  retries are exhausted the job pauses (`Paused · connection lost`) rather than failing the
  whole download.
- **Quota:** check `navigator.storage.estimate()` before starting (need the size plus 10%
  headroom). On `QuotaExceededError` mid-write, pause, keep the partial data, and surface the
  cap/delete dialog. Request `navigator.storage.persist()` on the first download so Chrome
  doesn't evict.
- **Startup reconciliation** (each app load, cheap): `.part` files with no manifest are
  deleted. Manifests whose file is missing are reset. `downloading` entries with no live job
  become `paused`. Entries for VODs whose ETag changed are marked stale and offered for
  deletion.
- **Screen Wake Lock** is held while a download runs and released on finish, failure or
  pause, because Android throttles background tabs.

## Hard constraint

- **Video watching must not regress.** The Vidstack player, subtitles, touch gestures and the
  existing `/watch?id=` route keep working. Listen is additive.
- **Static export + basePath:** `output: 'export'` to GitHub Pages under
  `/wubbyParasocialWorkbench`. No server code, no API routes, and no Next.js features that
  need a server.
- **Never download the video stream in Listen mode.** Asserted in tests (bytes fetched vs a
  budget), because a plausible "audio-only" implementation that sets `<audio src=mp4>` would
  look correct and cost 4.5 GB/h.
- **No request may be left able to stream the whole file:** every audio request is a bounded
  `Range`, and any non-206 is aborted before its body is read.
- **Next ≥ 16.4** stays: see the CLAUDE.md note on the range-prefetch blank-tab bug. That bug
  was in Next's *page* prefetch and is unrelated to our audio range requests.
- **Pin the Vidstack CDN version** (currently an unversioned `cdn.jsdelivr.net/npm/vidstack/...`
  in `VidstackPlayer.tsx:466-492`) so the player can't change under us.
- **`tsc` stays clean.** `next build` type-checks test files.
- The diary (`/`) gains only the resume markers and the storage chip. Its filters, paging and
  URL state are untouched.

## Testing (mobile first)

**Default device:** add a `Pixel 7` Playwright project, used first for every check. Desktop
Chrome is second. Recorded in CLAUDE.md.

### Automated

- **Unit tests (Vitest, Node):** fixtures generated with ffmpeg are small interleaved MP4s
  with `moov` **at the end**, plus one with it at the start and one using `co64`.
  - **Parsing:** box walking, the audio-track AudioIndex (chunk offsets and sizes match
    `ffprobe -show_packets`), and the fMP4 writer, whose output must be playable/parseable
    by ffprobe with a matching duration.
  - **`range-fetch`:** against a mocked `fetch`, covering every retriable and fatal branch,
    200-instead-of-206 abort before reading the body, short reads, caller-abort-not-retried,
    `Retry-After`, and offline parking.
  - **Positions, cap logic and reconciliation rules:** as pure functions.
- **Playwright (Pixel 7, Chromium):**
  - **Listen and data budget:** Listen plays, with `currentTime` advancing, against the
    Pages-style local server from this session, serving a generated fixture or a cut of a real
    VOD. Bytes fetched for 10 minutes of audio (media time) must be ≤ 15 MB.
  - **Speed and resume:** 1.5× persists across reload; resume returns to the saved position;
    Watch ↔ Listen keeps the time.
  - **Network faults:** with `context.setOffline(true)` for 20 s mid-stream, playback
    continues and recovers. Injected 5xx and 200-instead-of-206 responses (via `route`)
    surface the right states.
  - **Phase 2:** download, a kill mid-download, then resume.

### `WHAT THESE TESTS CANNOT COVER` (the real-phone checklist)

Each phase's test file starts with this block. It is the review checklist for Lee's phone.

- Audio keeps playing with the **screen locked for 10+ minutes**, and after Chrome is sent to
  the background and another app is opened.
- The **lock-screen / notification controls** show the title and thumbnail. Play/pause and
  ±30s work. The seek bar moves at the right speed at 1.5×.
- **1.5× survives** a pause/resume from the lock screen.
- **Real data use:** Android Settings → Data usage for Chrome before and after 30 minutes of
  Listen ≈ 25–40 MB at 1.5×, not gigabytes.
- **Dropout:** walk out of signal (or toggle airplane mode for 30 s) mid-listen. Audio
  continues from the buffer, shows Reconnecting…, and recovers.
- **Phase 2:** a 430 MB download on home Wi-Fi completes (record how long). Airplane mode,
  then play: it works. The diary chip shows the right count and size. Deleting frees the space
  (check `Settings → Apps → Chrome → Storage`).
- **Phase 3:** airplane mode, open the installed app from the home screen, and a downloaded
  VOD plays.

### Testing on the phone before merge

Plug the phone in by USB, open `chrome://inspect#devices` on the laptop, enable **Port
forwarding** `3000 → localhost:3000`, and open `http://localhost:3000` on the phone. Because
that address is `localhost`, it is a secure context, which MSE, OPFS, Wake Lock and service
workers need. A LAN address (`http://192.168…`) is not, and will mislead.

## Out of scope

- Re-encoding audio to a lower bitrate (the floor is the source's 162 kbps AAC, ~73 MB/h).
- A server-published audio index. It would save the one-off 23.6 MB per VOD; possible later,
  and it would slot in behind `index-cache` without touching the UI.
- Replacing Vidstack for video. Pinning it is in scope; swapping it is a separate project.
- iPhone/Safari-specific background behaviour. The design uses standard APIs, but only
  Android Chrome is verified.
- API response caching (SWR/React Query) for the diary.

## Open risks

- **The first open of a VOD costs 23.6 MB** before audio starts (~10–20 s on mobile data).
  Mitigation: show progress ("Preparing audio · 12/24 MB"), cache the result, and later
  possibly a server-published index.
- **Download speed is an estimate, not a measurement:** ~5–15 minutes for 430 MB, based on
  request latency and concurrency. The spike measures real throughput at concurrency 6/12/24
  over HTTP/2 or HTTP/3 in Chrome.
- **MSE in a locked or backgrounded tab on Android Chrome** is expected to keep playing
  (music sites rely on it), but only the real-phone checklist proves it. The spike includes a
  15-minute locked-screen test on Lee's phone before building the full UI.
