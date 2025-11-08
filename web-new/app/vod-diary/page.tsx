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

export default function VodDiaryPage() {
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

  // Fetch videos based on current filters
  const loadVideos = useCallback(async () => {
    setLoading(true);

    try {
      let results: Video[];

      if (isSearchMode && searchTerm) {
        // Search mode
        console.log('Searching videos:', searchTerm);
        results = await searchVideos({ searchTerm, limit: 200 });
      } else {
        // Normal filter mode
        console.log('Fetching recent videos:', {
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
      console.log(`✅ Loaded ${results.length} videos`);
    } catch (error) {
      console.error('Error loading videos:', error);
      showError('Failed to load videos. Please try again.');
      // Don't clear videos on error - keep showing previous results
    } finally {
      setLoading(false);
    }
  }, [platform, dateRange, searchTerm, isSearchMode, showError]);

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
        {/* Date Range Picker */}
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
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
