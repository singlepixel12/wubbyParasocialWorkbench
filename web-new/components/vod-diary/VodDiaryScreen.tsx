'use client';

/**
 * VodDiaryScreen
 * The single source of truth for the VOD Diary browse experience.
 * Rendered by both `/` (landing) and `/vod-diary` so the two routes can never drift.
 * Editorial masthead + date/search filters + staggered VideoList.
 */

import { useState, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { Video } from '@/types/video';
import { DateRangePicker } from '@/components/vod-diary/DateRangePicker';
import { SearchInput } from '@/components/vod-diary/SearchInput';
import { VideoList } from '@/components/vod-diary/VideoList';
import { Masthead } from '@/components/layout/Masthead';
import { fetchRecentVideos, searchVideos } from '@/lib/api/supabase';
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

  // Fetch videos based on current filters
  const loadVideos = useCallback(async () => {
    setLoading(true);

    try {
      let results: Video[];

      if (isSearchMode && searchTerm) {
        // Search mode
        logger.log('Searching videos:', searchTerm);
        results = await searchVideos({ searchTerm, limit: 200 });
      } else {
        // Normal filter mode (both platforms)
        logger.log('Fetching recent videos:', { dateRange });

        results = await fetchRecentVideos({
          limit: 50,
          fromDate: dateRange?.from || null,
          toDate: dateRange?.to || null,
        });
      }

      setVideos(results);
      logger.log(`✅ Loaded ${results.length} videos`);
    } catch (error) {
      logger.error('Error loading videos:', error);
      showError('Failed to load videos. Please try again.', {
        action: {
          label: 'Retry',
          onClick: () => {
            logger.log('Retrying video load...');
            loadVideos();
          },
        },
      });
      // Don't clear videos on error - keep showing previous results
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, searchTerm, isSearchMode]);

  // Load videos on mount and when filters change
  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

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
