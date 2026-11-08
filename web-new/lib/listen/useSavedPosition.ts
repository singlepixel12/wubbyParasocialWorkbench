'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { parsePosition, positionKey, POSITION_EVENT, type SavedPosition } from './positions';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(POSITION_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(POSITION_EVENT, onChange);
  };
}

/** The saved position for a VOD, live-updating. Null on the server and before any save. */
export function useSavedPosition(hash: string | undefined): SavedPosition | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      if (!hash) return null;
      try {
        return window.localStorage.getItem(positionKey(hash));
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => parsePosition(raw), [raw]);
}
