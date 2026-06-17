const CACHE_NAME = 'sondhani-ddc-cache-v6';

// Add the assets you want to be cached immediately
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/window.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching offline pages');
        return Promise.all(
          PRECACHE_ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.error('[Service Worker] Failed to precache:', url, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Skip Next.js dev server and HMR traffic completely
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.includes('/_next/dev/')) {
    return;
  }

  // Use Network-First strategy for EVERYTHING to prevent Next.js router loops
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Only cache valid, non-redirected HTML/asset responses for offline use
        if (networkResponse.ok && !networkResponse.redirected && networkResponse.type !== 'opaque' && !url.pathname.startsWith('/api/')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed (offline), try to serve from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's an API request that fails offline, return a JSON error
        if (url.pathname.startsWith('/api/')) {
          return new Response(
            JSON.stringify({ error: 'Network offline and no cached API response available.' }), 
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        }

        // If it's a page navigation that fails offline and isn't in cache, serve /offline fallback
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match('/offline');
          return offlineResponse || new Response('Offline', { status: 503 });
        }

        return new Response('Offline', { status: 503 });
      })
  );
});