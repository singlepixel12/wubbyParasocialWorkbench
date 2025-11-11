/**
 * Loading UI for VOD Diary page
 * Displayed during navigation and data fetching
 */

import { SkeletonVideoCard } from '@/components/vod-diary/SkeletonVideoCard';

export default function VodDiaryLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-5 w-96 bg-muted animate-pulse rounded" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
      </div>

      {/* Video Cards Skeleton */}
      <div className="space-y-4">
        <SkeletonVideoCard />
        <SkeletonVideoCard />
        <SkeletonVideoCard />
      </div>
    </div>
  );
}
