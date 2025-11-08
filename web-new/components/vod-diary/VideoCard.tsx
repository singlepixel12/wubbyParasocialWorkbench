'use client';

/**
 * VideoCard Component
 * Expandable video card with thumbnail, metadata, and tags
 * Features smooth max-height animation using requestAnimationFrame
 * Ported from: src/vodDiary.js createVideoCard()
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Video } from '@/types/video';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { Button } from '@/components/ui/button';
import { PlatformTag } from '@/components/ui/platform-tag';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  onCardClick?: (video: Video) => void;
}

export function VideoCard({ video, onCardClick }: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandableRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState(0);

  // Initialize collapsed height after component mounts
  useEffect(() => {
    if (expandableRef.current && summaryRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (!expandableRef.current || !summaryRef.current) return;

        // Disable transition temporarily for initial measurement
        expandableRef.current.style.transition = 'none';
        const collapsed = summaryRef.current.offsetHeight || 0;
        expandableRef.current.style.maxHeight = `${collapsed}px`;
        setCollapsedHeight(collapsed);

        // Force reflow then restore transition
        void expandableRef.current.offsetHeight;
        expandableRef.current.style.transition = 'max-height 0.3s ease-in-out';
      });
    }
  }, []);

  const handleExpand = () => {
    if (!expandableRef.current) return;

    if (!isExpanded) {
      // Expand: add class first so content is measurable
      setIsExpanded(true);
      // Next frame, animate to full height
      requestAnimationFrame(() => {
        if (expandableRef.current) {
          const targetHeight = expandableRef.current.scrollHeight;
          expandableRef.current.style.maxHeight = `${targetHeight}px`;
        }
      });
    } else {
      // Collapse: transition from current height to collapsed height
      if (expandableRef.current) {
        expandableRef.current.style.maxHeight = `${expandableRef.current.scrollHeight}px`;
        // Force reflow
        void expandableRef.current.offsetHeight;
        expandableRef.current.style.maxHeight = `${collapsedHeight}px`;
      }

      // After transition ends, remove expanded class
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== expandableRef.current) return;
        setIsExpanded(false);
        expandableRef.current?.removeEventListener('transitionend', onEnd as EventListener);
      };
      expandableRef.current?.addEventListener('transitionend', onEnd as EventListener);
    }
  };

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
    handleExpand();
  };

  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 pb-10 min-h-[180px] relative overflow-hidden cursor-pointer',
        isExpanded && 'expanded'
      )}
    >
      {/* Platform tag (top right) */}
      <PlatformTag
        platform={video.platform}
        variant="simple"
        className="absolute top-3 right-3 font-semibold z-10"
      />

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

        {/* Expandable content (summary + tags) */}
        <div
          ref={expandableRef}
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        >
          {/* Summary - clamped to 2 lines when collapsed */}
          <p
            ref={summaryRef}
            className={cn(
              'mt-2 text-sm text-[#ccc]',
              !isExpanded && 'line-clamp-2'
            )}
          >
            {video.summary}
          </p>

          {/* Tags - only shown when expanded */}
          {isExpanded && (
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
          )}
        </div>
      </div>

      {/* Expand/Collapse button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleExpand();
        }}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-[#888] hover:text-[#aaa] hover:bg-[#222]"
      >
        {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
      </Button>
    </div>
  );
}
