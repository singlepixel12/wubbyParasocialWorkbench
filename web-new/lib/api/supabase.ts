/**
 * Supabase API client and video data fetching utilities
 * Handles all communication with the Supabase backend
 */

import type { Video, Platform, PlatformFilter } from '@/types/video';
import type {
  SupabaseVideoRow,
  FetchVideosParams,
  SearchVideosParams,
} from '@/types/supabase';
import { computeVideoHash, isValidHash } from '@/lib/utils/hash';
import { toUploadDateBounds } from '@/lib/utils/date-range';
import { SUPABASE_URL } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';

// Supabase anon key - must be set in environment variables
// This is a read-only key protected by Row Level Security (RLS)
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.'
  );
}

/**
 * Request timeout for all Supabase REST calls (milliseconds)
 */
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * User-facing message for an aborted (timed-out) request
 */
const TIMEOUT_MESSAGE =
  'Request timed out. Please check your connection and try again.';

/**
 * Runtime guard mirroring the PlatformFilter type for untyped callers.
 * 'both' is allowed but means "no platform constraint" (handled by callers).
 * Anything outside this set is rejected rather than passed through.
 */
const ALLOWED_PLATFORM_FILTERS: readonly PlatformFilter[] = [
  'both',
  'twitch',
  'kick',
];

/**
 * Maps an HTTP error response to a clear, user-facing message.
 *
 * Every message is prefixed with the caller-provided `context` so the failing
 * call site stays identifiable — a 404 from a list query must not read like a
 * single-video lookup failure.
 *
 * @param response - The failed fetch Response
 * @param context - Short description of the call site (e.g. 'Failed to load videos')
 * @returns A user-facing error message string
 */
function describeHttpError(response: Response, context: string): string {
  let detail: string;
  switch (response.status) {
    case 400:
      detail = 'bad request (invalid query parameters)';
      break;
    case 401:
      detail = 'authentication failed (check API key)';
      break;
    case 403:
      detail = 'access denied (insufficient permissions)';
      break;
    case 404:
      detail = 'not found';
      break;
    case 429:
      detail = 'too many requests - please wait and try again';
      break;
    case 500:
      detail = 'server error - please try again later';
      break;
    case 502:
    case 503:
    case 504:
      detail = 'service temporarily unavailable - please try again later';
      break;
    default:
      detail = `${response.status} - ${response.statusText}`;
  }
  return `${context}: ${detail}`;
}

/**
 * Performs a GET against the Supabase REST API with the shared auth headers,
 * a request timeout, and consistent error mapping.
 *
 * Every fetcher in this module must go through this helper — it owns the
 * AbortController/timer lifecycle (cleared in `finally` so it can never leak),
 * translates a timeout abort into a clear timeout error, and maps HTTP failures
 * via {@link describeHttpError}.
 *
 * A caller-supplied `signal` is chained into the same controller. When the
 * caller cancels, the original AbortError is rethrown untouched (never mapped
 * to the timeout message) so callers can tell "superseded" from "failed" with
 * {@link isAbortError}.
 *
 * @param queryUrl - Full REST query URL to fetch
 * @param context - Call-site description used in error messages
 * @param signal - Optional caller cancellation signal
 * @returns The successful Response (guaranteed `response.ok`)
 * @throws Error with a user-facing message on timeout or HTTP failure
 */
async function supabaseFetch(
  queryUrl: string,
  context: string,
  signal?: AbortSignal
): Promise<Response> {
  signal?.throwIfAborted();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(describeHttpError(response, context));
    }

    return response;
  } catch (error) {
    // A caller cancellation passes through as-is; any other abort can only be
    // our timer, so surface it as a clear timeout error.
    if (isAbortError(error) && !signal?.aborted) {
      throw new Error(TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * True for the error a cancelled request rejects with. Checked via the name
 * property (not instanceof Error) so a DOMException is caught even on engines
 * where it doesn't subclass Error.
 */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

/**
 * Maps Supabase row to application Video type
 */
function mapRowToVideo(row: SupabaseVideoRow): Video {
  // Handle tags - can be array or string
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === 'string') {
    tags = row.tags.split(',').map((t) => t.trim());
  }

  // Generate thumbnail URL if video hash exists
  const videoHash = row.video_hash;
  const thumbnailUrl = videoHash
    ? `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${videoHash}/thumbnail.webp`
    : undefined;

  return {
    url: row.video_url || '#',
    title: row.pleb_title || 'Untitled',
    platform: (row.platform as Platform) || 'unknown',
    summary: row.summary || '- This vod has no summary -',
    tags,
    date: row.upload_date || row.created_at || new Date().toISOString(),
    videoHash: videoHash || undefined,
    thumbnailUrl,
  };
}

/**
 * Fetches video metadata by video URL
 *
 * Uses SHA-256 hash of the URL to query the wubby_summary table
 *
 * @param videoUrl - The video URL from archive.wubby.tv
 * @returns Video metadata or null if not found
 * @throws Error on API failures or timeout
 *
 * @example
 * ```ts
 * const video = await getWubbySummary('https://archive.wubby.tv/...');
 * if (video) {
 *   console.log(video.title, video.summary);
 * }
 * ```
 */
export async function getWubbySummary(
  videoUrl: string
): Promise<Video | null> {
  logger.group('📡 Fetching Video Summary from Supabase');
  logger.log('Video URL:', videoUrl);
  logger.log('Supabase URL:', SUPABASE_URL);

  try {
    // Validate input
    if (!videoUrl || typeof videoUrl !== 'string') {
      logger.error('❌ Invalid video URL:', typeof videoUrl);
      throw new Error('Invalid video URL provided');
    }

    // Generate hash for lookup
    logger.log('Generating hash for database lookup...');
    const videoHash = await computeVideoHash(videoUrl);
    logger.log('Video hash:', videoHash);

    // Query Supabase using REST API directly for maximum control
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${videoHash}`;
    logger.log('Query URL:', queryUrl);
    logger.log('Making API request...');

    const response = await supabaseFetch(queryUrl, 'Video lookup failed');

    logger.log('✅ API request successful');
    const data: SupabaseVideoRow[] = await response.json();
    logger.log('Response data:', data);
    logger.log('Number of results:', data.length);

    // No results found
    if (data.length === 0) {
      logger.log(
        '⚠️ No summary found for video - this is normal for videos without metadata.'
      );
      logger.groupEnd();
      return null;
    }

    const video = mapRowToVideo(data[0]);
    logger.log('✅ Video metadata retrieved:', {
      title: video.title,
      platform: video.platform,
      date: video.date,
      tagsCount: video.tags.length,
    });
    logger.groupEnd();
    return video;
  } catch (error) {
    logger.error('❌ Error fetching video summary:', error);
    logger.groupEnd();

    // Handle specific error types (timeouts are already mapped by supabaseFetch)
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else if (error.name === 'SyntaxError') {
        throw new Error('Invalid response from server. Please try again.');
      }
    }

    // Re-throw formatted errors
    throw error;
  }
}

/**
 * Fetches video metadata by video hash (direct lookup)
 *
 * Uses the pre-computed video hash to query the wubby_summary table
 * This is faster than getWubbySummary since it doesn't need to compute the hash
 *
 * @param videoHash - The SHA-256 hash of the video URL (64 character hex string)
 * @returns Video metadata or null if not found
 * @throws Error on API failures
 *
 * @example
 * ```ts
 * const video = await getWubbySummaryByHash('8cc0eeeafb8d55f97531588f67c2671a0e645c4923655ad07f9801fac4b422a9');
 * if (video) {
 *   console.log(video.title, video.summary);
 * }
 * ```
 */
export async function getWubbySummaryByHash(
  videoHash: string
): Promise<Video | null> {
  logger.group('📡 Fetching Video Summary by Hash');
  logger.log('Video hash:', videoHash);

  try {
    // Validate input (must be a 64-character hex string) to prevent
    // injection of extra query parameters / PostgREST operators into the URL
    if (typeof videoHash !== 'string' || !isValidHash(videoHash)) {
      logger.error('❌ Invalid video hash:', videoHash);
      throw new Error('Invalid video hash provided (expected 64-character hex string)');
    }

    // Query Supabase using REST API directly
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${encodeURIComponent(videoHash)}`;
    logger.log('Query URL:', queryUrl);
    logger.log('Making API request...');

    const response = await supabaseFetch(queryUrl, 'Video lookup failed');

    logger.log('✅ API request successful');
    const data: SupabaseVideoRow[] = await response.json();
    logger.log('Response data:', data);
    logger.log('Number of results:', data.length);

    // No results found
    if (data.length === 0) {
      logger.log('⚠️ No video found for this hash');
      logger.groupEnd();
      return null;
    }

    const video = mapRowToVideo(data[0]);
    logger.log('✅ Video metadata retrieved:', {
      title: video.title,
      platform: video.platform,
      date: video.date,
      tagsCount: video.tags.length,
    });
    logger.groupEnd();
    return video;
  } catch (error) {
    logger.error('❌ Error fetching video by hash:', error);
    logger.groupEnd();
    throw error;
  }
}

/**
 * Fetches recent videos with optional filtering
 *
 * @param params - Query parameters (limit, platform, date range)
 * @returns Array of videos matching the filters
 *
 * @example
 * ```ts
 * const videos = await fetchRecentVideos({
 *   limit: 50,
 *   platform: 'twitch',
 *   fromDate: new Date('2025-01-01'),
 *   toDate: new Date('2025-01-31')
 * });
 * ```
 */
export async function fetchRecentVideos(
  params: FetchVideosParams = {}
): Promise<Video[]> {
  const { limit = 50, platform = 'both', fromDate = null, toDate = null, signal } = params;

  // Validate the platform against a whitelist before interpolating it into the
  // query string (runtime backstop for the PlatformFilter type). Rejecting
  // (rather than ignoring) an out-of-range value means a caller can never
  // silently receive results for the wrong platform.
  if (!ALLOWED_PLATFORM_FILTERS.includes(platform)) {
    throw new Error(`Invalid platform filter: ${platform}`);
  }

  try {
    // Build query URL
    let queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?select=pleb_title,platform,tags,summary,upload_date,video_url,video_hash&order=upload_date.desc.nullslast&limit=${limit}`;

    // Add platform filter if not 'both' ('both' means no platform constraint)
    if (platform !== 'both') {
      queryUrl += `&platform=eq.${platform}`;
    }

    // Add date range filter: whole local days, end-exclusive (see date-range.ts).
    // A from-only range (mid-selection in the calendar) is that single day.
    if (fromDate) {
      const { gte, lt } = toUploadDateBounds(fromDate, toDate);
      queryUrl += `&upload_date=gte.${encodeURIComponent(gte)}&upload_date=lt.${encodeURIComponent(lt)}`;
    }

    const response = await supabaseFetch(queryUrl, 'Failed to load videos', signal);

    const data: SupabaseVideoRow[] = await response.json();

    return data.map(mapRowToVideo);
  } catch (error) {
    if (!isAbortError(error)) logger.error('Error fetching recent videos:', error);
    throw error;
  }
}

/**
 * Searches videos by title, tags, or URL
 *
 * Performs case-insensitive search across multiple fields
 *
 * @param params - Search parameters (searchTerm, limit)
 * @returns Array of videos matching the search term
 *
 * @example
 * ```ts
 * const results = await searchVideos({ searchTerm: 'cooking' });
 * ```
 */
export async function searchVideos(
  params: SearchVideosParams
): Promise<Video[]> {
  const { searchTerm, limit = 200, signal } = params;

  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }

  try {
    const term = searchTerm.trim();
    const encodedTerm = encodeURIComponent(`*${term}*`);

    // Build query with OR conditions for case-insensitive search
    let queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?select=pleb_title,platform,tags,summary,upload_date,video_url,video_hash&order=upload_date.desc.nullslast&limit=${limit}`;

    // PostgREST syntax for OR query with ilike (case-insensitive LIKE)
    queryUrl += `&or=(pleb_title.ilike.${encodedTerm},video_url.ilike.${encodedTerm})`;

    const response = await supabaseFetch(queryUrl, 'Search failed', signal);

    const data: SupabaseVideoRow[] = await response.json();

    // Client-side filtering for tags (array search)
    const termLower = term.toLowerCase();
    const filteredData = data.filter((row) => {
      const titleMatch = (row.pleb_title || '').toLowerCase().includes(termLower);
      const urlMatch = (row.video_url || '').toLowerCase().includes(termLower);
      const tagsMatch =
        Array.isArray(row.tags) &&
        row.tags.some((tag) => tag.toLowerCase().includes(termLower));
      return titleMatch || urlMatch || tagsMatch;
    });

    return filteredData.map(mapRowToVideo);
  } catch (error) {
    if (!isAbortError(error)) logger.error('Error searching videos:', error);
    throw error;
  }
}
