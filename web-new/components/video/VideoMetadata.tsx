'use client';
import { logger } from '@/lib/utils/logger';

/**
 * VideoMetadata Component
 * Displays video title, date, tags, and summary
 * Ported from: index.html (lines 66-73) and script.js updateVideoInfo()
 */

import { cn } from '@/lib/utils';
import { formatDateLong, formatSummaryText } from '@/lib/utils/video-helpers';
import { Badge } from '@/components/ui/badge';
import type { Video } from '@/types/video';

/**
 * Get Badge variant for platform or tag
 * @param text - Platform or tag name
 * @returns Badge variant name
 */
function getBadgeVariant(text: string): 'kick' | 'twitch' | 'tag' {
  const normalized = text.toLowerCase();
  if (normalized === 'kick') return 'kick';
  if (normalized === 'twitch') return 'twitch';
  return 'tag';
}

interface VideoMetadataProps {
  video: Video | null;
}

export function VideoMetadata({ video }: VideoMetadataProps) {
  logger.log('VideoMetadata render:', video ? { title: video.title, platform: video.platform, tagsCount: video.tags.length } : 'null');

  // Default state when no video is loaded
  if (!video) {
    return (
      <div className="space-y-4">
        <h4 className="text-xl font-semibold" id="video-title">
          Video Title for VOD
        </h4>
        <h3 className="text-lg text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </h3>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground text-center">
            - This vod has no summary -
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Title */}
      <h4
        className="text-xl sm:text-2xl font-semibold"
        id="video-title"
        aria-label={`Video title: ${video.title}`}
      >
        {video.title}
      </h4>

      {/* Upload Date */}
      <h3 className="text-base sm:text-lg text-muted-foreground">
        {formatDateLong(video.date)}
      </h3>

      {/* Tags */}
      {video.tags.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="region"
          aria-label="Video tags"
        >
          {/* Platform Tag */}
          {video.platform && video.platform !== 'unknown' && (
            <Badge variant={getBadgeVariant(video.platform)}>
              {video.platform}
            </Badge>
          )}

          {/* Content Tags */}
          {video.tags.map((tag, index) => (
            <Badge key={index} variant={getBadgeVariant(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed">
          {formatSummaryText(video.summary)}
        </p>
      </div>
    </div>
  );
}
