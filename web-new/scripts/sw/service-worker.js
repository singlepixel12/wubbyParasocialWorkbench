// The Wubby Archive service worker. Background-fetch events ONLY: there is deliberately no
// `fetch` handler (no caching, no interception) until Phase 3. Bundled to public/sw.js by
// scripts/build-sw.mjs. Logic lives in lib/listen/sw-handlers.ts (unit-tested).
import { handleBackgroundFetchEnd } from '../../lib/listen/sw-handlers';
import { hashFromBgFetchId } from '../../lib/listen/download-model';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
