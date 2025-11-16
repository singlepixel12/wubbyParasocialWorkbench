'use client';

/**
 * VideoCard Component
 * Scannable browse card showing 1-2 line hook (Two-Tier UX)
 * Clicking card navigates to /watch?id=hash for full detail view
 * Optimized with React.memo to prevent unnecessary re-renders
 * Updated: Week 0-1 Two-Tier UX implementation
 */

import { memo } from 'react';
import Link from 'next/link';
import { Play, Tag, FileText } from 'lucide-react';
import { Video } from '@/types/video';
import { formatDateDisplay, extractOriginalTitle, extractHook } from '@/lib/utils/video-helpers';
import { Badge } from '@/components/ui/badge';
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
  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);

  // Extract 1-2 line hook for scannable browse view
  const hook = extractHook(video.summary || '', 120);

  // IMPORTANT: Only use videoHash for routing (never URL - breaks Supabase calls)
  const videoHash = video.videoHash;

  // If no hash, card won't be clickable (shouldn't happen with DB videos)
  if (!videoHash) {
    console.warn('Video missing videoHash:', video.url);
  }

  const handleThumbnailClick = (e: React.MouseEvent) => {
    // Prevent card navigation when clicking thumbnail
    e.preventDefault();
    e.stopPropagation();

    // Store video URL in localStorage for player page
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedVideoUrl', video.url);
    }

    // Open player in new tab
    window.open('/player', '_blank');
    onCardClick?.(video);
  };

  // Render as link only if hash exists, otherwise as div
  const cardContent = (
    <div
      className={cn(
        'flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 min-h-[180px] relative overflow-hidden cursor-pointer transition-all duration-200',
        videoHash && 'group-hover:bg-[#1a1a1a] group-hover:border-[#444]'
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
        <div
          onClick={handleThumbnailClick}
          className="group/thumb block flex-shrink-0 cursor-pointer"
          aria-label={`Play ${video.title}`}
        >
          <div className="relative w-40 h-full min-h-[90px] bg-black rounded overflow-hidden">
            {/* Placeholder thumbnail (black box) */}
            <div className="absolute inset-0 bg-black" />

            {/* Play button overlay with platform-specific glow */}
            <div className="absolute inset-0 flex items-center justify-center opacity-80 transition-all duration-300 group-hover/thumb:opacity-100">
              <div
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-300 group-hover/thumb:scale-110 animate-[playButtonPulse_2s_ease-in-out_infinite] group-hover/thumb:animate-none',
                  'bg-gradient-to-br from-black/90 to-black/70',
                  // Platform-specific gradient and glow
                  video.platform === 'kick'
                    ? 'group-hover/thumb:from-[#28a745]/95 group-hover/thumb:to-[#28a745]/80 group-hover/thumb:shadow-[0_0_20px_rgba(40,167,69,0.8)]'
                    : video.platform === 'twitch'
                    ? 'group-hover/thumb:from-[#6441A5]/95 group-hover/thumb:to-[#6441A5]/80 group-hover/thumb:shadow-[0_0_20px_rgba(100,65,165,0.8)]'
                    : 'group-hover/thumb:from-[#28a745]/95 group-hover/thumb:to-[#28a745]/80 group-hover/thumb:shadow-[0_0_20px_rgba(40,167,69,0.8)]'
                )}
              >
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tag count badge (top right of content area) */}
          {video.tags && video.tags.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-[#6441A5] text-[#6441A5] text-xs">
                {video.tags.length} tags
              </Badge>
            </div>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{video.title}</h3>

          {/* Original title from URL (secondary) with icon */}
          {originalTitle && (
            <div className="flex items-start gap-1.5 mb-2">
              <FileText className="w-3 h-3 text-[#666] flex-shrink-0 mt-0.5" />
              <h4 className="text-xs text-[#888] font-mono line-clamp-1 flex-1">{originalTitle}</h4>
            </div>
          )}

          {/* Metadata inline */}
          <div className="flex items-center gap-2 text-xs text-[#888] mb-2 flex-wrap">
            {formattedDate && <span>{formattedDate}</span>}
          </div>

          {/* 🎯 HOOK: 1-2 line summary with green accent */}
          <div className={cn(
            'mb-2 p-2.5 rounded',
            'bg-gradient-to-r from-[#28a745]/10 to-transparent',
            'border-l-2 border-[#28a745]'
          )}>
            <p className="text-sm text-[#ccc] leading-relaxed line-clamp-2">
              {hook}
            </p>
          </div>

          {/* Tag preview (6 tags) + Read more */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex gap-1.5 flex-wrap flex-1">
              {video.tags
                ?.filter((tag) => tag !== video.platform)
                .slice(0, 6)
                .map((tag, index) => (
                  <Badge
                    key={index}
                    variant="tag"
                    className="text-xs cursor-pointer hover:bg-[#28a745] hover:text-white hover:border-[#28a745] transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // TODO: Implement tag search
                      console.log('Search for tag:', tag);
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              {video.tags && video.tags.filter(t => t !== video.platform).length > 6 && (
                <span className="text-xs text-[#666]">+{video.tags.filter(t => t !== video.platform).length - 6}</span>
              )}
            </div>

            {/* Read more CTA */}
            <span className="text-xs font-medium text-[#28a745] group-hover:text-white transition-colors ml-3 flex-shrink-0">
              Read more →
            </span>
          </div>
        </div>
    </div>
  );

  // Wrap with Link if hash exists, otherwise return plain div
  // Build the card content
  return videoHash ? (
    <Link href={`/watch?id=${videoHash}`} className="block group">
      {cardContent}
    </Link>
  ) : (
    cardContent
  );
});
