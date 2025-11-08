/**
 * Text and date formatting utilities
 * Provides consistent formatting across the application
 */

import { format, parseISO } from 'date-fns';

/**
 * Locale format types for date display
 */
type LocaleFormat = 'dmy' | 'mdy';

/**
 * Determines the appropriate date format based on user's locale and timezone
 *
 * Australian timezones and locales use DD/MM/YYYY format
 * All other locales use MM/DD/YYYY format
 *
 * @returns 'dmy' for DD/MM/YYYY or 'mdy' for MM/DD/YYYY
 */
function getLocaleFormat(): LocaleFormat {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const lang = navigator.language || 'en-US';
  const isAU = tz.startsWith('Australia') || lang.toLowerCase().includes('-au');
  return isAU ? 'dmy' : 'mdy';
}

/**
 * Formats a Date object for display based on user's locale
 *
 * Automatically detects if user is in Australia and uses DD/MM/YYYY format
 * Otherwise uses MM/DD/YYYY format
 *
 * @param dateObj - The date to format
 * @returns Formatted date string (e.g., "18/07/2025" or "07/18/2025")
 *
 * @example
 * ```ts
 * formatDateDisplay(new Date('2025-07-18')); // "07/18/2025" (US)
 * formatDateDisplay(new Date('2025-07-18')); // "18/07/2025" (AU)
 * ```
 */
export function formatDateDisplay(dateObj: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = pad(dateObj.getDate());
  const m = pad(dateObj.getMonth() + 1);
  const y = dateObj.getFullYear();

  return getLocaleFormat() === 'dmy' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
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
    console.error('Error formatting date:', error);
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
      console.warn('Summary text is not a string:', typeof summaryText);
      return '- This vod has no summary -';
    }

    // Split by newlines, trim whitespace, and rejoin with double newlines
    return summaryText
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .join('\n\n');
  } catch (error) {
    console.error('Error formatting summary text:', error);
    return '- This vod has no summary -';
  }
}

/**
 * Extracts the original title from a video URL
 *
 * Removes timestamp suffixes (e.g., _1753659052_000) and file extensions
 * Decodes URL encoding for clean display
 *
 * @param videoUrl - The video URL from archive.wubby.tv
 * @returns Clean video title extracted from URL
 *
 * @example
 * ```ts
 * extractOriginalTitle('https://archive.wubby.tv/.../MEDIA%20SHARE_1753659052_000.mp4');
 * // "MEDIA SHARE"
 * ```
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
    console.error('Error extracting original title:', error);
    return '';
  }
}

/**
 * Truncates text to a specified length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * ```ts
 * truncateText('This is a very long text', 10);
 * // "This is a..."
 * ```
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Formats a relative time string (e.g., "2 hours ago")
 *
 * @param dateString - ISO date string or Date object
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime('2025-01-18T20:00:00Z');
 * // "2 hours ago" (if current time is 2025-01-18T22:00:00Z)
 * ```
 */
export function formatRelativeTime(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    // Fall back to formatted date for older content
    return formatDateLong(date);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Unknown';
  }
}
