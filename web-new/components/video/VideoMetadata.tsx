'use client';
import { logger } from '@/lib/utils/logger';

/**
 * VideoMetadata Component
 * Displays video title, date, tags, and summary
 * Ported from: index.html (lines 66-73) and script.js updateVideoInfo()
 */

import { formatDateLong, formatSummaryText } from '@/lib/utils/video-helpers';
import { Badge } from '@/components/ui/badge';
import type { Video } from '@/types/video';

interface VideoMetadataProps {
  video: Video | null;
}

export function VideoMetadata({ video }: VideoMetadataProps) {
  logger.log('VideoMetadata render:', video ? { title: video.title, platform: video.platform, tagsCount: video.tags.length } : 'null');

  // Default state when no video is loaded
  if (!video) {
    return (
      <div className="space-y-4">
        <h4 className="font-display text-xl md:text-2xl text-foreground" id="video-title">
          Video Title for VOD
        </h4>
        <h3 className="text-base sm:text-lg text-ink-muted">
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </h3>
        <div className="border-l-2 border-rule pl-4">
          <p className="text-ink-muted">
            - This vod has no summary -
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Title — Fraunces display */}
      <h4
        className="font-display text-xl sm:text-2xl leading-tight text-foreground"
        id="video-title"
        aria-label={`Video title: ${video.title}`}
      >
        {video.title}
      </h4>

      {/* Upload Date */}
      <h3 className="text-base sm:text-lg text-ink-muted">
        {formatDateLong(video.date)}
      </h3>

      {/* Tags */}
      {video.tags.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="region"
          aria-label="Video tags"
        >
          {/* Content Tags */}
          {video.tags.map((tag, index) => (
            <Badge
              key={index}
              variant="tag"
              className="cursor-default transition-colors hover:border-accent-green hover:bg-accent-green hover:text-white"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary — minimal accent bar */}
      <div className="border-l-2 border-accent-green/50 pl-4">
        <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-foreground/80">
          {formatSummaryText(video.summary)}
        </p>
      </div>
    </div>
  );
}
