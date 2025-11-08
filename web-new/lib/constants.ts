/**
 * Application Constants
 * Centralized configuration values used across the application
 */

/**
 * Supabase configuration
 * Supports environment variable override via NEXT_PUBLIC_SUPABASE_URL
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sbvaclmypokafpxebusn.supabase.co';

/**
 * Storage bucket paths
 */
export const SUPABASE_STORAGE = {
  TRANSCRIPTS: 'wubbytranscript',
} as const;
