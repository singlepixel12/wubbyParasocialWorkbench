# UI Implementation Guide
## Wubby Parasocial Workbench — Design & Component Reference

**Version:** 3.0
**Last Updated:** 2026-06-02
**Status:** Editorial "Wubby Archive" redesign live

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Design Language](#design-language)
3. [Two-Tier UX Pattern](#two-tier-ux-pattern)
4. [Component Specifications](#component-specifications)
5. [Animation](#animation)
6. [Quick Reference](#quick-reference)
7. [Remaining Work](#remaining-work)

---

## Quick Start

### 🎯 What Makes This App Unique?

1. **AI-Generated Summaries** - Instant video understanding (200+ words)
2. **Intelligent Tagging** - Search by topics/guests (tag-search wiring is still TODO)
3. **Title Renaming** - AI-cleaned `pleb_title` shown alongside the original filename
4. **Two-Tier UX** - Scan first (browse hook), read later (expand / detail)
5. **Editorial identity** - The whole app is themed as *The Wubby Archive*, an archive periodical

### ⚡ Animation Framework

- **Framer Motion** (`framer-motion`) — page transitions, masthead wordmark, staggered card reveals
- **tw-animate-css** + CSS keyframes (e.g. `playButtonPulse`) for small idle effects
- All motion respects `prefers-reduced-motion` (`useReducedMotion`)

> ⚠️ Earlier versions of this guide said "NOT using Framer Motion." That is no longer
> true — Framer Motion is a dependency and is used across the app.

---

## Design Language

### "The Wubby Archive" — editorial archive periodical

A warm near-black canvas, one quiet green accent, hairline rules, a Fraunces display
serif, and a faint film-grain texture. The goal is "curated archive," not "generic dark
SaaS." There is **no per-platform color theming** anymore — a single accent does all the work.

### Design Tokens (HSL CSS variables in `app/globals.css`)

All colors are HSL custom properties consumed through Tailwind utilities. **Do not**
hardcode hex such as `#28a745` / `#6441A5` in components.

```css
--background:   30 12% 5%;    /* warm near-black page          → bg-background     */
--foreground:   40 18% 92%;   /* warm off-white text           → text-foreground   */
--card:         28 10% 8%;    /* card surface                  → bg-card           */
--accent-green: 142 38% 45%;  /* the one quiet accent          → text/bg-accent-green */
--ink-muted:    40 6% 58%;    /* muted metadata text           → text-ink-muted    */
--rule:         30 6% 17%;    /* hairline borders              → border-rule       */
--ring:         142 38% 38%;  /* focus ring                                        */
```

The legacy `--kick` / `--twitch` platform tokens and the `kick`/`twitch` badge variants
have been removed entirely; only a neutral gray scale remains in `globals.css` for the
`tag` badge.

### Typography

| Face | Variable | Tailwind | Used for |
|------|----------|----------|----------|
| Fraunces (display serif) | `--font-fraunces` | `.font-display` | Masthead, card titles |
| Hanken Grotesk (sans) | `--font-hanken` | default body | UI / metadata text |
| Geist Mono | `--font-geist-mono` | `font-mono` | Hashes, URLs, filenames, kickers |

Loaded via `next/font/google` in `app/layout.tsx`.

### Texture & Atmosphere

- `body::before` — fixed SVG fractal-noise film grain at ~4% opacity
- `.masthead-band` — radial warm-green wash behind the masthead
- Thumbnails render `grayscale-[35%]` and colorize to full on hover

---

## Two-Tier UX Pattern

### Phase 1: Browse (VodDiaryScreen — `/` and `/vod-diary`)

Each VOD is an "archive record" card:

```
┌──────────────────────────────────────────────┐
│  № 03   📅 12 Nov 2025                         │ ← record number (accent) · date (mono)
│                                                │
│  The Wubby Reacts to Reddit                    │ ← Fraunces display title
│  📄 11_kickapilol                              │ ← original filename (mono, muted)
│                                                │
│  ┃ Hilarious reactions to unhinged comments…   │ ← 1-2 line hook (thin accent rule)
│                                                │
│  reddit  react  alluux  +4                     │ ← 3 tags (mobile) / 6 (desktop)
│  ──────────────────────────────────────────   │
│  Read more  ▾                                  │ ← expands the FULL summary in place
└──────────────────────────────────────────────┘
```

- Clicking the **thumbnail** opens the detail view (`/watch?id=HASH`) in a new tab.
- Clicking **Read more** expands the full summary inline (no navigation); toggles to "Show less".

### Phase 2: Detail (`/watch?id=HASH`)

`VideoDetailView` — full-width player, full AI summary, all tags, back navigation.
The route is a **query param** (`app/watch/page.tsx`, `?id=HASH`), not a dynamic segment.

**Why two tiers:** browse dozens of VODs without fatigue; the full summary feels like a
reward; "other sites: nothing — here: 200 words" reads as more impressive.

---

## Component Specifications

### VodDiaryScreen — `components/vod-diary/VodDiaryScreen.tsx`

The single source of truth for the browse experience; rendered by both `/` and
`/vod-diary` so they can never drift. Holds the filter + fetch state and composes:

1. `<Masthead edition="VOD Diary" count={videos.length} dateLabel=… />`
2. Filters row — `DateRangePicker` (hidden while search is open) + toggleable `SearchInput`
3. `<VideoList>`

Fetch logic: search mode → `searchVideos({ searchTerm, limit: 200 })`; otherwise
`fetchRecentVideos({ limit: 50, fromDate, toDate })` (all platforms). On error it keeps
the previous results and shows a retry toast.

### Masthead — `components/layout/Masthead.tsx`

Editorial header: mono kicker (`Archive · est. wubby.tv`) + issue number (`No. NN`,
derived from the record count), a Fraunces wordmark "The Wubby *Archive*" that rises in
on mount (Framer Motion), and a bottom meta line (edition / date range) between hairlines.
Distinct from `PageHeader`, which stays for the utilitarian pages.

### VideoCard — `components/vod-diary/VideoCard.tsx`

Archive-record browse card (`React.memo`). Visual hierarchy:

1. Meta rail — `№ NN` record number (accent) + date (mono, with calendar icon)
2. Title — Fraunces display, `line-clamp-2`
3. Original filename — mono, muted, with `FileText` icon
4. Hook / full summary — thin `border-accent-green/50` left rule; `line-clamp-2` until expanded
5. Tags — 3 on mobile, 6 on desktop (`TagBadge`, clickable; search wiring is TODO)
6. Footer button — "Read more ▾" / "Show less ▴", spanning the card foot above a hairline

Thumbnail: `grayscale-[35%]` → full color on hover; idle `playButtonPulse`; on hover the
play button scales and gains an `accent-green` glow. Clicking it opens `/watch?id=HASH`
(includes the GitHub Pages basePath in production).

> No platform badge and no per-platform color — the single accent green is intentional.

### VideoList — `components/vod-diary/VideoList.tsx`

Container (`React.memo`). Loading → 5 `SkeletonVideoCard`s; brief 2s grace before the
empty state to avoid flashing "no results." Renders a **staggered** Framer Motion reveal
(`staggerChildren: 0.05`, each card fades/rises with an ease-out curve), disabled under
reduced motion.

### Header — `components/Header.tsx`

Sticky, hairline-bottom, blurred. Left: editorial wordmark linking home. Right: a
hamburger that opens a shadcn `Sheet` with secondary nav (currently just "Get Transcript").

### PageTransition — `components/PageTransition.tsx`

Wraps `main` in `app/layout.tsx`. `AnimatePresence` keyed on pathname; fade + horizontal
slide (±20px), or plain fade under reduced motion.

---

## Animation

| Element | Mechanism | Notes |
|---------|-----------|-------|
| Route changes | `PageTransition` (Framer Motion) | fade + slide, 0.25s |
| Masthead wordmark | `motion.h1` rise-in | 0.5s, custom ease |
| Card list | `VideoList` stagger | 0.05s between cards |
| Idle play button | CSS `playButtonPulse` | stops on hover |
| Reduced motion | `useReducedMotion()` | every animation degrades to none/fade |

---

## Quick Reference

### Key Functions (`lib/utils/video-helpers.ts`, `lib/utils/hash.ts`, `lib/api/supabase.ts`)

```typescript
extractHook(summary: string, maxLen?: number): string  // 1-2 line browse hook
extractOriginalTitle(url: string): string               // original filename from URL
formatDateDisplay(date: Date): string                   // display date
computeVideoHash(url: string): Promise<string>          // SHA-256 of URL
isValidHash(hash: string): boolean                       // 64-char hex guard

getWubbySummary(url: string): Promise<Video | null>          // by URL (computes hash)
getWubbySummaryByHash(hash: string): Promise<Video | null>   // by hash (validated)
fetchRecentVideos(params): Promise<Video[]>                  // limit / platform / date range
searchVideos(params): Promise<Video[]>                       // title / URL / tags
```

### Routes

```
/                  → Home (shared VodDiaryScreen)
/vod-diary         → VOD diary (shared VodDiaryScreen)
/watch?id=HASH     → Detail view (full summary + player)   ← query param, not /watch/[id]
/player            → Dedicated player
/transcript        → Transcript extraction
```

### Design Decisions Log

**Intentionally omitted (keep the UI quiet):**
- ❌ "AI Summary" badge / sparkle icons
- ❌ Tag-count badge with icon
- ❌ Per-platform color theming (one accent green instead)

**Superseded by the editorial redesign:**
- The old generic dark theme with hardcoded `#28a745` / `#6441A5`
- The Twitch/Kick `PlatformSlider` toggle (removed)
- Earlier "no Framer Motion" / "black-placeholder thumbnails" notes

---

## Remaining Work

Genuinely open UI/UX items (see CLAUDE.md for the full backlog):

| Task | Priority |
|------|----------|
| Wire tag clicks to search | Medium |
| API caching (React Query/SWR) | Medium |
| VOD diary pagination | Medium |
| Mobile date-picker UX polish | Medium |
| Keyboard shortcuts (Ctrl+K) | Low |
| Bundle analysis / code splitting | Low |

---

**Questions?** See [CLAUDE.md](./CLAUDE.md) for the project overview and file map.
