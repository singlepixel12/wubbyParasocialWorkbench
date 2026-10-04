/**
 * Landing Page - VOD Diary
 * Main entry point - displays scannable browse cards with Two-Tier UX.
 * Click cards to see full detail view at /watch?id=HASH.
 * The legacy /vod-diary route redirects here.
 *
 * VodDiaryScreen reads its filters from the URL via useSearchParams, which under
 * `output: 'export'` must sit inside a Suspense boundary or `next build` fails.
 */

import { Suspense } from 'react';
import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';
import { SkeletonVideoCard } from '@/components/vod-diary/SkeletonVideoCard';

function DiaryFallback() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <SkeletonVideoCard />
      <SkeletonVideoCard />
      <SkeletonVideoCard />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DiaryFallback />}>
      <VodDiaryScreen />
    </Suspense>
  );
}
