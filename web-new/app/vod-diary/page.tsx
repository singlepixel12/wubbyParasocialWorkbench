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
          platform: platform as any,
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
      <div className="flex flex-wrap gap-4 justify-end items-center">
        {/* Date Range Picker - Only render on client to avoid SSR issues with Radix Popover */}
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          {isMounted ? (
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          ) : (
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          )}
        </div>

        {/* Platform Slider */}
        <PlatformSlider value={platform} onChange={handlePlatformChange} />

        {/* Search Toggle and Input */}
        <SearchInput onSearch={handleSearch} />
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
