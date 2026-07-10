# Wubby Parasocial Workbench

Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging — presented as an editorial "archive periodical": **The Wubby Archive**.

## Quick Start

```bash
cd web-new
npm install
cp .env.example .env.local   # working defaults — no editing needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> The anon key is **required** — the app throws at startup without it. It's a
> read-only key protected by Row Level Security, so it's safe in client code.
> `NEXT_PUBLIC_SUPABASE_URL` is optional (a default is built in).

---

## Features

### VOD Diary (Browse)
Browse Wubby's VOD archive. Both `/` (home) and `/vod-diary` render the same
`VodDiaryScreen`, so the two routes can never drift.
- **Editorial masthead** - "The Wubby Archive" wordmark with an issue number (record count) and date-range meta line
- **Date Range Picker** - Filter by date (`react-day-picker`), with locale-aware formatting
- **Search** - Toggleable, debounced, real-time search across title / URL / tags
- **Archive-record cards** - Each VOD is a hairline-ruled entry with a running `№` number, a Fraunces display title, a 1-2 line hook, and an expand-in-place full summary

> Note: the old Twitch/Kick **platform toggle** was removed — the diary now shows
> all platforms together. The API still supports platform filtering internally.

### AI-Powered Content
Every video includes AI-generated metadata:
- **Summaries** - 200+ word summaries for instant video understanding
- **Smart Tags** - Topics, guests, games (clickable; tag-search is still a TODO)
- **Title Cleaning** - AI-cleaned `pleb_title` shown alongside the original filename from the URL

### Video Player
Full-featured video playback at `/watch?id=HASH` and `/player`:
- **Subtitles/Transcripts** - VTT files from Supabase storage
- **Playback Position** - Saves every 10s (after a 30s threshold), restores on reload
- **Lock Screen Controls** - Media Session API for background playback
- **Touch Gestures** - Drag up = fullscreen, drag down = PiP (mobile)

### Two-Tier UX
Progressive disclosure for better browsing:
1. **Browse View** - Scannable cards with a short hook; "Read more" expands the full summary in place
2. **Detail View** - Full summary + player at `/watch?id=HASH` (open the card thumbnail — a real link, opens in a new tab, fully keyboard accessible)

### Resilient API layer
All Supabase requests go through one `supabaseFetch` helper: shared auth headers, a
10-second timeout on every call, and consistent, call-site-aware error messages. The
platform filter is validated at both the type level (`PlatformFilter`) and runtime.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) + React Compiler |
| UI | React 19 + shadcn/ui + Tailwind CSS 4 |
| Typography | Fraunces (display), Hanken Grotesk (body), Geist Mono (mono) |
| Animation | Framer Motion + tw-animate-css |
| Video | Vidstack Player (CDN-loaded) |
| Backend | Supabase (PostgreSQL + Storage) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |

---

## Project Structure

```
wubbyParasocialWorkbench/
├── web-new/                    # Next.js app
│   ├── app/                    # App router pages
│   │   ├── page.tsx           # Home — renders <VodDiaryScreen>
│   │   ├── vod-diary/         # VOD diary — also renders <VodDiaryScreen>
│   │   ├── watch/             # Detail view (/watch?id=HASH)
│   │   ├── player/            # Dedicated player
│   │   └── transcript/        # Transcript extraction
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── layout/            # Masthead, PageHeader
│   │   ├── video/             # Player, metadata, selector, detail view
│   │   ├── vod-diary/         # VodDiaryScreen, cards, filters, search
│   │   └── PageTransition.tsx # Framer Motion route transitions
│   ├── lib/
│   │   ├── api/               # Supabase client
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Hash, logger, helpers
│   │   └── constants.ts       # Supabase URL, etc.
│   ├── types/                 # TypeScript interfaces
│   └── tests/                 # unit/ (Vitest) + *.spec.ts (Playwright)
├── CLAUDE.md                  # Developer guide
├── UI_IMPLEMENTATION_GUIDE.md # Design & component reference
└── README.md                  # This file
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — VOD browse (shared `VodDiaryScreen`) |
| `/vod-diary` | VOD diary — shared `VodDiaryScreen` |
| `/watch?id=HASH` | Full video detail view + player |
| `/player` | Dedicated video player |
| `/transcript` | Transcript extraction tool |

---

## Design Language — "The Wubby Archive"

An editorial, archive-periodical aesthetic on a warm near-black background:

- **One quiet accent**: `accent-green` (`hsl(142 38% 45%)`) — used sparingly for the
  wordmark italic, record numbers, hooks, and play-button glow
- **Editorial layer**: a single muted `ink-muted` text tone, hairline `rule` borders,
  a faint warm-green wash behind the masthead, and a fixed low-opacity film-grain overlay
- **Typography**: Fraunces display serif for titles/mastheads, Hanken Grotesk for body,
  Geist Mono for technical strings (hashes, URLs, filenames)
- **Motion**: Framer Motion page transitions, masthead wordmark rise, and a staggered
  card reveal — all respect `prefers-reduced-motion`

Colors are driven by HSL CSS variables in `app/globals.css` (e.g. `--accent-green`,
`--ink-muted`, `--rule`), not hardcoded hex.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key   # required (read-only, RLS-protected)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url    # optional — defaults to the project URL
```

See `web-new/.env.example` for a template. `.env.local` is gitignored.

---

## Building & Deployment

The app is a **static export** (`output: 'export'` in `next.config.ts`) built for
GitHub Pages:

```bash
cd web-new
npm run build   # emits static site to out/
```

In production builds, `basePath` is set to `/wubbyParasocialWorkbench` automatically —
never hand-prefix routes; `next/link` applies it for you.

---

## Testing

```bash
# Unit tests (Vitest)
npm run test          # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage

# E2E tests (Playwright)
npm run test:e2e        # run all
npm run test:e2e:ui     # interactive UI
npm run test:e2e:headed # headed browser

# Everything
npm run test:all        # vitest + playwright
```

Unit tests live in `tests/unit/` (VideoCard, VideoSelector, hooks, hash, helpers) —
126 tests, all passing. E2E suites cover navigation, VOD diary, player, player
gestures, transcript, accessibility, and mobile; they need a running dev server and
use real Supabase data.

> ⚠️ The E2E suite hasn't been run end-to-end since the editorial redesign — unit
> tests + the production build are the verified gates. Running it once is the top
> backlog item.

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Developer guide with technical details
- **[UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)** - Design & component reference

---

## Remaining Work

| Priority | Task |
|----------|------|
| HIGH | Run the E2E suite end-to-end once and fix what falls out |
| HIGH | Unit tests for `lib/api/supabase.ts` (the data backbone has zero coverage) |
| MEDIUM | Tag search (tags are clickable but don't trigger search yet) |
| MEDIUM | API caching (React Query/SWR) to avoid re-fetching |
| MEDIUM | VOD diary pagination (currently fetches up to 50–200 at once) |
| MEDIUM | `<img>` → `next/image` in VideoCard; dedupe the Supabase URL in VideoDetailView |
| LOW | Clean lint/type gate (pre-existing errors in test fixtures) |
| LOW | Keyboard shortcuts (Ctrl+K for search) |

See the "Remaining Tasks" section of [CLAUDE.md](./CLAUDE.md) for the full backlog,
including decisions already settled (e.g. **no CI is deliberate** at this project's
size — don't re-raise it).

> `wubby-pleb-titles-extension/` at the repo root is a **separate, gitignored
> project** with its own git history — not part of this app. See CLAUDE.md
> "Out of scope".

---

**Last Updated:** 2026-07-10
**Status:** Core complete. Editorial "Wubby Archive" redesign live. API layer hardened
(shared fetch helper, timeouts, typed platform filter) and VideoCard keyboard/screen-reader
accessible. 126 unit tests green; E2E suite present but unverified.
