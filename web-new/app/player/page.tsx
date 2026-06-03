'use client';

/**
 * Player Page
 * Dedicated video player page that loads video from localStorage
 * Video URL is set when user clicks play button on VOD Diary
 * Uses Vidstack player with automatic subtitle loading
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Video } from '@/types/video';
import { getWubbySummary } from '@/lib/api/supabase';
import { computeVideoHash } from '@/lib/utils/hash';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { useToast } from '@/lib/hooks/useToast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SUPABASE_URL } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';
import { PlayCircle, ArrowRight } from 'lucide-react';
import { cleanupOldPlaybackPositions } from '@/lib/utils/storage-cleanup';

export default function PlayerPage() {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitleUrl, setSubtitleUrl] = useState<string>('');
  const [videoHash, setVideoHash] = useState<string>('');
  const { showError, showWarning } = useToast();

  // Load video URL from localStorage
  const loadVideoFromStorage = async () => {
      const storedUrl = localStorage.getItem('selectedVideoUrl');

      if (!storedUrl) {
        logger.warn('[Player Page] No video URL found in localStorage.');
        showWarning('No video selected. Please select a video from VOD Diary.');
        setLoading(false);
        return;
      }

      logger.log('[Player Page] Loading video:', storedUrl);
      setVideoUrl(storedUrl);

      try {
        // Compute hash for subtitle lookup and playback position tracking
        logger.log('[Player Page] Computing hash...');
        const hash = await computeVideoHash(storedUrl);
        logger.log('[Player Page] Hash:', hash);
        setVideoHash(hash);

        // Construct subtitle URL
        const subtitlePath = `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt`;
        logger.log('[Player Page] Checking for subtitles:', subtitlePath);

        // Test if subtitle exists
        try {
          const testResponse = await fetch(subtitlePath, { method: 'HEAD' });

          if (testResponse.ok) {
            logger.log('[Player Page] ✅ Subtitles found');
            setSubtitleUrl(subtitlePath);
          } else {
            logger.warn('[Player Page] ⚠️ No subtitles available:', testResponse.status);
            setSubtitleUrl('');
          }
        } catch (fetchError) {
          logger.warn('[Player Page] Could not check for subtitles:', fetchError);
          setSubtitleUrl('');
        }

        // Fetch video metadata from Supabase
        logger.log('[Player Page] Fetching metadata...');
        const videoData = await getWubbySummary(storedUrl);

        if (!videoData) {
          showError('Failed to load video information.', {
            action: {
              label: 'Retry',
              onClick: () => {
                logger.log('[Player Page] Retrying metadata load...');
                loadVideoFromStorage();
              },
            },
          });
          setLoading(false);
          return;
        }

        setVideo(videoData);
        logger.log('[Player Page] ✅ Loaded video metadata:', videoData.title);
      } catch (error) {
        logger.error('[Player Page] Error loading video:', error);
        showError('Failed to load video. Please try again.', {
          action: {
            label: 'Retry',
            onClick: () => {
              logger.log('[Player Page] Retrying video load...');
              loadVideoFromStorage();
            },
          },
        });
      } finally {
        setLoading(false);
      }
    };

  // Run cleanup on mount to remove old playback positions
  useEffect(() => {
    logger.log('[Player Page] Running playback position cleanup...');
    const stats = cleanupOldPlaybackPositions();
    logger.log('[Player Page] Cleanup stats:', stats);
  }, []);

  useEffect(() => {
    loadVideoFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh]">
        <LoadingSpinner size="lg" message="Loading video..." />
      </div>
    );
  }

  if (!video || !videoUrl) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center text-center max-w-md px-4">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-4">
            Archive · est. wubby.tv
          </span>
          <PlayCircle className="w-12 h-12 text-accent-green mb-4" />
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-2">No video selected</h2>
          <p className="text-ink-muted mb-6">
            Browse the VOD Diary to find and play Wubby stream content with subtitles and
            metadata.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link href="/vod-diary">
              Browse VOD Diary
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(videoUrl);

  return (
    <div className="space-y-8">
      {/* Video Player — open, unboxed */}
      <div>
        <VidstackPlayer
          videoUrl={videoUrl}
          subtitleUrl={subtitleUrl}
          enableSubtitles={true}
          storageKey={videoHash}
          title={video.title}
          artist="PayMoneyWubby"
          onError={(error) => {
            logger.error('[Player Page] Video player error:', error);
            showError('Video player error occurred');
          }}
        />

        {subtitleUrl && (
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-accent-green">
            ✓ Transcript loaded — use the CC button in the player to toggle subtitles
          </p>
        )}
      </div>

      {/* Video Information */}
      <div className="space-y-4">
        {/* Title — Fraunces display */}
        <div>
          <h2 className="font-display text-2xl md:text-3xl leading-tight text-foreground mb-1">{video.title}</h2>
          {originalTitle && (
            <h3 className="font-mono text-sm text-ink-muted">{originalTitle}</h3>
          )}
        </div>

        {/* Date */}
        {formattedDate && (
          <p className="text-ink-muted">{formattedDate}</p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
        {video.summary && (
          <section className="border-t border-rule pt-5">
            <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-3">
              Summary
            </h3>
            <div className="border-l-2 border-accent-green/50 pl-4">
              <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{video.summary}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
