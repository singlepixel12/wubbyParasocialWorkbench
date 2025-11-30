'use client';

/**
 * VideoList Component
 * Container for rendering a list of video cards
 * Handles loading and empty states with skeleton placeholders
 * Optimized with React.memo to prevent unnecessary re-renders
 * Adds 2-second delay before showing "No Videos Found" for better UX
 * Ported from: vod-diary.html #video-list
 */

import { memo, useState, useEffect, useRef } from 'react';
import { Video } from '@/types/video';
import { VideoCard } from './VideoCard';
import { SkeletonVideoCard } from './SkeletonVideoCard';
import { Search, Film } from 'lucide-react';

interface VideoListProps {
  videos: Video[];
  loading?: boolean;
  isSearchMode?: boolean;
  onVideoClick?: (video: Video) => void;
}

export const VideoList = memo(function VideoList({
  videos,
  loading = false,
  isSearchMode = false,
  onVideoClick,
}: VideoListProps) {
  // Track if delay has elapsed for empty state
  const [delayElapsed, setDelayElapsed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if empty state conditions are met
  const shouldShowEmpty = !loading && videos.length === 0;

  // Add delay before showing "No Videos Found" (2 seconds)
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (shouldShowEmpty) {
      timerRef.current = setTimeout(() => {
        setDelayElapsed(true);
      }, 2000);
    } else {
      // Reset immediately when we have videos - this is intentional
      // to prevent stale empty state from showing
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelayElapsed(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [shouldShowEmpty]);

  // Derive showEmptyState from both conditions
  const showEmptyState = shouldShowEmpty && delayElapsed;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {/* Show 5 skeleton cards while loading (better mobile UX) */}
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
      </div>
    );
  }

  // Show skeletons during the 2-second delay (don't flash empty state immediately)
  if (videos.length === 0 && !showEmptyState) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
      </div>
    );
  }

  if (videos.length === 0 && showEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="rounded-full bg-muted p-6 mb-4">
          {isSearchMode ? (
            <Search className="w-12 h-12 text-muted-foreground" />
          ) : (
            <Film className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isSearchMode ? 'No results found' : 'No videos available'}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {isSearchMode
            ? 'Try adjusting your search terms or filters to find more videos.'
            : 'No videos found for the selected date range and filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {videos.map((video, index) => (
        <VideoCard
          key={`${video.url}-${index}`}
          video={video}
          onCardClick={onVideoClick}
        />
      ))}
    </div>
  );
});
