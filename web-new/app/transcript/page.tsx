'use client';

/**
 * Transcript Page
 * Load videos and view their transcripts/subtitles
 * Ported from: transcript.html
 */

import { useState, useEffect } from 'react';
import { VideoSelector } from '@/components/video/VideoSelector';
import { HashDisplay } from '@/components/video/HashDisplay';
import { VideoMetadata } from '@/components/video/VideoMetadata';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/lib/hooks/useToast';
import { computeVideoHash } from '@/lib/utils/hash';
import { getWubbySummary, fetchRecentVideos } from '@/lib/api/supabase';
import type { Video } from '@/types/video';
import { logger } from '@/lib/utils/logger';
import { SUPABASE_URL } from '@/lib/constants';

export default function TranscriptPage() {
  logger.log('===== TranscriptPage Render =====');

  const { showError, showWarning } = useToast();

  // State management
  const [videoUrl, setVideoUrl] = useState('');
  const [videoHash, setVideoHash] = useState('');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [status, setStatus] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [hasSubtitle, setHasSubtitle] = useState<boolean | null>(null);
  const [hasThumbnail, setHasThumbnail] = useState<boolean | null>(null);

  logger.log('Current state:', {
    videoUrl: videoUrl.substring(0, 50) + '...',
    videoHash: videoHash.substring(0, 16) + '...',
    hasSubtitleUrl: !!subtitleUrl,
    status,
    isSuccess,
    isLoading,
    hasVideo: !!video,
  });

  // Fetch recent videos on mount
  useEffect(() => {
    const loadRecentVideos = async () => {
      try {
        logger.log('Fetching recent videos for dropdown...');
        const videos = await fetchRecentVideos({ limit: 10 }); // Get 10 most recent
        setRecentVideos(videos);
        logger.log(`✅ Loaded ${videos.length} recent videos`);
      } catch (error) {
        logger.error('Failed to load recent videos:', error);
      }
    };
    loadRecentVideos();
  }, []);

  // Update page title when video changes
  useEffect(() => {
    if (video) {
      logger.log('Updating document title:', video.title);
      document.title = `${video.title} - Transcript | Wubby Parasocial Workbench`;
    }
  }, [video]);

  // Update status helper
  const updateStatus = (newStatus: string, success: boolean = true) => {
    logger.log('Updating status:', { newStatus, success });
    setStatus(newStatus);
    setIsSuccess(success);
  };

  // Load video handler with subtitle detection
  const handleLoadVideo = async () => {
    logger.group('🚀 Loading Video with Transcript');
    logger.log('Video URL:', videoUrl);

    const trimmedUrl = videoUrl.trim();

    // Validate URL format
    if (!trimmedUrl) {
      logger.error('❌ Empty URL');
      logger.groupEnd();
      setVideoHash('');
      setSubtitleUrl('');
      updateStatus('No video URL entered.', false);
      showWarning('Please enter a video URL to load.');
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmedUrl);
      logger.log('✅ Valid URL format');
    } catch (error) {
      logger.error('❌ Invalid URL format:', error);
      logger.groupEnd();
      showError('Please enter a valid URL format.');
      updateStatus('Invalid URL format', false);
      return;
    }

    // Check if it's a wubby.tv URL
    if (!trimmedUrl.includes('archive.wubby.tv')) {
      logger.warn('⚠️ Not a wubby.tv URL:', trimmedUrl);
      showWarning(
        'This tool is designed for archive.wubby.tv URLs. Transcripts may not be available for other URLs.'
      );
    }

    try {
      setIsLoading(true);
      updateStatus('Computing hash...', true);

      // Compute hash
      logger.log('Computing hash...');
      const hash = await computeVideoHash(trimmedUrl);
      setVideoHash(hash);
      logger.log('Hash computed:', hash);

      // Construct subtitle URL
      const subtitlePath = `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt`;
      logger.log('Subtitle path:', subtitlePath);

      // Test if subtitle exists
      updateStatus('Checking for subtitles...', true);
      logger.log('Testing subtitle availability...');

      try {
        const testResponse = await fetch(subtitlePath, { method: 'HEAD' });

        if (testResponse.ok) {
          logger.log('✅ Subtitles found');
          setSubtitleUrl(subtitlePath);
          setHasSubtitle(true);
          updateStatus('Subtitles available', true);
        } else {
          logger.warn('⚠️ No subtitles available:', testResponse.status, testResponse.statusText);
          setSubtitleUrl('');
          setHasSubtitle(false);
          updateStatus(`No subtitles (${testResponse.status})`, false);
          showWarning('No transcript available for this video. Video will play without subtitles.');
        }
      } catch (fetchError) {
        logger.error('❌ Network error testing subtitle URL:', fetchError);
        setSubtitleUrl('');
        setHasSubtitle(false);
        updateStatus('Could not check subtitles', false);
        showWarning('Unable to check for subtitles. Video will load without them.');
      }

      // Fetch video metadata
      updateStatus('Fetching video data...', true);
      logger.log('Fetching video data from Supabase...');
      const summary = await getWubbySummary(trimmedUrl);

      if (summary) {
        logger.log('✅ Video data retrieved');
        setVideo(summary);

        // Check for thumbnail
        if (summary.thumbnailUrl) {
          try {
            const thumbnailResponse = await fetch(summary.thumbnailUrl, { method: 'HEAD' });
            setHasThumbnail(thumbnailResponse.ok);
            logger.log(`Thumbnail check: ${thumbnailResponse.ok ? '✅' : '❌'}`);
          } catch {
            setHasThumbnail(false);
          }
        } else {
          setHasThumbnail(false);
        }

        updateStatus('Video loaded', true);
      } else {
        logger.log('⚠️ No metadata found');
        setVideo(null);
        setHasThumbnail(false);
        updateStatus('Video loaded - No Metadata', true);
      }

      logger.groupEnd();
    } catch (err) {
      logger.error('❌ Error loading video:', err);
      logger.groupEnd();

      const error = err as Error;
      showError(`Failed to load video: ${error.message}`, {
        action: {
          label: 'Retry',
          onClick: () => {
            logger.log('Retrying video load...');
            handleLoadVideo();
          },
        },
      });
      updateStatus('Error occurred', false);
      setSubtitleUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear handler
  const handleClear = () => {
    logger.log('🧹 Clearing all data');
    setVideoUrl('');
    setVideoHash('');
    setSubtitleUrl('');
    setStatus('');
    setIsSuccess(true);
    setVideo(null);
    setHasSubtitle(null);
    setHasThumbnail(null);
    document.title = 'Get Transcript | Wubby Parasocial Workbench';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        kicker="Tools · transcript extraction"
        title="Get Transcript"
        description="Technical showcase: Load archive.wubby.tv videos to see transcript extraction, hash generation, and metadata lookup in action. Check the status below to see subtitle/thumbnail availability and platform details."
      />

      {/* Video Selector */}
      <section aria-labelledby="video-section-title">
        <h2 id="video-section-title" className="sr-only">
          Video Information
        </h2>

        <div className="space-y-4">
          <VideoSelector
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
            onLoad={handleLoadVideo}
            onClear={handleClear}
            isLoading={isLoading}
            recentVideos={recentVideos}
          />

          <HashDisplay hash={videoHash} status={status} isSuccess={isSuccess} />

          {/* Video Status Display */}
          {video && (
            <section className="border-t border-rule pt-5">
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-3">
                Video Status
              </h3>
              <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                <code>{JSON.stringify(
                  {
                    title: video.title,
                    platform: video.platform,
                    date: video.date,
                    has_subtitles: hasSubtitle,
                    has_thumbnail: hasThumbnail,
                    thumbnail_url: video.thumbnailUrl || null,
                    subtitle_url: subtitleUrl || null,
                    video_hash: videoHash,
                    tags_count: video.tags?.length || 0,
                    tags: video.tags?.slice(0, 5) || [],
                  },
                  null,
                  2
                )}</code>
              </pre>
            </section>
          )}
        </div>
      </section>

      {/* Video Player with Subtitles */}
      <section
        className="border-t border-rule pt-5"
        aria-labelledby="player-section-title"
      >
        <h3 id="player-section-title" className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-4">
          Video Player
        </h3>

        <div className="space-y-4">
          <VidstackPlayer
            videoUrl={videoUrl}
            subtitleUrl={subtitleUrl}
            enableSubtitles={true}
            onError={(error) => {
              logger.error('Player error:', error);
              showError('Video player error occurred');
            }}
          />

          {subtitleUrl && (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-green">
              ✓ Transcript loaded — use the CC button in the player to toggle subtitles
            </p>
          )}

          {videoUrl && !subtitleUrl && !isLoading && (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
              ⚠ No transcript available for this video
            </p>
          )}
        </div>
      </section>

      {/* Video Metadata Display */}
      <section className="border-t border-rule pt-5" aria-labelledby="video-title">
        <VideoMetadata video={video} />
      </section>
    </div>
  );
}
