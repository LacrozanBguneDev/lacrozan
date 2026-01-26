const CACHE_NAME = 'bgunenet-static-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // HTML → Network First (WAJIB)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Aset lain → Cache First
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});