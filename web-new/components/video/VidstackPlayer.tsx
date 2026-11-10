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
import { useTouchGestures } from '@/lib/hooks/useTouchGestures';
import { addSubtitles } from '@/lib/video/subtitles';

/** Pinned: an unversioned CDN URL let the player change under us. Bump deliberately. */
export const VIDSTACK_CDN = 'https://cdn.jsdelivr.net/npm/vidstack@0.6.15';

// TypeScript declarations for Vidstack custom elements
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
  /** Video title for Media Session API (lock screen controls) */
  title?: string;
  /** Artist/Channel name for Media Session API */
  artist?: string;
  /** Seek here once metadata loads (Listen → Watch handoff, resume). */
  startTime?: number;
  /** 1 or 1.5; re-applied on every play. */
  playbackRate?: number;
  /** Called on the inner video's timeupdate. */
  onTimeUpdate?: (currentTime: number, duration: number, paused: boolean) => void;
  /**
   * Load and play right away instead of waiting for the first touch (e.g. Watch pressed in
   * Listen: that tap already says "I want the video").
   */
  autoPlay?: boolean;
}

export function VidstackPlayer({
  videoUrl,
  subtitleUrl,
  poster,
  className = 'video-player-box',
  onError,
  enableSubtitles = true,
  title,
  artist = 'PayMoneyWubby',
  startTime = 0,
  playbackRate = 1,
  onTimeUpdate,
  autoPlay = false,
}: VidstackPlayerProps) {
  logger.log('VidstackPlayer render:', {
    hasVideoUrl: !!videoUrl,
    hasSubtitleUrl: !!subtitleUrl,
    enableSubtitles,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement | null>(null);
  const { showError } = useToast();

  // Enable touch gestures for mobile (drag down = PiP, drag up = fullscreen)
  useTouchGestures(playerRef, {
    threshold: 80,
    enablePiP: true,
    enableFullscreen: true,
    mobileOnly: true,
  });

  const startTimeRef = useRef(startTime);
  const rateRef = useRef(playbackRate);
  const autoPlayRef = useRef(autoPlay);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Reach the <video> Vidstack creates inside <media-player>: start time, rate, time reporting.
  useEffect(() => {
    if (!videoUrl) return;
    const controller = new AbortController();
    const { signal } = controller;
    let attempts = 0;
    const timer = setInterval(() => {
      const video = containerRef.current?.querySelector('video');
      if (!video) {
        // With load="custom" the <video> may only appear once the viewer taps, which can be
        // minutes later, so keep looking (cheaply) rather than giving up.
        if (++attempts > 100 * 60 * 30) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      video.playbackRate = rateRef.current;
      video.addEventListener('play', () => {
        if (video.playbackRate !== rateRef.current) video.playbackRate = rateRef.current;
      }, { signal });
      video.addEventListener('timeupdate', () => onTimeUpdateRef.current?.(video.currentTime, video.duration, video.paused), { signal });
      const start = startTimeRef.current;
      if (start > 0) {
        // Vidstack applies its own pending start time (~0.1 s) to the <video> just after can-play,
        // overwriting a raw `video.currentTime` seek (measured 2026-11-08: our 3597 → 0.1 five ms
        // later). Setting it through <media-player> updates Vidstack's state, so it sticks.
        // `once`, so a later deliberate seek by the user is never yanked back.
        const player = containerRef.current?.querySelector('media-player') as (HTMLElement & { currentTime: number }) | null;
        const seek = () => {
          if (Math.abs(video.currentTime - start) <= 2) return;
          if (player && 'currentTime' in player) player.currentTime = start;
          else video.currentTime = start;
        };
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) seek();
        else if (player) player.addEventListener('can-play', seek, { once: true, signal });
        else video.addEventListener('canplay', seek, { once: true, signal });
      }
    }, 100);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [videoUrl]);

  useEffect(() => {
    rateRef.current = playbackRate;
    const video = containerRef.current?.querySelector('video');
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

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
          player.addEventListener('error', (e: Event) => {
            const detail = (e as CustomEvent).detail;
            logger.error('❌ Player error:', detail);
            const error = new Error(detail?.message || 'Player error occurred');
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
    playerRef.current = newPlayer; // Store ref for touch gestures
    newPlayer.setAttribute('class', className);
    newPlayer.setAttribute('src', videoUrl);
    if (poster) {
      newPlayer.setAttribute('poster', poster);
      logger.log('🖼️ Poster attribute set:', poster);
    } else {
      logger.warn('⚠️ No poster URL provided');
    }
    newPlayer.setAttribute('playsinline', '');

    // Download nothing until the viewer asks for video. The VODs keep a 23.6 MB moov at the END of
    // a 27 GB file; Vidstack's default (load="visible" + preload="metadata") pulled ~31 MB just for
    // opening /watch (measured 2026-11-08), which is costly on mobile data and wasted when the
    // viewer picks Listen. In 0.6.15 `preload` doesn't reach the <video>, but load="custom" is
    // honoured: nothing loads until startLoading().
    newPlayer.setAttribute('load', 'custom');
    const vidstack = newPlayer as HTMLElement & { startLoading?: () => void; play?: () => Promise<void> };
    let loadRequested = false;
    const requestLoad = () => {
      if (loadRequested) return;
      loadRequested = true;
      // Play as soon as it can: the tap that asked for video counts as the user gesture
      // (Chrome's sticky activation), so this isn't blocked as autoplay.
      newPlayer.addEventListener('can-play', () => void vidstack.play?.().catch(() => undefined), { once: true });
      void customElements.whenDefined('media-player').then(() => vidstack.startLoading?.());
    };
    newPlayer.addEventListener('pointerdown', requestLoad, { capture: true });
    newPlayer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') requestLoad();
    }, { capture: true });
    if (autoPlayRef.current) requestLoad();

    // Create media outlet
    const mediaOutlet = document.createElement('media-outlet');

    // Create the community skin
    const skin = document.createElement('media-community-skin');

    // Assemble player structure
    newPlayer.appendChild(mediaOutlet);
    newPlayer.appendChild(skin);

    // Add to container
    containerRef.current.appendChild(newPlayer);
    logger.log('✅ New player created and added to DOM');

    // Set poster on the actual video element after player is created
    if (poster) {
      const checkVideoAndSetPoster = () => {
        const videoElement = newPlayer.querySelector('video');
        if (videoElement) {
          videoElement.setAttribute('poster', poster);
          logger.log('✅ Poster set on video element:', poster);
        } else {
          // Retry after a short delay if video element doesn't exist yet
          setTimeout(checkVideoAndSetPoster, 100);
        }
      };
      checkVideoAndSetPoster();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerElement = newPlayer as any;

    // Subtitles: registered once playback loads (opening /watch still downloads nothing); Vidstack
    // fetches and draws them (see lib/video/subtitles.ts for why not a <track>).
    const subtitles = new AbortController();
    let subtitleBlob: string | null = null;
    if (subtitleUrl && enableSubtitles) {
      newPlayer.addEventListener('can-play', () => {
        addSubtitles(newPlayer, subtitleUrl, subtitles.signal)
          .then((blobUrl) => {
            subtitleBlob = blobUrl;
            logger.log(blobUrl ? '✅ Subtitles added' : 'No subtitles for this VOD');
          })
          .catch((err) => {
            if (!subtitles.signal.aborted) logger.warn('Subtitles failed to load', err);
          });
      }, { once: true });
    }

    // Set up Media Session API for background playback and lock screen controls
    if ('mediaSession' in navigator) {
      playerElement.addEventListener('loaded-metadata', () => {
        try {
          // Set metadata for lock screen display
          navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'Wubby Stream',
            artist: artist || 'PayMoneyWubby',
            artwork: poster ? [
              { src: poster, sizes: '512x512', type: 'image/jpeg' }
            ] : undefined,
          });

          logger.log('📱 Media Session metadata set for background playback');

          // Set up action handlers for lock screen controls
          navigator.mediaSession.setActionHandler('play', () => {
            playerElement.play?.();
            logger.debug('Media Session: play');
          });

          navigator.mediaSession.setActionHandler('pause', () => {
            playerElement.pause?.();
            logger.debug('Media Session: pause');
          });

          navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            playerElement.currentTime = Math.max(0, playerElement.currentTime - skipTime);
            logger.debug(`Media Session: seek backward ${skipTime}s`);
          });

          navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            const duration = playerElement.state?.duration || playerElement.duration;
            playerElement.currentTime = Math.min(duration, playerElement.currentTime + skipTime);
            logger.debug(`Media Session: seek forward ${skipTime}s`);
          });

          // Update playback position for lock screen scrubber
          const updatePositionState = () => {
            const duration = playerElement.state?.duration || playerElement.duration;
            if (duration && navigator.mediaSession.setPositionState) {
              navigator.mediaSession.setPositionState({
                duration,
                playbackRate: playerElement.playbackRate || 1,
                position: playerElement.currentTime || 0,
              });
            }
          };

          playerElement.addEventListener('time-update', updatePositionState);
          playerElement.addEventListener('play', updatePositionState);
          playerElement.addEventListener('pause', updatePositionState);

        } catch (error) {
          logger.warn('Failed to set up Media Session API', error);
        }
      }, { once: true });
    }

    logger.groupEnd();

    // Cleanup function
    return () => {
      logger.log('🧹 Cleaning up player');
      subtitles.abort();
      if (subtitleBlob) URL.revokeObjectURL(subtitleBlob);
      const player = containerRef.current?.querySelector('media-player');
      if (player) {
        player.remove();
      }
      playerRef.current = null; // Clear ref
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, subtitleUrl, poster, className, enableSubtitles]);

  // Load Vidstack CSS and JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logger.log('📦 Loading Vidstack assets from CDN');

    // Check if already loaded
    const existingDefaultsCSS = document.querySelector(`link[href="${VIDSTACK_CDN}/styles/defaults.css"]`);
    const existingSkinCSS = document.querySelector(`link[href="${VIDSTACK_CDN}/styles/community-skin/video.css"]`);
    const existingScript = document.querySelector(`script[src="${VIDSTACK_CDN}/dist/cdn/prod.js"]`);

    // Load CSS - defaults
    if (!existingDefaultsCSS) {
      const defaultsLink = document.createElement('link');
      defaultsLink.rel = 'stylesheet';
      defaultsLink.href = `${VIDSTACK_CDN}/styles/defaults.css`;
      document.head.appendChild(defaultsLink);
      logger.log('✅ Loaded Vidstack defaults.css');
    }

    // Load CSS - community skin
    if (!existingSkinCSS) {
      const skinLink = document.createElement('link');
      skinLink.rel = 'stylesheet';
      skinLink.href = `${VIDSTACK_CDN}/styles/community-skin/video.css`;
      document.head.appendChild(skinLink);
      logger.log('✅ Loaded Vidstack community-skin CSS');
    }

    // Load JS
    if (!existingScript) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = `${VIDSTACK_CDN}/dist/cdn/prod.js`;
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
