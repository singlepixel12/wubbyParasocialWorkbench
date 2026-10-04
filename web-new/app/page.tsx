/**
 * Landing Page - VOD Diary
 * Main entry point - displays scannable browse cards with Two-Tier UX.
 * Click cards to see full detail view at /watch?id=HASH.
 * The legacy /vod-diary route redirects here.
 */

import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';

export default function HomePage() {
  return <VodDiaryScreen />;
}
