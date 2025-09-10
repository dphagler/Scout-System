// Bump CACHE to force update
const CACHE = 'scouting-shell-v10';
// Only cache under /scout/ to avoid CORS from site root redirects
const ASSETS = ['/scout/', '/scout/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? undefined : caches.delete(k))));
    // Notify all open clients so they can reload to pick up fresh assets
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      try { client.postMessage({ type: 'sw-activated', cache: CACHE, ts: Date.now() }); } catch {}
    }
  })());
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Runtime cache only for same-origin under /scout/
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/scout/')) return;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
