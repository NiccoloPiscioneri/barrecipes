// App shell is served from cache and refreshed in the background (stale-while-revalidate),
// so the app starts offline and picks up updates on the next load.
// API calls and drink photos always go to the network.
const CACHE = 'barrecipes-v4';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'data/types.json',
  'js/app.js', 'js/dom.js', 'js/measure.js', 'js/types.js', 'js/catalog.js', 'js/store.js', 'js/pantry.js',
  'js/match.js', 'js/dose.js', 'js/backup.js', 'js/gemini.js', 'js/recipes.js',
  'js/ui/drinks.js', 'js/ui/card.js', 'js/ui/pantry.js', 'js/ui/settings.js', 'js/ui/ai.js', 'js/ui/recipes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
  }));
});
