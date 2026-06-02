# Wubby Parasocial Workbench

Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging — presented as an editorial "archive periodical": **The Wubby Archive**.

## Quick Start

```bash
cd web-new
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

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
2. **Detail View** - Full summary + player at `/watch?id=HASH` (open the card thumbnail)

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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

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

Unit tests live in `tests/unit/` (VideoCard, VideoSelector, hooks, hash, helpers).
E2E suites cover navigation, VOD diary, player, player gestures, transcript,
accessibility, and mobile. E2E tests use real Supabase data.

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Developer guide with technical details
- **[UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)** - Design & component reference

---

## Remaining Work

| Priority | Task |
|----------|------|
| MEDIUM | API caching (React Query/SWR) to avoid re-fetching |
| MEDIUM | VOD diary pagination (currently fetches up to 50–200 at once) |
| MEDIUM | Tag search (tags are clickable but don't trigger search yet) |
| LOW | Production build optimization (bundle analysis, code splitting) |
| LOW | Keyboard shortcuts (Ctrl+K for search) |

---

**Last Updated:** 2026-06-02
**Status:** Core complete. Editorial "Wubby Archive" redesign live. Unit + E2E test suites in place.
