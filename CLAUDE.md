# Claude.md - Wubby Parasocial Workbench

## Project Overview

**Wubby Parasocial Workbench** - Web tool for analyzing Wubby stream content with video transcription, VOD diary, and content analysis.

**Target Audience:** Wubby community
**Data Source:** archive.wubby.tv
**Location:** `/web-new` directory

---

## Tech Stack

### Original (Vanilla)
- Pure HTML/CSS/JavaScript
- Vidstack Player
- Flatpickr date picker

### Migrated (Next.js)
- **Framework:** Next.js 16 (App Router)
- **UI:** React + shadcn/ui + Tailwind CSS
- **Video:** Vidstack Player
- **Backend:** Supabase (video metadata, subtitles)

---

## Core Features

1. **Video Management** - URL input, dropdown VOD selection, hash-based tracking, metadata display
2. **Transcription Tools** - VTT subtitle extraction/display, transcript sync with video
3. **VOD Diary** - Date range filtering, platform toggle (Twitch/Kick), expandable video cards, search
4. **Player Page** - Dedicated video player with subtitle support

---

## Migration Status

### ✅ CORE MIGRATION COMPLETE (2025-11-08)
All 4 pages functional, mobile tested (375x667px), all features working.

**Success Criteria:**
- [x] All pages functional in Next.js
- [x] Video playback + subtitles working
- [x] Transcript extraction working
- [x] VOD diary filtering (date + platform + search)
- [x] Hash-based tracking preserved
- [x] archive.wubby.tv integration intact
- [x] Responsive design matches original
- [x] Toast notifications working
- [x] Visual appearance preserved
- [x] No functionality lost

### ✅ SHADCN PHASE 1 COMPLETE (2025-11-10)

**Migrations Completed:**
1. **Sonner Toast** - Replaced custom AlertToastProvider (182 lines removed)
2. **Badge Component** - Replaced PlatformTag with shadcn Badge + 6 custom variants (58 lines removed)
3. **Skeleton Loading** - Added SkeletonVideoCard for better loading UX
4. **Collapsible** - Replaced custom VideoCard animations with Radix Collapsible (60 lines removed)

**Impact:**
- ~300 lines of custom code removed
- WCAG 2.1 AA accessibility compliance
- Better cross-browser support
- Improved keyboard navigation + screen readers

### ✅ WEEK 0-1: TWO-TIER UX COMPLETE (2025-11-16)

**UI Uplift - Differentiator Focus:**

1. **Two-Tier UX Pattern** - Progressive disclosure implemented
   - ✅ Browse cards show 1-2 line hooks (scannable!)
   - ✅ "Read more →" CTA on all cards
   - ✅ `/watch/[id]` route with full detail view
   - ✅ Full 200-word AI summary on detail page
   - ✅ `getWubbySummaryByHash()` for direct hash lookup

2. **Visual Enhancements** - Make differentiators prominent
   - ✅ Tag count badge added (no icon - clean)
   - ✅ Green accent bar for summary hooks
   - ✅ FileText icon for original titles
   - ✅ 6 tags visible (was 3), all clickable
   - ✅ Platform-specific play button glow (Kick green, Twitch purple)
   - ✅ Removed redundant "Click to watch" text

**Impact:**
- 7 files modified
- ~200 lines changed
- Better UX with two-tier progressive disclosure
- Differentiators (AI, tags, titles) now prominent
- "Read more" flow fully functional

**See:** `UI_IMPLEMENTATION_GUIDE.md` for complete design reference

### ✅ MEDIUM PRIORITY OPTIMIZATIONS COMPLETE (2025-11-11)

**Optimizations Completed:**

1. **Utility File Consolidation** - Analyzed all utility files
   - ✅ No consolidation needed - files already well-organized
   - 4 files with distinct responsibilities: cn(), logger, hash, video-helpers
   - No overlapping functionality found

2. **Enhanced Empty States** - Improved UX with icons and actions
   - ✅ VideoList.tsx - Search/Film icons, helpful descriptions
   - ✅ app/player/page.tsx - PlayCircle icon with "Browse VOD Diary" action button
   - Better visual hierarchy and user guidance

3. **Error Retry Logic** - Added retry buttons to all error toasts
   - ✅ app/vod-diary/page.tsx - Retry loading videos
   - ✅ app/player/page.tsx - Retry loading video metadata (2 cases)
   - ✅ app/page.tsx - Retry loading video on index page
   - ✅ app/transcript/page.tsx - Retry loading video on transcript page
   - Users can retry failed operations without manual page refresh

4. **React.memo Optimization** - Prevented unnecessary re-renders
   - ✅ VideoCard.tsx - Memoized to prevent re-renders on parent updates
   - ✅ VideoList.tsx - Memoized list container
   - Improved performance with 50+ video cards

5. **useToast Simplification** - Reduced code complexity
   - ✅ Simplified from 217 lines to 90 lines (58% reduction)
   - Removed unnecessary wrapper functions
   - Maintained all functionality with cleaner code

**Impact:**
- 6 files modified
- ~120 lines changed
- Better UX with retry functionality
- Improved performance with React.memo
- Cleaner, more maintainable code

---

## File Structure

```
web-new/
├── app/
│   ├── page.tsx              # Index - Video metadata
│   ├── transcript/page.tsx   # Transcript extraction
│   ├── vod-diary/page.tsx    # VOD list with filters
│   ├── player/page.tsx       # Video player
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Tailwind styles
├── components/
│   ├── ui/                   # shadcn components
│   ├── video/                # VideoSelector, VidstackPlayer, VideoMetadata
│   ├── vod-diary/            # VideoCard, DateRangePicker, PlatformSlider, SearchInput
│   └── Header.tsx            # Navigation
├── lib/
│   ├── api/supabase.ts       # API client
│   ├── hooks/useToast.ts     # Toast wrapper
│   └── utils/                # hash, video-helpers, cn
└── types/
    ├── video.ts              # Video interface
    └── supabase.ts           # DB types
```

---

## Key Technical Details

### Hash-based Video Tracking
- SHA-256 hash generation from video URLs
- Used for subtitle lookup: `wubbytranscript/{hash}/en/subtitle.vtt`
- Implementation: `/lib/utils/hash.ts`

### Supabase Integration
- Video metadata from `wubby_summaries` table
- Subtitle storage in `wubbytranscript` bucket
- Client: `/lib/api/supabase.ts`

### Platform Support
- Twitch VODs
- Kick VODs
- Platform-specific filtering + color theming (purple/green)

### Accessibility
- ARIA attributes via Radix UI primitives
- Keyboard navigation (Tab, Enter, Space)
- Screen reader compatible
- Focus indicators

---

## Component Highlights

### Badge Variants (Custom)
```typescript
// Light variants: kick, twitch, tag
// Solid variants: kick-solid, twitch-solid, tag-solid
// Colors: Kick=#1e7e34, Twitch=#6441A5
```

### Collapsible VideoCard
- Replaces 60 lines of custom animation code
- Automatic ARIA attributes
- Keyboard accessible expand/collapse

### Skeleton Loading
- SkeletonVideoCard mimics VideoCard structure
- Shows 3 cards during VOD fetch
- Better perceived performance

---

## Code Analysis & Optimization Findings

**Analysis Date:** 2025-11-10
**Codebase Size:** 3,117 lines (40 TypeScript/TSX files)

### 1. Code Organization & Structure ✅ GOOD

**Strengths:**
- Clear separation: app/, components/, lib/, types/ directories well-organized
- Component composition: Proper separation (video/, vod-diary/, ui/, layout/)
- Type safety: TypeScript properly used with dedicated type files
- Modern patterns: Next.js App Router, shadcn/ui with Radix UI primitives

**Issues:**
- ✅ ~~Utility fragmentation~~ - RESOLVED: Files analyzed, no consolidation needed (well-organized)
- Component size: Some growing large (VideoCard: 171 lines, vod-diary/page: 128 lines)
- ✅ ~~Missing structure~~ - RESOLVED: Error boundaries and loading.tsx files added (HIGH priority)
- Test gap: Only 3 test files - no component unit tests

### 2. Code Quality & Best Practices ⚠️ NEEDS WORK

**Strengths:**
- TypeScript: Proper types, interfaces, type safety throughout
- Documentation: Comprehensive JSDoc (hash.ts, supabase.ts)
- Error handling: 24 try-catch blocks for critical operations
- React patterns: Proper hooks (useState, useEffect, useCallback)

**🚨 CRITICAL ISSUES:**

**✅ Issue #1: Excessive Console Logging (173 statements)** - RESOLVED
- ✅ Centralized logger.ts implemented with environment-aware log levels
- ✅ Logs suppressed in production, only show in development
- ✅ All console.log statements now go through logger utility

**✅ Issue #2: No Production Logging Strategy** - RESOLVED
- ✅ Logger.ts with debug/info/warn/error levels implemented
- ✅ Environment detection (development vs production)
- ✅ Ready for Sentry/LogRocket integration

**✅ Issue #3: Hardcoded API Key Fallbacks** - RESOLVED
- ✅ Removed hardcoded fallback from lib/api/supabase.ts
- ✅ App now fails fast with clear error message if env vars missing
- ✅ Better debugging for configuration errors

**✅ Issue #4: No Global Error Boundary** - RESOLVED
- ✅ app/error.tsx implemented with user-friendly UI
- ✅ Component-level error boundaries (player, transcript, vod-diary)
- ✅ app/not-found.tsx for 404 errors
- ✅ Graceful error recovery with retry options

**MAJOR ISSUES:**

**✅ Issue #5: No Environment Detection** - RESOLVED
- ✅ Logger.ts now detects NODE_ENV (development, production, test)
- ✅ Logs automatically suppressed in production
- ✅ Ready for environment-specific analytics and error reporting

**✅ Issue #6: useToast Over-Engineering** - RESOLVED
- ✅ Simplified from 217 lines to 90 lines (58% reduction)
- ✅ Removed unnecessary convertOptions/convertDuration wrappers
- ✅ Maintained all functionality with cleaner implementation

**Issue #7: Code Duplication**
- Similar fetch patterns across supabase.ts
- Sample data hardcoded in components (should be in constants)
- Priority: MEDIUM

**Issue #8: Unused Code**
- isValidHash function defined but never used
- Sample videos in VideoSelector (should be constant)
- Priority: LOW

### 3. UI/UX Analysis ✅ MOSTLY GOOD

**Strengths:**
- **Accessibility:** Skip links, ARIA labels, semantic HTML, keyboard nav via Radix UI
- **Responsive:** Tested 375x667px mobile, works well
- **Loading states:** Skeleton components for perceived performance
- **Feedback:** Toast notifications for all operations
- **Theming:** Platform-specific colors (Kick green, Twitch purple)

**Issues:**

**✅ Issue #9: Missing Page Metadata** - RESOLVED
- ✅ Root layout updated with comprehensive metadata
- ✅ Per-page layouts for vod-diary, transcript, player
- ✅ Open Graph tags for social sharing
- ✅ Twitter Card support

**✅ Issue #10: No 404/Error Pages** - RESOLVED
- ✅ app/not-found.tsx implemented
- ✅ app/error.tsx (global error boundary)
- ✅ Page-level error.tsx files (player, transcript, vod-diary)

**✅ Issue #11: No Loading States** - RESOLVED
- ✅ loading.tsx files for all routes (/, /vod-diary, /transcript, /player)
- ✅ Skeleton UIs for better perceived performance
- ✅ Next.js Suspense streaming support

**Issue #12: Player UX**
- Opens in new tab (target="_blank") - could use modal
- No in-page player option
- Priority: LOW

**✅ Enhancements Completed:**
- ✅ Retry buttons on error toasts (all critical error cases)
- ✅ Better empty states with icons and helpful messages

**Enhancement Opportunities:**
- Pagination for VOD Diary (currently fetches 200 at once)
- Search loading indicator (debounce already implemented)
- Keyboard shortcuts (Ctrl+K for search)
- Offline support indicator

### 4. Performance Analysis ⚠️ OPTIMIZATION NEEDED

**Optimizations Completed:**

**✅ Issue #13: No React.memo** - RESOLVED
- ✅ VideoCard.tsx wrapped with React.memo
- ✅ VideoList.tsx wrapped with React.memo
- ✅ Prevents unnecessary re-renders of 50+ video cards on filter changes

**Potential Issues:**

**Issue #14: Large Data Fetches**
- Search fetches 200 videos without pagination
- VOD Diary fetches 50 videos at once
- Priority: MEDIUM

**Issue #15: No API Caching**
- Repeated API calls on filter changes
- Could cache with React Query/SWR
- Priority: MEDIUM

**Issue #16: Bundle Size**
- Vidstack player is heavy (could lazy load)
- No dynamic imports for heavy components
- Priority: LOW

**Measurements:**
- Component lines: 3,117
- Dependencies: 33 packages (reasonable)
- Console logs: 173 statements

### 5. Testing & Quality Assurance ⚠️ MAJOR GAPS

**Current Coverage:**
- E2E tests: 3 Playwright specs (smoke, hash, vod-diary)
- Unit tests: **ZERO**
- Integration tests: **ZERO**
- Visual regression: **ZERO**

**Issue #17: No Component Tests**
- No tests for VideoCard, VideoSelector, VideoMetadata
- No hook tests (useToast, useLocalStorage)
- Priority: HIGH

**Issue #18: No API Tests**
- No mocked Supabase tests
- No error handling tests
- Priority: MEDIUM

**Issue #19: No Accessibility Tests**
- Beyond manual verification, no automated a11y tests
- Priority: MEDIUM

**Missing Test Types:**
- Component rendering tests
- Hook behavior tests
- API mocking tests
- Error boundary tests
- Keyboard navigation tests
- Screen reader tests

### 6. Security & Best Practices ✅ ACCEPTABLE

**Good:**
- Read-only Supabase anon key (safe to expose)
- RLS protection on database
- No sensitive data in client
- Proper CORS via Supabase

**Recommendations:**
- Remove hardcoded API key fallback (Issue #3)
- Add client-side rate limiting
- Request timeout handling (already in getWubbySummary)
- Consider CSRF protection for future writes

---

---

## Current Work

### 🔄 IN PROGRESS: Touch Gestures for Video Player
- Added `useTouchGestures.ts` hook
- Added `player-gestures.spec.ts` E2E test
- Changes to VidstackPlayer, VideoSelector, Header, transcript page

---

## Remaining Tasks

### 🟠 HIGH Priority
1. **Component Unit Tests** - Zero unit tests currently, only 3 E2E tests

### 🟡 MEDIUM Priority
2. **API Caching** - Add React Query/SWR to avoid re-fetching on filter changes (Issue #15)
3. **VOD Diary Pagination** - Currently fetches 200 videos at once (Issue #14)
4. **Mobile Date Picker UX** - Flatpickr touch improvements

### 🟢 LOW Priority
5. **Production Build Optimization** - Bundle analysis, code splitting (Issue #16)
6. **Keyboard Shortcuts** - Ctrl+K for search, etc.

---

**Last Updated:** 2025-11-30
**Status:** Core migration complete. All CRITICAL & HIGH optimizations done (except unit tests). Touch gestures work in progress. 3 MEDIUM priority enhancements pending.
