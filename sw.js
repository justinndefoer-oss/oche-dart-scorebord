/* OCHE service worker — network-first so updates always come through online,
   with a cache fallback so the app works fully offline. */
const CACHE = 'oche-cache-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // drop old caches, then take control of open pages immediately
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
      const res = await fetch(req);          // always try network first → fresh updates
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());           // keep a copy for offline
      return res;
    } catch (err) {
      const cached = await caches.match(req); // offline → serve last good copy
      if (cached) return cached;
      throw err;
    }
  })());
});
