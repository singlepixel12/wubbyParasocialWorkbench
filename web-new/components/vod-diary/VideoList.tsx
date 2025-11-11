'use client';

/**
 * VideoList Component
 * Container for rendering a list of video cards
 * Handles loading and empty states with skeleton placeholders
 * Optimized with React.memo to prevent unnecessary re-renders
 * Ported from: vod-diary.html #video-list
 */

import { memo } from 'react';
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
  if (loading) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {/* Show 3 skeleton cards while loading */}
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
      </div>
    );
  }

  if (videos.length === 0) {
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
