/**
 * Loading UI for root page
 * Displayed during initial page load
 */

export default function HomeLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-5 w-full max-w-2xl bg-muted animate-pulse rounded" />
      </div>

      {/* Video Information Card Skeleton */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="h-7 w-48 bg-muted animate-pulse rounded" />

        {/* URL Input Skeleton */}
        <div className="space-y-2">
          <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>

        {/* Hash Display Skeleton */}
        <div className="flex gap-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Metadata Card Skeleton */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="h-6 w-56 bg-muted animate-pulse rounded" />
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="h-20 w-full bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
