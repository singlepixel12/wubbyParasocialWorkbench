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
import { getWubbySummary } from '@/lib/api/supabase';
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

  logger.log('Current state:', {
    videoUrl: videoUrl.substring(0, 50) + '...',
    videoHash: videoHash.substring(0, 16) + '...',
    hasSubtitleUrl: !!subtitleUrl,
    status,
    isSuccess,
    isLoading,
    hasVideo: !!video,
  });

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
          updateStatus('Subtitles available', true);
        } else {
          logger.warn('⚠️ No subtitles available:', testResponse.status, testResponse.statusText);
          setSubtitleUrl('');
          updateStatus(`No subtitles (${testResponse.status})`, false);
          showWarning('No transcript available for this video. Video will play without subtitles.');
        }
      } catch (fetchError) {
        logger.error('❌ Network error testing subtitle URL:', fetchError);
        setSubtitleUrl('');
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
        updateStatus('Video loaded', true);
      } else {
        logger.log('⚠️ No metadata found');
        setVideo(null);
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
    document.title = 'Get Transcript | Wubby Parasocial Workbench';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Get Transcript"
        description="Load archive.wubby.tv videos with transcripts and view them alongside the video player. Subtitles will be enabled automatically if available."
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
          />

          <HashDisplay hash={videoHash} status={status} isSuccess={isSuccess} />
        </div>
      </section>

      {/* Video Player with Subtitles */}
      <section
        className="rounded-lg border border-border bg-card p-6"
        aria-labelledby="player-section-title"
      >
        <h3 id="player-section-title" className="text-xl font-semibold mb-4">
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
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">
                ✓ Transcript loaded - Use the CC button in the player to toggle subtitles
              </p>
            </div>
          )}

          {videoUrl && !subtitleUrl && !isLoading && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                ⚠ No transcript available for this video
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Video Metadata Display */}
      <section className="rounded-lg border border-border bg-card p-6" aria-labelledby="video-title">
        <VideoMetadata video={video} />
      </section>
    </div>
  );
}
