# UI Implementation Guide
## Wubby Parasocial Workbench - Complete Design & Implementation Reference

**Version:** 2.0
**Last Updated:** 2025-11-16
**Status:** Week 0-1 Two-Tier UX ✅ Complete

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Design Philosophy](#design-philosophy)
3. [Two-Tier UX Pattern](#two-tier-ux-pattern)
4. [Core Differentiators](#core-differentiators)
5. [Component Specifications](#component-specifications)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Progress Checklist](#progress-checklist)

---

## Quick Start

### 🎯 What Makes This App Unique?

1. **AI-Generated Summaries** - Instant video understanding (200+ words)
2. **Intelligent Tagging** - Lightning-fast search by topics/guests
3. **Title Renaming** - AI-cleaned titles + original URL preserved
4. **Two-Tier UX** - Scan first (browse), read later (detail)

### ⚡ Animation Framework

- **CSS Animations**: Using `tw-animate-css` (installed)
- **NOT using Framer Motion** (not in dependencies)
- Tailwind CSS animations for transitions and effects

---

## Design Philosophy

### Progressive Disclosure (Two-Tier UX)

**Browse Page (Scannable):**
- 1-2 line hook (NOT full summary)
- Tag count badge
- 6 tag preview
- "Read more →" CTA

**Detail Page (Full Context):**
- Full 200-word AI summary
- All tags (clickable)
- Video player
- Related videos

**Why:**
- ✅ Browse 50+ videos quickly without fatigue
- ✅ Full summary feels like a reward
- ✅ "Other sites: nothing. You: 200 words" contrast is MORE impressive

---

## Two-Tier UX Pattern

### Phase 1: Browse (VOD Diary)

```
┌─────────────────────────────┐
│ 🏷️ 10 tags                  │ ← Tag count badge (purple)
│                             │
│ Wubby Reacts to Reddit      │ ← AI-cleaned title
│ 📄 11_kickapilol            │ ← Original filename (gray)
│                             │
│ 12/11/2025                  │ ← Date
│                             │
│ ┃ Hilarious reactions to   │ ← 1-2 line HOOK (green accent)
│ ┃ unhinged comments...     │
│                             │
│ reddit react alluux         │ ← 6 tag preview (clickable)
│ ChatGPT +4    [Read more →]│ ← CTA to detail
└─────────────────────────────┘
```

### Phase 2: Detail (/watch/[hash])

```
┌─────────────────────────────┐
│      VIDEO PLAYER           │
│     [=====●=====]           │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                             │
│ 💚 AI SUMMARY               │ ← Full summary in green card
│    [Full 200-word context] │
│    [Multiple paragraphs]   │
│                             │
│ 🏷️ All tags (clickable)    │ ← All 10 tags shown
│                             │
│ 🔙 Back to VOD Diary       │ ← Navigation
└─────────────────────────────┘
```

### ✅ Implementation Status

- ✅ Hook extraction function (`extractHook()`)
- ✅ VideoCard shows 1-2 line hook
- ✅ "Read more →" CTA
- ✅ `/watch/[id]` route created
- ✅ `VideoDetailView` component
- ✅ Full summary on detail page
- ✅ `getWubbySummaryByHash()` function

---

## Core Differentiators

### 1. Tag System (🏷️ Searchable Topics)

**Browse Cards:**
```tsx
{/* Tag count badge - NO icon (redundant) */}
<Badge variant="outline" className="border-[#6441A5] text-[#6441A5] text-xs">
  {video.tags.length} tags
</Badge>

{/* Show 6 tags instead of 3 */}
{video.tags.slice(0, 6).map((tag) => (
  <Badge
    variant="tag"
    className="cursor-pointer hover:bg-[#28a745] hover:text-white transition-colors"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      // TODO: Implement tag search
    }}
  >
    {tag}
  </Badge>
))}
```

**Status:** ✅ Implemented
- ✅ Tag count badge (without icon)
- ✅ 6 tags visible (was 3)
- ✅ Clickable with hover effects
- ⏳ Tag search not yet wired up

### 2. AI Summary (💚 Green Accent)

**Browse Cards (Hook):**
```tsx
{/* Green accent bar makes summary special */}
<div className={cn(
  'mb-2 p-2.5 rounded',
  'bg-gradient-to-r from-[#28a745]/10 to-transparent',
  'border-l-2 border-[#28a745]'
)}>
  <p className="text-sm text-[#ccc] leading-relaxed line-clamp-2">
    {hook}
  </p>
</div>
```

**Detail Page (Full Summary):**
```tsx
<Card className={cn(
  'p-6',
  'bg-gradient-to-br from-[#28a745]/10 via-transparent to-transparent',
  'border-l-4 border-[#28a745]'
)}>
  <h2 className="text-lg font-semibold text-white mb-3">
    AI Summary
  </h2>
  <div className="prose prose-invert prose-sm max-w-none">
    <p className="text-[#ccc] leading-relaxed whitespace-pre-line">
      {video.summary}
    </p>
  </div>
</Card>
```

**Status:** ✅ Implemented
- ✅ Green accent bar on browse cards
- ✅ Full summary card on detail page
- ❌ NO "AI Summary" badge (per user request)

### 3. Title Renaming (📄 Dual Display)

**Browse Cards:**
```tsx
{/* AI-cleaned title (primary) */}
<h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
  {video.title}
</h3>

{/* Original filename (secondary) with icon */}
{originalTitle && (
  <div className="flex items-start gap-1.5 mb-2">
    <FileText className="w-3 h-3 text-[#666] flex-shrink-0 mt-0.5" />
    <h4 className="text-xs text-[#888] font-mono line-clamp-1 flex-1">
      {originalTitle}
    </h4>
  </div>
)}
```

**Status:** ✅ Implemented
- ✅ FileText icon for original title
- ✅ Monospace font for filename
- ❌ NO sparkle icon on AI title (per user request)

### 4. Platform Filter (🎨 Visual Theme)

**Play Button Glow:**
```tsx
<div className={cn(
  'w-20 h-20 rounded-full',
  'bg-gradient-to-br from-black/90 to-black/70',
  'transition-all duration-300',
  // Platform-specific gradient and glow
  video.platform === 'kick'
    ? 'group-hover/thumb:from-[#28a745]/95 group-hover/thumb:to-[#28a745]/80 group-hover/thumb:shadow-[0_0_20px_rgba(40,167,69,0.8)]'
    : video.platform === 'twitch'
    ? 'group-hover/thumb:from-[#6441A5]/95 group-hover/thumb:to-[#6441A5]/80 group-hover/thumb:shadow-[0_0_20px_rgba(100,65,165,0.8)]'
    : 'group-hover/thumb:from-[#28a745]/95 group-hover/thumb:to-[#28a745]/80'
)}>
  <Play className="w-8 h-8 text-white fill-white ml-1" />
</div>
```

**Platform Colors:**
- Kick: `#28a745` (green)
- Twitch: `#6441A5` (purple)

**Status:** ✅ Implemented
- ✅ Platform-specific gradient on hover
- ✅ Platform-specific glow shadow

---

## Component Specifications

### VideoCard Component

**Location:** `components/vod-diary/VideoCard.tsx`

**Visual Hierarchy:**
1. Platform badge (top right, solid color)
2. Tag count badge (top of content area)
3. Video title (AI-cleaned)
4. Original filename (with FileText icon)
5. Date
6. Hook (1-2 lines, green accent)
7. Tags (6 visible, clickable)
8. "Read more →" CTA

**Mobile-First Sizing:**
- Thumbnail: Fixed width 160px on desktop
- Touch targets: All interactive elements ≥44px
- Text: Responsive sizing (base → md)

### VideoDetailView Component

**Location:** `components/video/VideoDetailView.tsx`

**Sections:**
1. "Back to VOD Diary" button
2. Video player (full width)
3. Platform + AI badges
4. Title + original filename
5. Date
6. Full AI summary (green accent card)
7. All tags (clickable)

**Key Features:**
- Subtitle URL generation from hash
- Platform-specific badge variants
- Green accent card for summary

---

## Implementation Roadmap

### ✅ Week 0-1: Two-Tier UX (COMPLETE)

**Deliverables:**
- ✅ `extractHook()` function (1-2 line summaries)
- ✅ VideoCard shows hook with green accent
- ✅ Tag count badge (no icon)
- ✅ 6 tags visible (clickable)
- ✅ FileText icon for original title
- ✅ Platform-specific play button glow
- ✅ `/watch/[id]` route
- ✅ VideoDetailView component
- ✅ Full AI summary on detail page
- ✅ `getWubbySummaryByHash()` function
- ✅ Removed "Click to watch" text

**Time Spent:** ~3-4 hours
**Status:** ✅ COMPLETE

### 🔜 Phase 1: Mobile-First Foundation (2-3 weeks)

**Priority:** CRITICAL
**Duration:** 40-60 hours total
**Risk Level:** Medium

#### Success Metrics
- ✅ Lighthouse Mobile Score: ≥90
- ✅ Touch Target Compliance: 100% (all ≥44px)
- ✅ Works on 320px width (smallest phones)
- ✅ Time to Interactive: <3.5s on 3G
- ✅ No horizontal scroll on any screen size

#### Task 1.1: Touch Target Optimization (8-12h) ⏳

**Goal:** All interactive elements meet WCAG 2.1 AA minimum touch target size

**Minimum Sizes:**
- Buttons: 44px × 44px
- Badges (clickable): 32px × 32px minimum
- Links: 44px tap area
- Form inputs: 44px height

**Files to Update:**
```
components/ui/button.tsx         → Add 'touch' size variant
components/ui/badge.tsx          → Ensure clickable badges ≥32px
components/vod-diary/VideoCard.tsx → Verify play button, tags
components/Header.tsx            → Nav links
```

**Implementation:**
```tsx
// Add to button.tsx variants
const buttonVariants = cva({
  variants: {
    size: {
      default: "h-10 px-4 py-2",      // 40px
      sm: "h-9 rounded-md px-3",      // 36px
      lg: "h-11 rounded-md px-8",     // 44px
      touch: "h-11 px-4 min-h-[44px]", // 44px minimum ✅
      icon: "h-10 w-10",              // 40px
      "icon-lg": "h-11 w-11",         // 44px ✅
    }
  }
})
```

**Testing:**
```bash
# Use Chrome DevTools
# 1. Open DevTools → More Tools → Rendering
# 2. Enable "Show layout shift regions"
# 3. Right-click element → Inspect
# 4. Check computed height/width ≥44px
```

#### Task 1.2: Bottom Navigation (12-16h) ⏳

**Goal:** Thumb-friendly navigation on mobile (iPhone X+ safe area)

**Create:** `components/layout/BottomNav.tsx`

**Features:**
- 4 nav items: Index, Transcript, VODs, Player
- Icons: Home, FileText, Video, PlayCircle (lucide-react)
- Auto-hide on scroll down (optional)
- iOS safe area support (`pb-safe`)
- Active state with green accent (#28a745)

**Desktop Behavior:**
- Header: Show on desktop (`hidden md:block`)
- BottomNav: Hide on desktop (`md:hidden`)

**Mobile Behavior:**
- Header: Hide on mobile (`hidden md:block`)
- BottomNav: Show on mobile (`md:hidden`)

#### Task 1.3: Reverse Breakpoints Audit (16-24h) ⏳

**Goal:** Mobile-first CSS (default styles for mobile, enhance for desktop)

**Pattern:**
```tsx
// ❌ BEFORE (Desktop-first)
<div className="flex flex-row gap-6 sm:gap-4">
  // Desktop: 24px, Mobile: 16px (backwards!)
</div>

// ✅ AFTER (Mobile-first)
<div className="flex flex-col gap-4 md:flex-row md:gap-6">
  // Mobile: column 16px, Desktop: row 24px ✅
</div>
```

**Files to Audit:**
```bash
cd web-new
grep -r "sm:" components/ app/ --include="*.tsx" > responsive-audit.txt
# Review each occurrence, refactor to mobile-first
```

**Priority Order:**
1. VideoCard.tsx (most visible)
2. Header.tsx (navigation)
3. vod-diary/page.tsx (main page)
4. Other components

#### Task 1.4: Pull-to-Refresh (4-8h) ⏳

**Goal:** Native-feeling refresh on mobile

**Install:**
```bash
npm install react-simple-pull-to-refresh
```

**Implementation:**
```tsx
// app/vod-diary/page.tsx
import PullToRefresh from 'react-simple-pull-to-refresh';

<PullToRefresh onRefresh={handleRefresh}>
  <VideoList videos={videos} />
</PullToRefresh>
```

**Styling:**
```css
/* Match green accent theme */
.ptr__pull-down {
  color: #28a745;
}
```

#### Testing Checklist

**Devices to Test:**
- [ ] iPhone SE (375 × 667) - smallest modern iPhone
- [ ] iPhone 14 Pro (390 × 844) - notch/Dynamic Island
- [ ] Android (360 × 800) - common Android size
- [ ] iPad (768 × 1024) - tablet
- [ ] Desktop (1920 × 1080) - large screen

**Test Scenarios:**
- [ ] No horizontal scroll at any size
- [ ] All buttons/links tappable with thumb
- [ ] Bottom nav reachable with one hand
- [ ] Pull-to-refresh works smoothly
- [ ] Text readable without zoom
- [ ] Images load progressively

### 🔜 Phase 2: Visual Polish (1 week)

**Priority:** HIGH
**Duration:** 20-30 hours total

#### Task 2.1: Enhanced Video Cards (12-16h) ⏳

**Goal:** Professional, responsive card layout

**Mobile Enhancements:**
- Full-width thumbnail on mobile (16:9 aspect ratio)
- Fixed 160px width on desktop
- Larger play button (80px → 96px on mobile)
- Better text hierarchy

**Responsive Thumbnail:**
```tsx
<div className={cn(
  'relative rounded overflow-hidden bg-black',
  // Mobile: Full width, 16:9 aspect
  'w-full aspect-video',
  // Desktop: Fixed width
  'md:w-40 md:aspect-auto md:h-28',
  'flex-shrink-0'
)}>
```

#### Task 2.2: Loading States (4-8h) ⏳

**Goal:** Progressive loading with skeleton UI

**Create:** `components/vod-diary/SkeletonVideoCard.tsx`

```tsx
export function SkeletonVideoCard() {
  return (
    <div className="animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="w-full aspect-video md:w-40 md:h-28 bg-[#222] rounded" />

      {/* Content skeleton */}
      <div className="space-y-2 mt-2">
        <div className="h-4 bg-[#222] rounded w-3/4" />
        <div className="h-3 bg-[#222] rounded w-1/2" />
        <div className="h-16 bg-[#222] rounded" />
      </div>
    </div>
  );
}
```

**Usage:**
```tsx
{isLoading && (
  <>
    <SkeletonVideoCard />
    <SkeletonVideoCard />
    <SkeletonVideoCard />
  </>
)}
```

#### Task 2.3: Page Transitions (4-6h) ⏳

**Goal:** Smooth navigation transitions (CSS only, no Framer Motion)

**Using tw-animate-css:**
```tsx
// Fade in on mount
<div className="animate-fadeIn">
  {children}
</div>

// Slide up on mount
<div className="animate-slideInUp">
  {children}
</div>
```

**Custom animations:**
```css
/* tailwind.config.ts */
module.exports = {
  theme: {
    extend: {
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
}
```

### 🔜 Phase 3: Performance (1 week)

**Priority:** HIGH
**Duration:** 30-46 hours total

#### Task 3.1: Code Splitting (6-10h) ⏳

**Goal:** Lazy load heavy components

**Lazy Load Video Player:**
```tsx
// app/watch/[id]/page.tsx
import dynamic from 'next/dynamic';

const VidstackPlayer = dynamic(
  () => import('@/components/video/VidstackPlayer'),
  {
    loading: () => <div className="w-full aspect-video bg-black animate-pulse" />,
    ssr: false,
  }
);
```

**Lazy Load Date Picker:**
```tsx
// components/vod-diary/DateRangePicker.tsx
const Calendar = dynamic(() => import('react-day-picker'), {
  loading: () => <div className="h-64 bg-[#111] animate-pulse rounded" />,
});
```

#### Task 3.2: Image Optimization (10-16h) ⏳

**Goal:** Fast image loading, progressive enhancement

**Note:** Currently using black placeholder boxes (no actual images yet)

**Future:** When thumbnails are added:
```tsx
import Image from 'next/image';

<Image
  src={video.thumbnail}
  alt={video.title}
  width={640}
  height={360}
  className="w-full h-full object-cover"
  loading="lazy"
  placeholder="blur"
/>
```

#### Task 3.3: React Query (10-14h) ⏳

**Goal:** Smart API caching, better loading/error states

**Install:**
```bash
npm install @tanstack/react-query
```

**Setup:**
```tsx
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
  },
});

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Usage:**
```tsx
// hooks/useVideos.ts
import { useQuery } from '@tanstack/react-query';

export function useVideos(params) {
  return useQuery({
    queryKey: ['videos', params],
    queryFn: () => fetchRecentVideos(params),
    staleTime: 5 * 60 * 1000,
  });
}
```

#### Task 3.4: Bundle Analysis (4-6h) ⏳

**Goal:** Identify and reduce bundle size

**Install:**
```bash
npm install --save-dev @next/bundle-analyzer
```

**Configure:**
```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // your config
});
```

**Run:**
```bash
ANALYZE=true npm run build
# Opens bundle visualization in browser
```

**Target:**
- Total bundle < 200KB (gzipped)
- First Load JS < 100KB

### 🔜 Phase 4: Advanced Features (1-2 weeks)

**Priority:** MEDIUM

| Task | Effort | Status |
|------|--------|--------|
| Filter bottom sheet (mobile) | 16-24h | ⏳ Not Started |
| Keyboard shortcuts | 8-16h | ⏳ Not Started |
| Enhanced gestures (swipe) | 6-10h | ⏳ Not Started |
| Tag search functionality | 4-8h | ⏳ Not Started |

**Target:** Excellent mobile UX, power user features

---

## Progress Checklist

### ✅ Completed (Week 0-1)

#### Two-Tier UX Implementation
- [x] Create `extractHook()` function for 1-2 line summaries
- [x] Update VideoCard to show hook instead of full summary
- [x] Add "Read more →" CTA to cards
- [x] Create `/watch/[id]` route
- [x] Create `VideoDetailView` component
- [x] Create `getWubbySummaryByHash()` function (direct hash lookup)
- [x] Display full AI summary on detail page

#### Visual Enhancements
- [x] Add tag count badge (NO icon)
- [x] Add green accent bar to summary hook
- [x] Add FileText icon to original title (NO sparkle on AI title)
- [x] Increase tag preview from 3 to 6 tags
- [x] Make tags clickable with hover effects
- [x] Add platform-specific glow to play button
- [x] Remove "Click to watch" redundant text

### ⏳ In Progress

- [ ] Wire up tag click to search functionality
- [ ] Test "Read more" flow end-to-end
- [ ] Mobile responsive testing

### 📋 Next Up (Phase 1)

#### Mobile-First Foundation
- [ ] Audit all touch targets (ensure ≥44px)
- [ ] Create BottomNav component
- [ ] Reverse all Tailwind breakpoints (mobile-first)
- [ ] Add pull-to-refresh to VOD Diary
- [ ] Test on iPhone SE (375x667)
- [ ] Test on Android (360x800)

#### Documentation
- [ ] Update CLAUDE.md with Week 0-1 completion
- [ ] Create mobile testing checklist
- [ ] Document animation patterns (tw-animate-css)

### 🚀 Future Phases

#### Phase 2: Visual Polish
- [ ] Enhanced video cards with better metadata
- [ ] Progressive loading states (skeleton)
- [ ] Page transitions (CSS animations)
- [ ] Hover states for desktop
- [ ] Visual regression testing

#### Phase 3: Performance
- [ ] Lazy load video player
- [ ] Dynamic imports for heavy components
- [ ] React Query for API caching
- [ ] Bundle size optimization
- [ ] Lighthouse audit (target: ≥90 mobile)

#### Phase 4: Advanced Features
- [ ] Filter bottom sheet (mobile)
- [ ] Keyboard shortcuts (/, Ctrl+K)
- [ ] Swipe gestures in player
- [ ] Tag search implementation
- [ ] Quick date presets

---

## Design Decisions Log

### Skipped Features (User Requested)

**DON'T implement these:**
- ❌ "AI Summary" badge with sparkle icon (redundant)
- ❌ Sparkle icon on AI-renamed title (unnecessary)
- ❌ Tag icon in tag count badge (redundant)

**Reasoning:** Keep UI clean, avoid visual clutter

### Technology Choices

**Animation Framework:** CSS (tw-animate-css)
- ✅ Lighter than Framer Motion
- ✅ Already installed
- ✅ Good enough for transitions

**NOT Using:**
- ❌ Framer Motion (not installed, too heavy)

---

## Quick Reference

### Colors

```css
/* Platform Colors */
--kick-green: #28a745;
--twitch-purple: #6441A5;

/* Accent Colors */
--ai-green: #28a745;
--tag-purple: #6441A5;

/* Neutral Colors */
--bg-primary: #111;
--bg-secondary: #1a1a1a;
--border: #333;
--text-primary: #fff;
--text-secondary: #ccc;
--text-tertiary: #888;
--text-muted: #666;
```

### Key Functions

```typescript
// Extract 1-2 line hook from summary
extractHook(summary: string): string

// Extract original filename from URL
extractOriginalTitle(url: string): string

// Format date for display
formatDateDisplay(date: Date): string

// Compute video hash for URLs
computeVideoHash(url: string): Promise<string>

// Fetch video by URL (computes hash)
getWubbySummary(url: string): Promise<Video | null>

// Fetch video by hash (direct lookup)
getWubbySummaryByHash(hash: string): Promise<Video | null>
```

### Routes

```
/                  → Index (video metadata, feature showcase)
/vod-diary         → Browse VODs (scannable cards)
/watch/[hash]      → Detail view (full summary, player)
/transcript        → Transcript extraction
/player            → Direct player access
```

---

**Last Updated:** 2025-11-16
**Next Review:** Start of Phase 1 (Mobile-First Foundation)
**Questions?** Check CLAUDE.md for project overview
