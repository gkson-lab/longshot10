// Offline support: each release installs its own complete copy of the game's files and serves
// them from that copy. A copy is only ever replaced by the next release, never piecemeal.
const CACHE = 'rngdle10-v2.8.2';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'badges.js', 'data.js', 'worker.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', ev => {
  // The version query makes GitHub's CDN fetch fresh files too: right after a deploy, some of its
  // nodes still hold the previous release for up to ten minutes. Files are stored under their plain URLs.
  ev.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(async f => {
    const res = await fetch(new Request(`${f}${f.includes('?') ? '&' : '?'}v=${CACHE}`, { cache: 'reload' }));
    if (!res.ok) throw new Error(`${f}: ${res.status}`);
    await cache.put(f, res);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(caches.open(CACHE).then(async cache => (await cache.match(ev.request, { ignoreSearch: true })) || fetch(ev.request)));
});
