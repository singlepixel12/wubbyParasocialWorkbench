'use client';

/**
 * VidstackPlayer Component
 * React wrapper for Vidstack web components player
 * Supports dynamic video and subtitle loading
 * Ported from: player.html + transcript.html Vidstack implementation
 */
import { logger } from '@/lib/utils/logger';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/lib/hooks/useToast';
import { useTouchGestures } from '@/lib/hooks/useTouchGestures';

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
  /** Storage key for Vidstack position tracking (usually video hash) */
  storageKey?: string;
  /** Video title for Media Session API (lock screen controls) */
  title?: string;
  /** Artist/Channel name for Media Session API */
  artist?: string;
}

export function VidstackPlayer({
  videoUrl,
  subtitleUrl,
  poster,
  className = 'video-player-box',
  onError,
  enableSubtitles = true,
  storageKey,
  title,
  artist = 'PayMoneyWubby',
}: VidstackPlayerProps) {
  logger.log('VidstackPlayer render:', {
    hasVideoUrl: !!videoUrl,
    hasSubtitleUrl: !!subtitleUrl,
    enableSubtitles,
    hasStorageKey: !!storageKey,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement | null>(null);
  const { showError, showWarning } = useToast();

  // Track watch time for 30-second threshold before enabling storage
  const [hasWatched30Seconds, setHasWatched30Seconds] = useState(false);
  const watchTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Enable touch gestures for mobile (drag down = PiP, drag up = fullscreen)
  useTouchGestures(playerRef, {
    threshold: 80,
    enablePiP: true,
    enableFullscreen: true,
    mobileOnly: true,
  });

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

    // Restore saved position after player is ready (do this AFTER subtitles are set up)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerElement = newPlayer as any;
    const restoreSavedPosition = () => {
      if (!storageKey) return;

      try {
        const saved = localStorage.getItem(`vds-${storageKey}`);
        if (saved) {
          const position = JSON.parse(saved);
          const age = Date.now() - position.timestamp;

          // Only restore if position was saved within last 60 days
          if (age < 60 * 24 * 60 * 60 * 1000) {
            logger.log(`🔄 Restoring position: ${Math.floor(position.currentTime)}s`);

            // Wait for duration to be available (Vidstack uses state.duration, not duration directly)
            const attemptRestore = () => {
              const duration = playerElement.state?.duration || playerElement.duration;
              if (duration && duration > 0) {
                playerElement.currentTime = position.currentTime;
                logger.log(`✅ Position restored to ${Math.floor(position.currentTime)}s`);
              }
            };

            const duration = playerElement.state?.duration || playerElement.duration;
            if (duration && duration > 0) {
              attemptRestore();
            } else {
              playerElement.addEventListener('loaded-metadata', attemptRestore, { once: true });
              playerElement.addEventListener('duration-change', attemptRestore, { once: true });
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to restore playback position', error);
      }
    };

    // Enable subtitles when player is ready (use event listener instead of setTimeout)
    if (subtitleUrl && enableSubtitles) {
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

        // Restore position AFTER subtitles are enabled
        restoreSavedPosition();
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
    } else {
      // No subtitles, restore position directly when player is ready
      playerElement.addEventListener('loaded-metadata', restoreSavedPosition, { once: true });
      playerElement.addEventListener('can-play', restoreSavedPosition, { once: true });
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
      const player = containerRef.current?.querySelector('media-player');
      if (player) {
        player.remove();
      }
      playerRef.current = null; // Clear ref
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, subtitleUrl, poster, className, enableSubtitles, showWarning]);

  // Track watch time and enable manual position saving after 30 seconds
  useEffect(() => {
    if (!storageKey || !containerRef.current) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = containerRef.current.querySelector('media-player') as any;
    if (!player) {
      return;
    }

    logger.log('⏱️ Starting watch time tracking for storage (30s threshold)');

    const savePosition = () => {
      if (!player.currentTime || !hasWatched30Seconds) return;

      const position = {
        currentTime: player.currentTime,
        duration: player.duration || 0,
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(`vds-${storageKey}`, JSON.stringify(position));
        logger.debug(`💾 Saved position: ${Math.floor(position.currentTime)}s`);
      } catch (error) {
        logger.warn('Failed to save playback position', error);
      }
    };

    const handleTimeUpdate = () => {
      if (!player.currentTime) return;

      // Track actual watch time (not just playback position)
      const currentTime = player.currentTime;
      const timeDiff = currentTime - lastTimeRef.current;

      // Only count forward playback (prevent seeking backward from adding time)
      if (timeDiff > 0 && timeDiff < 2) {
        watchTimeRef.current += timeDiff;
      }

      lastTimeRef.current = currentTime;

      // Check if 30 seconds watched (first time)
      if (watchTimeRef.current >= 30 && !hasWatched30Seconds) {
        logger.log(`✅ 30 seconds watched! Enabling position saving with key: vds-${storageKey}`);
        setHasWatched30Seconds(true);
      }

      // Save position every 10 seconds after threshold crossed
      if (hasWatched30Seconds && Math.floor(currentTime) % 10 === 0) {
        savePosition();
      }
    };

    const handlePlay = () => {
      if (!lastTimeRef.current && player.currentTime) {
        lastTimeRef.current = player.currentTime;
      }
    };

    const handlePause = () => {
      savePosition();
    };

    const handleSeeked = () => {
      // Update lastTimeRef to current position after seeking
      lastTimeRef.current = player.currentTime;
    };

    // Add event listeners
    player.addEventListener('time-update', handleTimeUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('seeked', handleSeeked);

    // Note: Position restoration is handled in the player recreation effect (lines 162-242)
    // after subtitle setup completes, to avoid conflicts with player recreation

    return () => {
      savePosition(); // Save one last time on cleanup
      player.removeEventListener('time-update', handleTimeUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('seeked', handleSeeked);
    };
  }, [storageKey, hasWatched30Seconds]);

  // Reset watch time tracking when video changes
  useEffect(() => {
    watchTimeRef.current = 0;
    lastTimeRef.current = 0;
    setHasWatched30Seconds(false);
    logger.log('🔄 Reset watch time tracking for new video');
  }, [videoUrl]);

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
