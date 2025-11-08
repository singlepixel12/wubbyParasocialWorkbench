# Claude.md - Wubby Parasocial Workbench Migration Guide

## Project Overview

**Wubby Parasocial Workbench** is a web-based tool for analyzing and working with parasocial content from Wubby's streams. It provides video transcription, VOD diary management, and content analysis capabilities.

**Target Audience:** Wubby community members
**Data Source:** archive.wubby.tv

---

## Current State (Vanilla HTML/CSS/JS)

### Technology Stack
- Pure HTML/CSS/JavaScript (no frameworks)
- **Vidstack Player** - Video playback
- **Flatpickr** - Date range picker for VOD diary

### File Structure
```
├── index.html          # Main entry - Transcription Details page
├── transcript.html     # Transcript extraction and viewing
├── vod-diary.html     # VOD diary management
├── player.html        # Video player page
├── styles.css         # Main stylesheet (28KB)
└── src/
    ├── script.js      # Core application logic and video handling
    ├── toast.js       # Toast notification system
    └── vodDiary.js    # VOD diary functionality and filtering
```

### Core Features to Preserve

#### 1. Video Management
- URL input system for archive.wubby.tv
- Dropdown selection of available VODs
- Hash-based video tracking (unique hash generation per video)
- Video metadata display (title, date, tags, summary)
- Vidstack player integration

#### 2. Transcription Tools
- Transcript extraction from video content
- VTT (WebVTT) subtitle file handling
- Real-time transcript display alongside video
- Transcript analysis capabilities

#### 3. VOD Diary System
- Calendar-based date range selection (Flatpickr)
- Platform filtering toggle (Twitch/Kick/Both)
- Video list management with filtering
- Responsive mobile-friendly design
- Expandable card UI for VOD entries

#### 4. UI/UX Elements
- Toast notification system
- Responsive design across devices
- Current styling and layout (to be preserved initially)

---

## Migration Goals

### Primary Objective
**Migrate to Next.js/React/shadcn while preserving 100% of current functionality**

### Migration Constraints
- ✅ **DO:** Preserve all existing features and functionality
- ✅ **DO:** Maintain current behavior and user workflows
- ✅ **DO:** Keep existing integrations (archive.wubby.tv, Vidstack, etc.)
- ❌ **DON'T:** Add new features during migration
- ❌ **DON'T:** Restyle or redesign UI/UX (future phase)
- ❌ **DON'T:** Change data structures or API interactions
- ❌ **DON'T:** Modify business logic unless necessary for framework compatibility

### Target Technology Stack
- **Framework:** Next.js (App Router or Pages Router - TBD)
- **UI Library:** React
- **Component Library:** shadcn/ui
- **Styling:** Tailwind CSS (via shadcn)
- **Video Player:** Vidstack Player (preserve existing)
- **Date Picker:** TBD (replace Flatpickr with shadcn/React equivalent)

---

## Key Technical Details

### Current Functionality Requirements

#### Hash-based Video Tracking
- Videos are identified by unique hashes
- Status tracking system for video processing
- Must preserve hash generation logic

#### archive.wubby.tv Integration
- URL parsing for archive.wubby.tv links
- API/data fetching from archive source
- VOD metadata retrieval (title, date, tags, summary)

#### Multi-Platform Support
- Twitch VODs
- Kick VODs
- Platform-specific filtering logic

#### Transcript System
- VTT file parsing and display
- Sync with video playback
- Extraction and analysis tools

#### VOD Diary Features
- Date range filtering
- Platform toggle (Twitch/Kick/Both)
- Card-based expandable UI
- Search functionality (if exists)

---

## Migration Strategy

### Phase 1: Setup & Foundation
1. Initialize Next.js project with TypeScript
2. Install shadcn/ui and configure Tailwind
3. Set up project structure matching current page organization
4. Configure Vidstack for React/Next.js

### Phase 2: Component Migration
1. Create page components (index, transcript, vod-diary, player)
2. Extract reusable components (player, toast, filters, cards)
3. Port JavaScript logic to React hooks and components
4. Preserve all state management patterns

### Phase 3: Styling Migration
1. Convert existing CSS to Tailwind classes
2. Maintain current visual design exactly
3. Ensure responsive behavior matches current implementation
4. Use shadcn components where appropriate (buttons, inputs, etc.)

### Phase 4: Testing & Validation
1. Feature parity verification
2. Cross-browser testing
3. Mobile responsiveness validation
4. Integration testing with archive.wubby.tv

### Phase 5: Future Enhancements (Post-Migration)
- UI/UX redesign
- New features
- Performance optimizations
- Additional platforms or integrations

---

## Important Notes

### Data Sources & APIs
- **Primary Source:** archive.wubby.tv
- Need to understand current API calls and data fetching patterns
- Preserve all existing endpoints and data structures

### State Management
- Current: Vanilla JS DOM manipulation
- Target: React state (useState, useEffect, etc.)
- May need lightweight state management (Context API or Zustand) if complexity requires

### Routing
- Current: Multi-page HTML site
- Target: Next.js routing (App Router recommended for new projects)
- Preserve current page structure: /, /transcript, /vod-diary, /player

### Build & Deployment
- Current: Static HTML files (can be served anywhere)
- Target: Next.js (SSG/SSR/ISR capabilities)
- Consider deployment platform (Vercel, Netlify, etc.)

---

## Success Criteria

Migration is complete when:
- [ ] All 4 pages are functional in Next.js
- [ ] Video playback works identically to current implementation
- [ ] Transcript extraction and display functions correctly
- [ ] VOD diary filtering (date range + platform) works as expected
- [ ] Hash-based tracking system is preserved
- [ ] archive.wubby.tv integration is intact
- [ ] Responsive design matches current behavior
- [ ] Toast notifications work correctly
- [ ] Visual appearance matches current site (no unintended style changes)
- [ ] No functionality has been lost or degraded

---

## Current Investigation Needed

Before starting migration, we need to examine:
1. **src/script.js** - Understand video loading, hash generation, API calls
2. **src/vodDiary.js** - VOD filtering logic, data structures, API integration
3. **src/toast.js** - Toast notification implementation
4. **styles.css** - Current styling patterns to replicate in Tailwind
5. **HTML files** - Page structure, forms, event handlers

---

## Questions to Answer

1. What API endpoints does archive.wubby.tv expose?
2. How is video metadata fetched and structured?
3. What is the hash generation algorithm?
4. Are there any backend services, or is this purely client-side?
5. What browser storage (localStorage/sessionStorage) is being used?
6. Are there any existing build tools or bundlers?

---

---

## Migration TODO Progress Tracker

**Status:** In Progress
**Target Directory:** `/web-new`
**Last Updated:** 2025-11-08

### PRIORITY 1: Project Foundation & Setup

- [ ] **1.1** Initialize Next.js project with TypeScript in `/web-new`
  - Command: `npx create-next-app@latest web-new --typescript --tailwind --app --no-src-dir`
  - Deliverable: Next.js 14+ with App Router, TypeScript, Tailwind configured

- [ ] **1.2** Initialize shadcn/ui component library
  - Command: `cd web-new && npx shadcn@latest init`
  - Select: New York style, Slate color, CSS variables
  - Deliverable: `components.json`, `/components/ui` folder

- [ ] **1.3** Install core dependencies
  - Command: `npm install vidstack @supabase/supabase-js crypto-js date-fns`
  - Deliverable: Updated `package.json`

- [ ] **1.4** Install shadcn UI components
  - Command: `npx shadcn@latest add button input card toast select`
  - Deliverable: shadcn components in `/components/ui`

- [ ] **1.5** Environment configuration
  - Create `.env.local` with Supabase credentials
  - Create `.env.example` template
  - Deliverable: Environment files configured

### PRIORITY 2: Playwright Setup (Early for Visualization)

- [ ] **2.1** Install Playwright
  - Command: `npm install -D @playwright/test && npx playwright install`
  - Deliverable: `playwright.config.ts`, `/tests` directory

- [ ] **2.2** Configure Playwright for Next.js
  - Set baseURL to `http://localhost:3000`
  - Configure browser contexts (chromium, firefox, webkit)
  - Deliverable: Working Playwright configuration

- [ ] **2.3** Create basic smoke test
  - Create `/tests/smoke.spec.ts` - test homepage loads
  - Command: `npx playwright test`
  - Deliverable: Passing smoke test

- [ ] **2.4** Add Playwright UI mode script
  - Add `"test:ui": "playwright test --ui"` to package.json
  - Deliverable: Visual test runner available

### PRIORITY 3: Core Utilities & Type Definitions

- [ ] **3.1** Create TypeScript type definitions
  - Create `/types/video.ts` - Video object interface
  - Create `/types/supabase.ts` - Database schema types
  - Deliverable: Type-safe data structures

- [ ] **3.2** Create hash utility
  - Create `/lib/utils/hash.ts` - SHA-256 video URL hashing
  - Port logic from `src/script.js:computeVideoHash()`
  - Deliverable: Type-safe hash generation

- [ ] **3.3** Create Supabase client
  - Create `/lib/api/supabase.ts` - Supabase client initialization
  - Add `getWubbySummary()` and `fetchRecentVideos()` functions
  - Deliverable: API integration layer

- [ ] **3.4** Create formatter utilities
  - Create `/lib/utils/formatters.ts` - Date/text formatting
  - Port `formatSummaryText()` and `formatDateDisplay()`
  - Deliverable: Reusable formatter functions

- [ ] **3.5** Create localStorage hook
  - Create `/lib/hooks/useLocalStorage.ts`
  - Deliverable: Type-safe client-side storage hook

### PRIORITY 4: Basic Route Structure & Layout

- [ ] **4.1** Create root layout with navigation
  - Create `/app/layout.tsx` - Root layout component
  - Create `/components/Header.tsx` - Navigation header
  - Create `/components/Footer.tsx` - Footer (if needed)
  - Deliverable: Shared layout with navigation

- [ ] **4.2** Create page route files (shells only)
  - Create `/app/page.tsx` - Index page shell
  - Create `/app/transcript/page.tsx` - Transcript page shell
  - Create `/app/vod-diary/page.tsx` - VOD diary page shell
  - Create `/app/player/page.tsx` - Player page shell
  - Deliverable: All 4 routes accessible via navigation

- [ ] **4.3** Verify routing works
  - Test navigation between all pages
  - Run dev server: `npm run dev`
  - Deliverable: Working multi-page app structure

### PRIORITY 5: Toast System (Used Across All Pages)

- [ ] **5.1** Create toast provider
  - Create `/components/providers/ToastProvider.tsx`
  - Port logic from `src/toast.js`
  - Deliverable: React-based toast context

- [ ] **5.2** Create useToast hook
  - Create `/lib/hooks/useToast.ts`
  - Expose `showToast()`, `showError()`, `showSuccess()`, `showWarning()`
  - Deliverable: Toast hook matching vanilla API

- [ ] **5.3** Add toast provider to root layout
  - Wrap app in ToastProvider in `/app/layout.tsx`
  - Deliverable: Toast system available globally

### PRIORITY 6: Index Page Migration (First Complete Page)

- [ ] **6.1** Create VideoSelector component
  - Create `/components/VideoSelector.tsx`
  - URL input with dropdown for video selection
  - Deliverable: Reusable video input component

- [ ] **6.2** Create VideoMetadata component
  - Create `/components/VideoMetadata.tsx`
  - Display title, date, tags, summary
  - Deliverable: Metadata display component

- [ ] **6.3** Create HashDisplay component
  - Create `/components/HashDisplay.tsx`
  - Show video hash and status
  - Deliverable: Hash display component

- [ ] **6.4** Migrate index page logic
  - Port logic from `index.html` + `src/script.js` to `/app/page.tsx`
  - Integrate VideoSelector, VideoMetadata, HashDisplay
  - Add Load/Clear button handlers
  - Deliverable: Functional index page with video metadata loading

- [ ] **6.5** Test index page functionality
  - Create `/tests/index.spec.ts`
  - Test: Load video URL → Display metadata
  - Test: Hash generation works
  - Test: Error handling
  - Deliverable: Passing E2E tests for index page

### PRIORITY 7: Vidstack Player Component

- [ ] **7.1** Create VidstackPlayer component
  - Create `/components/VidstackPlayer.tsx`
  - Add Vidstack React integration
  - Support dynamic subtitle loading
  - Deliverable: Reusable video player component

- [ ] **7.2** Test player initialization
  - Create test page with player
  - Verify video playback works
  - Verify subtitle loading works
  - Deliverable: Working player component

### PRIORITY 8: Transcript Page Migration

- [ ] **8.1** Migrate transcript page layout
  - Port structure from `transcript.html` to `/app/transcript/page.tsx`
  - Add VideoSelector component
  - Add VidstackPlayer component
  - Deliverable: Transcript page structure

- [ ] **8.2** Port dynamic subtitle loading logic
  - Migrate inline script from `transcript.html`
  - SHA-256 hash-based subtitle fetching from Supabase storage
  - Player recreation for subtitle switching
  - Deliverable: Working transcript extraction

- [ ] **8.3** Test transcript page
  - Create `/tests/transcript.spec.ts`
  - Test: Select video → Load player → Display subtitles
  - Deliverable: Passing E2E tests for transcript page

### PRIORITY 9: VOD Diary Page Components

- [ ] **9.1** Create VideoCard component
  - Create `/components/VideoCard.tsx`
  - Expandable card with platform tags, metadata
  - Match current card design
  - Deliverable: Reusable VOD card component

- [ ] **9.2** Create PlatformToggle component
  - Create `/components/PlatformToggle.tsx`
  - Twitch/Kick/Both slider
  - Deliverable: Platform filter toggle

- [ ] **9.3** Create DateRangePicker component
  - Create `/components/DateRangePicker.tsx`
  - Replace Flatpickr with shadcn calendar/date-picker
  - Deliverable: Date range selection component

- [ ] **9.4** Create SearchInput component
  - Create `/components/SearchInput.tsx`
  - Search toggle with input field
  - Deliverable: Search input component

- [ ] **9.5** Create useVideoSearch hook
  - Create `/lib/hooks/useVideoSearch.ts`
  - Client-side search filtering by title/tags
  - Deliverable: Search logic hook

### PRIORITY 10: VOD Diary Page Migration

- [ ] **10.1** Migrate VOD diary page structure
  - Port layout from `vod-diary.html` to `/app/vod-diary/page.tsx`
  - Integrate PlatformToggle, DateRangePicker, SearchInput
  - Deliverable: VOD diary page structure

- [ ] **10.2** Port VOD fetching and filtering logic
  - Migrate logic from `src/vodDiary.js`
  - Implement `fetchRecentVideos()` with platform/date filtering
  - Render VideoCard list
  - Deliverable: Working VOD diary with filtering

- [ ] **10.3** Test VOD diary functionality
  - Create `/tests/vod-diary.spec.ts`
  - Test: Date range filtering works
  - Test: Platform toggle works
  - Test: Search functionality works
  - Deliverable: Passing E2E tests for VOD diary

### PRIORITY 11: Player Page Migration

- [ ] **11.1** Migrate player page
  - Port logic from `player.html` to `/app/player/page.tsx`
  - Add hidden VideoSelector (CSS positioning)
  - Add VidstackPlayer with localStorage integration
  - Deliverable: Standalone player page

- [ ] **11.2** Test player page
  - Create `/tests/player.spec.ts`
  - Test: Video selection from localStorage
  - Test: Player displays correctly
  - Deliverable: Passing E2E tests for player page

### PRIORITY 12: Error Tracking System

- [ ] **12.1** Create error tracking provider
  - Create `/components/providers/ErrorTrackingProvider.tsx`
  - Port ErrorTracker logic from `src/script.js`
  - localStorage persistence for errors
  - Deliverable: Error tracking context

- [ ] **12.2** Add error tracking to root layout
  - Wrap app in ErrorTrackingProvider
  - Global error handlers
  - Deliverable: Error tracking across entire app

### PRIORITY 13: Styling Migration (Match Current Design)

- [ ] **13.1** Analyze existing styles
  - Review `styles.css` - identify key design patterns
  - Document colors, spacing, typography
  - Deliverable: Style audit document

- [ ] **13.2** Create Tailwind theme configuration
  - Update `/app/globals.css` with CSS variables
  - Configure dark theme colors in `tailwind.config.ts`
  - Deliverable: Theme matching current design

- [ ] **13.3** Apply Tailwind to Header/Layout
  - Convert header styles to Tailwind
  - Ensure responsive navigation
  - Deliverable: Styled layout components

- [ ] **13.4** Style Index page components
  - Apply Tailwind to VideoSelector, VideoMetadata, HashDisplay
  - Match current design exactly
  - Deliverable: Styled index page

- [ ] **13.5** Style Transcript page
  - Apply Tailwind to transcript layout
  - Player container styling
  - Deliverable: Styled transcript page

- [ ] **13.6** Style VOD Diary page
  - Apply Tailwind to filters and cards
  - Match expandable card animations
  - Deliverable: Styled VOD diary page

- [ ] **13.7** Style Player page
  - Apply Tailwind to player layout
  - Deliverable: Styled player page

- [ ] **13.8** Responsive design verification
  - Test mobile, tablet, desktop breakpoints
  - Ensure matches current responsive behavior
  - Deliverable: Mobile-friendly design matching current

### PRIORITY 14: Advanced Testing

- [ ] **14.1** Visual regression tests
  - Create screenshot comparison tests
  - Compare all 4 pages (desktop + mobile)
  - Deliverable: Visual diff tests

- [ ] **14.2** Unit tests setup
  - Install Jest: `npm install -D jest @testing-library/react @testing-library/jest-dom`
  - Configure Jest for Next.js
  - Deliverable: Jest configuration

- [ ] **14.3** Write unit tests for utilities
  - Test hash generation
  - Test formatters
  - Test hooks (useLocalStorage, useVideoSearch)
  - Deliverable: Unit test suite

- [ ] **14.4** Integration tests
  - Mock Supabase API responses
  - Test error handling flows
  - Deliverable: Integration test suite

- [ ] **14.5** Accessibility testing
  - Keyboard navigation tests
  - Screen reader compatibility
  - ARIA label verification
  - Deliverable: A11y test suite

### PRIORITY 15: Final Validation & Documentation

- [ ] **15.1** Production build verification
  - Run: `npm run build && npm run start`
  - Fix any build errors
  - Deliverable: Production-ready build

- [ ] **15.2** Feature parity checklist
  - Verify all success criteria from above
  - Manual testing of all features
  - Deliverable: Completed success criteria

- [ ] **15.3** Create migration documentation
  - Create `/web-new/README.md`
  - Create `/web-new/MIGRATION_NOTES.md`
  - Document component architecture
  - Deliverable: Developer documentation

- [ ] **15.4** Performance audit
  - Run Lighthouse tests
  - Verify load times
  - Deliverable: Performance report

---

**Last Updated:** 2025-11-08
**Status:** Ready to begin migration
