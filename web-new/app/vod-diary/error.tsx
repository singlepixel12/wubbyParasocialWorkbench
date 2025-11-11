'use client';

/**
 * VOD Diary Error Boundary
 * Catches errors in the VOD Diary page without crashing the entire app
 */

import { useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function VodDiaryError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('❌ VOD Diary error:', {
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
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">
            VOD Diary Error
          </h2>
          <p className="text-muted-foreground">
            We couldn't load the VOD diary. This might be a temporary issue.
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
          <a
            href="/"
            className="px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/90 transition-colors inline-block"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
