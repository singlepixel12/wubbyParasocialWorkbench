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
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlatformTag } from '@/components/ui/platform-tag';
import { SUPABASE_URL } from '@/lib/constants';

export default function PlayerPage() {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitleUrl, setSubtitleUrl] = useState<string>('');
  const { showError, showWarning } = useToast();

  useEffect(() => {
    // Load video URL from localStorage
    const loadVideoFromStorage = async () => {
      const storedUrl = localStorage.getItem('selectedVideoUrl');

      if (!storedUrl) {
        console.warn('[Player Page] No video URL found in localStorage.');
        showWarning('No video selected. Please select a video from VOD Diary.');
        setLoading(false);
        return;
      }

      console.log('[Player Page] Loading video:', storedUrl);
      setVideoUrl(storedUrl);

      try {
        // Compute hash for subtitle lookup
        console.log('[Player Page] Computing hash...');
        const hash = await computeVideoHash(storedUrl);
        console.log('[Player Page] Hash:', hash);

        // Construct subtitle URL
        const subtitlePath = `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt`;
        console.log('[Player Page] Checking for subtitles:', subtitlePath);

        // Test if subtitle exists
        try {
          const testResponse = await fetch(subtitlePath, { method: 'HEAD' });

          if (testResponse.ok) {
            console.log('[Player Page] ✅ Subtitles found');
            setSubtitleUrl(subtitlePath);
          } else {
            console.warn('[Player Page] ⚠️ No subtitles available:', testResponse.status);
            setSubtitleUrl('');
          }
        } catch (fetchError) {
          console.warn('[Player Page] Could not check for subtitles:', fetchError);
          setSubtitleUrl('');
        }

        // Fetch video metadata from Supabase
        console.log('[Player Page] Fetching metadata...');
        const videoData = await getWubbySummary(storedUrl);

        if (!videoData) {
          showError('Failed to load video information.');
          setLoading(false);
          return;
        }

        setVideo(videoData);
        console.log('[Player Page] ✅ Loaded video metadata:', videoData.title);
      } catch (error) {
        console.error('[Player Page] Error loading video:', error);
        showError('Failed to load video. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadVideoFromStorage();
  }, [showError, showWarning]);

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
        <div className="text-center">
          <p className="text-[#777] text-lg mb-4">No video selected</p>
          <p className="text-[#555] text-sm">
            Please select a video from the{' '}
            <Link href="/vod-diary" className="text-[#28a745] hover:underline">
              VOD Diary
            </Link>
          </p>
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
          onError={(error) => {
            console.error('[Player Page] Video player error:', error);
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
          <h2 className="text-2xl font-bold text-white mb-1">{video.title}</h2>
          {originalTitle && (
            <h3 className="text-lg text-[#999]">{originalTitle}</h3>
          )}
        </div>

        {/* Date */}
        {formattedDate && (
          <p className="text-[#777]">{formattedDate}</p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {video.tags.map((tag, index) => (
              <PlatformTag key={index} platform={tag} variant="simple" />
            ))}
          </div>
        )}

        {/* Summary */}
        {video.summary && (
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
            <p className="text-[#ccc] leading-relaxed">{video.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
