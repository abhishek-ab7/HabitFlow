const CACHE_NAME = 'habit-tracker-v3';
const STATIC_ASSETS = [
  '/manifest.json',
];

const STATIC_ASSET_EXTENSIONS = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)$/i;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean ALL old caches (including poisoned habit-tracker-v2)
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

function isCacheablePublicAsset(url) {
  if (url.pathname === '/manifest.json') return true;
  if (url.pathname.startsWith('/icons/')) return true;
  return STATIC_ASSET_EXTENSIONS.test(url.pathname);
}

// Fetch event - ONLY cache static public assets (manifest, icons, images, fonts).
// Never intercept Next.js chunks (/_next/*), RSC payloads, API calls, or HTML navigations.
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Never intercept API routes or Next.js build/runtime assets (/_next/*)
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  // Never intercept Next.js App Router RSC / prefetch requests
  if (
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1' ||
    event.request.headers.has('Next-Router-State-Tree')
  ) {
    return;
  }

  // Skip page navigations and HTML/RSC component requests
  const accept = event.request.headers.get('Accept') || '';
  if (
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    accept.includes('text/x-component')
  ) {
    return;
  }

  // Only cache explicit static public assets; let everything else hit the network directly
  if (!isCacheablePublicAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
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
