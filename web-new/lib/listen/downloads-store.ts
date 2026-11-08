'use client';

import { useSyncExternalStore } from 'react';
import type { DownloadManifest } from './download-model';
import { DOWNLOADS_CHANNEL, listManifests } from './offline-store';

type Listener = () => void;
let snapshot: readonly DownloadManifest[] = [];
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;
let loading: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    snapshot = await listManifests();
  } catch {
    snapshot = [];
  }
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(DOWNLOADS_CHANNEL);
    channel.onmessage = () => void refresh();
  }
  loading ??= refresh();
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      channel?.close();
      channel = null;
      loading = null;
    }
  };
}

const getSnapshot = () => snapshot;
const EMPTY: readonly DownloadManifest[] = [];
const getServerSnapshot = () => EMPTY;

/** All download manifests, live across tabs and the service worker. */
export function useDownloads(): readonly DownloadManifest[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Force a reload (after this tab changed something without a broadcast). */
export const refreshDownloads = refresh;
