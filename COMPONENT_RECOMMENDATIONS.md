# Component-Specific Recommendations
## Wubby Parasocial Workbench - Component Refactoring Guide

**Version:** 1.0
**Last Updated:** 2025-11-13

This document provides detailed before/after examples for each major component in the Wubby Parasocial Workbench, incorporating parasoci.al aesthetics, YouTube/Netflix best practices, and mobile-first design.

---

## Table of Contents

1. [VideoCard Component](#videocard-component)
2. [Header & Navigation](#header--navigation)
3. [Filter Controls](#filter-controls)
4. [Video Player](#video-player)
5. [Search Input](#search-input)
6. [Empty States](#empty-states)
7. [Loading States](#loading-states)
8. [Badge Component](#badge-component)
9. [Button Variants](#button-variants)
10. [New Components to Create](#new-components-to-create)

---

## VideoCard Component

**File:** `components/vod-diary/VideoCard.tsx`
**Priority:** CRITICAL
**Effort:** 8-12 hours

### Current Issues
- Desktop-first sizing
- Touch targets too small (expand button: ~24px height)
- Horizontal layout doesn't work well on mobile
- No visual hierarchy on thumbnail
- Platform badge not interactive

### Design Goals
- **🎯 HERO: AI Summary prominently displayed** (Your key differentiator!)
- **🎯 HERO: Tags always visible and clickable** (Fast search superpower!)
- **🎯 HERO: Both AI and original title shown** (Title renaming feature!)
- Mobile-first vertical layout
- Larger thumbnails on mobile
- Platform-specific glow effects
- Better metadata hierarchy
- Duration badge on thumbnail

### Before
```tsx
<div className="flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 pb-10">
  <Link href="/player" className="group block flex-shrink-0">
    <div className="relative w-40 h-full min-h-[90px] bg-black rounded overflow-hidden">
      {/* Small horizontal thumbnail */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 flex items-center justify-center opacity-80">
        <Play className="w-8 h-8 text-white fill-white" />
      </div>
    </div>
  </Link>

  <div className="flex-1 flex flex-col">
    <h3 className="text-lg font-semibold text-white mb-1">{video.title}</h3>
    {/* Rest of content */}
  </div>

  <Button size="sm" className="absolute bottom-2">
    {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
  </Button>
</div>
```

### After
```tsx
<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
  <div
    onClick={handleCardClick}
    className={cn(
      // Mobile: Vertical, full-width thumbnail
      'flex flex-col gap-3 p-3 rounded-lg',
      'bg-[#111] border border-[#333]',
      'hover:bg-[#1a1a1a] hover:border-[#444]',
      'transition-all duration-200',
      'cursor-pointer relative pb-14',
      // Desktop: Horizontal, fixed thumbnail
      'md:flex-row md:gap-4 md:p-4',
      isExpanded && 'bg-[#1a1a1a] border-[#444]'
    )}
  >
    {/* Platform badge - interactive */}
    <Badge
      variant={getSolidBadgeVariant(video.platform)}
      onClick={(e) => {
        e.stopPropagation();
        onFilterByPlatform?.(video.platform);
      }}
      className={cn(
        "absolute top-3 right-3 z-10",
        "px-4 py-2 min-w-[64px] h-[32px]",
        "cursor-pointer transition-transform hover:scale-105",
        "font-semibold"
      )}
      aria-label={`Filter by ${video.platform}`}
    >
      {video.platform}
    </Badge>

    {/* Thumbnail - responsive sizing */}
    <Link
      href="/player"
      target="_blank"
      onClick={handleThumbnailClick}
      className="group block"
      aria-label={`Play ${video.title}`}
    >
      <div className={cn(
        'relative rounded overflow-hidden bg-black',
        // Mobile: 16:9 aspect ratio, full width
        'w-full aspect-video',
        // Desktop: Fixed width
        'md:w-48 md:aspect-auto md:h-28',
        'flex-shrink-0'
      )}>
        {/* Thumbnail with gradient overlay */}
        <div className="absolute inset-0 bg-black" />

        {/* Gradient overlay for text legibility */}
        <div className={cn(
          "absolute inset-0",
          "bg-gradient-to-t from-black/90 via-black/20 to-transparent",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-300"
        )} />

        {/* Play button with platform glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'w-16 h-16 md:w-20 md:h-20',
              'rounded-full flex items-center justify-center',
              'backdrop-blur-sm transition-all duration-300',
              'animate-[playButtonPulse_2s_ease-in-out_infinite]',
              'group-hover:animate-none group-hover:scale-110',
              'bg-gradient-to-br from-black/90 to-black/70',
              // Platform-specific glow
              video.platform === 'kick' &&
                'group-hover:from-[#28a745]/95 group-hover:to-[#28a745]/80 group-hover:shadow-[0_0_20px_rgba(30,126,52,0.8)]',
              video.platform === 'twitch' &&
                'group-hover:from-[#6441A5]/95 group-hover:to-[#6441A5]/80 group-hover:shadow-[0_0_20px_rgba(100,65,165,0.8)]'
            )}
          >
            <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge - bottom right */}
        <div className={cn(
          "absolute bottom-2 right-2",
          "px-2 py-1 rounded",
          "bg-black/80 backdrop-blur-sm",
          "text-white text-xs font-medium"
        )}>
          {formatDuration(video.duration)}
        </div>
      </div>
    </Link>

    {/* Content section - DIFFERENTIATOR FOCUSED */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* 🎯 DIFFERENTIATOR 1: AI-Generated badges (Top) */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="border-[#28a745] text-[#28a745] text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          AI Summary
        </Badge>
        {video.tags.length > 0 && (
          <Badge variant="outline" className="border-[#6441A5] text-[#6441A5] text-xs">
            <Tag className="w-3 h-3 mr-1" />
            {video.tags.length} tags
          </Badge>
        )}
      </div>

      {/* 🎯 DIFFERENTIATOR 2: Title Renaming - Show BOTH titles */}
      <div className="space-y-1.5 mb-3">
        {/* AI-Renamed Title (PRIMARY) */}
        <div className="flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#28a745] flex-shrink-0 mt-0.5" />
          <h3 className="text-base md:text-lg font-semibold text-white line-clamp-2 flex-1">
            {video.title}
          </h3>
        </div>

        {/* Original Title from URL (SECONDARY) */}
        {originalTitle && (
          <div className="flex items-start gap-1.5">
            <FileText className="w-3 h-3 text-[#666] flex-shrink-0 mt-0.5" />
            <h4 className="text-xs text-[#888] font-mono line-clamp-1 flex-1">
              {originalTitle}
            </h4>
          </div>
        )}
      </div>

      {/* Metadata inline */}
      <div className="flex items-center gap-2 text-xs text-[#888] mb-3 flex-wrap">
        {formattedDate && <span>{formattedDate}</span>}
        {formattedDate && <span>•</span>}
        <span>{formatViews(video.views)} views</span>
        <span>•</span>
        <span>{formatDuration(video.duration)}</span>
      </div>

      {/* 🎯 DIFFERENTIATOR 3: AI Summary as HERO (not buried) */}
      <div className={cn(
        'mb-3 p-2.5 rounded',
        'bg-gradient-to-r from-[#28a745]/10 to-transparent',
        'border-l-2 border-[#28a745]'
      )}>
        <p className={cn(
          'text-sm leading-relaxed text-[#ccc]',
          // Show MORE lines on mobile (3-4 instead of 2)
          !isExpanded && 'line-clamp-3 md:line-clamp-4'
        )}>
          <span className="text-[#28a745] font-medium text-xs uppercase tracking-wide">
            Summary:
          </span>{' '}
          {video.summary}
        </p>
      </div>

      {/* 🎯 DIFFERENTIATOR 4: Tags ALWAYS visible (not hidden) */}
      <div className="flex flex-wrap gap-1.5">
        {video.tags
          .filter((tag) => tag !== video.platform)
          .slice(0, isExpanded ? undefined : 6)
          .map((tag, index) => (
            <Badge
              key={index}
              variant="tag"
              onClick={(e) => {
                e.stopPropagation();
                onSearchTag?.(tag);
              }}
              className={cn(
                "cursor-pointer text-xs",
                "hover:bg-[#28a745] hover:text-white hover:border-[#28a745]",
                "transition-colors"
              )}
            >
              {tag}
            </Badge>
          ))}
        {!isExpanded && video.tags.length > 6 && (
          <Badge variant="outline" className="text-xs text-[#666]">
            +{video.tags.length - 6} more
          </Badge>
        )}
      </div>
    </div>

    {/* Expand button - larger touch target */}
    <CollapsibleTrigger asChild>
      <Button
        variant="ghost"
        size="touch"  // 44px height
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute bottom-2 left-1/2 -translate-x-1/2',
          'min-w-[120px]',
          'text-sm font-medium',
          'text-[#888] hover:text-white hover:bg-[#222]',
          'transition-colors'
        )}
        aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
      >
        {isExpanded ? (
          <>Collapse <span className="ml-1">▲</span></>
        ) : (
          <>Expand <span className="ml-1">▼</span></>
        )}
      </Button>
    </CollapsibleTrigger>
  </div>
</Collapsible>
```

### Key Changes (Differentiator-Focused!)
1. **🎯 AI Summary as HERO** - Green accent bar, shows 3-4 lines (not 2), never buried
2. **🎯 Tags always visible** - 6 tags shown immediately, clickable for instant search
3. **🎯 Dual titles** - AI-renamed title + original filename both shown with icons
4. **🎯 AI badges** - "AI Summary" and tag count badges at top
5. **Mobile-first layout** - Vertical on mobile, horizontal on desktop
6. **Larger thumbnails** - 16:9 aspect ratio, full width on mobile
7. **Touch-optimized** - Expand button 44px height, larger badges
8. **Interactive tags** - Hover shows green, clicking searches instantly
9. **Platform glow** - Hover effect with platform colors
10. **Duration badge** - Shows video length on thumbnail

### New Utilities Needed
```ts
// lib/utils/video-helpers.ts

export function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatViews(views?: number): string {
  if (!views) return '0';

  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}K`;
  }
  return views.toString();
}
```

---

## Header & Navigation

**Files:**
- `components/Header.tsx`
- `components/layout/BottomNav.tsx` (new)

**Priority:** CRITICAL
**Effort:** 12-16 hours

### Current Issues
- Desktop-only navigation
- Always visible (takes vertical space on mobile)
- Not optimized for thumb zone

### Design Goals
- Bottom navigation on mobile (thumb-friendly)
- Top navigation on desktop
- Auto-hide on scroll (mobile)
- Active state indicators

### Before
```tsx
// components/Header.tsx
export function Header() {
  return (
    <header className="border-b border-[#333] bg-[#111]">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Wubby Parasocial Workbench
          </Link>
          <div className="flex gap-4">
            <Link href="/">Index</Link>
            <Link href="/transcript">Transcript</Link>
            <Link href="/vod-diary">VOD Diary</Link>
            <Link href="/player">Player</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
```

### After

**Desktop Header (Enhanced)**
```tsx
// components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();

  return (
    <header className={cn(
      'border-b border-[#333] bg-[#111]/95 backdrop-blur-sm',
      'sticky top-0 z-40',
      'hidden md:block'  // Hide on mobile
    )}>
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-bold text-white hover:text-[#28a745] transition-colors"
          >
            Wubby Parasocial Workbench
          </Link>

          {/* Desktop Navigation */}
          <div className="flex gap-1">
            {[
              { href: '/', label: 'Index' },
              { href: '/transcript', label: 'Transcript' },
              { href: '/vod-diary', label: 'VOD Diary' },
              { href: '/player', label: 'Player' },
            ].map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium',
                    'transition-colors',
                    isActive
                      ? 'bg-[#28a745] text-white'
                      : 'text-[#ccc] hover:text-white hover:bg-[#222]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
```

**Mobile Bottom Navigation (New)**
```tsx
// components/layout/BottomNav.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Video, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Index', icon: Home },
  { href: '/transcript', label: 'Transcript', icon: FileText },
  { href: '/vod-diary', label: 'VODs', icon: Video },
  { href: '/player', label: 'Player', icon: PlayCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-hide on scroll down (optional)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'md:hidden',  // Only on mobile
        'bg-[#111]/95 backdrop-blur-sm',
        'border-t border-[#333]',
        'transition-transform duration-300',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        // iOS safe area
        'pb-safe'
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center',
                'w-full h-full gap-1',
                'transition-colors',
                'min-w-[44px]',  // Touch target
                isActive
                  ? 'text-[#28a745]'
                  : 'text-[#888] hover:text-[#aaa] active:text-white'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                'text-xs font-medium',
                isActive && 'font-semibold'
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Update Root Layout**
```tsx
// app/layout.tsx
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/layout/BottomNav';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />  {/* Desktop only */}

        <main className={cn(
          'container mx-auto px-4 py-6',
          'pb-20 md:pb-6'  // Extra padding for bottom nav on mobile
        )}>
          {children}
        </main>

        <BottomNav />  {/* Mobile only */}
      </body>
    </html>
  );
}
```

### Key Changes
1. **Dual navigation** - Bottom nav on mobile, top nav on desktop
2. **Auto-hide** - Bottom nav hides on scroll down (optional)
3. **Active indicators** - Platform green for current page
4. **Touch-optimized** - 44px tap targets, larger icons
5. **Backdrop blur** - Modern translucent effect
6. **Safe area support** - iOS notch compatibility

---

## Filter Controls

**Files:**
- `components/vod-diary/DateRangePicker.tsx`
- `components/vod-diary/PlatformSlider.tsx`
- `components/vod-diary/FilterSheet.tsx` (new)

**Priority:** HIGH
**Effort:** 16-24 hours

### Current Issues
- Horizontal layout takes too much space on mobile
- Date picker modal is hard to use on mobile
- No quick preset options
- Filters at top (hard to reach)

### Design Goals
- Bottom sheet on mobile
- Quick preset buttons (This Week, This Month, etc.)
- Larger touch targets
- Sticky position on desktop

### Before
```tsx
// app/vod-diary/page.tsx
<div className="flex flex-wrap gap-4 justify-end items-center">
  <div className="w-full sm:w-auto sm:min-w-[280px]">
    <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
  </div>
  <PlatformSlider value={platform} onChange={handlePlatformChange} />
  <SearchInput onSearch={handleSearch} />
</div>
```

### After

**Mobile: Filter Button + Bottom Sheet**
```tsx
// components/vod-diary/FilterSheet.tsx
'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sliders, X } from 'lucide-react';
import { Platform } from './PlatformSlider';
import { DateRange } from 'react-day-picker';
import { getThisWeekRange, getThisMonthRange, getThisYearRange } from '@/lib/utils/video-helpers';

interface FilterSheetProps {
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const presets = [
  { label: 'This Week', getValue: getThisWeekRange },
  { label: 'This Month', getValue: getThisMonthRange },
  { label: 'This Year', getValue: getThisYearRange },
  { label: 'All Time', getValue: () => ({ from: null, to: null }) },
];

export function FilterSheet({
  platform,
  onPlatformChange,
  dateRange,
  onDateRangeChange,
}: FilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (platform !== 'both') count++;
    if (dateRange?.from) count++;
    setActiveFiltersCount(count);
  }, [platform, dateRange]);

  const handleApply = () => {
    setIsOpen(false);
  };

  const handleReset = () => {
    onPlatformChange('both');
    onDateRangeChange(getThisWeekRange());
  };

  const handlePreset = (getRange: () => { from: Date | null; to: Date | null }) => {
    const range = getRange();
    onDateRangeChange(range.from ? { from: range.from, to: range.to || undefined } : undefined);
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
      {/* Trigger Button */}
      <Drawer.Trigger asChild>
        <Button
          variant="outline"
          size="touch"
          className={cn(
            "md:hidden relative",  // Only show on mobile
            activeFiltersCount > 0 && "border-[#28a745]"
          )}
        >
          <Sliders className="w-5 h-5 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="kick-solid"
              className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </Drawer.Trigger>

      {/* Bottom Sheet */}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60" />
        <Drawer.Content className={cn(
          "bg-[#111] border-t-2 border-[#333]",
          "flex flex-col rounded-t-xl",
          "h-[85vh] mt-24",
          "fixed bottom-0 left-0 right-0 z-50"
        )}>
          {/* Handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-[#444] mt-4" />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333]">
            <Drawer.Title className="text-xl font-semibold">
              Filter VODs
            </Drawer.Title>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-6">
            {/* Quick Presets */}
            <div>
              <label className="block text-sm font-medium mb-3 text-[#ccc]">
                Quick Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map(({ label, getValue }) => (
                  <Button
                    key={label}
                    variant="outline"
                    onClick={() => handlePreset(getValue)}
                    className="h-12"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Platform Filter */}
            <div>
              <label className="block text-sm font-medium mb-3 text-[#ccc]">
                Platform
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['both', 'kick', 'twitch'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={platform === p ? 'default' : 'outline'}
                    onClick={() => onPlatformChange(p)}
                    className={cn(
                      "h-12 capitalize",
                      platform === p && p === 'kick' && "bg-[#28a745] hover:bg-[#28a745]/90",
                      platform === p && p === 'twitch' && "bg-[#6441A5] hover:bg-[#6441A5]/90"
                    )}
                  >
                    {p === 'both' ? 'All' : p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div>
              <label className="block text-sm font-medium mb-3 text-[#ccc]">
                Custom Date Range
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-[#333] flex gap-3 pb-safe">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-12"
            >
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 h-12 bg-[#28a745] hover:bg-[#28a745]/90"
            >
              Apply Filters
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**Desktop: Inline Filters (Enhanced)**
```tsx
// app/vod-diary/page.tsx
<div className="flex flex-wrap gap-4 justify-end items-center">
  {/* Mobile: Filter button opens sheet */}
  <FilterSheet
    platform={platform}
    onPlatformChange={handlePlatformChange}
    dateRange={dateRange}
    onDateRangeChange={handleDateRangeChange}
  />

  {/* Desktop: Inline filters */}
  <div className="hidden md:flex gap-4 items-center">
    {/* Quick preset tabs */}
    <div className="flex gap-1 border border-[#333] rounded-lg p-1 bg-[#0a0a0a]">
      {presets.map(({ label, getValue }) => (
        <Button
          key={label}
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(getValue)}
          className="text-xs"
        >
          {label}
        </Button>
      ))}
    </div>

    <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
    <PlatformSlider value={platform} onChange={handlePlatformChange} />
  </div>

  {/* Search (both mobile and desktop) */}
  <SearchInput onSearch={handleSearch} />
</div>
```

### Key Changes
1. **Bottom sheet on mobile** - Easier to reach and use
2. **Quick presets** - One-tap date ranges
3. **Active filter indicator** - Badge shows filter count
4. **Larger buttons** - 48px height on mobile
5. **Platform-specific colors** - Kick green, Twitch purple
6. **Reset button** - Clear all filters easily

---

## Video Player

**File:** `components/video/VidstackPlayer.tsx`
**Priority:** MEDIUM
**Effort:** 6-10 hours

### Current Issues
- Opens in new tab (breaks flow)
- No mobile-specific controls
- No gesture support

### Design Goals
- Gesture-based controls (swipe to scrub)
- Auto-hide controls
- Mobile-optimized UI
- Picture-in-picture support

### Enhancements

```tsx
// components/video/VidstackPlayer.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useSwipeable } from 'react-swipeable';
import { cn } from '@/lib/utils';

interface VidstackPlayerProps {
  url: string;
  subtitleUrl?: string;
}

export function VidstackPlayer({ url, subtitleUrl }: VidstackPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout>();

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls]);

  // Gesture handlers for mobile
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      // Skip forward 10 seconds
      const player = playerRef.current?.querySelector('media-player');
      if (player && player.currentTime !== undefined) {
        player.currentTime += 10;
        showSkipIndicator('+10s');
      }
    },
    onSwipedRight: () => {
      // Skip backward 10 seconds
      const player = playerRef.current?.querySelector('media-player');
      if (player && player.currentTime !== undefined) {
        player.currentTime -= 10;
        showSkipIndicator('-10s');
      }
    },
    onSwipedDown: () => {
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    },
    onTap: () => {
      // Show controls temporarily
      setShowControls(true);
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: false, // Mobile only
  });

  const showSkipIndicator = (text: string) => {
    // Show visual feedback for skip
    // Implementation left as exercise
  };

  return (
    <div
      ref={playerRef}
      {...handlers}
      className={cn(
        'relative w-full',
        'aspect-video',
        'bg-black rounded-lg overflow-hidden',
        'shadow-2xl'
      )}
    >
      <MediaPlayer
        src={url}
        crossorigin
        playsInline  // Important for iOS
        className="w-full h-full"
        onTimeUpdate={(time) => setCurrentTime(time)}
      >
        <MediaProvider />

        {/* Subtitles */}
        {subtitleUrl && (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default
          />
        )}

        {/* Custom mobile-optimized layout */}
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          // Larger touch targets on mobile
          className={cn(
            'media-controls',
            showControls ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-300'
          )}
        />

        {/* Skip indicator (mobile) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none md:hidden">
          {/* Show +10s or -10s animation here */}
        </div>
      </MediaPlayer>

      {/* Mobile hint overlay (first time only) */}
      <MobilePlayerHint />
    </div>
  );
}

// First-time hint for mobile gestures
function MobilePlayerHint() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem('playerHintSeen');
    if (!hasSeenHint) {
      setShowHint(true);
      setTimeout(() => {
        setShowHint(false);
        localStorage.setItem('playerHintSeen', 'true');
      }, 5000);
    }
  }, []);

  if (!showHint) return null;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 md:hidden">
      <div className="text-center p-6 max-w-sm">
        <h3 className="text-lg font-semibold mb-3">Player Controls</h3>
        <div className="space-y-2 text-sm text-[#ccc]">
          <p>↔️ Swipe left/right to skip 10s</p>
          <p>↕️ Swipe down to exit fullscreen</p>
          <p>👆 Tap to show controls</p>
        </div>
        <Button
          onClick={() => setShowHint(false)}
          className="mt-4"
          size="sm"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
```

### Key Changes
1. **Gesture support** - Swipe to skip, tap to show controls
2. **Auto-hide controls** - Better immersion
3. **Mobile hint** - One-time overlay explaining gestures
4. **Picture-in-picture** - Continue watching while browsing
5. **Responsive layout** - Adapts to screen size

---

## New Components to Create

### 1. FloatingActionButton (FAB)

**Purpose:** Quick access to primary action on mobile
**File:** `components/ui/FloatingActionButton.tsx`
**Priority:** MEDIUM

```tsx
'use client';

import { Plus } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface FABProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center';
}

export function FloatingActionButton({
  icon = <Plus />,
  label,
  onClick,
  position = 'bottom-right',
}: FABProps) {
  return (
    <Button
      onClick={onClick}
      size="icon-lg"
      className={cn(
        'fixed z-40',
        'w-14 h-14 rounded-full',
        'bg-[#28a745] hover:bg-[#28a745]/90',
        'shadow-lg hover:shadow-xl',
        'transition-all duration-200',
        'md:hidden',  // Only show on mobile
        position === 'bottom-right' && 'bottom-20 right-4',
        position === 'bottom-center' && 'bottom-20 left-1/2 -translate-x-1/2'
      )}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
```

**Usage:**
```tsx
// app/vod-diary/page.tsx
<FloatingActionButton
  icon={<Search />}
  label="Open search"
  onClick={openSearch}
/>
```

---

This component guide provides concrete examples for refactoring each major component. Each section includes:
- Current issues
- Design goals inspired by parasoci.al, YouTube, and Netflix
- Before/after code comparisons
- Key changes summary
- New utilities needed

**Next:** Refer to `MOBILE_FIRST_IMPLEMENTATION_PLAN.md` for step-by-step implementation sequence.
