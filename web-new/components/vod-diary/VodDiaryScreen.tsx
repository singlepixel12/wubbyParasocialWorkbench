'use client';

/**
 * VodDiaryScreen
 * The single source of truth for the VOD Diary browse experience.
 * Rendered at `/` (the legacy `/vod-diary` route redirects there).
 * Editorial masthead + date/search filters + staggered VideoList.
 *
 * The URL is the source of truth for the filters, so a refresh keeps them and a
 * link shares them:  `/?q=cooking`  ·  `/?from=2026-09-01&to=2026-09-30`
 * No `from` means the default "This Week". Search keystrokes `replace` the URL
 * (typing never floods history); a completed date range `push`es (Back undoes it).
 *
 * `useSearchParams` requires a <Suspense> boundary under `output: 'export'` —
 * see app/page.tsx.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Video } from '@/types/video';
import { DateRangePicker } from '@/components/vod-diary/DateRangePicker';
import { SearchInput } from '@/components/vod-diary/SearchInput';
import { VideoList } from '@/components/vod-diary/VideoList';
import { Masthead } from '@/components/layout/Masthead';
import { fetchRecentVideos, searchVideos, isAbortError } from '@/lib/api/supabase';
import { getThisWeekRange } from '@/lib/utils/video-helpers';
import { formatDayParam, parseDayParam } from '@/lib/utils/date-range';
import { useToast } from '@/lib/hooks/useToast';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

/** Short "12 Nov" style label for the masthead date range. */
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function VodDiaryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Client-only rendering flag (prevents SSR hydration issues with Radix UI Popover)
  const [isMounted, setIsMounted] = useState(false);

  // Filters — derived from the URL, never mirrored into state
  const qParam = searchParams.get('q') ?? '';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const searchTerm = qParam.trim();
  const isSearchMode = searchTerm.length > 0;

  const dateRange = useMemo<DateRange>(() => {
    const from = parseDayParam(fromParam);
    if (!from) return getThisWeekRange();
    const to = parseDayParam(toParam);
    return { from, to: to && to >= from ? to : undefined };
  }, [fromParam, toParam]);

  // Opening a shared `?q=` link shows the search box with the term in it
  const [isSearchVisible, setIsSearchVisible] = useState(() => qParam.length > 0);

  // Data states
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);

  const { showError } = useToast();

  // Set mounted flag after client-side hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Bumped by the error toast's Retry to re-run the load with the *current* filters
  const [reloadToken, setReloadToken] = useState(0);

  // Load videos on mount and whenever the filters change. Each run owns an
  // AbortController and the cleanup aborts it, so a slow, superseded response
  // (e.g. a search for "co" landing after one for "cooking") can never
  // overwrite the results of the newer query.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      setLoading(true);

      try {
        let results: Video[];

        if (isSearchMode) {
          logger.log('Searching videos:', searchTerm);
          results = await searchVideos({ searchTerm, limit: 200, signal });
        } else {
          // Normal filter mode (both platforms)
          logger.log('Fetching recent videos:', { dateRange });
          results = await fetchRecentVideos({
            limit: 50,
            fromDate: dateRange.from || null,
            toDate: dateRange.to || null,
            signal,
          });
        }

        // Belt and braces: never render a superseded result, even if it resolved
        if (signal.aborted) return;
        setVideos(results);
        logger.log(`✅ Loaded ${results.length} videos`);
      } catch (error) {
        // Superseded by a newer query — not a failure, and the newer run owns the UI
        if (isAbortError(error)) return;

        logger.error('Error loading videos:', error);
        showError('Failed to load videos. Please try again.', {
          action: {
            label: 'Retry',
            onClick: () => {
              logger.log('Retrying video load...');
              setReloadToken((n) => n + 1);
            },
          },
        });
        // Don't clear videos on error - keep showing previous results
      } finally {
        // Only the live run may clear the loading state; an aborted run's
        // successor has already set it
        if (!signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [dateRange, searchTerm, isSearchMode, reloadToken, showError]);

  /**
   * Writes filter changes into the URL. Reads the *live* query string rather than
   * the `searchParams` snapshot so these callbacks stay stable across URL changes
   * (SearchInput re-fires onSearch whenever its identity changes). No-ops when
   * nothing changed, so re-sent identical values never touch history.
   */
  const updateParams = useCallback(
    (changes: Record<string, string | null>, mode: 'push' | 'replace') => {
      const current = new URLSearchParams(window.location.search);
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (next.toString() === current.toString()) return;

      const query = next.toString();
      router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  // Handle search input changes (already debounced by SearchInput)
  const handleSearch = useCallback(
    (term: string) => {
      updateParams({ q: term.trim() || null }, 'replace');
    },
    [updateParams]
  );

  // Handle date range change. A half-picked range (from only) replaces, so only
  // completed ranges become history entries; clearing returns to "This Week".
  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      updateParams(
        {
          from: range?.from ? formatDayParam(range.from) : null,
          to: range?.to ? formatDayParam(range.to) : null,
        },
        range?.from && range.to ? 'push' : 'replace'
      );
    },
    [updateParams]
  );

  // Human-readable date-range label for the masthead meta line
  const dateLabel = dateRange.from
    ? dateRange.to
      ? `${formatDateLabel(dateRange.from)} – ${formatDateLabel(dateRange.to)}`
      : formatDateLabel(dateRange.from)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Editorial masthead */}
      <Masthead edition="VOD Diary" count={videos.length} dateLabel={dateLabel} />

      {/* Filters section */}
      <div className={cn(
        "flex gap-4 items-center",
        isSearchVisible ? "w-screen -mx-4 px-4 md:w-full md:mx-0 md:px-0" : "justify-end"
      )}>
        {/* Date Range Picker - Hide entire div when search is visible */}
        {!isSearchVisible && (
          <div className="flex-1 md:flex-none md:w-[280px]">
            {isMounted ? (
              <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
            ) : (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            )}
          </div>
        )}

        {/* Search - Full width when visible */}
        <SearchInput
          onSearch={handleSearch}
          initialValue={qParam}
          isVisible={isSearchVisible}
          onToggle={setIsSearchVisible}
          className={isSearchVisible ? 'flex-1 w-full' : ''}
        />
      </div>

      {/* Video list */}
      <VideoList
        videos={videos}
        loading={loading}
        isSearchMode={isSearchMode}
      />
    </div>
  );
}
