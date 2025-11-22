'use client';

/**
 * VideoList Component
 * Container for rendering a list of video cards
 * Handles loading and empty states with skeleton placeholders
 * Optimized with React.memo to prevent unnecessary re-renders
 * Adds 2-second delay before showing "No Videos Found" for better UX
 * Ported from: vod-diary.html #video-list
 */

import { memo, useState, useEffect } from 'react';
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
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Add delay before showing "No Videos Found" (2 seconds)
  useEffect(() => {
    if (!loading && videos.length === 0) {
      const timer = setTimeout(() => {
        setShowEmptyState(true);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setShowEmptyState(false);
    }
  }, [loading, videos.length]);

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
