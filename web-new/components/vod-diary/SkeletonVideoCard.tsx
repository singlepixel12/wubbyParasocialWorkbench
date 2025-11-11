/**
 * SkeletonVideoCard Component
 * Loading skeleton that mimics VideoCard structure
 * Provides visual feedback while videos are loading
 */

import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonVideoCard() {
  return (
    <div className="flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 min-h-[180px] relative">
      {/* Skeleton Platform badge (top right) */}
      <Skeleton className="absolute top-3 right-3 h-6 w-16 rounded-full" />

      {/* Skeleton Thumbnail */}
      <div className="w-[240px] h-[135px] flex-shrink-0">
        <Skeleton className="w-full h-full rounded-md" />
      </div>

      {/* Skeleton Content */}
      <div className="flex-1 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />

        {/* Original Title */}
        <Skeleton className="h-4 w-1/2" />

        {/* Date */}
        <Skeleton className="h-4 w-24" />

        {/* Summary (3 lines) */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
