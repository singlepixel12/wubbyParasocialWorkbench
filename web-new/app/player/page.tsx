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

/**
 * Get solid Badge variant for platform/tag
 * @param text - Platform or tag name
 * @returns Solid badge variant name
 */
function getSolidBadgeVariant(text: string): 'kick-solid' | 'twitch-solid' | 'tag-solid' {
  const normalized = text.toLowerCase();
  if (normalized === 'kick') return 'kick-solid';
  if (normalized === 'twitch') return 'twitch-solid';
  return 'tag-solid';
}

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
          <div className="rounded-full bg-muted p-6 mb-4">
            <PlayCircle className="w-16 h-16 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">No video selected</h2>
          <p className="text-muted-foreground mb-6">
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
    <div className="space-y-6">
      {/* Video Player */}
      <div className="rounded-lg border border-border bg-card p-6">
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
          <div className="rounded-lg bg-muted p-3 text-sm mt-4">
            <p className="text-green-600 dark:text-green-400 font-medium">
              ✓ Transcript loaded - Use the CC button in the player to toggle subtitles
            </p>
          </div>
        )}
      </div>

      {/* Video Information */}
      <div className="space-y-4">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{video.title}</h2>
          {originalTitle && (
            <h3 className="text-lg text-muted-foreground">{originalTitle}</h3>
          )}
        </div>

        {/* Date */}
        {formattedDate && (
          <p className="text-muted-foreground">{formattedDate}</p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {video.tags.map((tag, index) => (
              <Badge key={index} variant={getSolidBadgeVariant(tag)}>
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Summary */}
        {video.summary && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Summary</h3>
            <p className="text-card-foreground leading-relaxed">{video.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
