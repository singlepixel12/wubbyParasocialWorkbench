/**
 * Supabase API client and video data fetching utilities
 * Handles all communication with the Supabase backend
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Video } from '@/types/video';
import type {
  SupabaseVideoRow,
  FetchVideosParams,
  SearchVideosParams,
} from '@/types/supabase';
import { computeVideoHash } from '@/lib/utils/hash';
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
 * Initialize Supabase client
 * This key is safe to expose as it's read-only with RLS protection
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase configuration is missing. Please check your environment variables.'
      );
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
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
    platform: (row.platform as any) || 'unknown',
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

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Query Supabase using REST API directly for maximum control
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${videoHash}`;
    logger.log('Query URL:', queryUrl);
    logger.log('Making API request...');

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    logger.log('API Response Status:', response.status, response.statusText);

    // Handle HTTP errors with specific messages
    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;

      switch (response.status) {
        case 400:
          errorMessage = 'Bad request - Invalid query parameters';
          break;
        case 401:
          errorMessage = 'Authentication failed - Check API key';
          break;
        case 403:
          errorMessage = 'Access denied - Insufficient permissions';
          break;
        case 404:
          errorMessage = 'Video not found in database';
          break;
        case 429:
          errorMessage = 'Too many requests - Please wait and try again';
          break;
        case 500:
          errorMessage = 'Server error - Please try again later';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage =
            'Service temporarily unavailable - Please try again later';
          break;
        default:
          errorMessage = `Request failed: ${response.status} - ${response.statusText}`;
      }

      logger.error('❌ API Error:', errorMessage);
      logger.groupEnd();
      throw new Error(errorMessage);
    }

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

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(
          'Request timed out. Please check your connection and try again.'
        );
      } else if (
        error.name === 'TypeError' &&
        error.message.includes('fetch')
      ) {
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
    // Validate input (should be 64-character hex string)
    if (!videoHash || typeof videoHash !== 'string' || videoHash.length !== 64) {
      logger.error('❌ Invalid video hash:', videoHash);
      throw new Error('Invalid video hash provided (expected 64-character hex string)');
    }

    // Query Supabase using REST API directly
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${videoHash}`;
    logger.log('Query URL:', queryUrl);
    logger.log('Making API request...');

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    logger.log('API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      switch (response.status) {
        case 404:
          errorMessage = 'Video not found in database';
          break;
        case 500:
          errorMessage = 'Server error - Please try again later';
          break;
      }
      logger.error('❌ API Error:', errorMessage);
      logger.groupEnd();
      throw new Error(errorMessage);
    }

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
  const { limit = 50, platform = 'both', fromDate = null, toDate = null } = params;

  try {
    // Build query URL
    let queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?select=pleb_title,platform,tags,summary,upload_date,video_url,video_hash&order=upload_date.desc.nullslast&limit=${limit}`;

    // Add platform filter if not 'both'
    if (platform !== 'both') {
      queryUrl += `&platform=eq.${platform}`;
    }

    // Add date range filter
    if (fromDate && toDate) {
      const fromISO = fromDate.toISOString();
      const toISO = toDate.toISOString();
      queryUrl += `&upload_date=gte.${fromISO}&upload_date=lte.${toISO}`;
    }

    const response = await fetch(queryUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load videos: ${response.status} - ${response.statusText}`);
    }

    const data: SupabaseVideoRow[] = await response.json();

    return data.map(mapRowToVideo);
  } catch (error) {
    logger.error('Error fetching recent videos:', error);
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
  const { searchTerm, limit = 200 } = params;

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

    const response = await fetch(queryUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} - ${response.statusText}`);
    }

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
    logger.error('Error searching videos:', error);
    throw error;
  }
}

/**
 * Sample videos for fallback/testing
 */
export const SAMPLE_VIDEOS: Video[] = [
  {
    url: 'https://archive.wubby.tv/vods/public/jul_2025/27_MEDIA%20SHARE%20NIGHT.mp4',
    title: 'Kick Friday Madness',
    platform: 'kick',
    summary:
      'A wild Friday stream with community games, random antics, and spicy takes that had chat popping off all night long.',
    tags: ['kick', 'community', 'games'],
    date: '2025-07-18T20:00:00Z',
  },
  {
    url: '#',
    title: 'Cooking IRL – Chaos in the Kitchen',
    platform: 'twitch',
    summary:
      'Attempted to bake a 12-layer cake; only 8 survived. Fire alarm cameo. A masterpiece of disaster.',
    tags: ['twitch', 'cooking', 'irl'],
    date: '2025-07-17T18:00:00Z',
  },
];
