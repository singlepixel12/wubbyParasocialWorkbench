'use client';

import { useEffect, useState } from 'react';
import { autoResume, resetStallWatch, watchdogTick } from '@/lib/listen/downloads';
import { autoResumeDelay } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';

/**
 * Chrome's Background Fetch gives up a whole round on one failed request, which on a flaky phone
 * network happens a lot. While the site is open and online, start another round (missing runs only)
 * on the backoff schedule in download-model. Never for a download the user cancelled.
 */
/** How often the watchdog looks at running downloads (it restarts one after STALL_RESTART_MS). */
export const WATCHDOG_EVERY_MS = 30_000;

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

  // Watchdog: a round can stay alive in Chrome with no bytes moving (a locked phone on battery
  // saver). Only while visible: a hidden page's timers are frozen, and it can't tell a stuck round
  // from one Android is merely holding. Coming back starts a fresh baseline and checks at once,
  // which also turns a "downloading" whose fetch has gone into "paused".
  const anyDownloading = manifests.some((m) => m.state === 'downloading');
  useEffect(() => {
    if (!online || !anyDownloading) return;
    const visible = () => document.visibilityState === 'visible';
    const tick = () => {
      if (visible()) void watchdogTick().catch(() => undefined);
    };
    const onVisibility = () => {
      if (!visible()) return;
      resetStallWatch();
      tick();
    };
    tick();
    const timer = setInterval(tick, WATCHDOG_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [online, anyDownloading]);

  return null;
}
