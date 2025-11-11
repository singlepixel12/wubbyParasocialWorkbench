/**
 * Loading UI for Transcript page
 * Displayed during navigation and transcript fetching
 */

export default function TranscriptLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-muted animate-pulse rounded" />
        <div className="h-5 w-full max-w-2xl bg-muted animate-pulse rounded" />
      </div>

      {/* URL Input Section Skeleton */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="h-7 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </div>

      {/* Transcript Content Skeleton */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div
                className="h-5 bg-muted animate-pulse rounded"
                style={{ width: `${Math.random() * 40 + 60}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
