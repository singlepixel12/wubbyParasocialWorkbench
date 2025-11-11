/**
 * Loading UI for Player page
 * Displayed during navigation and video loading
 */

export default function PlayerLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-5 w-96 bg-muted animate-pulse rounded" />
      </div>

      {/* Video Player Skeleton */}
      <div className="aspect-video w-full bg-muted animate-pulse rounded-lg flex items-center justify-center">
        <svg
          className="w-16 h-16 text-muted-foreground/30"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Controls Skeleton */}
      <div className="space-y-3">
        <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>

      {/* Metadata Skeleton */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="h-6 w-64 bg-muted animate-pulse rounded" />
        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
        <div className="h-16 w-full bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
