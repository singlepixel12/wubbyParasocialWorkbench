'use client';

/**
 * VideoMetadata Component
 * Displays video title, date, tags, and summary
 * Ported from: index.html (lines 66-73) and script.js updateVideoInfo()
 */

import { cn } from '@/lib/utils';
import { formatDateLong, formatSummaryText } from '@/lib/utils/formatters';
import { PlatformTag } from '@/components/ui/platform-tag';
import type { Video } from '@/types/video';

interface VideoMetadataProps {
  video: Video | null;
}

export function VideoMetadata({ video }: VideoMetadataProps) {
  console.log('VideoMetadata render:', video ? { title: video.title, platform: video.platform, tagsCount: video.tags.length } : 'null');

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
            <PlatformTag platform={video.platform} variant="badge" />
          )}

          {/* Content Tags */}
          {video.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30"
            >
              {tag}
            </span>
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
