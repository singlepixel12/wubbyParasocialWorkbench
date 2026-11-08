// The Wubby Archive service worker. Bundled to sw.js by scripts/build-sw.mjs; logic lives in
// lib/listen/sw-handlers.ts and lib/offline/* (unit-tested).
// - Background Fetch: saves finished download rounds to IndexedDB (Phase 2).
// - App shell (Phase 3b): precaches the static export so the app opens with no signal. The build
//   injects the file list; in dev it's empty, and then there is no fetch handler at all.
import { handleBackgroundFetchEnd } from '../../lib/listen/sw-handlers';
import { hashFromBgFetchId } from '../../lib/listen/download-model';
import { planFetch } from '../../lib/offline/shell-rules';
import { activateShell, installShell, respond } from '../../lib/offline/shell-cache';

/* global __SHELL_FILES__, __SHELL_VERSION__ */
const SHELL_FILES = __SHELL_FILES__;
const SHELL_VERSION = __SHELL_VERSION__;
const shellOn = SHELL_FILES.length > 0;
const fileSet = new Set(SHELL_FILES);
const deps = () => ({ caches, fetch: (r) => fetch(r), scope: self.registration.scope, version: SHELL_VERSION, files: SHELL_FILES });

// A failed precache rejects install, so this worker is discarded and the old one (with its
// complete shell) keeps serving.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (shellOn) event.waitUntil(installShell(deps()));
});
self.addEventListener('activate', (event) =>
  event.waitUntil((shellOn ? activateShell(deps()).catch(() => undefined) : Promise.resolve()).then(() => self.clients.claim())),
);

if (shellOn) {
  self.addEventListener('fetch', (event) => {
    const req = event.request;
    const scope = new URL(self.registration.scope);
    const plan = planFetch(
      { method: req.method, url: req.url, mode: req.mode, hasRange: req.headers.has('range') },
      { base: scope.pathname.replace(/\/$/, ''), origin: scope.origin, files: fileSet },
    );
    if (plan.kind !== 'pass') event.respondWith(respond(deps(), req, plan));
  });
}

for (const [type, kind] of [['backgroundfetchsuccess', 'success'], ['backgroundfetchfail', 'fail'], ['backgroundfetchabort', 'abort']]) {
  self.addEventListener(type, (event) => {
    event.waitUntil(
      (async () => {
        const result = await handleBackgroundFetchEnd(kind, event.registration);
        if (result && typeof event.updateUI === 'function') {
          const title = result.state === 'ready' ? `Saved for offline: ${result.title}` : `Download paused: ${result.title}`;
          await event.updateUI({ title }).catch(() => undefined);
        }
      })(),
    );
  });
}

self.addEventListener('backgroundfetchclick', (event) => {
  const hash = hashFromBgFetchId(event.registration.id);
  if (hash) event.waitUntil(self.clients.openWindow(`${self.registration.scope}watch?id=${hash}`));
});
