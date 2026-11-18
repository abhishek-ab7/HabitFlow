const CACHE_NAME = 'habit-tracker-v2';
const STATIC_ASSETS = [
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve static assets from cache, bypass for HTML/API/navigations
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Skip API requests
  if (url.pathname.startsWith('/api') || url.pathname.includes('/api/')) return;

  // Skip page navigations and HTML requests to avoid caching redirects/login pages
  const isNavigation = event.request.mode === 'navigate';
  const isHtml = event.request.headers.get('Accept')?.includes('text/html');
  if (isNavigation || isHtml) return;

  // Serve static assets from cache, fallback to network and cache
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (non-navigation requests)
        fetch(event.request).then((response) => {
          if (response.ok && !response.redirected) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (response.ok && !response.redirected) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
