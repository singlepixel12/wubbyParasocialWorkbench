# Claude.md - Wubby Parasocial Workbench

## Project Overview

**Wubby Parasocial Workbench** - Web tool for analyzing Wubby stream content with AI-powered video summaries, transcripts, and smart tagging.

**Target Audience:** Wubby community
**Data Source:** archive.wubby.tv
**Location:** `/web-new` directory

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + shadcn/ui + Tailwind CSS 4
- **Video:** Vidstack Player (CDN-loaded)
- **Backend:** Supabase (PostgreSQL + Storage)
- **Testing:** Playwright (E2E)
- **Animations:** tw-animate-css

---

## Core Features

### 1. VOD Diary (Browse)
- Date range filtering with locale-aware formatting (AU/US)
- Platform toggle (Twitch/Kick/Both) with color theming
- Real-time search with debouncing
- Expandable video cards with AI summary hooks
- Lazy-loaded thumbnails with fallbacks

### 2. Two-Tier UX (Progressive Disclosure)
- **Browse View:** Scannable 1-2 line hooks + "Read more"
- **Detail View:** Full 200+ word AI summary at `/watch?id=HASH`
- Platform-specific play button glow (Kick green, Twitch purple)
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
- Format: `wubbytranscript/{hash}/en/subtitle.vtt`

---

## File Structure

```
web-new/
├── app/
│   ├── page.tsx              # Landing/Home (VOD browse)
│   ├── watch/page.tsx        # Detail view (/watch?id=HASH)
│   ├── vod-diary/page.tsx    # VOD diary with filters
│   ├── player/page.tsx       # Dedicated player
│   ├── transcript/page.tsx   # Transcript extraction
│   ├── layout.tsx            # Root layout + metadata
│   ├── error.tsx             # Global error boundary
│   ├── not-found.tsx         # 404 page
│   ├── loading.tsx           # Loading skeleton
│   └── globals.css           # Tailwind styles
├── components/
│   ├── ui/                   # shadcn components (badge, button, card, etc.)
│   ├── video/
│   │   ├── VidstackPlayer.tsx    # Main player (CDN, subtitles, gestures)
│   │   ├── VideoSelector.tsx     # URL input + dropdown
│   │   ├── VideoMetadata.tsx     # Metadata display
│   │   ├── VideoDetailView.tsx   # Full detail view
│   │   └── HashDisplay.tsx       # Hash status display
│   ├── vod-diary/
│   │   ├── VideoCard.tsx         # Browse card (React.memo)
│   │   ├── VideoList.tsx         # Card container (React.memo)
│   │   ├── SkeletonVideoCard.tsx # Loading placeholder
│   │   ├── DateRangePicker.tsx   # Flatpickr integration
│   │   ├── PlatformSlider.tsx    # Platform toggle
│   │   └── SearchInput.tsx       # Debounced search
│   ├── layout/
│   │   └── PageHeader.tsx        # Page title/description
│   └── Header.tsx                # Site navigation
├── lib/
│   ├── api/
│   │   └── supabase.ts           # API client (4 functions)
│   ├── hooks/
│   │   ├── useTouchGestures.ts   # Mobile gestures (PiP/fullscreen)
│   │   ├── useLocalStorage.ts    # SSR-safe storage
│   │   ├── useToast.ts           # Sonner wrapper
│   │   └── useDebounce.ts        # Debounce utility
│   └── utils/
│       ├── hash.ts               # SHA-256 computation
│       ├── video-helpers.ts      # Format/extract utilities
│       ├── logger.ts             # Environment-aware logging
│       └── storage-cleanup.ts    # Vidstack position cleanup
├── types/
│   ├── video.ts                  # Video interface
│   └── supabase.ts               # DB types
└── tests/
    ├── player-gestures.spec.ts   # Touch gesture tests (32 tests)
    ├── navigation.spec.ts        # Page navigation
    ├── vod-diary.spec.ts         # Filter functionality
    └── ...                       # Other E2E tests
```

---

## API Functions (lib/api/supabase.ts)

| Function | Purpose |
|----------|---------|
| `getWubbySummary(url)` | Fetch metadata by URL (computes hash) |
| `getWubbySummaryByHash(hash)` | Fetch metadata by pre-computed hash |
| `fetchRecentVideos(params)` | Query videos with filters |
| `searchVideos(params)` | Search by title, URL, tags |

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useTouchGestures` | Mobile touch gestures for PiP/fullscreen |
| `useLocalStorage` | SSR-safe localStorage with cross-tab sync |
| `useToast` | Sonner toast wrapper (error/success/info) |
| `useDebounce` | Debounce values for search input |

---

## Completed Work

### ✅ Core Migration (2025-11-08)
- All 4 pages functional in Next.js
- Video playback + subtitles working
- VOD diary filtering (date + platform + search)
- Hash-based tracking preserved
- Mobile tested (375x667px)

### ✅ shadcn Phase 1 (2025-11-10)
- Sonner Toast (182 lines removed)
- Badge component with 6 variants (kick, twitch, tag + solid)
- Skeleton loading components
- Collapsible (60 lines removed)
- WCAG 2.1 AA accessibility

### ✅ Two-Tier UX (2025-11-16)
- Browse cards with 1-2 line hooks
- `/watch?id=HASH` detail pages
- Full 200-word AI summaries
- Platform-specific play button glow
- 6 tags visible (was 3)
- Green accent bar for summaries

### ✅ Optimizations (2025-11-11)
- React.memo on VideoCard/VideoList
- Error retry buttons on all toasts
- Enhanced empty states with icons
- useToast simplified (217→90 lines)
- Environment-aware logger

### ✅ Touch Gestures (2025-11-30)
- `useTouchGestures.ts` hook
- Drag up = fullscreen, drag down = PiP
- Mobile-only (80px threshold)
- 32 E2E tests passing (Mobile Chrome + Safari)
- `data-video-hash` attribute for testability

### ✅ Thumbnails & Posters (2025-11-30)
- Thumbnail images from Supabase storage
- Lazy loading with fallback to black box
- Poster display in video player
- Path: `wubbytranscript/{hash}/thumbnail.webp`

### ✅ Playback Position (2025-11-30)
- Saves position every 10s (after 30s watch threshold)
- Position restoration on reload
- Storage cleanup after 60 days or 100 max
- Per-video storage using hash key

### ✅ Media Session API (2025-11-30)
- Lock screen controls for background playback
- Metadata display (title, artist, artwork)
- Seek forward/backward buttons

---

## Remaining Tasks

### HIGH Priority
1. **Component Unit Tests** - Zero unit tests currently (only 32 E2E tests)

### MEDIUM Priority
2. **API Caching** - Add React Query/SWR to avoid re-fetching
3. **VOD Diary Pagination** - Currently fetches 200 videos at once
4. **Mobile Date Picker UX** - Flatpickr touch improvements
5. **Tag Search** - Tags are clickable but don't trigger search (TODO in code)

### LOW Priority
6. **Production Build Optimization** - Bundle analysis, code splitting
7. **Keyboard Shortcuts** - Ctrl+K for search
8. **Offline Support Indicator**

---

## Key Technical Details

### Video Interface
```typescript
interface Video {
  url: string;
  title: string;
  platform: 'twitch' | 'kick';
  summary: string;           // 200+ words AI-generated
  tags: string[];            // Topic tags
  date: string;              // ISO date
  videoHash?: string;        // SHA-256 (64 chars)
  thumbnailUrl?: string;     // Supabase storage URL
}
```

### Badge Variants
```typescript
// Light: kick, twitch, tag
// Solid: kick-solid, twitch-solid, tag-solid
// Colors: Kick=#28a745, Twitch=#6441A5
```

### Storage Keys
- `selectedVideoUrl` - Current video URL
- `vds-{hash}` - Playback position (Vidstack format)

---

## Testing

### E2E Tests (Playwright)
- **player-gestures.spec.ts** - 32 tests (Mobile Chrome + Safari)
- **navigation.spec.ts** - Page navigation
- **vod-diary.spec.ts** - Filters, search
- **accessibility.spec.ts** - WCAG compliance
- **mobile.spec.ts** - Responsive design

### Test Strategy
- Uses real Supabase data (fetches video hash from VOD diary)
- Serial execution with `test.beforeAll` for shared state
- Touch detection skips simulation on desktop

---

**Last Updated:** 2025-11-30
**Status:** Core complete. Touch gestures complete (32 E2E tests). Unit tests needed.
