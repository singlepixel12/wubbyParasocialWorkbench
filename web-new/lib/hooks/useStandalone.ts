'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(display-mode: standalone)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener?.('change', onChange);
  return () => mq?.removeEventListener?.('change', onChange);
}

/** True inside the installed app (opened from the home screen), false in a browser tab. */
export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(QUERY).matches ?? false, () => false);
}
