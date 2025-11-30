'use client';

/**
 * Global Error Boundary
 * Catches React errors at the root level and provides recovery UI
 * Prevents blank page crashes and provides user-friendly error messages
 */

import { useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console and error tracking service
    logger.error('🚨 Global error boundary caught error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong!
              </h1>
              <p className="text-muted-foreground">
                The application encountered an unexpected error. Your data is safe.
              </p>
            </div>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-muted rounded-lg p-4 text-left">
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/90 transition-colors"
              >
                Go to Home
              </button>
            </div>

            {/* Help Text */}
            <p className="text-sm text-muted-foreground">
              If this problem persists, please{' '}
              <a
                href="https://github.com/anthropics/claude-code/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                report the issue
              </a>
              .
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
