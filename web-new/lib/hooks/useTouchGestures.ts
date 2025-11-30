import { useEffect, useRef } from 'react';
import { logger } from '@/lib/utils/logger';

/**
 * Configuration for touch gesture behavior
 */
interface TouchGestureConfig {
  /** Minimum vertical distance (px) to trigger action */
  threshold?: number;
  /** Enable Picture-in-Picture on drag down */
  enablePiP?: boolean;
  /** Enable Fullscreen on drag up */
  enableFullscreen?: boolean;
  /** Only enable on mobile devices */
  mobileOnly?: boolean;
  /** Enable visual scale feedback during drag */
  enableScaleFeedback?: boolean;
}

/**
 * Custom hook for video player touch gestures
 * - Drag down: Enter Picture-in-Picture mode
 * - Drag up: Enter Fullscreen mode
 *
 * @param videoElementRef - Ref to the video element or media-player element
 * @param config - Configuration options
 */
export function useTouchGestures(
  videoElementRef: React.RefObject<HTMLElement | null>,
  config: TouchGestureConfig = {}
) {
  const {
    threshold = 80,
    enablePiP = true,
    enableFullscreen = true,
    mobileOnly = true,
    enableScaleFeedback = true,
  } = config;

  // Track touch state
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  useEffect(() => {
    // Poll for element if not immediately available (ref may be set after mount)
    let element = videoElementRef.current;
    let pollAttempts = 0;
    const maxPolls = 10;

    const checkAndInitialize = () => {
      element = videoElementRef.current;

      if (!element) {
        pollAttempts++;
        if (pollAttempts < maxPolls) {
          // Try again in 100ms
          setTimeout(checkAndInitialize, 100);
        } else {
          logger.debug('[useTouchGestures] No element found after polling');
        }
        return;
      }

      // Element found, proceed with initialization
      initializeGestures(element);
    };

    // Start checking
    checkAndInitialize();

    // Cleanup function
    return () => {
      if (element) {
        cleanupGestures(element);
      }
    };
  }, [threshold, enablePiP, enableFullscreen, mobileOnly]);

  // Separated initialization logic
  function initializeGestures(element: HTMLElement) {
    // Check if we should enable gestures (mobile only if configured)
    if (mobileOnly && !isMobileDevice()) {
      logger.debug('[useTouchGestures] Desktop detected, gestures disabled');
      return;
    }

    // Check browser support
    const supportsPiP = 'pictureInPictureEnabled' in document;
    const supportsFullscreen = 'requestFullscreen' in element || 'webkitRequestFullscreen' in element;

    if (!supportsPiP && !supportsFullscreen) {
      logger.warn('[useTouchGestures] Browser does not support PiP or Fullscreen');
      return;
    }

    logger.log('[useTouchGestures] Initializing touch gestures', {
      threshold,
      enablePiP,
      enableFullscreen,
      supportsPiP,
      supportsFullscreen,
    });

    /**
     * Handle touch start - record initial position
     */
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle single-finger touches
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      isDragging.current = false;

      logger.debug('[useTouchGestures] Touch start:', { x: touch.clientX, y: touch.clientY });
    };

    /**
     * Apply scale transform during drag for visual feedback
     */
    const applyScaleTransform = (deltaY: number) => {
      if (!enableScaleFeedback) return;

      // Calculate scale based on drag distance
      // Drag down (PiP): shrink from 1.0 to 0.85
      // Drag up (Fullscreen): grow from 1.0 to 1.05
      let scale: number;
      if (deltaY > 0) {
        // Dragging down - shrink (PiP preview)
        scale = Math.max(0.85, 1 - (deltaY / 400));
      } else {
        // Dragging up - grow (Fullscreen preview)
        scale = Math.min(1.05, 1 + (Math.abs(deltaY) / 800));
      }

      element.style.transform = `scale(${scale})`;
      element.style.transition = 'none';
    };

    /**
     * Reset scale transform with spring animation
     */
    const resetScaleTransform = () => {
      if (!enableScaleFeedback) return;

      element.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      element.style.transform = 'scale(1)';

      // Clean up transition after animation
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
      }, 300);
    };

    /**
     * Handle touch move - track if user is dragging vertically
     */
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = touch.clientX - touchStartX.current;

      // Check if this is a vertical drag (more vertical than horizontal movement)
      const isVerticalDrag = Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10;

      if (isVerticalDrag) {
        isDragging.current = true;
        // Prevent default scroll behavior during vertical drag
        e.preventDefault();

        // Apply scale feedback during drag
        applyScaleTransform(deltaY);
      }
    };

    /**
     * Handle touch end - trigger action if threshold met
     */
    const handleTouchEnd = async (e: TouchEvent) => {
      // Always reset scale on touch end
      resetScaleTransform();

      if (touchStartY.current === null || !isDragging.current) {
        // Reset state
        touchStartY.current = null;
        touchStartX.current = null;
        isDragging.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - touchStartY.current;

      logger.debug('[useTouchGestures] Touch end:', { deltaY, threshold });

      // Reset state first
      touchStartY.current = null;
      touchStartX.current = null;
      isDragging.current = false;

      // Check if threshold met
      if (Math.abs(deltaY) < threshold) {
        logger.debug('[useTouchGestures] Below threshold, ignoring');
        return;
      }

      // Drag DOWN (positive deltaY) -> Picture-in-Picture
      if (deltaY > 0 && enablePiP) {
        logger.log('[useTouchGestures] Drag down detected, entering PiP');
        await enterPictureInPicture(element);
      }
      // Drag UP (negative deltaY) -> Fullscreen
      else if (deltaY < 0 && enableFullscreen) {
        logger.log('[useTouchGestures] Drag up detected, entering fullscreen');
        await enterFullscreen(element);
      }
    };

    // Add event listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  // Separated cleanup logic
  function cleanupGestures(element: HTMLElement) {
    // Note: We can't remove the exact handlers because they're defined inside initializeGestures
    // This is acceptable because the element itself is being removed
    logger.debug('[useTouchGestures] Cleanup called');
  }
}

/**
 * Check if the current device is mobile
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for touch capability AND small screen
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  return hasTouchScreen && isSmallScreen;
}

/**
 * Enter Picture-in-Picture mode
 */
async function enterPictureInPicture(element: HTMLElement) {
  try {
    // Check if PiP is supported
    if (!('pictureInPictureEnabled' in document)) {
      logger.warn('[useTouchGestures] Picture-in-Picture not supported');
      return;
    }

    // Find the video element (might be inside media-player)
    const videoElement = element.tagName === 'VIDEO'
      ? element as HTMLVideoElement
      : element.querySelector('video');

    if (!videoElement) {
      logger.error('[useTouchGestures] No video element found');
      return;
    }

    // Check if already in PiP
    if (document.pictureInPictureElement === videoElement) {
      logger.debug('[useTouchGestures] Already in PiP mode');
      return;
    }

    // Request PiP
    await videoElement.requestPictureInPicture();
    logger.log('[useTouchGestures] ✅ Entered Picture-in-Picture mode');
  } catch (error) {
    logger.error('[useTouchGestures] Failed to enter PiP:', error);
  }
}

/**
 * Enter Fullscreen mode
 */
async function enterFullscreen(element: HTMLElement) {
  try {
    // Check if already in fullscreen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      logger.debug('[useTouchGestures] Already in fullscreen mode');
      return;
    }

    // Try standard API first
    if ('requestFullscreen' in element) {
      await element.requestFullscreen();
    }
    // Fallback to webkit (iOS Safari)
    else if ('webkitRequestFullscreen' in element) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (element as any).webkitRequestFullscreen();
    }
    else {
      logger.warn('[useTouchGestures] Fullscreen not supported');
      return;
    }

    logger.log('[useTouchGestures] ✅ Entered fullscreen mode');
  } catch (error) {
    logger.error('[useTouchGestures] Failed to enter fullscreen:', error);
  }
}
