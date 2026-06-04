# Claude.md - Wubby Parasocial Workbench

## Project Overview

**Wubby Parasocial Workbench** - Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging. The UI is themed as an editorial "archive periodical": **The Wubby Archive**.

**Target Audience:** Wubby community
**Data Source:** archive.wubby.tv
**Location:** `/web-new` directory

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

---

## Remaining Tasks

### 🔜 Next Working Session — start here (cleanup + quality debt)

Surfaced during the editorial-uplift session (2026-06-04). Small, well-scoped, and
worth clearing before new features so `main` is genuinely solid.

**Loose ends / tech debt**
1. **Stale E2E specs (will fail)** - `tests/accessibility.spec.ts` and `tests/mobile.spec.ts`
   still drive a removed `PlatformSlider` (`radiogroup` "platform filter"). Fix both,
   then run `npm run test:e2e` — the suite's real state is currently **unverified**
   (build + 125 unit tests + security review are green; e2e was not run).
2. **`wubby-pleb-titles-extension/`** - an embedded git repo sitting untracked at the
   repo root (shows in every `git status`). Decide: gitignore it, make it a submodule,
   or move it out.
3. **Lint not clean** - 11 pre-existing `no-explicit-any` **errors** in test files
   (`hash.test.ts`, `video-helpers.test.ts`, etc.) + unused-var warnings. Don't block
   the build, but worth holding a clean `npm run lint` gate.

**Code quality**
4. **Thumbnail not keyboard-accessible** - `VideoCard`'s play affordance is a
   `<div onClick>` with `aria-label` but no `role`/`tabIndex`/key handler, so keyboard
   + screen-reader users can't open `/watch` (WCAG 2.1.1). Make it a `<button>`/link.
5. **`<img>` → `next/image`** in `VideoCard` (lint warns; slower LCP on the thumbnail grid).
6. **Raw `console.*` in `VideoCard`** (tag-search TODO + missing-hash warning) should use
   the existing `logger` utility.

### MEDIUM Priority
7. **Tag Search** - Tags are clickable but only `console.log` a TODO in `VideoCard`
   (highest user-visible win; already half-wired)
8. **API Caching** - Add React Query/SWR to avoid re-fetching
9. **VOD Diary Pagination** - Currently fetches up to 50–200 videos at once
10. **Mobile Date Picker UX** - `react-day-picker` touch improvements

### LOW Priority
11. **Production Build Optimization** - Bundle analysis, code splitting
12. **Keyboard Shortcuts** - Ctrl+K for search
13. **Offline Support Indicator**

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

---

**Last Updated:** 2026-06-02
**Status:** Core complete. Editorial "Wubby Archive" redesign live. Unit + E2E suites in place.
