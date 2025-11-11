'use client';

/**
 * VideoCard Component
 * Expandable video card with thumbnail, metadata, and tags
 * Uses shadcn Collapsible for accessible expand/collapse
 * Optimized with React.memo to prevent unnecessary re-renders
 * Ported from: src/vodDiary.js createVideoCard()
 */

import { useState, memo } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Video } from '@/types/video';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Get solid Badge variant for platform
 * @param platform - Platform name
 * @returns Solid badge variant name
 */
function getSolidBadgeVariant(platform: string): 'kick-solid' | 'twitch-solid' | 'tag-solid' {
  const normalized = platform.toLowerCase();
  if (normalized === 'kick') return 'kick-solid';
  if (normalized === 'twitch') return 'twitch-solid';
  return 'tag-solid';
}

interface VideoCardProps {
  video: Video;
  onCardClick?: (video: Video) => void;
}

export const VideoCard = memo(function VideoCard({ video, onCardClick }: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleThumbnailClick = (e: React.MouseEvent) => {
    // Prevent card expansion when clicking thumbnail
    e.stopPropagation();

    // Store video URL in localStorage for player page
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedVideoUrl', video.url);
    }
    onCardClick?.(video);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        onClick={handleCardClick}
        className={cn(
          'flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 pb-10 min-h-[180px] relative overflow-hidden cursor-pointer',
          isExpanded && 'expanded'
        )}
      >
      {/* Platform tag (top right) */}
      <Badge
        variant={getSolidBadgeVariant(video.platform)}
        className="absolute top-3 right-3 font-semibold z-10 px-3 py-1"
      >
        {video.platform}
      </Badge>

      {/* Thumbnail with play button */}
      <Link
        href="/player"
        target="_blank"
        onClick={handleThumbnailClick}
        className="group block flex-shrink-0"
        aria-label={`Play ${video.title}`}
      >
        <div className="relative w-40 h-full min-h-[90px] bg-black rounded overflow-hidden">
          {/* Placeholder thumbnail (black box) */}
          <div className="absolute inset-0 bg-black" />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-80 transition-all duration-300 group-hover:opacity-100">
            <div
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-300 group-hover:scale-110 animate-[playButtonPulse_2s_ease-in-out_infinite] group-hover:animate-none',
                'bg-gradient-to-br from-black/90 to-black/70',
                video.platform === 'kick'
                  ? 'group-hover:from-[#28a745]/95 group-hover:to-[#28a745]/80'
                  : video.platform === 'twitch'
                  ? 'group-hover:from-[#6441A5]/95 group-hover:to-[#6441A5]/80'
                  : 'group-hover:from-[#28a745]/95 group-hover:to-[#28a745]/80'
              )}
            >
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
      </Link>

      {/* Info section */}
      <div className="flex-1 flex flex-col">
        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-1">{video.title}</h3>

        {/* Original title from URL */}
        {originalTitle && (
          <h4 className="text-sm text-[#999] mb-2">{originalTitle}</h4>
        )}

        {/* Upload date */}
        {formattedDate && (
          <span className="text-sm text-[#777] mb-2">{formattedDate}</span>
        )}

        {/* Summary - clamped to 2 lines when collapsed */}
        <p
          className={cn(
            'mt-2 text-sm text-[#ccc]',
            !isExpanded && 'line-clamp-2'
          )}
        >
          {video.summary}
        </p>

        {/* Tags - shown in collapsible section when expanded */}
        <CollapsibleContent className="CollapsibleContent">
          <div className="flex flex-wrap gap-2 mt-3">
            {video.tags
              .filter((tag) => tag !== video.platform) // Don't duplicate platform tag
              .map((tag, index) => (
                <span
                  key={index}
                  className={cn(
                    'inline-block px-3 py-1 rounded-full text-xs font-medium',
                    tag === 'kick'
                      ? 'bg-[#1e7e34] text-white'
                      : tag === 'twitch'
                      ? 'bg-[#6441A5] text-white'
                      : 'bg-[#666] text-white'
                  )}
                >
                  {tag}
                </span>
              ))}
          </div>
        </CollapsibleContent>
      </div>

      {/* Expand/Collapse button */}
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-[#888] hover:text-[#aaa] hover:bg-[#222]"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
        </Button>
      </CollapsibleTrigger>
      </div>
    </Collapsible>
  );
});
