'use client';

/**
 * VideoSelector Component
 * Provides URL input with dropdown and Load/Clear buttons
 * Ported from: index.html (lines 29-53)
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/utils/logger';
import type { Video } from '@/types/video';

interface VideoSelectorProps {
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onLoad: () => void;
  onClear: () => void;
  isLoading: boolean;
  recentVideos?: Video[];
}

// Sample videos for dropdown (from index.html datalist)
const SAMPLE_VIDEOS = [
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/2_LITTLE%20PEOPLE%20BIG%20DESSERT%20-%20POOKIE%20RESPONDS%20-%20JEWISH%20WEDDINGS%20-%20PENCIL%20SHARPENER%20GUY%20ON%20CALL%20-%20UNDER%20THE%20SEAT%20VIBES_1751499060_000.mp4',
    label: 'Little People Big Dessert',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/4_MAKING%20PASSIONATE%20LOVE%20TO%20OBJECTS%20AROUND%20MY%20HOUSE%20-%20GRAPHIC%20-%20NO%20PROTECTION%20-%20TURN%20A%20BAR%20STOOL%20UPSIDE%20DOWN%20ILL%20FIND%20A%20SEAT%20-%20LOOKING%20FOR%20TAN_1751671871_000.mp4',
    label: 'Making Passionate Love to Objects',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/5_kickapilol_1751754314_000.mp4',
    label: 'Kickapilol',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/6_WHICH%20WAIFU%20IS%20THE%20FASTEST%20-%20IVE%20BEEN%20KNOWN%20TO%20LAST%2012%20SECONDS%20-%20MAYBE%20DATING%20THE%20BED%20AFTER%20-%20THE%20WORLD%20IS%20MY%20OYSTER%20-%20SMASHING%20CLAM_1751844647_000.mp4',
    label: 'Which Waifu Is The Fastest',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/9_SHTS%20ON%20FIRE%20YO%20-%20UPDATE%20SOON_1752106523_000.mp4',
    label: 'Shits On Fire Yo',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/12_kickapilol_1752360305_000.mp4',
    label: 'Kickapilol 2',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/14_MARE%20MONDAY%20-%20HORSE%20GIRLS%20BUT%20THEY%20ARE%20CARDBOARD%20-%20BETA%20PACK%20AFTER%20%20I%20GUESS%20SO_1752531749_000.mp4',
    label: 'Mare Monday',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/16_THE%20JUICE%20-%20THE%20SQUEEZE%20-%20THE%20MAN%20-%20THE%20MERMAID%20TITTIES%20-%20MASTER%20CHIEF%20HOLDING%20BLUE%20BALLOONS%20-%20GAY%20BOWSER%20-%20GG_1752708670_000.mp4',
    label: 'The Juice',
  },
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/15_MARE%20MONDAY%20-%20HORSE%20GIRLS%20BUT%20THEY%20ARE%20CARDBOARD%20-%20BETA%20PACK%20AFTER%20%20I%20GUESS%20SO_1752597114_000.mp4',
    label: 'Progressive Show',
  },
];

export function VideoSelector({
  videoUrl,
  onVideoUrlChange,
  onLoad,
  onClear,
  isLoading,
  recentVideos = [],
}: VideoSelectorProps) {
  logger.debug('VideoSelector render:', { videoUrl, isLoading, videoCount: recentVideos.length });

  // Use recent videos if provided, otherwise fall back to sample videos
  const videos = recentVideos.length > 0
    ? recentVideos.map((v) => ({ url: v.url, label: v.title }))
    : SAMPLE_VIDEOS;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* URL Input with dropdown */}
        <div className="flex-1">
          <Input
            type="text"
            value={videoUrl}
            onChange={(e) => {
              logger.debug('URL input changed:', e.target.value);
              onVideoUrlChange(e.target.value);
            }}
            placeholder="Enter archive.wubby.tv URL or select from dropdown"
            disabled={isLoading}
            list="video-options"
            className="w-full"
            aria-label="Video URL"
            aria-describedby="video-input-help"
          />
          <datalist id="video-options">
            {videos.map((video) => (
              <option key={video.url} value={video.url}>
                {video.label}
              </option>
            ))}
          </datalist>
          <span id="video-input-help" className="sr-only">
            Enter a video URL or select from the dropdown list of available videos
          </span>
        </div>

        {/* Load Button */}
        <Button
          onClick={() => {
            logger.log('Load button clicked');
            onLoad();
          }}
          disabled={isLoading || !videoUrl.trim()}
          className="bg-green-600 hover:bg-green-700"
          aria-label="Load video data"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </Button>

        {/* Clear Button */}
        <Button
          onClick={() => {
            logger.log('Clear button clicked');
            onClear();
          }}
          disabled={isLoading}
          variant="outline"
          aria-label="Clear video input and data"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
