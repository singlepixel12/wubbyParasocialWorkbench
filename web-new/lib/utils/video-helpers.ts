/**
 * Video Helper Utilities
 * Date formatting and video URL parsing functions
 * Ported from: src/vodDiary.js
 */

import { format, parseISO } from 'date-fns';
import { logger } from './logger';

/**
 * Determine date format based on locale/timezone
 * Returns 'dmy' for Australian locale, 'mdy' for US/other
 */
export function getLocaleFormat(): 'dmy' | 'mdy' {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const lang = navigator.language || 'en-US';
  const isAU = tz.startsWith('Australia') || lang.toLowerCase().includes('-au');
  return isAU ? 'dmy' : 'mdy';
}

/**
 * Format date for display based on locale
 * Returns DD/MM/YYYY for AU, MM/DD/YYYY for US
 */
export function formatDateDisplay(dateObj: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = pad(dateObj.getDate());
  const m = pad(dateObj.getMonth() + 1);
  const y = dateObj.getFullYear();
  return getLocaleFormat() === 'dmy' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

/**
 * Extract original title from video URL
 * Removes timestamp suffix (_1753659052_000) and decodes URL encoding
 * Returns clean title for display without technical artifacts
 *
 * Example:
 * Input: "https://archive.wubby.tv/vods/public/jul_2025/27_MEDIA%20SHARE_1753659052_000.mp4"
 * Output: "27_MEDIA SHARE"
 */
export function extractOriginalTitle(videoUrl: string): string {
  if (!videoUrl || videoUrl === '#') return '';

  try {
    // Get the filename from the URL
    const url = new URL(videoUrl);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];

    // Remove the file extension
    const nameWithoutExt = filename.replace(/\.(mp4|webm|avi|mov)$/i, '');

    // Decode URL encoding and replace %20 with spaces
    const decodedName = decodeURIComponent(nameWithoutExt);

    // Remove timestamp suffix (e.g., _1753659052_000)
    const nameWithoutTimestamp = decodedName.replace(/_\d+_\d+$/, '');

    return nameWithoutTimestamp;
  } catch (error) {
    logger.error('Error extracting original title:', error);
    return '';
  }
}

/**
 * Get date range for "This Week" preset
 * Returns { from: 7 days ago, to: today }
 */
export function getThisWeekRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 7);
  return { from, to };
}

/**
 * Format date for Flatpickr/date picker based on locale
 * Returns format string for date picker library
 */
export function getDatePickerFormat(): string {
  return getLocaleFormat() === 'dmy' ? 'd/M/y' : 'M/d/y';
}

/**
 * Formats a date for display in a long format
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted date (e.g., "January 18, 2025")
 *
 * @example
 * ```ts
 * formatDateLong('2025-01-18T20:00:00Z'); // "January 18, 2025"
 * formatDateLong(new Date()); // "November 8, 2025"
 * ```
 */
export function formatDateLong(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'MMMM d, yyyy');
  } catch (error) {
    logger.error('Error formatting date:', error);
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Formats summary text for better readability
 *
 * Splits text by newlines and formats paragraphs with proper spacing
 *
 * @param summaryText - Raw summary text (may contain newlines)
 * @returns Formatted summary text with proper paragraph spacing
 *
 * @example
 * ```ts
 * formatSummaryText('First paragraph\n\nSecond paragraph');
 * // "First paragraph\n\nSecond paragraph"
 *
 * formatSummaryText(null);
 * // "- This vod has no summary -"
 * ```
 */
export function formatSummaryText(summaryText: string | null | undefined): string {
  try {
    if (!summaryText) return '- This vod has no summary -';

    // Validate input type
    if (typeof summaryText !== 'string') {
      logger.warn('Summary text is not a string:', typeof summaryText);
      return '- This vod has no summary -';
    }

    // Split by newlines, trim whitespace, and rejoin with double newlines
    return summaryText
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .join('\n\n');
  } catch (error) {
    logger.error('Error formatting summary text:', error);
    return '- This vod has no summary -';
  }
}

/**
 * Extract hook (1-2 sentences) from summary for browse cards
 *
 * This creates a scannable "hook" by taking the first 1-2 sentences
 * of a summary, making browse pages easier to scan.
 *
 * @param summary - Full AI-generated summary text
 * @param maxLength - Maximum character length (default: 100)
 * @returns Short 1-2 sentence hook
 *
 * @example
 * ```ts
 * const summary = "Wubby reacts to Reddit posts. The chat is hilarious. Everyone has fun.";
 * extractHook(summary); // "Wubby reacts to Reddit posts. The chat is hilarious."
 * extractHook(summary, 50); // "Wubby reacts to Reddit posts..."
 * ```
 */
export function extractHook(summary: string, maxLength: number = 100): string {
  if (!summary || typeof summary !== 'string') {
    return '';
  }

  try {
    // Split by period, exclamation, or question mark followed by space
    const sentences = summary.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);

    if (sentences.length === 0) {
      return summary.substring(0, maxLength) + (summary.length > maxLength ? '...' : '');
    }

    let hook = sentences[0];

    // If first sentence is too short (< 50 chars), add second sentence
    if (hook.length < 50 && sentences[1]) {
      hook += '. ' + sentences[1];
    }

    // Add period if missing
    if (hook && !hook.match(/[.!?]$/)) {
      hook += '.';
    }

    // Trim to max length if needed
    if (hook.length > maxLength) {
      hook = hook.substring(0, maxLength).trim();
      // Find last complete word
      const lastSpace = hook.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        // Only trim to last word if it's not too short
        hook = hook.substring(0, lastSpace);
      }
      hook += '...';
    }

    return hook;
  } catch (error) {
    logger.error('Error extracting hook:', error);
    return summary.substring(0, maxLength) + '...';
  }
}

/**
 * Format video duration from seconds to HH:MM:SS or MM:SS
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * ```ts
 * formatDuration(65); // "1:05"
 * formatDuration(3665); // "1:01:05"
 * formatDuration(undefined); // "--:--"
 * ```
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format view count with K/M suffixes
 *
 * @param views - Number of views
 * @returns Formatted view count
 *
 * @example
 * ```ts
 * formatViews(500); // "500"
 * formatViews(1500); // "1.5K"
 * formatViews(1500000); // "1.5M"
 * formatViews(undefined); // "0"
 * ```
 */
export function formatViews(views?: number): string {
  if (!views) return '0';

  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}K`;
  }
  return views.toString();
}
