'use client';

/**
 * VideoCard Component
 * Scannable browse card showing 1-2 line hook with expandable full summary
 * Clicking "Read more" expands the card to show full summary in-place
 * Optimized with React.memo to prevent unnecessary re-renders
 * Updated: Expandable summary view
 */

import { memo, useState } from 'react';
import { Play, FileText, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Extract 1-2 line hook for scannable browse view
  const hook = extractHook(video.summary || '', 120);

  // IMPORTANT: Only use videoHash for routing (never URL - breaks Supabase calls)
  const videoHash = video.videoHash;

  // If no hash, card won't be clickable (shouldn't happen with DB videos)
  if (!videoHash) {
    console.warn('Video missing videoHash:', video.url);
  }

  const handleThumbnailClick = (e: React.MouseEvent) => {
    // Prevent card expansion when clicking thumbnail
    e.preventDefault();
    e.stopPropagation();

    // Navigate to watch page with video hash (include basePath for GitHub Pages)
    if (videoHash) {
      const basePath = process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '/wubbyParasocialWorkbench';
      window.open(`${basePath}/watch?id=${videoHash}`, '_blank');
      onCardClick?.(video);
    }
  };

  const cardContent = (
    <div
      className={cn(
        'flex flex-col md:flex-row gap-4 bg-[#111] border border-[#333] rounded-lg p-4 relative overflow-hidden transition-all duration-200',
        'hover:bg-[#1a1a1a] hover:border-[#444]',
        // Platform-specific glow on hover
        video.platform === 'kick' && 'hover:shadow-[0_0_20px_rgba(40,167,69,0.3)]',
        video.platform === 'twitch' && 'hover:shadow-[0_0_20px_rgba(100,65,165,0.3)]'
      )}
    >
        {/* Thumbnail with play button */}
        <div
          onClick={handleThumbnailClick}
          className="group/thumb block flex-shrink-0 cursor-pointer w-full md:w-40"
          aria-label={`Play ${video.title}`}
        >
          <div className="relative w-full md:w-40 h-48 md:h-full md:min-h-[90px] bg-black rounded overflow-hidden">
            {/* Thumbnail image (with fallback to black box) */}
            {video.thumbnailUrl && !thumbnailError ? (
              <img
                src={video.thumbnailUrl}
                alt={`Thumbnail for ${video.title}`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setThumbnailError(true)}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}

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
          {/* Platform badge */}
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={getSolidBadgeVariant(video.platform)}
              className="font-semibold px-3 py-1"
            >
              {video.platform}
            </Badge>
          </div>

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
          <div className="flex items-center gap-1.5 text-xs text-[#888] mb-2 flex-wrap">
            {formattedDate && (
              <>
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>{formattedDate}</span>
              </>
            )}
          </div>

          {/* 🎯 SUMMARY: Expandable with hook preview */}
          <div className={cn(
            'mb-2 p-2.5 rounded',
            'bg-gradient-to-r from-[#28a745]/10 to-transparent',
            'border-l-2 border-[#28a745]'
          )}>
            <p className={cn(
              'text-sm text-[#ccc] leading-relaxed',
              !isExpanded && 'line-clamp-2'
            )}>
              {isExpanded ? (video.summary || 'No summary available for this video.') : hook}
            </p>
          </div>

          {/* Tag preview (3 tags on mobile, 6 on desktop) */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {/* Mobile: show 3 tags */}
            <div className="flex gap-1.5 flex-wrap md:hidden">
              {video.tags
                ?.filter((tag) => tag !== video.platform)
                .slice(0, 3)
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
              {video.tags && video.tags.filter(t => t !== video.platform).length > 3 && (
                <span className="text-xs text-[#666]">+{video.tags.filter(t => t !== video.platform).length - 3}</span>
              )}
            </div>

            {/* Desktop: show 6 tags */}
            <div className="hidden md:flex gap-1.5 flex-wrap">
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
          </div>

          {/* Read more/Show less toggle at bottom */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="w-full py-2 text-xs font-medium text-[#28a745] hover:text-white transition-colors flex items-center justify-center gap-1 border-t border-[#333] -mx-4 px-4 -mb-4 mt-auto"
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Read more <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
    </div>
  );

  return cardContent;
});
