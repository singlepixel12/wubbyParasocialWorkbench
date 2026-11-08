'use client';

import { useEffect } from 'react';
import { reconcileDownloads } from '@/lib/listen/downloads';
import { refreshDownloads } from '@/lib/listen/downloads-store';

/** Once per app load: downloads whose background fetch vanished become "paused". */
export function DownloadsReconciler() {
  useEffect(() => {
    void reconcileDownloads().then(() => refreshDownloads());
  }, []);
  return null;
}
