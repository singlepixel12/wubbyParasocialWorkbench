# Parasocial Style Guide
## Wubby Parasocial Workbench - Mobile-First Design System

**Version:** 1.0
**Last Updated:** 2025-11-13
**Status:** Implementation Planning

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Research Foundation](#research-foundation)
3. [Mobile-First Principles](#mobile-first-principles)
4. [Visual Design System](#visual-design-system)
5. [Component Patterns](#component-patterns)
6. [Interaction Patterns](#interaction-patterns)
7. [Performance Guidelines](#performance-guidelines)
8. [Accessibility Standards](#accessibility-standards)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Design Philosophy

### Core Principles

1. **Content-First** - Video content is the hero, UI recedes into the background
2. **Minimal Cognitive Load** - Users should never think about what to do next
3. **Touch-Optimized** - Everything designed for thumb-friendly mobile interaction
4. **Progressive Disclosure** - Show only what's needed, when it's needed
5. **Platform Personality** - Embrace Wubby community aesthetics while maintaining professionalism

### Target Experience

Users should feel like they're:
- Browsing a premium streaming service (Netflix quality)
- Using a familiar platform (YouTube patterns)
- Part of the Wubby community (parasoci.al aesthetic)

---

## Research Foundation

### Parasoci.al Analysis

**Key Takeaways:**
- ✅ Minimal navigation (Vods, Search, Live, Login)
- ✅ Card-based gallery layout
- ✅ Thumbnail-first visual hierarchy
- ✅ View counts + ratings as secondary metadata
- ✅ ALL-CAPS title treatment for emphasis
- ✅ Tab-based sorting (Most Viewed, Highest Rated, Time ranges)

**What We're Adopting:**
- Minimal header with focused navigation
- Thumbnail-first card design
- Prominent metadata display (views, ratings)
- Tab-based filtering pattern

### YouTube 2025 Best Practices

**Key Innovations:**
- ✅ Material Design 3 (translucent, rounded UI)
- ✅ Gesture-based controls (swipe to scrub, pinch to zoom)
- ✅ Content-aware animations (like button responds to video type)
- ✅ Minimalist player controls (translucent overlay)
- ✅ Immersive full-screen experience
- ✅ Threaded comments for better conversation flow

**What We're Adopting:**
- Translucent overlays on video thumbnails
- Rounded, pill-shaped buttons (already have some)
- Gesture-based navigation (swipe cards, pull-to-refresh)
- Minimal player controls with auto-hide
- Context-aware animations (platform-specific colors)

### Netflix Best Practices

**Key Strategies:**
- ✅ Default Effect (reduce decision paralysis)
- ✅ Clean visual hierarchy, no clutter
- ✅ Mobile-optimized navigation (compressed categories)
- ✅ Clear primary CTA (white play button on black)
- ✅ Cross-device consistency
- ✅ Smart personalization (thumbnails, recommendations)
- ✅ Offline-first features (Smart Downloads)
- ✅ Skip Intro (respect user time)

**What We're Adopting:**
- Single clear primary action per screen
- Compressed mobile navigation
- Prominent play button design (already good)
- Cross-device state preservation (localStorage)
- Skeleton loading states (already implemented)

---

## Mobile-First Principles

### 1. Touch Targets

**Minimum Sizes:**
- Primary actions: 44x44px (iOS standard)
- Secondary actions: 40x40px minimum
- Text links: 32x32px minimum with padding

**Current State:**
- ❌ Expand/Collapse button too small
- ✅ Play button appropriately sized (80x80px)
- ⚠️ Platform badges could be larger on mobile

**Action Items:**
- Increase expand button size to 44px height
- Add more padding around tap targets
- Test with actual finger sizes (not mouse)

### 2. Thumb Zones

**Optimal Areas (Right-Handed):**
```
┌─────────────────┐
│   Hard to reach │ Top corners
├─────────────────┤
│  Easy to reach  │ Bottom right
│      ✓ ✓ ✓      │ Bottom center
└─────────────────┘
```

**Current State:**
- ❌ Filters at top (hard to reach)
- ✅ Play button in middle (good)
- ❌ Navigation at top (standard but suboptimal)

**Action Items:**
- Move primary filters to sticky bottom sheet
- Consider bottom navigation bar pattern
- Add floating action button for key tasks

### 3. Viewport Optimization

**Breakpoints:**
```css
mobile:    320px - 767px   (default, mobile-first)
tablet:    768px - 1023px  (minor adjustments)
desktop:   1024px+         (enhanced features)
```

**Current State:**
- ⚠️ Desktop-first approach (sm:, md: modifiers)
- ✅ Responsive grid layout
- ❌ No mobile-specific optimizations

**Action Items:**
- Reverse breakpoint logic (mobile default)
- Hide non-essential content on mobile
- Stack filters vertically on mobile

### 4. Progressive Enhancement

**Mobile (Essential):**
- Browse VODs
- Watch videos
- Basic filtering (platform, date)

**Tablet (Enhanced):**
- Search functionality
- Side-by-side comparisons
- Expanded metadata

**Desktop (Full Features):**
- Keyboard shortcuts
- Advanced search operators
- Multi-tab workflows

---

## Visual Design System

### Color Palette

#### Dark Theme (Primary)

```css
/* Base Colors - Already Implemented */
--background: hsl(20, 14.3%, 4.1%)      /* #0a0907 - Near black */
--foreground: hsl(0, 0%, 95%)            /* #f2f2f2 - Off white */
--card: hsl(24, 9.8%, 10%)               /* #1a1715 - Dark brown */

/* Platform Colors - Keep These */
--kick: #1e7e34          /* Keep green */
--kick-hover: #28a745    /* Brighter green */
--twitch: #6441A5        /* Keep purple */

/* Accent Colors - New Additions */
--accent-gold: #FFD700   /* For featured/premium content */
--accent-blue: #4A90E2   /* For informational elements */
--accent-red: #E74C3C    /* For live indicators */
```

#### Gradient Overlays (YouTube-Inspired)

```css
/* Translucent overlay on thumbnails */
--overlay-gradient: linear-gradient(
  180deg,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0.4) 50%,
  rgba(0,0,0,0.9) 100%
);

/* Platform-specific play button hover */
--kick-gradient: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
--twitch-gradient: linear-gradient(135deg, #9147FF 0%, #6441A5 100%);
```

### Typography

#### Font System

```css
/* Already using Geist Sans & Mono - Keep these */
--font-sans: var(--font-geist-sans);  /* Body, UI */
--font-mono: var(--font-geist-mono);  /* Code, timestamps */

/* Font Scale - Mobile-First */
--text-xs: 0.75rem;    /* 12px - Tags, metadata */
--text-sm: 0.875rem;   /* 14px - Body text */
--text-base: 1rem;     /* 16px - Default */
--text-lg: 1.125rem;   /* 18px - Card titles (mobile) */
--text-xl: 1.25rem;    /* 20px - Card titles (desktop) */
--text-2xl: 1.5rem;    /* 24px - Page headings */
--text-3xl: 1.875rem;  /* 30px - Hero text */
```

#### Line Height

```css
/* Tighter for headings, looser for body */
--leading-tight: 1.25;   /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.75; /* Long-form content */
```

#### Font Weights

```css
--font-normal: 400;   /* Body text */
--font-medium: 500;   /* Emphasis */
--font-semibold: 600; /* Headings */
--font-bold: 700;     /* Strong emphasis */
```

### Spacing System

#### Scale (8px Base)

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
```

#### Mobile vs Desktop

```css
/* Component padding */
mobile:   --padding: var(--space-4);   /* 16px */
desktop:  --padding: var(--space-6);   /* 24px */

/* Card gaps */
mobile:   --gap: var(--space-4);       /* 16px */
desktop:  --gap: var(--space-6);       /* 24px */

/* Section spacing */
mobile:   --section: var(--space-8);   /* 32px */
desktop:  --section: var(--space-12);  /* 48px */
```

### Border Radius

```css
/* Keep current system, add mobile variants */
--radius-sm: 0.25rem;   /* 4px - Tags */
--radius-md: 0.375rem;  /* 6px - Buttons */
--radius-lg: 0.5rem;    /* 8px - Cards (current) */
--radius-xl: 0.75rem;   /* 12px - Large cards */
--radius-2xl: 1rem;     /* 16px - Modals */
--radius-full: 9999px;  /* Pills, play button */
```

### Shadows & Depth

```css
/* Subtle shadows for depth */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.25);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.4);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.5);

/* Glow effects for platform colors */
--glow-kick: 0 0 20px rgba(30, 126, 52, 0.5);
--glow-twitch: 0 0 20px rgba(100, 65, 165, 0.5);
```

---

## Component Patterns

### Video Cards

#### Current Implementation
```
┌─────────────────────────────────┐
│ [Badge]         [Platform] ←Top │
│                                 │
│ [Thumbnail]  [Title]            │
│   + Play     [Original Title]   │
│              [Date]             │
│              [Summary...]       │
│                                 │
│         [Expand ▼]      ←Bottom │
└─────────────────────────────────┘
```

#### Proposed Mobile-First Redesign

**Collapsed State (Mobile):**
```
┌───────────────────────┐
│ ┌─────┐ Title        │ ← Vertical space optimized
│ │ IMG │ Platform • Date│ ← Metadata inline
│ │ ▶️  │ 2 line preview│ ← Summary limited
│ └─────┘ [Tap to expand]│
└───────────────────────┘
```

**Expanded State (Mobile):**
```
┌───────────────────────┐
│ ┌─────────────────┐  │ ← Larger thumbnail
│ │   Thumbnail     │  │
│ │      ▶️         │  │
│ └─────────────────┘  │
│ Title               │
│ Platform • Date     │
│ Full summary text   │
│ [Tags] [Tags]       │
│ [Watch] [Collapse]  │
└───────────────────────┘
```

**Key Changes:**
- ✅ Thumbnail left-aligned (better hierarchy)
- ✅ Metadata inline (save vertical space)
- ✅ Larger tap targets
- ✅ Play button more prominent when expanded
- ✅ Action buttons at bottom (thumb-friendly)

#### Implementation Notes

```tsx
// Mobile-first card sizing
<div className="
  flex gap-3 p-4           // Mobile: compact
  md:gap-4 md:p-6          // Desktop: spacious
  rounded-lg border border-[#333]
  bg-[#111] hover:bg-[#1a1a1a]
  transition-colors
">
  {/* Thumbnail - responsive sizing */}
  <div className="
    relative w-24 h-16      // Mobile: 96x64px
    md:w-40 md:h-24         // Desktop: 160x96px
    flex-shrink-0
  ">
    {/* Content */}
  </div>
</div>
```

### Navigation Header

#### Current Implementation
```
┌─────────────────────────────────┐
│ LOGO  [Index][Transcript][VODs] │ ← Fixed top
└─────────────────────────────────┘
```

#### Proposed Mobile Pattern

**Option A: Bottom Navigation (Recommended)**
```
Content Area ↓
┌─────────────────────────────────┐
│                                 │
│         CONTENT                 │
│                                 │
├─────────────────────────────────┤
│  🏠     📝     📺     👤        │ ← Fixed bottom
│ Index  Trans  VODs  More        │
└─────────────────────────────────┘
```

**Option B: Collapsible Header**
```
┌─────────────────────────────────┐
│ ☰ Logo               🔍  [User] │ ← Hamburger menu
└─────────────────────────────────┘
             ↓ scrolls up, hides
```

**Recommendation:** Option A for mobile (thumb-friendly), Option B for desktop

### Filter Controls

#### Current Implementation (Desktop-First)
```
┌─────────────────────────────────────────┐
│ [Date Range] [Platform Slider] [Search] │ ← Top, horizontal
└─────────────────────────────────────────┘
```

#### Proposed Mobile Pattern

**Mobile: Bottom Sheet**
```
Content Area ↓
┌─────────────────┐
│   Video Cards   │
├─────────────────┤
│ [Filter] [Sort] │ ← Tap opens bottom sheet
└─────────────────┘
        ↓
┌─────────────────┐
│   Filters       │ ← Sheet slides up
│ ─────────────   │
│ Platform        │
│ ○ Both          │
│ ○ Kick          │
│ ○ Twitch        │
│                 │
│ Date Range      │
│ [This Week ▼]   │
│                 │
│ [Apply] [Reset] │
└─────────────────┘
```

**Desktop: Horizontal (Keep Current)**
```
┌─────────────────────────────────────────┐
│ [Date Range] [Platform] [Search]        │
└─────────────────────────────────────────┘
```

### Loading States

#### Current: Skeleton Cards (Good!)
```tsx
<div className="animate-pulse">
  <div className="h-20 bg-[#222] rounded" />
</div>
```

#### Enhanced: Progressive Loading
```tsx
// 1. Show skeleton immediately
<SkeletonVideoCard />

// 2. Load thumbnails first (lazy)
<img loading="lazy" />

// 3. Fade in metadata
<div className="animate-fade-in">
  {metadata}
</div>
```

### Empty States

#### Current: Basic Text (Improved)
```tsx
<div className="text-center">
  <SearchIcon />
  <p>No videos found</p>
</div>
```

#### Enhanced: Actionable Empty States
```tsx
<div className="text-center py-12">
  <SearchIcon className="w-16 h-16 mx-auto text-[#666]" />
  <h3 className="text-xl font-semibold mt-4">
    No videos found
  </h3>
  <p className="text-[#999] mt-2">
    Try adjusting your filters or search term
  </p>
  <Button onClick={resetFilters} className="mt-6">
    Clear Filters
  </Button>
</div>
```

---

## Interaction Patterns

### Gestures (Mobile-Specific)

#### Swipe Gestures

**Video Cards:**
- ↔️ Swipe left/right: Navigate between cards (future)
- ↕️ Pull down: Refresh list
- ↕️ Scroll: Infinite scroll pagination

**Video Player:**
- ↔️ Swipe left/right: Scrub timeline (10s increments)
- ↕️ Swipe up: Open comments/description
- ↕️ Swipe down: Close player/minimize
- 👆👆 Double tap left/right: Skip 10s back/forward

**Implementation:**
```tsx
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => nextVideo(),
  onSwipedRight: () => previousVideo(),
  preventDefaultTouchmoveEvent: true,
  trackMouse: false // Mobile only
});
```

#### Tap Targets

**Single Tap:**
- Card: Expand/collapse
- Thumbnail: Play video
- Platform badge: Filter by platform
- Tag: Search by tag

**Long Press:**
- Card: Show context menu (share, bookmark)
- Thumbnail: Preview video (future)

### Animations

#### Micro-Interactions (YouTube-Inspired)

**Play Button Pulse:**
```css
@keyframes playButtonPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}

/* Already implemented - keep this! */
```

**Platform-Aware Hover:**
```css
/* Kick: Green glow */
.play-button:hover {
  box-shadow: 0 0 20px rgba(30, 126, 52, 0.8);
  background: linear-gradient(135deg, #28a745, #1e7e34);
}

/* Twitch: Purple glow */
.play-button[data-platform="twitch"]:hover {
  box-shadow: 0 0 20px rgba(100, 65, 165, 0.8);
  background: linear-gradient(135deg, #9147FF, #6441A5);
}
```

**Card Expansion:**
```tsx
// Already using Radix Collapsible - enhance with spring animation
<Collapsible
  className="transition-all duration-300 ease-out"
  style={{
    transformOrigin: 'top',
    // Spring physics: duration 300ms, ease-out
  }}
>
```

#### Page Transitions

**Route Changes:**
```tsx
// Smooth fade between pages
<div className="animate-fade-in">
  {children}
</div>

// globals.css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Feedback Mechanisms

#### Toast Notifications (Already Good!)
```tsx
// Keep current Sonner implementation
// Add platform-specific toast colors
toast.success('Video loaded', {
  icon: platform === 'kick' ? '🟢' : '🟣',
  duration: 2000,
});
```

#### Loading Indicators
```tsx
// Spinner for quick actions (<1s expected)
<Loader2 className="animate-spin" />

// Skeleton for slow loads (>1s expected)
<SkeletonVideoCard /> // Already implemented ✅

// Progress bar for file operations
<Progress value={uploadProgress} />
```

#### Haptic Feedback (Mobile)
```tsx
// On successful action (requires API)
if ('vibrate' in navigator) {
  navigator.vibrate(10); // 10ms subtle vibration
}
```

---

## Performance Guidelines

### Mobile Performance Budget

**Target Metrics:**
- First Contentful Paint (FCP): <1.5s
- Largest Contentful Paint (LCP): <2.5s
- Time to Interactive (TTI): <3.5s
- Cumulative Layout Shift (CLS): <0.1

### Image Optimization

#### Thumbnail Handling

**Current State:**
- ❌ Black placeholders (no actual thumbnails)
- ✅ Responsive sizing with CSS

**Improvements:**
```tsx
// Use Next.js Image component
import Image from 'next/image';

<Image
  src={video.thumbnail || '/placeholder.jpg'}
  alt={video.title}
  width={160}
  height={90}
  loading="lazy"
  placeholder="blur"
  blurDataURL={video.thumbnailBlur} // Generate server-side
  className="object-cover"
/>
```

**Responsive Images:**
```tsx
<Image
  srcSet={`
    ${video.thumbnail_small} 320w,
    ${video.thumbnail_medium} 640w,
    ${video.thumbnail_large} 1024w
  `}
  sizes="(max-width: 768px) 96px, 160px"
/>
```

### Code Splitting

#### Current State
- ✅ Next.js automatic code splitting
- ❌ No dynamic imports for heavy components

#### Improvements
```tsx
// Lazy load video player (heavy Vidstack dependency)
const VidstackPlayer = dynamic(
  () => import('@/components/video/VidstackPlayer'),
  {
    loading: () => <SkeletonPlayer />,
    ssr: false, // Video player doesn't need SSR
  }
);

// Lazy load date picker (heavy dependency)
const DateRangePicker = dynamic(
  () => import('@/components/vod-diary/DateRangePicker'),
  { loading: () => <Skeleton className="h-10 w-[280px]" /> }
);
```

### Caching Strategy

#### API Responses
```tsx
// Use React Query for smart caching
import { useQuery } from '@tanstack/react-query';

const { data: videos } = useQuery({
  queryKey: ['videos', platform, dateRange],
  queryFn: () => fetchRecentVideos({ platform, dateRange }),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

#### Service Worker (Future)
```ts
// Cache video metadata offline
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/videos')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});
```

### Bundle Size Optimization

**Current Dependencies to Review:**
- Vidstack Player (heavy) - lazy load ✓
- Flatpickr (if still used) - replace with native date input on mobile
- React Day Picker - lazy load ✓

**Target Bundle Sizes:**
- Initial JS: <100KB gzipped
- Per-route JS: <50KB gzipped
- CSS: <20KB gzipped

---

## Accessibility Standards

### WCAG 2.1 AA Compliance (Current Status: Good!)

#### Color Contrast
```css
/* Already meeting standards */
--foreground: hsl(0, 0%, 95%)    /* #f2f2f2 on */
--background: hsl(20, 14.3%, 4.1%) /* #0a0907 */
/* Contrast ratio: 17.3:1 (AAA level) ✅ */

/* Platform badges */
--kick: #1e7e34 on white text
/* Contrast ratio: 4.8:1 (AA level) ✅ */

--twitch: #6441A5 on white text
/* Contrast ratio: 7.2:1 (AA level) ✅ */
```

#### Focus Indicators
```css
/* Current implementation is good */
* {
  @apply outline-ring/50;
}

/* Enhance for better visibility */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

#### Keyboard Navigation

**Current State:**
- ✅ Tab navigation works (Radix UI)
- ✅ Enter/Space for buttons
- ⚠️ No skip links
- ⚠️ No keyboard shortcuts

**Improvements:**
```tsx
// Skip to main content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Keyboard shortcuts (desktop)
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === '/' && !isInputFocused) {
      e.preventDefault();
      focusSearch();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

#### Screen Reader Support

**Current State:**
- ✅ Semantic HTML
- ✅ ARIA labels on interactive elements
- ⚠️ No live regions for dynamic content

**Improvements:**
```tsx
// Announce filter results
<div
  role="status"
  aria-live="polite"
  className="sr-only"
>
  {videos.length} videos found
</div>

// Loading state announcement
<div role="status" aria-live="polite">
  {loading ? 'Loading videos...' : null}
</div>
```

### Mobile Accessibility

#### Touch Target Sizes
```css
/* Minimum 44x44px per WCAG 2.5.5 */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 8px; /* If content is smaller */
}
```

#### Reduce Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .play-button {
    animation: none; /* Disable pulse */
  }
}
```

---

## Implementation Roadmap

### Phase 1: Mobile-First Foundation (1-2 weeks)

**Priority: CRITICAL**

**Tasks:**
1. **Reverse Breakpoint Logic**
   - Change Tailwind to mobile-first (remove sm:, use md: lg: for desktop)
   - Audit all components for mobile-first styling
   - Test on actual devices (not just DevTools)

2. **Touch Target Optimization**
   - Increase all interactive elements to 44x44px minimum
   - Add padding around buttons and links
   - Test with finger (not mouse pointer)

3. **Bottom Navigation Pattern**
   - Create mobile bottom nav component
   - Collapse header on mobile scroll
   - Add floating action button for primary action

4. **Gesture Support**
   - Add pull-to-refresh on VOD Diary
   - Implement swipe-to-navigate (optional)
   - Add double-tap to skip in player

**Acceptance Criteria:**
- ✅ All tap targets meet 44x44px standard
- ✅ Navigation accessible within thumb zone
- ✅ No horizontal scrolling on 320px viewport
- ✅ Pull-to-refresh works on VOD list

### Phase 2: Visual Polish (1 week)

**Priority: HIGH**

**Tasks:**
1. **Enhanced Video Cards**
   - Redesign for mobile (vertical layout)
   - Add gradient overlays on thumbnails
   - Improve expand/collapse animation
   - Platform-specific glow effects

2. **Loading States**
   - Add progressive image loading
   - Enhance skeleton animations
   - Add spinner for quick actions
   - Implement optimistic UI updates

3. **Empty States**
   - Add illustrations/icons
   - Provide clear actions
   - Context-specific messaging

4. **Micro-Animations**
   - Platform-aware hover effects
   - Smooth page transitions
   - Success/error animations

**Acceptance Criteria:**
- ✅ Cards look polished on mobile
- ✅ Loading states feel fast (perceived performance)
- ✅ Animations respect prefers-reduced-motion
- ✅ Empty states are actionable

### Phase 3: Performance Optimization (1 week)

**Priority: HIGH**

**Tasks:**
1. **Code Splitting**
   - Lazy load video player component
   - Dynamic imports for heavy dependencies
   - Route-based code splitting

2. **Image Optimization**
   - Implement Next.js Image component
   - Generate thumbnail blur placeholders
   - Responsive image srcsets
   - WebP format with fallbacks

3. **Caching Layer**
   - Integrate React Query
   - Cache video metadata
   - Implement stale-while-revalidate
   - Add service worker (optional)

4. **Bundle Analysis**
   - Run webpack-bundle-analyzer
   - Remove unused dependencies
   - Tree-shake dead code
   - Optimize CSS

**Acceptance Criteria:**
- ✅ Lighthouse mobile score >90
- ✅ Initial bundle <100KB gzipped
- ✅ LCP <2.5s on 3G connection
- ✅ No layout shifts (CLS <0.1)

### Phase 4: Advanced Features (2 weeks)

**Priority: MEDIUM**

**Tasks:**
1. **Filter Bottom Sheet**
   - Create mobile bottom sheet component
   - Move filters to sheet on mobile
   - Add preset filter options
   - Sticky filters on desktop

2. **Advanced Gestures**
   - Swipe to navigate between videos
   - Pinch to zoom thumbnails
   - Long-press context menus

3. **Keyboard Shortcuts** (Desktop)
   - Cmd+K for search
   - Arrow keys for navigation
   - Space to play/pause
   - Shortcuts help modal

4. **Offline Support**
   - Service worker for offline shell
   - Cache recently viewed videos
   - Offline indicator
   - Queue actions for sync

**Acceptance Criteria:**
- ✅ Filter UX excellent on mobile
- ✅ Gestures feel natural
- ✅ Keyboard shortcuts discoverable
- ✅ App works offline (basic functionality)

### Phase 5: Personalization (Future)

**Priority: LOW**

**Tasks:**
1. **User Preferences**
   - Remember platform preference
   - Save favorite VODs
   - Preferred sort order
   - Dark/light theme toggle

2. **Smart Recommendations**
   - Watch history tracking
   - "More like this" suggestions
   - Trending tags
   - Popular this week

3. **Advanced Search**
   - Fuzzy search
   - Search operators (tag:, date:)
   - Search history
   - Saved searches

**Acceptance Criteria:**
- ✅ Preferences persist across devices
- ✅ Recommendations are relevant
- ✅ Search is powerful and intuitive

---

## Quick Reference

### Design Tokens

```css
/* Colors */
--kick: #1e7e34;
--twitch: #6441A5;
--background: hsl(20, 14.3%, 4.1%);
--foreground: hsl(0, 0%, 95%);

/* Spacing (8px base) */
--space-4: 1rem;      /* 16px - mobile padding */
--space-6: 1.5rem;    /* 24px - desktop padding */

/* Touch Targets */
--touch-min: 44px;    /* iOS/Android standard */

/* Typography */
--text-sm: 0.875rem;  /* 14px - body mobile */
--text-base: 1rem;    /* 16px - body desktop */
--text-lg: 1.125rem;  /* 18px - headings mobile */

/* Border Radius */
--radius-lg: 0.5rem;  /* 8px - cards */
--radius-full: 9999px; /* Pills, buttons */
```

### Component Checklist

Before implementing any component, verify:

- [ ] Mobile-first responsive (320px+)
- [ ] Touch targets 44x44px minimum
- [ ] Keyboard navigable (Tab, Enter, Escape)
- [ ] Screen reader accessible (ARIA, semantic HTML)
- [ ] Loading state implemented
- [ ] Empty state handled
- [ ] Error state with retry
- [ ] Animations respect prefers-reduced-motion
- [ ] Color contrast ≥4.5:1 (AA)
- [ ] Focus indicator visible
- [ ] Works offline (graceful degradation)

---

## Resources

### Design Inspiration
- **Parasoci.al**: https://parasoci.al/
- **YouTube Mobile**: Latest app design (Oct 2025)
- **Netflix Mobile**: iOS/Android app patterns

### Documentation
- **Material Design 3**: https://m3.material.io/
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **Next.js Image**: https://nextjs.org/docs/pages/api-reference/components/image
- **Radix UI**: https://www.radix-ui.com/

### Tools
- **Lighthouse**: Performance auditing
- **Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Bundle Analyzer**: webpack-bundle-analyzer
- **React Query**: https://tanstack.com/query/latest

---

**Last Updated:** 2025-11-13
**Version:** 1.0
**Next Review:** After Phase 1 completion
