'use client';

/**
 * VodDiaryScreen
 * The single source of truth for the VOD Diary browse experience.
 * Rendered at `/` (the legacy `/vod-diary` route redirects there).
 * Editorial masthead + date/search filters + staggered VideoList.
 */

import { useState, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { Video } from '@/types/video';
import { DateRangePicker } from '@/components/vod-diary/DateRangePicker';
import { SearchInput } from '@/components/vod-diary/SearchInput';
import { VideoList } from '@/components/vod-diary/VideoList';
import { Masthead } from '@/components/layout/Masthead';
import { fetchRecentVideos, searchVideos, isAbortError } from '@/lib/api/supabase';
import { getThisWeekRange } from '@/lib/utils/video-helpers';
import { useToast } from '@/lib/hooks/useToast';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

/** Short "12 Nov" style label for the masthead date range. */
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function VodDiaryScreen() {
  // Client-only rendering flag (prevents SSR hydration issues with Radix UI Popover)
  const [isMounted, setIsMounted] = useState(false);

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const { from, to } = getThisWeekRange();
    return { from, to };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Data states
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

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

        if (isSearchMode && searchTerm) {
          logger.log('Searching videos:', searchTerm);
          results = await searchVideos({ searchTerm, limit: 200, signal });
        } else {
          // Normal filter mode (both platforms)
          logger.log('Fetching recent videos:', { dateRange });
          results = await fetchRecentVideos({
            limit: 50,
            fromDate: dateRange?.from || null,
            toDate: dateRange?.to || null,
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

  // Handle search input changes
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setIsSearchMode(term.trim().length > 0);
  }, []);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
  }, []);

  // Human-readable date-range label for the masthead meta line
  const dateLabel = dateRange?.from
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
