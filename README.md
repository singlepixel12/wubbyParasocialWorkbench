# Wubby Parasocial Workbench

Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging.

## Quick Start

```bash
cd web-new
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

### VOD Diary
Browse Wubby's VOD archive with powerful filtering:
- **Date Range Picker** - Filter by date with locale-aware formatting (AU/US)
- **Platform Filter** - Toggle between Twitch, Kick, or both
- **Search** - Real-time search with debouncing
- **Expandable Cards** - 1-2 line AI summary hooks with "Read more"

### AI-Powered Content
Every video includes AI-generated metadata:
- **Summaries** - 200+ word summaries for instant video understanding
- **Smart Tags** - Topics, guests, games for lightning-fast search
- **Title Cleaning** - AI-cleaned titles + original filenames preserved

### Video Player
Full-featured video playback:
- **Subtitles/Transcripts** - VTT files from Supabase storage
- **Playback Position** - Saves every 10s, restores on reload
- **Lock Screen Controls** - Media Session API for background playback
- **Touch Gestures** - Drag up = fullscreen, drag down = PiP (mobile)

### Two-Tier UX
Progressive disclosure for better browsing:
1. **Browse View** - Scannable cards with summary hooks
2. **Detail View** - Full summary at `/watch?id=HASH`

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui + Tailwind CSS 4 |
| Video | Vidstack Player |
| Backend | Supabase (PostgreSQL + Storage) |
| Testing | Playwright (E2E) |
| Animations | tw-animate-css |

---

## Project Structure

```
wubbyParasocialWorkbench/
├── web-new/                    # Next.js app
│   ├── app/                    # App router pages
│   │   ├── page.tsx           # Home (VOD browse)
│   │   ├── watch/             # Detail view
│   │   ├── vod-diary/         # VOD diary
│   │   ├── player/            # Video player
│   │   └── transcript/        # Transcript extraction
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── video/             # Player, metadata, selector
│   │   └── vod-diary/         # Cards, filters, search
│   ├── lib/
│   │   ├── api/               # Supabase client
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Hash, logger, helpers
│   ├── types/                 # TypeScript interfaces
│   └── tests/                 # Playwright E2E tests
├── CLAUDE.md                  # Developer guide
└── README.md                  # This file
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with VOD browse |
| `/vod-diary` | VOD diary with filters |
| `/watch?id=HASH` | Full video detail view |
| `/player` | Dedicated video player |
| `/transcript` | Transcript extraction tool |

---

## Key Features Implemented

### Core (Nov 2025)
- [x] Next.js migration from vanilla HTML/CSS/JS
- [x] Supabase integration (metadata, subtitles, thumbnails)
- [x] Hash-based video tracking (SHA-256)
- [x] VOD diary with date/platform/search filters
- [x] Vidstack player with subtitles

### UX Enhancements
- [x] Two-tier progressive disclosure
- [x] shadcn/ui components (badge, skeleton, collapsible)
- [x] Platform-specific theming (Kick green, Twitch purple)
- [x] React.memo optimization for 50+ cards
- [x] Error boundaries with retry buttons
- [x] Skeleton loading states

### Video Player
- [x] Touch gestures (PiP/fullscreen on mobile)
- [x] Playback position saving/restoration
- [x] Media Session API (lock screen controls)
- [x] Thumbnail/poster display
- [x] Lazy-loaded thumbnails with fallbacks

### Testing
- [x] 32 E2E tests for touch gestures
- [x] Mobile Chrome + Safari coverage
- [x] Real Supabase data in tests

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Testing

```bash
# Run all E2E tests
npx playwright test

# Run touch gesture tests on mobile
npx playwright test tests/player-gestures.spec.ts --project="Mobile Chrome"

# Run with UI
npx playwright test --ui
```

---

## Platform Support

- **Twitch VODs** - Purple theming
- **Kick VODs** - Green theming
- Platform-specific filtering and color accents throughout

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Developer guide with technical details
- **[UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)** - Design reference

---

## Remaining Work

| Priority | Task |
|----------|------|
| HIGH | Component unit tests |
| MEDIUM | API caching (React Query/SWR) |
| MEDIUM | VOD diary pagination |
| MEDIUM | Tag search implementation |
| LOW | Production build optimization |
| LOW | Keyboard shortcuts (Ctrl+K) |

---

**Last Updated:** 2025-11-30
**Status:** Core complete. 32 E2E tests passing. Ready for unit tests.
