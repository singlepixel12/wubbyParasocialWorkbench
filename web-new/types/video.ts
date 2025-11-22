/**
 * Type definitions for video data structures
 * Based on the Wubby Parasocial Workbench data model
 */

/**
 * Platform types for VOD sources
 */
export type Platform = 'twitch' | 'kick' | 'both' | 'unknown';

/**
 * Video object structure used throughout the application
 * Represents a single VOD with metadata
 */
export interface Video {
  /** Video URL from archive.wubby.tv */
  url: string;

  /** Display title for the video */
  title: string;

  /** Platform where the video was streamed */
  platform: Platform;

  /** Extended description/summary of the video content */
  summary: string;

  /** Array of tags/categories associated with the video */
  tags: string[];

  /** Upload date in ISO 8601 format */
  date: string;

  /** Optional SHA-256 hash of the video URL (used for database lookups) */
  videoHash?: string;

  /** Optional thumbnail URL (stored in Supabase storage) */
  thumbnailUrl?: string;
}

/**
 * Video metadata for display purposes
 * Used in the main transcription details page
 */
export interface VideoMetadata {
  title: string;
  date: string;
  tags: string[];
  summary: string;
  platform: Platform;
}

/**
 * Hash status information
 */
export interface HashStatus {
  hash: string;
  status: string;
  isSuccess: boolean;
}

/**
 * Date range for filtering VODs
 */
export interface DateRange {
  from: Date | null;
  to: Date | null;
}

/**
 * Search parameters for VOD filtering
 */
export interface SearchParams {
  platform: Platform;
  dateRange: DateRange;
  searchTerm?: string;
}

/**
 * Error tracking information
 */
export interface ErrorInfo {
  timestamp: string;
  message: string;
  stack?: string;
  name: string;
  context: {
    url: string;
    userAgent: string;
    [key: string]: unknown;
  };
}

/**
 * Error summary statistics
 */
export interface ErrorSummary {
  total: number;
  byType: Record<string, number>;
  recent: ErrorInfo[];
}
