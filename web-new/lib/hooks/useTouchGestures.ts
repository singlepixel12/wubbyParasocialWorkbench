import { useEffect } from 'react';
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

  useEffect(() => {
    // The ref may be set after mount (the player is created imperatively): poll briefly for it.
    let detach: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const tryAttach = () => {
      const element = videoElementRef.current;
      if (element) {
        detach = attachGestures(element, { threshold, enablePiP, enableFullscreen, mobileOnly, enableScaleFeedback });
        return;
      }
      if (++polls < MAX_POLLS) timer = setTimeout(tryAttach, 100);
      else logger.debug('[useTouchGestures] No element found after polling');
    };
    tryAttach();

    // Really detach: re-running the effect (config change, new player) used to stack listeners.
    return () => {
      clearTimeout(timer);
      detach?.();
    };
  }, [videoElementRef, threshold, enablePiP, enableFullscreen, mobileOnly, enableScaleFeedback]);
}

const MAX_POLLS = 10;

/**
 * Attach the drag gestures to `element`. Returns a function that removes them again.
 */
function attachGestures(element: HTMLElement, cfg: Required<TouchGestureConfig>): () => void {
  const { threshold, enablePiP, enableFullscreen, mobileOnly, enableScaleFeedback } = cfg;

  // Check if we should enable gestures (mobile only if configured)
  if (mobileOnly && !isMobileDevice()) {
    logger.debug('[useTouchGestures] Desktop detected, gestures disabled');
    return () => {};
  }

  // Check browser support
  const supportsPiP = 'pictureInPictureEnabled' in document;
  const supportsFullscreen = 'requestFullscreen' in element || 'webkitRequestFullscreen' in element;

  if (!supportsPiP && !supportsFullscreen) {
    logger.warn('[useTouchGestures] Browser does not support PiP or Fullscreen');
    return () => {};
  }

  logger.log('[useTouchGestures] Initializing touch gestures', {
    threshold,
    enablePiP,
    enableFullscreen,
    supportsPiP,
    supportsFullscreen,
  });

  // Touch state for this element only
  let touchStartY: number | null = null;
  let touchStartX: number | null = null;
  let isDragging = false;

  /**
   * Handle touch start - record initial position
   */
  const handleTouchStart = (e: TouchEvent) => {
    // Only handle single-finger touches
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    isDragging = false;

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
    if (touchStartY === null || touchStartX === null) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;

    // Check if this is a vertical drag (more vertical than horizontal movement)
    const isVerticalDrag = Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10;

    if (isVerticalDrag) {
      isDragging = true;
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

    if (touchStartY === null || !isDragging) {
      // Reset state
      touchStartY = null;
      touchStartX = null;
      isDragging = false;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartY;

    logger.debug('[useTouchGestures] Touch end:', { deltaY, threshold });

    // Reset state first
    touchStartY = null;
    touchStartX = null;
    isDragging = false;

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

  // passive: false on touchmove so a vertical drag can preventDefault the scroll
  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    logger.debug('[useTouchGestures] Gestures detached');
  };
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
