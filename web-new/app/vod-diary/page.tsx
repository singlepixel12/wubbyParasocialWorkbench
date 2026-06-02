/**
 * VOD Diary Page
 * Filterable list of recent VODs (date range + search; both platforms).
 * Renders the shared <VodDiaryScreen>, the single source of truth also used by `/`.
 */

import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';

export default function VodDiaryPage() {
  return <VodDiaryScreen />;
}
