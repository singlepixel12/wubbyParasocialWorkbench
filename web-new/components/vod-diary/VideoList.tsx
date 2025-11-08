'use client';

/**
 * VideoList Component
 * Container for rendering a list of video cards
 * Handles loading and empty states
 * Ported from: vod-diary.html #video-list
 */

import { Video } from '@/types/video';
import { VideoCard } from './VideoCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface VideoListProps {
  videos: Video[];
  loading?: boolean;
  isSearchMode?: boolean;
  onVideoClick?: (video: Video) => void;
}

export function VideoList({
  videos,
  loading = false,
  isSearchMode = false,
  onVideoClick,
}: VideoListProps) {
  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner size="md" message="Loading videos..." />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[#777]">
          {isSearchMode
            ? 'No videos found matching your search.'
            : 'No videos found.'}
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
}
