'use client';

// Chrome's "install this app" offer. It arrives once, early, as `beforeinstallprompt`; we keep it
// so the menu can show "Install app" whenever it's opened.
import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we offer it from the menu instead of Chrome's mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Show Chrome's install dialog. Resolves true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // a prompt event can only be used once
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

/** True while Chrome is offering an install (not installed, criteria met). */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null, () => false);
}
