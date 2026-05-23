const CACHE_NAME = 'ledger-v1';
const RUNTIME_CACHE = 'ledger-runtime-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Continue even if some assets fail to cache
        console.warn('Some static assets could not be cached');
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first strategy for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API calls: network-first
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || new Response('Offline - resource not cached', { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  if (
    request.url.includes('.js') ||
    request.url.includes('.css') ||
    request.url.includes('.woff') ||
    request.url.includes('.woff2') ||
    request.url.includes('.png') ||
    request.url.includes('.jpg') ||
    request.url.includes('.svg')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((res) => {
            if (res.ok) {
              const cache = caches.open(CACHE_NAME);
              cache.then((c) => c.put(request, res.clone()));
            }
            return res;
          })
        );
      })
    );
    return;
  }

  // HTML pages: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/');
          });
        })
    );
    return;
  }

  // Default: network-first with fallback
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-credits') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    // Sync any pending requests
    const requests = await caches.open(RUNTIME_CACHE);
    const keys = await requests.keys();
    for (const request of keys) {
      try {
        await fetch(request);
      } catch (e) {
        console.warn('Failed to sync:', request.url);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
