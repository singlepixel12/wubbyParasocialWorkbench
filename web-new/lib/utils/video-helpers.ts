/**
 * Video Helper Utilities
 * Date formatting and video URL parsing functions
 * Ported from: src/vodDiary.js
 */

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
    console.error('Error extracting original title:', error);
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
