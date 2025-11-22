/**
 * SkeletonVideoCard Component
 * Loading skeleton that mimics VideoCard structure
 * Provides visual feedback while videos are loading
 * Responsive: Mobile (stacked) | Desktop (side-by-side)
 */

import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonVideoCard() {
  return (
    <div className="flex flex-col md:flex-row gap-4 bg-[#111] border border-[#333] rounded-lg p-4">
      {/* Skeleton Thumbnail - Full width on mobile, fixed width on desktop */}
      <div className="w-full md:w-40 h-48 md:h-full md:min-h-[90px] flex-shrink-0">
        <Skeleton className="w-full h-full rounded" />
      </div>

      {/* Skeleton Content */}
      <div className="flex-1 flex flex-col min-w-0 space-y-2">
        {/* Platform badge */}
        <Skeleton className="h-6 w-16 rounded-full" />

        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Original Title with icon space */}
        <div className="flex items-start gap-1.5">
          <Skeleton className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        {/* Date with icon space */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-3 flex-shrink-0" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Summary box with green accent (mimics real card) */}
        <div className="p-2.5 rounded bg-gradient-to-r from-[#28a745]/10 to-transparent border-l-2 border-[#28a745]">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>

        {/* Tag preview - 3 on mobile, 6 on desktop */}
        <div className="flex gap-1.5 flex-wrap">
          {/* Mobile: 3 tags */}
          <div className="flex gap-1.5 md:hidden">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>

          {/* Desktop: 6 tags */}
          <div className="hidden md:flex gap-1.5 flex-wrap">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-18 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-22 rounded-full" />
          </div>
        </div>

        {/* Read more button skeleton */}
        <div className="border-t border-[#333] -mx-4 px-4 -mb-4 mt-auto pt-2">
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}
