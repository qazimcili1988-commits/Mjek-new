const CACHE_NAME = 'mjek-hyrje-v1';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
];

// Install Event: cache initial assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-First or Network-Fallback with dynamic caching
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local/same-origin assets
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip API routes so that server-side AI generations can still be attempted/fail gracefully instead of caching empty responses
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response, but fetch fresh copy in the background (stale-while-revalidate) for non-static files
        if (!url.pathname.includes('/assets/')) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* ignore network failures */});
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache the newly fetched asset dynamically (if it's a static file or page)
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for offline page or index.html when user is offline
        if (event.request.mode === 'navigate') {
          return caches.match('./').then(res => res || caches.match('index.html'));
        }
      });
    })
  );
});
