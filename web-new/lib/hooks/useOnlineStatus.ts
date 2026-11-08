'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * `navigator.onLine`, live. `false` is reliable (no network at all); `true` only means "some
 * network", so a lie-fi connection still needs the API's own timeouts and retries.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
