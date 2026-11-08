'use client';

import { useEffect } from 'react';
import { backfillVodDetails, ensureWorker, reconcileDownloads } from '@/lib/listen/downloads';
import { refreshDownloads } from '@/lib/listen/downloads-store';
import { getWubbySummaryByHash } from '@/lib/api/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * Once per app load (renders nothing):
 * - register the worker, which caches the app shell so the site opens with no signal;
 * - downloads whose background fetch vanished become "paused";
 * - downloads saved before Phase 3b get their row (summary, tags), so they open offline.
 */
export function DownloadsReconciler() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      ensureWorker().catch((err) => logger.warn('service worker registration failed', err));
    }
    void reconcileDownloads()
      .then(() => refreshDownloads())
      .then(() => backfillVodDetails(getWubbySummaryByHash))
      .then((n) => (n > 0 ? refreshDownloads() : undefined));
  }, []);
  return null;
}
