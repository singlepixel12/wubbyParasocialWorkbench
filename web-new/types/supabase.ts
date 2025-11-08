/**
 * Type definitions for Supabase database schema
 * Table: wubby_summary
 */

import { Platform } from './video';

/**
 * Raw row from Supabase wubby_summary table
 * Represents database structure before mapping to application Video type
 */
export interface SupabaseVideoRow {
  /** Video title stored in database */
  pleb_title: string | null;

  /** Platform identifier (twitch, kick, etc.) */
  platform: string | null;

  /** Tags array or comma-separated string */
  tags: string[] | string | null;

  /** Video summary/description */
  summary: string | null;

  /** Upload date in ISO format */
  upload_date: string | null;

  /** Video URL from archive.wubby.tv */
  video_url: string | null;

  /** SHA-256 hash of video URL (primary key) */
  video_hash?: string | null;

  /** Automatic timestamp from Supabase */
  created_at?: string | null;
}

/**
 * Supabase client configuration
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Query parameters for fetching videos from Supabase
 */
export interface FetchVideosParams {
  /** Maximum number of videos to return */
  limit?: number;

  /** Filter by platform (twitch, kick, both) */
  platform?: Platform;

  /** Start date for date range filter */
  fromDate?: Date | null;

  /** End date for date range filter */
  toDate?: Date | null;
}

/**
 * Search query parameters for Supabase
 */
export interface SearchVideosParams {
  /** Search term to match against title, tags, and URL */
  searchTerm: string;

  /** Maximum number of results */
  limit?: number;
}

/**
 * Supabase API error response
 */
export interface SupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

/**
 * Generic Supabase response wrapper
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}
