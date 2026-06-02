/**
 * SkeletonVideoCard Component
 * Loading skeleton that mirrors the editorial VideoCard structure
 * Provides visual feedback while videos are loading
 * Responsive: Mobile (stacked) | Desktop (side-by-side)
 */

import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonVideoCard() {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-rule bg-card/40 p-4 md:flex-row md:gap-6 md:p-5">
      {/* Skeleton Thumbnail - Full width on mobile, fixed width on desktop */}
      <div className="h-48 w-full flex-shrink-0 md:h-auto md:min-h-[100px] md:w-44">
        <Skeleton className="h-full w-full rounded" />
      </div>

      {/* Skeleton Content */}
      <div className="flex min-w-0 flex-1 flex-col space-y-2">
        {/* Meta rail (record no · date) */}
        <Skeleton className="h-3 w-32" />

        {/* Display title (two lines) */}
        <Skeleton className="h-6 w-4/5" />

        {/* Original filename */}
        <div className="flex items-start gap-1.5">
          <Skeleton className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        {/* Summary with accent marker rule */}
        <div className="border-l-2 border-accent-green/40 pl-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>

        {/* Tag preview - 3 on mobile, 6 on desktop */}
        <div className="flex flex-wrap gap-1.5">
          <div className="flex gap-1.5 md:hidden">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="hidden flex-wrap gap-1.5 md:flex">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-18 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-22 rounded-full" />
          </div>
        </div>

        {/* Read more button skeleton */}
        <div className="-mx-4 -mb-4 mt-auto border-t border-rule px-4 pt-2.5">
          <Skeleton className="mx-auto h-4 w-24" />
        </div>
      </div>
    </div>
  );
}
