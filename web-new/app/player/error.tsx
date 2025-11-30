'use client';

/**
 * Player Error Boundary
 * Catches errors in the Player page without crashing the entire app
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/utils/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PlayerError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('❌ Player page error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">
            Video Player Error
          </h2>
          <p className="text-muted-foreground">
            Unable to load the video player. This might be a video loading issue or a temporary problem.
          </p>
        </div>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted rounded-lg p-4 text-left">
            <p className="text-sm font-mono text-muted-foreground break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Retry Loading
          </button>
          <Link
            href="/vod-diary"
            className="px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/90 transition-colors inline-block"
          >
            Back to VOD Diary
          </Link>
        </div>
      </div>
    </div>
  );
}
