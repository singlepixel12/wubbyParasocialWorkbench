'use client';

/**
 * VidstackPlayer Component
 * React wrapper for Vidstack web components player
 * Supports dynamic video and subtitle loading
 * Ported from: player.html + transcript.html Vidstack implementation
 */
import { logger } from '@/lib/utils/logger';

import { useEffect, useRef } from 'react';
import { useToast } from '@/lib/hooks/useToast';

// TypeScript declarations for Vidstack custom elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'media-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        poster?: string;
        playsinline?: boolean | '';
      }, HTMLElement>;
      'media-outlet': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'media-community-skin': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

interface VidstackPlayerProps {
  videoUrl?: string;
  subtitleUrl?: string;
  poster?: string;
  className?: string;
  onError?: (error: Error) => void;
  enableSubtitles?: boolean;
}

export function VidstackPlayer({
  videoUrl,
  subtitleUrl,
  poster,
  className = 'video-player-box',
  onError,
  enableSubtitles = true,
}: VidstackPlayerProps) {
  logger.log('VidstackPlayer render:', {
    hasVideoUrl: !!videoUrl,
    hasSubtitleUrl: !!subtitleUrl,
    enableSubtitles,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const { showError, showWarning } = useToast();

  useEffect(() => {
    logger.group('🎬 VidstackPlayer Initialization');
    logger.log('Video URL:', videoUrl);
    logger.log('Subtitle URL:', subtitleUrl);

    // Wait for Vidstack custom elements to be defined
    if (typeof window !== 'undefined' && customElements) {
      customElements.whenDefined('media-player').then(() => {
        logger.log('✅ media-player custom element defined');

        // Add error listener to player after it's defined
        const player = document.querySelector('media-player');
        if (player) {
          player.addEventListener('error', (e: any) => {
            logger.error('❌ Player error:', e.detail);
            const error = new Error(e.detail?.message || 'Player error occurred');
            onError?.(error);
            showError('Video player error occurred');
          });
        }
      }).catch(err => {
        logger.error('❌ Error waiting for media-player definition:', err);
      });
    }

    logger.groupEnd();
  }, [onError, showError]);

  // Handle subtitle changes by recreating player
  useEffect(() => {
    if (!videoUrl || !containerRef.current) {
      logger.log('⏭️ Skipping player recreation - no video URL or container');
      return;
    }

    logger.group('🔄 Recreating Player for Subtitle Change');
    logger.log('Video URL:', videoUrl);
    logger.log('Subtitle URL:', subtitleUrl);

    // Find existing player in container
    const existingPlayer = containerRef.current.querySelector('media-player');

    if (existingPlayer) {
      logger.log('Removing existing player');
      existingPlayer.remove();
    }

    // Create new media player
    const newPlayer = document.createElement('media-player') as HTMLElement;
    newPlayer.setAttribute('class', className);
    newPlayer.setAttribute('src', videoUrl);
    if (poster) newPlayer.setAttribute('poster', poster);
    newPlayer.setAttribute('playsinline', '');

    // Create media outlet
    const mediaOutlet = document.createElement('media-outlet');

    // Add subtitle track if URL provided (track goes INSIDE media-outlet)
    if (subtitleUrl && enableSubtitles) {
      logger.log('Adding subtitle track:', subtitleUrl);

      const trackEl = document.createElement('track');
      trackEl.id = 'subtitle-track';
      trackEl.src = subtitleUrl;
      trackEl.kind = 'subtitles';
      trackEl.srclang = 'en';
      trackEl.label = 'English';
      trackEl.setAttribute('default', '');

      // Track load/error events
      trackEl.addEventListener('load', () => {
        logger.log('✅ Subtitle track loaded successfully');
      });

      trackEl.addEventListener('error', (e) => {
        logger.error('❌ Subtitle track failed to load:', e);
        showWarning('Subtitles may not be available for this video');
      });

      // IMPORTANT: Track must be INSIDE media-outlet, not before it!
      mediaOutlet.appendChild(trackEl);
    } else {
      logger.log('No subtitles - creating player without tracks');
    }

    // Create the community skin
    const skin = document.createElement('media-community-skin');

    // Assemble player structure
    newPlayer.appendChild(mediaOutlet);
    newPlayer.appendChild(skin);

    // Add to container
    containerRef.current.appendChild(newPlayer);
    logger.log('✅ New player created and added to DOM');

    // Enable subtitles when player is ready (use event listener instead of setTimeout)
    if (subtitleUrl && enableSubtitles) {
      const playerElement = newPlayer as any;

      // Listen for the 'can-play' event which indicates player is ready
      const enableSubtitlesOnReady = () => {
        logger.log('🎬 Player ready, attempting to enable subtitles...');

        if (playerElement.textTracks && playerElement.textTracks.length > 0) {
          logger.log(`Found ${playerElement.textTracks.length} text tracks`);

          for (let i = 0; i < playerElement.textTracks.length; i++) {
            const track = playerElement.textTracks[i];
            logger.log(`Track ${i}:`, {
              language: track.language,
              label: track.label,
              mode: track.mode,
              kind: track.kind
            });

            // Enable the English subtitle track
            if (track.kind === 'subtitles' && (track.language === 'en' || track.label === 'English')) {
              track.mode = 'showing';
              logger.log(`✅ Enabled track ${i} (${track.label})`);
            }
          }
        } else {
          logger.warn('⚠️ No text tracks found on player');
        }
      };

      // Try multiple events to ensure we catch when the player is ready
      playerElement.addEventListener('can-play', enableSubtitlesOnReady, { once: true });
      playerElement.addEventListener('loaded-metadata', enableSubtitlesOnReady, { once: true });

      // Fallback: also try after a delay in case events don't fire
      setTimeout(() => {
        if (playerElement.textTracks && playerElement.textTracks.length > 0) {
          enableSubtitlesOnReady();
        }
      }, 2000);
    }

    logger.groupEnd();

    // Cleanup function
    return () => {
      logger.log('🧹 Cleaning up player');
      const player = containerRef.current?.querySelector('media-player');
      if (player) {
        player.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, subtitleUrl, poster, className, enableSubtitles, showWarning]);

  // Load Vidstack CSS and JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logger.log('📦 Loading Vidstack assets from CDN');

    // Check if already loaded
    const existingDefaultsCSS = document.querySelector('link[href*="vidstack/styles/defaults.css"]');
    const existingSkinCSS = document.querySelector('link[href*="vidstack/styles/community-skin/video.css"]');
    const existingScript = document.querySelector('script[src*="vidstack/dist/cdn/prod.js"]');

    // Load CSS - defaults
    if (!existingDefaultsCSS) {
      const defaultsLink = document.createElement('link');
      defaultsLink.rel = 'stylesheet';
      defaultsLink.href = 'https://cdn.jsdelivr.net/npm/vidstack/styles/defaults.css';
      document.head.appendChild(defaultsLink);
      logger.log('✅ Loaded Vidstack defaults.css');
    }

    // Load CSS - community skin
    if (!existingSkinCSS) {
      const skinLink = document.createElement('link');
      skinLink.rel = 'stylesheet';
      skinLink.href = 'https://cdn.jsdelivr.net/npm/vidstack/styles/community-skin/video.css';
      document.head.appendChild(skinLink);
      logger.log('✅ Loaded Vidstack community-skin CSS');
    }

    // Load JS
    if (!existingScript) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://cdn.jsdelivr.net/npm/vidstack/dist/cdn/prod.js';
      script.onload = () => {
        logger.log('✅ Vidstack JS loaded from CDN');
      };
      script.onerror = (err) => {
        logger.error('❌ Failed to load Vidstack JS:', err);
        showError('Failed to load video player. Please refresh the page.');
      };
      document.head.appendChild(script);
    }
  }, [showError]);

  return (
    <div
      ref={containerRef}
      className="vidstack-container w-full"
      aria-label="Video player"
    >
      {!videoUrl && (
        <div className="flex items-center justify-center h-64 bg-muted rounded-lg border border-border">
          <p className="text-muted-foreground">No video loaded</p>
        </div>
      )}
    </div>
  );
}
