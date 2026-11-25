const CACHE_NAME = 'habit-tracker-v5';
const MAX_CACHED_ASSETS = 80;
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const STATIC_ASSET_EXTENSIONS = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)$/i;

function isSafeStaticResponse(response) {
  if (!response || !response.ok || response.redirected) return false;
  if (response.type !== 'basic') return false;
  const ct = (response.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;
  return true;
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHED_ASSETS) return;
  const excess = keys.length - MAX_CACHED_ASSETS;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

// Install event - precache lightweight manifest & icons
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheablePublicAsset(url) {
  if (url.pathname === '/manifest.json') return true;
  if (url.pathname.startsWith('/icons/')) return true;
  return STATIC_ASSET_EXTENSIONS.test(url.pathname);
}

// Fetch event - ONLY cache static public assets (manifest, icons, images, fonts).
// Never intercept Next.js chunks (/_next/*), RSC payloads, API calls, or HTML navigations.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  if (
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1' ||
    event.request.headers.get('Next-Router-State-Tree')
  ) {
    return;
  }

  const accept = event.request.headers.get('Accept') || '';
  if (
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    accept.includes('text/x-component')
  ) {
    return;
  }

  if (!isCacheablePublicAsset(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then(async (response) => {
          if (isSafeStaticResponse(response)) {
            await cache.put(event.request, response.clone());
            await trimCache(cache);
          }
          return response;
        })
        .catch(() => cachedResponse);

      if (cachedResponse) {
        // Keep SW alive until background SWR revalidation completes
        event.waitUntil(networkFetch);
        return cachedResponse;
      }

      return networkFetch;
    })
  );
});
