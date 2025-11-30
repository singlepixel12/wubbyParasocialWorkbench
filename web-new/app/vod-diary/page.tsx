'use client';

/**
 * VOD Diary Page
 * Displays a filterable list of recent VODs with platform, date, and search filtering
 * Ported from: vod-diary.html
 */

import { useState, useEffect, useCallback } from 'react';
import type { Metadata } from 'next';
import { DateRange } from 'react-day-picker';
import { Video } from '@/types/video';
import { Platform } from '@/components/vod-diary/PlatformSlider';
import { DateRangePicker } from '@/components/vod-diary/DateRangePicker';
import { PlatformSlider } from '@/components/vod-diary/PlatformSlider';
import { SearchInput } from '@/components/vod-diary/SearchInput';
import { VideoList } from '@/components/vod-diary/VideoList';
import { PageHeader } from '@/components/layout/PageHeader';
import { fetchRecentVideos, searchVideos } from '@/lib/api/supabase';
import { getThisWeekRange } from '@/lib/utils/video-helpers';
import { useToast } from '@/lib/hooks/useToast';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

export default function VodDiaryPage() {
  // Client-only rendering flag (prevents SSR hydration issues with Radix UI Popover)
  const [isMounted, setIsMounted] = useState(false);

  // Filter states
  const [platform, setPlatform] = useState<Platform>('both');
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

  const { showError, showWarning } = useToast();

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
        // Normal filter mode
        logger.log('Fetching recent videos:', {
          platform,
          dateRange,
        });

        results = await fetchRecentVideos({
          limit: 50,
          platform: platform as Platform,
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
  }, [platform, dateRange, searchTerm, isSearchMode]);

  // Load videos on mount and when filters change
  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Handle search input changes
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setIsSearchMode(term.trim().length > 0);
  }, []);

  // Handle platform change
  const handlePlatformChange = useCallback((newPlatform: Platform) => {
    setPlatform(newPlatform);
  }, []);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="VOD Diary"
        description="Browse and filter Wubby VODs by platform, date range, and search terms."
      />

      {/* Filters section */}
      <div className="flex flex-col gap-4">
        {/* Mobile: Platform centered | Desktop: hidden (will show inline below) */}
        <div className="flex justify-center md:hidden">
          {!isSearchVisible && (
            <PlatformSlider value={platform} onChange={handlePlatformChange} />
          )}
        </div>

        {/* All filters in one row - Platform left, Date+Search right | Search full-width when open */}
        <div className={cn(
          "flex items-center",
          isSearchVisible ? "" : "gap-4 md:justify-between"
        )}>
          {/* Platform - Desktop only (left side) */}
          {!isSearchVisible && (
            <div className="hidden md:block w-[180px] flex-shrink-0">
              <PlatformSlider value={platform} onChange={handlePlatformChange} />
            </div>
          )}

          {/* Date + Search group (right side on desktop) | Full width when search open */}
          <div className={cn(
            "flex gap-4 items-center",
            isSearchVisible ? "w-screen -mx-4 px-4 md:w-full md:mx-0 md:px-0" : "flex-1 md:flex-none md:justify-end"
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
        </div>
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
