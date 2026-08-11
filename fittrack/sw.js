/* FitTrack service worker — network-first so an online launch always gets the
   newest build, with a cache fallback so the app works fully offline.
   Same shape as the dart scoreboard's worker; separate cache name and scope. */
const CACHE = 'fittrack-cache-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-store' }); // bypass the HTTP cache → always freshest
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());            // keep a copy for offline
      return res;
    } catch (err) {
      const cached = await caches.match(req); // offline → last good copy
      if (cached) return cached;
      throw err;
    }
  })());
});
