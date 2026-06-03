'use client';

/**
 * VidstackPlayer Test Page
 * Tests the VidstackPlayer component with and without subtitles
 */

import { useState } from 'react';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { computeVideoHash } from '@/lib/utils/hash';
import { SUPABASE_URL } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';

const TEST_VIDEOS = [
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/5_kickapilol_1751754314_000.mp4',
    label: 'Kickapilol (Test with subtitles)',
  },
  {
    url: 'https://files.vidstack.io/sprite-fight/720p.mp4',
    label: 'Sprite Fight (No subtitles)',
    poster: 'https://files.vidstack.io/sprite-fight/poster.webp',
  },
];

export default function PlayerTestPage() {
  logger.log('===== PlayerTestPage Render =====');

  const [videoUrl, setVideoUrl] = useState('');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [poster, setPoster] = useState('');

  const handleLoadVideo = async (testVideoUrl: string, testPoster?: string) => {
    logger.group('🎥 Loading Test Video');
    logger.log('Video URL:', testVideoUrl);

    setVideoUrl(testVideoUrl);
    setPoster(testPoster || '');

    // Try to load subtitles from Supabase
    try {
      const hash = await computeVideoHash(testVideoUrl);
      const subtitlePath = `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt`;

      logger.log('Computed hash:', hash);
      logger.log('Subtitle path:', subtitlePath);

      // Test if subtitle exists
      const response = await fetch(subtitlePath, { method: 'HEAD' });
      if (response.ok) {
        logger.log('✅ Subtitles found');
        setSubtitleUrl(subtitlePath);
      } else {
        logger.log('⚠️ No subtitles available');
        setSubtitleUrl('');
      }
    } catch (err) {
      logger.error('Error checking subtitles:', err);
      setSubtitleUrl('');
    }

    logger.groupEnd();
  };

  const handleCustomUrl = async () => {
    const customUrl = (document.getElementById('custom-url') as HTMLInputElement)?.value;
    if (customUrl) {
      await handleLoadVideo(customUrl);
    }
  };

  const handleClear = () => {
    logger.log('🧹 Clearing player');
    setVideoUrl('');
    setSubtitleUrl('');
    setPoster('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        kicker="Internal · player sandbox"
        title="VidstackPlayer Test"
        description="Test the VidstackPlayer component with various video sources and subtitles."
      />

      {/* Test Controls */}
      <section className="border-t border-rule pt-5 space-y-4">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">Test Videos</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TEST_VIDEOS.map((video) => (
            <Button
              key={video.url}
              onClick={() => handleLoadVideo(video.url, video.poster)}
              variant="outline"
              className="h-auto py-3 px-4 text-left justify-start"
            >
              <div>
                <div className="font-semibold">{video.label}</div>
                <div className="text-xs text-muted-foreground truncate mt-1">
                  {video.url.substring(0, 60)}...
                </div>
              </div>
            </Button>
          ))}
        </div>

        <div className="flex gap-3">
          <Input
            id="custom-url"
            type="text"
            placeholder="Or enter custom video URL..."
            className="flex-1"
          />
          <Button onClick={handleCustomUrl}>Load Custom</Button>
          <Button onClick={handleClear} variant="outline">Clear</Button>
        </div>
      </section>

      {/* Player Status */}
      <section className="border-t border-rule pt-5">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-3">Player Status</h3>
        <div className="space-y-2 rounded bg-muted p-4 text-sm font-mono">
          <div>
            <span className="font-semibold">Video URL:</span>{' '}
            <span className="text-muted-foreground">{videoUrl || '-'}</span>
          </div>
          <div>
            <span className="font-semibold">Subtitle URL:</span>{' '}
            <span className="text-muted-foreground">
              {subtitleUrl ? subtitleUrl.substring(0, 80) + '...' : '-'}
            </span>
          </div>
          <div>
            <span className="font-semibold">Has Subtitles:</span>{' '}
            <span className={subtitleUrl ? 'text-accent-green' : 'text-ink-muted'}>
              {subtitleUrl ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </section>

      {/* Video Player */}
      <section
        className="border-t border-rule pt-5"
        aria-labelledby="player-section-title"
      >
        <h3 id="player-section-title" className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-4">
          Video Player
        </h3>

        <VidstackPlayer
          videoUrl={videoUrl}
          subtitleUrl={subtitleUrl}
          poster={poster}
          enableSubtitles={true}
          onError={(error) => {
            logger.error('Player error callback:', error);
          }}
        />
      </section>

      {/* Instructions */}
      <section className="border-t border-rule pt-5">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted mb-3">Testing Checklist</h3>
        <ul className="space-y-2 text-sm">
          <li>✅ Click a test video button to load the player</li>
          <li>✅ Check the console logs for detailed player initialization</li>
          <li>✅ Verify video playback works</li>
          <li>✅ If subtitles are available, verify they load and display</li>
          <li>✅ Test subtitle toggle in player controls (CC button)</li>
          <li>✅ Test switching between different videos</li>
          <li>✅ Test Clear button to reset player</li>
          <li>✅ Check for any errors in console</li>
        </ul>
      </section>
    </div>
  );
}
