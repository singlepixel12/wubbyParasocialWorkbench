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
- Single shared `VodDiaryScreen` rendered by both `/` and `/vod-diary` (one source of truth)
- Editorial `Masthead` — wordmark, issue/record count, date-range meta line
- Date range filtering via `react-day-picker` (`DateRangePicker`)
- Toggleable, debounced real-time search (`SearchInput`) across title / URL / tags
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
- Vidstack player with custom community skin
- Subtitle/transcript support (VTT files from Supabase)
- Playback position saving (every 10s after 30s threshold)
- Position restoration on page reload
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
│   ├── page.tsx              # Home — renders <VodDiaryScreen>
│   ├── vod-diary/page.tsx    # VOD diary — also renders <VodDiaryScreen>
│   ├── watch/page.tsx        # Detail view (/watch?id=HASH, query param)
│   ├── player/page.tsx       # Dedicated player
│   ├── transcript/page.tsx   # Transcript extraction
│   ├── player-test/page.tsx  # Player sandbox
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
│   │   ├── VodDiaryScreen.tsx    # Shared browse screen (masthead + filters + list)
│   │   ├── VideoCard.tsx         # Archive-record browse card (React.memo)
│   │   ├── VideoList.tsx         # Card container, staggered reveal (React.memo)
│   │   ├── SkeletonVideoCard.tsx # Loading placeholder
│   │   ├── DateRangePicker.tsx   # react-day-picker integration
│   │   └── SearchInput.tsx       # Toggleable debounced search
│   ├── PageTransition.tsx        # Framer Motion route transitions
│   └── Header.tsx                # Sticky editorial wordmark + hamburger Sheet
├── lib/
│   ├── api/
│   │   └── supabase.ts           # API client (4 functions)
│   ├── hooks/
│   │   ├── useTouchGestures.ts   # Mobile gestures (PiP/fullscreen)
│   │   ├── useLocalStorage.ts    # SSR-safe storage
│   │   ├── useToast.ts           # Sonner wrapper
│   │   └── useDebounce.ts        # Debounce utility
│   ├── utils/
│   │   ├── hash.ts               # SHA-256 computation + isValidHash
│   │   ├── video-helpers.ts      # Format/extract utilities (extractHook, etc.)
│   │   ├── logger.ts             # Environment-aware logging
│   │   └── storage-cleanup.ts    # Vidstack position cleanup
│   └── constants.ts              # SUPABASE_URL, shared constants
├── types/
│   ├── video.ts                  # Video / Platform interfaces ('twitch'|'kick'|'both'|'unknown')
│   └── supabase.ts               # DB types
└── tests/
    ├── unit/                     # Vitest unit tests
    │   ├── VideoCard.test.tsx
    │   ├── VideoSelector.test.tsx
    │   ├── useToast.test.tsx
    │   ├── useLocalStorage.test.tsx
    │   ├── hash.test.ts
    │   └── video-helpers.test.ts
    ├── player-gestures.spec.ts   # Touch gesture E2E tests
    ├── navigation.spec.ts        # Page navigation
    ├── vod-diary.spec.ts         # Filter functionality
    ├── player.spec.ts            # Player E2E
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
| `fetchRecentVideos(params)` | Query videos with filters (limit, optional platform, date range) |
| `searchVideos(params)` | Search by title, URL, tags (PostgREST `ilike` + client-side tag filter) |

Rows are mapped to the `Video` type by `mapRowToVideo`, which also derives the
thumbnail URL from `video_hash`.

All four fetchers go through one module-private `supabaseFetch(queryUrl, context)` helper
that owns the auth headers, a 10s `AbortController` timeout (cleared in `finally`),
timeout-error mapping, and `describeHttpError(response, context)` for status-code
messages (every message is context-prefixed so list failures never read like
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

---

## Remaining Tasks

A risk audit (2026-06-12) found the concrete defects now listed under Completed Work.
What remains is a **thin verification layer**: the E2E suite has never been run
end-to-end, and `lib/api/supabase.ts` has no unit tests.

### 🔜 Next Working Session — start here

1. **Run `npm run test:e2e` once** and fix what falls out. Needs a dev server + live
   Supabase; the suite's real state is currently unverified.
2. **Unit-test `lib/api/supabase.ts`** (mock `fetch`) — the data backbone, and the most
   logic-dense file, with zero coverage. The timeout and platform-whitelist paths are
   easy first tests.
3. **Lint/typecheck not clean** - pre-existing `no-explicit-any` errors and ~17 `tsc`
   errors in test files (mock fixtures typing `platform` as a bare string). Don't block
   the build, but they prevent holding a clean gate.

### MEDIUM Priority
4. **Tag Search** - Tags are clickable but only log a TODO via `logger.debug` in
   `VideoCard` (highest user-visible win; already half-wired)
5. **API Caching** - Add React Query/SWR to avoid re-fetching
6. **VOD Diary Pagination** - Currently fetches up to 50–200 videos at once
7. **Mobile Date Picker UX** - `react-day-picker` touch improvements
8. **`<img>` → `next/image`** in `VideoCard` (lint warns). Note `next.config.ts` sets
   `images.unoptimized` for static export, so the win is smaller than it looks.
9. **Dedupe the Supabase URL** - hardcoded in `VideoDetailView.tsx` instead of importing
   `SUPABASE_URL` from `lib/constants.ts`.

### ⛔ Settled — do not re-raise

Decisions already made and false positives already investigated. Don't "discover" these
again in the next audit:

- **No CI is deliberate.** Not worth the setup cost at this project's size. Revisit if
  more than one person starts committing, or if a regression ships unnoticed.
- **`.env.local` is NOT committed.** Verified gitignored and absent from git history.
- **The hardcoded Supabase URL + anon key are fine.** Both are *public by design* for a
  PostgREST client. The only real nit is the duplication (item 9 above).
- **`getSupabaseClient` in `lib/api/supabase.ts` is unused** and lint warns. The file
  talks to PostgREST via raw `fetch` throughout. Wire it up or delete it — but it is not
  a bug.

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
- `selectedVideoUrl` - Current video URL
- `vds-{hash}` - Playback position (Vidstack format)

---

## Testing

### Unit Tests (Vitest)
```bash
npm run test            # run once
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```
- Located in `tests/unit/`: `VideoCard`, `VideoSelector`, `useToast`, `useLocalStorage`, `hash`, `video-helpers`
- 126 tests, all passing. `createMockVideo` (`tests/test-utils.tsx`) includes a
  `videoHash` by default — that's what makes a card navigable. Pass
  `{ videoHash: undefined }` to exercise the inert, non-linked card.
- **Not covered:** `lib/api/supabase.ts` — the data backbone has zero unit tests

### E2E Tests (Playwright)
```bash
npm run test:e2e        # all suites
npm run test:e2e:ui     # interactive UI
npm run test:e2e:headed # headed browser
npm run test:all        # vitest + playwright
```
- Suites: `player-gestures`, `navigation`, `vod-diary`, `player`, `transcript`, `index`, `accessibility`, `mobile`

### Test Strategy
- E2E uses real Supabase data (fetches a video hash from the VOD diary)
- Serial execution with `test.beforeAll` for shared state
- Touch detection skips simulation on desktop
- ⚠️ The E2E suite has **not been run end-to-end** since the editorial redesign. Unit
  tests + production build are the only verified gates.

---

**Last Updated:** 2026-07-10
**Status:** Core complete. Editorial "Wubby Archive" redesign live. API resilience + a11y
fixes landed. Unit suite green (126); E2E suite present but unverified.
