'use client';

/**
 * VideoCard Component
 * Editorial "archive record" browse card: a hairline-ruled entry with a running
 * index, a Fraunces display title, a 1-2 line hook, and an expandable full summary.
 * Clicking "Read more" expands the card to show the full summary in-place.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */

import { memo, useState } from 'react';
import { Play, FileText, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Video } from '@/types/video';
import { formatDateDisplay, extractOriginalTitle, extractHook } from '@/lib/utils/video-helpers';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  /** Position in the list — rendered as the archive record number (№ NN). */
  index?: number;
  onCardClick?: (video: Video) => void;
}

export const VideoCard = memo(function VideoCard({ video, index, onCardClick }: VideoCardProps) {
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

  // Visible tags (drop the platform if it leaked into the tag list)
  const tags = video.tags?.filter((tag) => tag !== video.platform) ?? [];
  const recordNo = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;

  const handleThumbnailClick = (e: React.MouseEvent) => {
    // Prevent card expansion when clicking thumbnail
    e.preventDefault();
    e.stopPropagation();

    // Navigate to watch page with video hash (include basePath for GitHub Pages)
    if (videoHash) {
      const basePath = process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '';
      window.open(`${basePath}/watch?id=${videoHash}`, '_blank');
      onCardClick?.(video);
    }
  };

  return (
    <article
      data-video-hash={videoHash}
      className={cn(
        'group relative flex flex-col gap-4 overflow-hidden rounded-md border border-rule bg-card/40 p-4 transition-colors duration-200',
        'md:flex-row md:gap-6 md:p-5',
        'hover:border-foreground/15 hover:bg-card'
      )}
    >
      {/* Thumbnail with play button */}
      <div
        onClick={handleThumbnailClick}
        className="group/thumb block w-full flex-shrink-0 cursor-pointer md:w-44"
        aria-label={`Play ${video.title}`}
      >
        <div className="relative h-48 w-full overflow-hidden rounded bg-black md:h-full md:min-h-[100px]">
          {/* Thumbnail image (with fallback to black box) */}
          {video.thumbnailUrl && !thumbnailError ? (
            <img
              src={video.thumbnailUrl}
              alt={`Thumbnail for ${video.title}`}
              className="absolute inset-0 h-full w-full object-cover grayscale-[35%] transition-all duration-500 group-hover/thumb:grayscale-0"
              onError={() => setThumbnailError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}

          {/* Play button overlay with a single quiet-green accent */}
          <div className="absolute inset-0 flex items-center justify-center opacity-80 transition-all duration-300 group-hover/thumb:opacity-100">
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300',
                'bg-gradient-to-br from-black/90 to-black/70',
                'animate-[playButtonPulse_2s_ease-in-out_infinite] group-hover/thumb:animate-none',
                'group-hover/thumb:scale-110 group-hover/thumb:from-accent-green/95 group-hover/thumb:to-accent-green/80',
                'group-hover/thumb:shadow-[0_0_24px_hsl(var(--accent-green)/0.55)]'
              )}
            >
              <Play className="ml-0.5 h-7 w-7 fill-white text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Meta rail: record number · date */}
        <div className="mb-2 flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-muted">
          {recordNo && <span className="text-accent-green">№&nbsp;{recordNo}</span>}
          {formattedDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Title — Fraunces display */}
        <h3 className="font-display text-xl leading-snug text-foreground md:text-2xl line-clamp-2">
          {video.title}
        </h3>

        {/* Original title from URL (secondary) with icon */}
        {originalTitle && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <FileText className="mt-0.5 h-3 w-3 flex-shrink-0 text-ink-muted" />
            <h4 className="line-clamp-1 flex-1 font-mono text-xs text-ink-muted">{originalTitle}</h4>
          </div>
        )}

        {/* Summary — thin accent-green marker rule, no heavy box */}
        <div className="my-3 border-l-2 border-accent-green/50 pl-3">
          <p className={cn('text-sm leading-relaxed text-foreground/80', !isExpanded && 'line-clamp-2')}>
            {isExpanded ? video.summary || 'No summary available for this video.' : hook}
          </p>
        </div>

        {/* Tag preview (3 on mobile, 6 on desktop) */}
        {tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {/* Mobile: show 3 tags */}
            <div className="flex flex-wrap gap-1.5 md:hidden">
              {tags.slice(0, 3).map((tag, i) => (
                <TagBadge key={i} tag={tag} />
              ))}
              {tags.length > 3 && <span className="text-xs text-ink-muted">+{tags.length - 3}</span>}
            </div>

            {/* Desktop: show 6 tags */}
            <div className="hidden flex-wrap gap-1.5 md:flex">
              {tags.slice(0, 6).map((tag, i) => (
                <TagBadge key={i} tag={tag} />
              ))}
              {tags.length > 6 && <span className="text-xs text-ink-muted">+{tags.length - 6}</span>}
            </div>
          </div>
        )}

        {/* Read more/Show less toggle at bottom */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="-mx-4 -mb-4 mt-auto flex w-[calc(100%+2rem)] items-center justify-center gap-1 border-t border-rule px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-accent-green transition-colors hover:bg-accent-green/10 hover:text-foreground"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </article>
  );
});

/** A single clickable topic tag. */
function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge
      variant="tag"
      className="cursor-pointer text-xs transition-colors hover:border-accent-green hover:bg-accent-green hover:text-white"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // TODO: Implement tag search
        console.log('Search for tag:', tag);
      }}
    >
      {tag}
    </Badge>
  );
}
