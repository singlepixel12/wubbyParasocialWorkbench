/**
 * Landing Page - VOD Diary
 * Main entry point - displays scannable browse cards with Two-Tier UX.
 * Click cards to see full detail view at /watch/[id].
 * Shares <VodDiaryScreen> with the /vod-diary route so the two never drift.
 */

import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';

export default function HomePage() {
  return <VodDiaryScreen />;
}
