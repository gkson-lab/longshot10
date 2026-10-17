// Offline support: serve the game's own files from a cache, refreshing them in the background.
const CACHE = 'rngdle10-v2.0.2';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'badges.js', 'data.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', ev => {
  // cache: 'reload' skips the HTTP cache, so a new version never stores the previous version's files.
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(ev.request, { ignoreSearch: true });
    const network = fetch(ev.request).then(res => {
      if (res.ok) cache.put(ev.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
