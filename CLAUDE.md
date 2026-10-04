# Claude.md - Wubby Parasocial Workbench

## Project Overview

**Wubby Parasocial Workbench** - Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging. The UI is themed as an editorial "archive periodical": **The Wubby Archive**.

**Target Audience:** Wubby community
**Data Source:** archive.wubby.tv
**Location:** `/web-new` directory

### Out of scope — `wubby-pleb-titles-extension/`

A **standalone browser extension with its own git history**, living at the repo root and
gitignored. It is not part of the Next.js app and shares no build, deps, or tests with it.

**Do not read, modify, or refactor it.** The only reason to touch it is a breaking change
to core shared tech that the extension genuinely depends on (e.g. a Supabase schema or
API contract change that would break it). Cleanups, lint sweeps, dependency bumps, and
"while I'm here" edits do not qualify — leave it alone.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), with the React Compiler (`babel-plugin-react-compiler`)
- **UI:** React 19 + shadcn/ui + Tailwind CSS 4
- **Typography:** Fraunces (display serif), Hanken Grotesk (body), Geist Mono (mono) — via `next/font/google`
- **Theming:** HSL CSS variables in `globals.css`; `next-themes` (app is dark by default)
- **Animation:** Framer Motion (page transitions, masthead, staggered list) + tw-animate-css
- **Video:** Vidstack Player (CDN-loaded)
- **Backend:** Supabase (PostgreSQL + Storage)
- **Unit testing:** Vitest + Testing Library + jsdom
- **E2E testing:** Playwright

---

## Core Features

### 1. VOD Diary (Browse)
- `VodDiaryScreen` rendered at `/`; the legacy `/vod-diary` route is a client-side
  redirect to `/` that keeps the query string (static export can't redirect server-side)
- **Filters live in the URL** — `/?q=cooking`, `/?from=2026-09-01&to=2026-09-30`. No
  `from` means "This Week". Search writes with `router.replace`, a completed date range
  with `router.push`. `useSearchParams` needs the `<Suspense>` in `app/page.tsx`.
- Editorial `Masthead` — wordmark, issue number (= total records in the range, not the
  page loaded), date-range meta line
- Date range filtering via `react-day-picker` (`DateRangePicker`). Ranges are **whole
  local calendar days**, queried `gte` start-of-from / `lt` start-of-day-after-to
  (`lib/utils/date-range.ts`) — never `lte` a midnight
- Paging: 50 per page, "Showing N of M records" + "Load more" at the list foot
- Toggleable, debounced real-time search (`SearchInput`) across title / URL (tags only
  narrow server matches — see Remaining Tasks)
- Superseded loads are aborted (`AbortController` per filter change), so a slow old
  response can never overwrite newer results
- Archive-record cards: running `№` number, Fraunces title, 1-2 line hook, expand-in-place full summary
- Lazy-loaded thumbnails, grayscale by default and colorizing on hover, with black-box fallback

> **Removed:** the Twitch/Kick **platform toggle** (`PlatformSlider`) no longer exists.
> The diary shows all platforms together. `fetchRecentVideos` still accepts a `platform`
> param (default `'both'`) for programmatic filtering, but no UI exposes it.

### 2. Two-Tier UX (Progressive Disclosure)
- **Browse View:** Scannable 1-2 line hooks + "Read more" (expands the full summary in place)
- **Detail View:** Full AI summary + player at `/watch?id=HASH` (open via card thumbnail)
- Single quiet-green play-button glow (no per-platform color theming anymore)
- Tag display (3 mobile, 6 desktop) with click handlers

### 3. Video Player
- Vidstack player with custom community skin; `/watch?id=HASH` is the only player route
- Subtitle/transcript support (VTT files from Supabase)
- Playback position saving (every 10s after 30s threshold) and restoration — **only when
  `storageKey` is passed**, which `/watch` (`VideoDetailView`) does not yet do (see
  Remaining Tasks)
- Media Session API (lock screen controls, background playback)
- Touch gestures (mobile only): drag up = fullscreen, drag down = PiP

### 4. Transcript Extraction
- Manual URL input or dropdown selection
- Real-time SHA-256 hash computation
- Subtitle availability detection (HEAD request)
- Debug output with metadata display

### 5. Hash-Based Tracking
- SHA-256 hash of video URLs as unique identifier
- Used for: DB lookups, subtitle paths, thumbnail paths, position storage
- `isValidHash()` guards hash lookups (64-char hex) against query injection
- Format: `wubbytranscript/{hash}/en/subtitle.vtt`, `wubbytranscript/{hash}/thumbnail.webp`

---

## File Structure

```
web-new/
├── app/
│   ├── page.tsx              # Home — <Suspense> + <VodDiaryScreen>
│   ├── vod-diary/page.tsx    # Legacy route — client redirect to / (keeps query)
│   ├── watch/page.tsx        # Detail view + player (/watch?id=HASH, query param)
│   ├── transcript/page.tsx   # Transcript extraction
│   ├── layout.tsx            # Root layout — fonts, Header, PageTransition, Toaster
│   ├── error.tsx             # Global error boundary
│   ├── not-found.tsx         # 404 page
│   ├── loading.tsx           # Loading skeleton
│   ├── globals.css           # Tailwind v4 theme + HSL design tokens
│   └── (per-route loading.tsx / error.tsx / layout.tsx)
├── components/
│   ├── ui/                   # shadcn components (badge, button, card, sheet, etc.)
│   ├── layout/
│   │   ├── Masthead.tsx          # Editorial "The Wubby Archive" masthead (Framer Motion)
│   │   └── PageHeader.tsx        # Utilitarian header for the other pages
│   ├── video/
│   │   ├── VidstackPlayer.tsx    # Main player (CDN, subtitles, gestures)
│   │   ├── VideoSelector.tsx     # URL input + dropdown
│   │   ├── VideoMetadata.tsx     # Metadata display
│   │   ├── VideoDetailView.tsx   # Full detail view
│   │   └── HashDisplay.tsx       # Hash status display
│   ├── vod-diary/
│   │   ├── VodDiaryScreen.tsx    # Browse screen: URL filters, paging, abortable loads
│   │   ├── VideoCard.tsx         # Archive-record browse card (React.memo)
│   │   ├── VideoList.tsx         # Card container, staggered reveal (React.memo)
│   │   ├── SkeletonVideoCard.tsx # Loading placeholder
│   │   ├── DateRangePicker.tsx   # react-day-picker integration
│   │   └── SearchInput.tsx       # Toggleable debounced search
│   ├── PageTransition.tsx        # Framer Motion route transitions
│   └── Header.tsx                # Sticky editorial wordmark + hamburger Sheet
├── lib/
│   ├── api/
│   │   └── supabase.ts           # API client (see API Functions)
│   ├── hooks/
│   │   ├── useTouchGestures.ts   # Mobile gestures (PiP/fullscreen)
│   │   ├── useLocalStorage.ts    # SSR-safe storage
│   │   ├── useToast.ts           # Sonner wrapper
│   │   └── useDebounce.ts        # Debounce utility
│   ├── utils/
│   │   ├── hash.ts               # SHA-256 computation + isValidHash
│   │   ├── date-range.ts         # Whole-local-day ranges, query bounds, URL day params
│   │   ├── video-helpers.ts      # Format/extract utilities (extractHook, etc.)
│   │   ├── logger.ts             # Environment-aware logging
│   │   └── storage-cleanup.ts    # Vidstack position cleanup
│   └── constants.ts              # SUPABASE_URL, shared constants
├── types/
│   ├── video.ts                  # Video / Platform interfaces ('twitch'|'kick'|'both'|'unknown')
│   └── supabase.ts               # DB types
└── tests/
    ├── unit/                     # Vitest unit tests
    │   ├── VodDiaryScreen.test.tsx
    │   ├── supabase.test.ts
    │   ├── date-range.test.ts
    │   ├── VideoCard.test.tsx
    │   ├── VideoSelector.test.tsx
    │   ├── useToast.test.tsx
    │   ├── useLocalStorage.test.tsx
    │   ├── hash.test.ts
    │   └── video-helpers.test.ts
    ├── player-gestures.spec.ts   # Touch gesture E2E tests
    ├── navigation.spec.ts        # Page navigation
    ├── vod-diary.spec.ts         # Filter functionality
    ├── transcript.spec.ts        # Transcript E2E
    ├── index.spec.ts             # Home E2E
    ├── accessibility.spec.ts     # WCAG compliance
    ├── mobile.spec.ts            # Responsive design
    ├── smoke.spec.ts / hash.spec.ts
    └── ...
```

---

## API Functions (lib/api/supabase.ts)

| Function | Purpose |
|----------|---------|
| `getWubbySummary(url)` | Fetch metadata by URL (computes hash) |
| `getWubbySummaryByHash(hash)` | Fetch metadata by pre-computed hash (validated via `isValidHash`) |
| `fetchRecentVideosPage(params)` | One page (`limit`, `offset`, platform, date range, `signal`) + `total` from `Prefer: count=exact` |
| `fetchRecentVideos(params)` | Rows-only wrapper over `fetchRecentVideosPage` |
| `searchVideos(params)` | Search by title, URL (PostgREST `ilike`; client-side tag check only narrows) |
| `isAbortError(error)` | True for a caller cancellation — callers ignore it rather than toast |

Rows are mapped to the `Video` type by `mapRowToVideo`, which also derives the
thumbnail URL from `video_hash`.

All fetchers go through one module-private `supabaseFetch(queryUrl, context, { signal, headers })`
helper that owns the auth headers, a 10s `AbortController` timeout (cleared in `finally`),
timeout-error mapping, and `describeHttpError(response, context)` for status-code
messages. A caller `signal` is chained in; a caller abort rethrows the `AbortError`
untouched (only the internal timer maps to the timeout message) (every message is context-prefixed so list failures never read like
single-video lookups). **New fetchers must use `supabaseFetch`** — do not hand-wire
`fetch` + timers. `fetchRecentVideos` takes a `PlatformFilter`
(`'twitch' | 'kick' | 'both'` — `types/video.ts`; deliberately excludes `'unknown'`)
plus a runtime whitelist that **throws** on anything else — `'both'` means "no platform
constraint", not "an invalid value to ignore".

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useTouchGestures` | Mobile touch gestures for PiP/fullscreen |
| `useLocalStorage` | SSR-safe localStorage with cross-tab sync |
| `useToast` | Sonner toast wrapper (error/success/info) |
| `useDebounce` | Debounce values for search input |

---

## Design Language — "The Wubby Archive"

Editorial archive-periodical aesthetic on a warm near-black background. All colors are
HSL CSS variables in `app/globals.css` — **do not** reintroduce hardcoded hex like
`#28a745` / `#6441A5` in components.

| Token | Value | Use |
|-------|-------|-----|
| `--background` | `30 12% 5%` | warm near-black page |
| `--foreground` | `40 18% 92%` | warm off-white text |
| `--accent-green` | `142 38% 45%` | the one quiet accent (wordmark italic, № numbers, hooks, play glow) |
| `--ink-muted` | `40 6% 58%` | muted metadata text (`text-ink-muted`) |
| `--rule` | `30 6% 17%` | hairline borders (`border-rule`) |

Other design details:
- `.font-display` → Fraunces; body → Hanken Grotesk; `font-mono` → Geist Mono
- `.masthead-band` radial warm-green wash behind the masthead
- Fixed SVG film-grain overlay (`body::before`, ~4% opacity)
- `playButtonPulse` keyframe on idle play buttons
- Framer Motion respects `prefers-reduced-motion` everywhere (`useReducedMotion`)

---

## Completed Work

### ✅ Core Migration (2025-11-08)
- All pages functional in Next.js, video playback + subtitles, hash-based tracking, mobile tested

### ✅ shadcn Phase 1 (2025-11-10)
- Sonner toast, Badge variants, Skeleton loaders, Collapsible, WCAG 2.1 AA accessibility

### ✅ Two-Tier UX (2025-11-16)
- Browse hooks, `/watch?id=HASH` detail pages, full summaries, 6 tags on desktop

### ✅ Touch Gestures, Thumbnails, Playback Position, Media Session API (2025-11-30)
- See git history for details; all shipped with E2E coverage

### ✅ Next.js 16 + React 19 upgrade
- Upgraded framework/runtime; enabled the React Compiler; ESLint clean for production build

### ✅ Editorial "Wubby Archive" redesign
- New HSL token system + Fraunces/Hanken/Geist Mono typography
- `Masthead`, archive-record `VideoCard`, film-grain + hairline-rule visual language
- Framer Motion: `PageTransition`, masthead wordmark rise, staggered `VideoList` reveal
- Removed the platform toggle; consolidated `/` and `/vod-diary` into shared `VodDiaryScreen`

### ✅ Editorial uplift — rest of the site
- Extended the editorial language to every secondary/utility page: `PageHeader`
  (mono kicker + Fraunces + hairline rules), `watch`/`VideoDetailView`, `player`,
  `transcript`, `player-test`, and the error/404 pages
- Open ruled sections instead of boxed `bg-card` panels; minimal `border-l-2
  border-accent-green/50` accent-bar summaries; tokens replacing all hardcoded hex
- Dropped platform badges site-wide and removed the now-dead `kick`/`twitch` badge
  variants + `--kick`/`--twitch` tokens (visual-only; no logic/data/player changes)

### ✅ Unit test suite
- Vitest + Testing Library; tests in `tests/unit/` (VideoCard, VideoSelector, hooks, hash, helpers)
- npm scripts: `test`, `test:watch`, `test:coverage`, `test:e2e*`, `test:all`

### ✅ Weakspots pass — API resilience + a11y (2026-07-10)
- **API resilience:** `fetchRecentVideos` / `searchVideos` now share `getWubbySummary`'s
  10s `AbortController` timeout (cleared in `finally`); the HTTP status-code switch is
  extracted into one `describeHttpError(response, context)` helper used by all three;
  the `platform` param is whitelisted and **throws** on an out-of-range value rather than
  silently returning unfiltered data
- **WCAG 2.1.1:** `VideoCard`'s play affordance is a real `<Link>` (new-tab behavior kept
  via `target="_blank"` + `rel="noopener noreferrer"`), so it is keyboard/SR reachable
- Removed the hand-rolled basePath prefix + `window.open` — `next/link` applies the
  configured `basePath` automatically; raw `console.*` now routed through `logger`
- Deleted two E2E tests that only drove the removed `PlatformSlider`; gitignored the
  standalone extension

### ✅ Diary hardening (2026-10-04)
- Removed dead code + 70 tracked `.playwright-mcp` screenshots; `/player` (unreachable —
  nothing wrote `selectedVideoUrl`) and `/player-test` deleted; `/vod-diary` redirects
- Superseded diary loads are aborted; Retry re-runs the *current* filters
- Date ranges are whole local days, end-exclusive (fixed the dropped last day and a DST
  test failure); search + date range live in the URL; "Load more" paging with an honest
  total in the masthead
- `lib/api/supabase.ts` now has unit tests; 173 unit tests pass

---

## Remaining Tasks

### 🔜 Next Working Session — start here

1. **The E2E suite is mostly stale.** A Chromium run of navigation / vod-diary /
   accessibility / mobile on 2026-10-04: 33 of 73 pass (every `mobile.spec` test fails). Most failures assert the old
   vanilla-site UI (a "Home"/"VOD Diary"/"Player" header nav, `index.spec`'s URL-input
   homepage) — rewrite against the current UI rather than "fix". The full 5-browser run
   exceeds 10 minutes because stale tests wait out their timeouts.
2. **`/watch` doesn't save or resume playback position** — `VideoDetailView` passes no
   `storageKey`/`title`/`artist` to `VidstackPlayer`, so position + Media Session only
   ever worked on the now-deleted `/player`. `cleanupOldPlaybackPositions` is unused
   until this lands.
3. **Search can't find by tag or summary** — the server `or=` only matches title/URL; the
   client tag check can only narrow. Prerequisite for tag search (item 4).
4. **Lint/typecheck not clean** - pre-existing `no-explicit-any` errors and ~17 `tsc`
   errors in test files (mock fixtures typing `platform` as a bare string). Don't block
   the build, but they prevent holding a clean gate.

### MEDIUM Priority
5. **Tag Search** - Tags are clickable but only log a TODO via `logger.debug` in
   `VideoCard`. Now just `/?q=<tag>` once item 3 lands.
6. **API Caching** - Add React Query/SWR to avoid re-fetching
7. **Mobile Date Picker UX** - `react-day-picker` touch improvements
8. **`<img>` → `next/image`** in `VideoCard` (lint warns). Note `next.config.ts` sets
   `images.unoptimized` for static export, so the win is smaller than it looks.
9. **Search paging** - search is capped at 200 (the UI says so when hit); diary paging
   doesn't cover it.

### ⛔ Settled — do not re-raise

Decisions already made and false positives already investigated. Don't "discover" these
again in the next audit:

- **No CI is deliberate.** Not worth the setup cost at this project's size. Revisit if
  more than one person starts committing, or if a regression ships unnoticed.
- **`.env.local` is NOT committed.** Verified gitignored and absent from git history.
- **The hardcoded Supabase URL + anon key are fine.** Both are *public by design* for a
  PostgREST client.
- **`@supabase/supabase-js` is still a dependency but unused** (the unused client was
  deleted; the API layer is raw `fetch` to PostgREST). Dropping the package is a
  dependency change, so it's its own decision.

### LOW Priority
10. **Production Build Optimization** - Bundle analysis, code splitting
11. **Keyboard Shortcuts** - Ctrl+K for search
12. **Offline Support Indicator**

---

## Key Technical Details

### Video Interface
```typescript
type Platform = 'twitch' | 'kick' | 'both' | 'unknown';

interface Video {
  url: string;
  title: string;            // AI-cleaned pleb_title
  platform: Platform;
  summary: string;          // 200+ words AI-generated
  tags: string[];           // Topic tags
  date: string;             // ISO date
  videoHash?: string;       // SHA-256 (64 chars)
  thumbnailUrl?: string;    // Supabase storage URL
}
```

### Storage Keys
- `vds-{hash}` - Playback position (Vidstack format)

---

## Testing

### Unit Tests (Vitest)
```bash
npm run test            # run once
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```
- Located in `tests/unit/`: `VodDiaryScreen`, `supabase`, `date-range`, `VideoCard`,
  `VideoSelector`, `useToast`, `useLocalStorage`, `hash`, `video-helpers`
- 173 tests, all passing. `date-range.test.ts` pins `process.env.TZ` (Sydney + New York).
  `VodDiaryScreen.test.tsx` mocks `next/navigation` with a store backed by jsdom's URL. `createMockVideo` (`tests/test-utils.tsx`) includes a
  `videoHash` by default — that's what makes a card navigable. Pass
  `{ videoHash: undefined }` to exercise the inert, non-linked card.

### E2E Tests (Playwright)
```bash
npm run test:e2e        # all suites
npm run test:e2e:ui     # interactive UI
npm run test:e2e:headed # headed browser
npm run test:all        # vitest + playwright
```
- Suites: `player-gestures`, `navigation`, `vod-diary`, `transcript`, `index`, `accessibility`, `mobile`

### Test Strategy
- E2E uses real Supabase data (fetches a video hash from the VOD diary)
- Serial execution with `test.beforeAll` for shared state
- Touch detection skips simulation on desktop
- ⚠️ The E2E suite is largely stale (see Remaining Tasks 1). Unit tests + production
  build are the reliable gates; compare E2E runs before/after rather than expecting green.

---

**Last Updated:** 2026-10-04
**Status:** Core complete. Diary hardening landed (abortable loads, whole-day ranges, URL
filters, paging). Unit suite green (173); E2E suite largely stale.
