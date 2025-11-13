/**
 * Storage Cleanup Utility
 *
 * Manages localStorage cleanup for Vidstack playback positions.
 * Removes old positions to prevent quota issues and keep storage clean.
 */

import { logger } from './logger';

/**
 * Configuration for storage cleanup
 */
const CLEANUP_CONFIG = {
  /** Maximum age of playback positions in days */
  MAX_AGE_DAYS: 60,
  /** Maximum number of positions to keep */
  MAX_POSITIONS: 100,
  /** Vidstack storage key prefix */
  VIDSTACK_PREFIX: 'vds-',
};

/**
 * Interface for parsed Vidstack storage data
 */
interface VidstackStorageData {
  currentTime?: number;
  volume?: number;
  muted?: boolean;
  lang?: string;
  captions?: boolean;
  [key: string]: unknown;
}

/**
 * Interface for position entry with metadata
 */
interface PositionEntry {
  key: string;
  data: VidstackStorageData;
  lastModified: number;
  size: number;
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all Vidstack storage entries from localStorage
 */
function getVidstackEntries(): PositionEntry[] {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage not available for cleanup');
    return [];
  }

  const entries: PositionEntry[] = [];

  try {
    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key || !key.startsWith(CLEANUP_CONFIG.VIDSTACK_PREFIX)) {
        continue;
      }

      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const data = JSON.parse(value) as VidstackStorageData;

        entries.push({
          key,
          data,
          lastModified: Date.now(), // Vidstack doesn't store timestamp, use current time
          size: value.length,
        });
      } catch (error) {
        logger.warn(`Failed to parse Vidstack entry: ${key}`, error);
      }
    }
  } catch (error) {
    logger.error('Error scanning localStorage entries', error);
  }

  return entries;
}

/**
 * Clean up old playback positions from localStorage
 *
 * Removes entries that:
 * 1. Are older than MAX_AGE_DAYS (60 days)
 * 2. Exceed MAX_POSITIONS limit (keeps newest 100)
 *
 * @returns Cleanup statistics
 */
export function cleanupOldPlaybackPositions(): {
  totalFound: number;
  removed: number;
  kept: number;
  bytesFreed: number;
} {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage not available, skipping cleanup');
    return { totalFound: 0, removed: 0, kept: 0, bytesFreed: 0 };
  }

  const entries = getVidstackEntries();
  const now = Date.now();
  const maxAgeMs = CLEANUP_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  let removed = 0;
  let bytesFreed = 0;

  logger.info(`Starting playback position cleanup. Found ${entries.length} entries.`);

  try {
    // Sort by last modified (newest first)
    const sortedEntries = entries.sort((a, b) => b.lastModified - a.lastModified);

    // Remove entries that are too old or exceed limit
    sortedEntries.forEach((entry, index) => {
      const age = now - entry.lastModified;
      const exceedsLimit = index >= CLEANUP_CONFIG.MAX_POSITIONS;
      const tooOld = age > maxAgeMs;

      if (exceedsLimit || tooOld) {
        try {
          localStorage.removeItem(entry.key);
          removed++;
          bytesFreed += entry.size;

          const reason = tooOld
            ? `older than ${CLEANUP_CONFIG.MAX_AGE_DAYS} days`
            : `exceeds limit of ${CLEANUP_CONFIG.MAX_POSITIONS}`;

          logger.debug(`Removed position: ${entry.key} (${reason})`);
        } catch (error) {
          logger.warn(`Failed to remove entry: ${entry.key}`, error);
        }
      }
    });

    const kept = entries.length - removed;

    logger.info(
      `Cleanup complete. Removed: ${removed}, Kept: ${kept}, Bytes freed: ${bytesFreed}`
    );

    return {
      totalFound: entries.length,
      removed,
      kept,
      bytesFreed,
    };
  } catch (error) {
    logger.error('Error during cleanup', error);
    return {
      totalFound: entries.length,
      removed,
      kept: entries.length - removed,
      bytesFreed,
    };
  }
}

/**
 * Get statistics about current playback positions
 */
export function getPlaybackPositionStats(): {
  totalPositions: number;
  totalSize: number;
  oldestPosition: number | null;
  newestPosition: number | null;
} {
  const entries = getVidstackEntries();

  if (entries.length === 0) {
    return {
      totalPositions: 0,
      totalSize: 0,
      oldestPosition: null,
      newestPosition: null,
    };
  }

  const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
  const timestamps = entries.map((e) => e.lastModified);

  return {
    totalPositions: entries.length,
    totalSize,
    oldestPosition: Math.min(...timestamps),
    newestPosition: Math.max(...timestamps),
  };
}

/**
 * Clear all playback positions (use with caution)
 */
export function clearAllPlaybackPositions(): number {
  const entries = getVidstackEntries();
  let removed = 0;

  entries.forEach((entry) => {
    try {
      localStorage.removeItem(entry.key);
      removed++;
    } catch (error) {
      logger.warn(`Failed to remove entry: ${entry.key}`, error);
    }
  });

  logger.info(`Cleared ${removed} playback positions`);
  return removed;
}
