'use client';

import { useEffect, useState } from 'react';
import { autoResume } from '@/lib/listen/downloads';
import { autoResumeDelay } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';

/**
 * Chrome's Background Fetch gives up a whole round on one failed request, which on a flaky phone
 * network happens a lot. While the site is open and online, start another round (missing runs only)
 * on the backoff schedule in download-model. Never for a download the user cancelled.
 */
export function DownloadsAutoResume() {
  const manifests = useDownloads();
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const m of manifests) {
      const delay = autoResumeDelay(m, Date.now());
      if (delay !== null) timers.push(setTimeout(() => void autoResume(m).catch(() => undefined), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [manifests, online]);

  return null;
}
