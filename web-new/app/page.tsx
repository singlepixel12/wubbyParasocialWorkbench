'use client';

/**
 * Home Page (Transcription Details)
 * Main entry point - displays video metadata and hash information
 * Ported from: index.html + src/script.js
 */

import { useState, useEffect } from 'react';
import { VideoSelector } from '@/components/video/VideoSelector';
import { HashDisplay } from '@/components/video/HashDisplay';
import { VideoMetadata } from '@/components/video/VideoMetadata';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/lib/hooks/useToast';
import { computeVideoHash } from '@/lib/utils/hash';
import { getWubbySummary } from '@/lib/api/supabase';
import { logger } from '@/lib/utils/logger';
import type { Video } from '@/types/video';

export default function HomePage() {
  logger.debug('===== HomePage Render =====');

  const { showError, showWarning } = useToast();

  // State management
  const [videoUrl, setVideoUrl] = useState('');
  const [videoHash, setVideoHash] = useState('');
  const [status, setStatus] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);

  logger.debug('Current state:', {
    videoUrl: videoUrl.substring(0, 50) + '...',
    videoHash: videoHash.substring(0, 16) + '...',
    status,
    isSuccess,
    isLoading,
    hasVideo: !!video,
  });

  // Update page title when video changes
  useEffect(() => {
    if (video) {
      logger.log('Updating document title:', video.title);
      document.title = `${video.title} | Wubby Parasocial Workbench`;
    }
  }, [video]);

  // Update status helper
  const updateStatus = (newStatus: string, success: boolean = true) => {
    logger.debug('Updating status:', { newStatus, success });
    setStatus(newStatus);
    setIsSuccess(success);
  };

  // Load video handler - main business logic
  const handleLoadVideo = async () => {
    logger.group('🚀 Loading Video');
    logger.log('Video URL:', videoUrl);

    const trimmedUrl = videoUrl.trim();

    // Validate URL format
    if (!trimmedUrl) {
      logger.error('❌ Empty URL');
      logger.groupEnd();
      setVideoHash('');
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
        'This tool is designed for archive.wubby.tv URLs. Other URLs may not work as expected.'
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

      // Fetch video data
      updateStatus('Fetching video data...', true);
      logger.log('Fetching video data from Supabase...');
      const summary = await getWubbySummary(trimmedUrl);

      if (summary) {
        logger.log('✅ Video data retrieved');
        setVideo(summary);
        updateStatus('Success - Video loaded', true);
      } else {
        logger.log('⚠️ No metadata found');
        setVideo(null);
        updateStatus('Success - No Metadata Available', true);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Clear handler
  const handleClear = () => {
    logger.log('🧹 Clearing all data');
    setVideoUrl('');
    setVideoHash('');
    setStatus('');
    setIsSuccess(true);
    setVideo(null);
    document.title = 'Wubby Parasocial Workbench';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Transcription Details"
        description="Load and view video metadata from archive.wubby.tv including titles, dates, tags, and summaries."
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

      {/* Video Metadata Display */}
      <section className="rounded-lg border border-border bg-card p-6" aria-labelledby="video-title">
        <VideoMetadata video={video} />
      </section>
    </div>
  );
}
