const CACHE_NAME = 'habit-tracker-v5';
const MAX_CACHED_ASSETS = 80;
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const STATIC_ASSET_EXTENSIONS = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)$/i;

function isSafeStaticResponse(response) {
  if (!response || !response.ok) return false;
  if (response.redirected || response.type !== 'basic') return false;
  const ct = (response.headers.get('Content-Type') || '').toLowerCase();
  return !ct.includes('text/html');
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

function isApiOrNextPath(pathname, searchParams) {
  if (pathname.startsWith('/api') || pathname.includes('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  return searchParams.has('_rsc');
}

function isBypassedRoute(url, request) {
  if (isApiOrNextPath(url.pathname, url.searchParams)) return true;
  const rscHeaders = ['RSC', 'Next-Router-Prefetch', 'Next-Router-State-Tree'];
  if (rscHeaders.some((h) => request.headers.get(h) === '1')) return true;
  const accept = request.headers.get('Accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html') || accept.includes('text/x-component');
}

function handleStaticAssetFetch(event) {
  return caches.open(CACHE_NAME).then(async (cache) => {
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
      event.waitUntil(networkFetch);
      return cachedResponse;
    }
    return networkFetch;
  });
}

// Fetch event - ONLY cache static public assets (manifest, icons, images, fonts).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  if (isBypassedRoute(url, event.request) || !isCacheablePublicAsset(url)) return;
  event.respondWith(handleStaticAssetFetch(event));
});
