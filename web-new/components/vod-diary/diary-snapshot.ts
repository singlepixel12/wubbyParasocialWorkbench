// What the diary had on screen when you left it for /watch in the same window (the installed app,
// or a row in the downloads sheet), so coming back puts you where you were: the same filters, every
// "Load more" page, and the scroll position. Module memory on purpose: it lasts as long as this
// document, so a reload or a new tab starts fresh.
import type { Video } from '@/types/video';

export interface DiarySnapshot {
  /** The filters these results belong to (see diaryKey). */
  key: string;
  videos: Video[];
  total: number | null;
  scrollY: number;
  at: number;
}

/** Longer than a long listen: coming back after a 6 h VOD still finds your place. */
export const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Older than this, the restored list also checks the archive for new VODs at the top. */
export const SNAPSHOT_REFRESH_AFTER_MS = 10 * 60 * 1000;

let snapshot: DiarySnapshot | null = null;

export const diaryKey = (q: string, from: string | null, to: string | null) => `${q}|${from ?? ''}|${to ?? ''}`;

export function saveDiarySnapshot(s: DiarySnapshot): void {
  snapshot = s;
}

/** The snapshot for these filters, if it's recent enough to trust. */
export function peekDiarySnapshot(key: string, now = Date.now()): DiarySnapshot | null {
  return snapshot && snapshot.key === key && now - snapshot.at <= SNAPSHOT_MAX_AGE_MS ? snapshot : null;
}

/** Tests only. */
export function clearDiarySnapshot(): void {
  snapshot = null;
}
