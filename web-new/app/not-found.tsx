/**
 * 404 Not Found Page
 * Displayed when user navigates to a non-existent route
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* 404 Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors inline-block"
          >
            Go to Home
          </Link>
          <Link
            href="/vod-diary"
            className="px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/90 transition-colors inline-block"
          >
            Browse VODs
          </Link>
        </div>

        {/* Additional Help */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Looking for something specific?
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/" className="text-primary hover:underline">
              Video Metadata
            </Link>
            <Link href="/transcript" className="text-primary hover:underline">
              Transcript Extraction
            </Link>
            <Link href="/vod-diary" className="text-primary hover:underline">
              VOD Diary
            </Link>
            <Link href="/player" className="text-primary hover:underline">
              Video Player
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
