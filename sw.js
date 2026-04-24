// ═══════════════════════════════════════════════════════════
//  HEEBEE COFFEE — Service Worker v4 (Phase 4)
//  Network-first strategy for HTML/JS to prevent stale cache
// ═══════════════════════════════════════════════════════════

const CACHE_VERSION = 'heebee-v4';
const STATIC_CACHE  = 'heebee-static-v4';

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache only static assets (icons, manifest)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
});

// Activate: clean up ALL old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - index.html / root: NETWORK-FIRST (always try fresh, fallback to cache)
//  - Static assets: CACHE-FIRST
//  - Google Fonts: CACHE-FIRST with background revalidate
//  - Apps Script API calls: NETWORK ONLY (never cache backend calls)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Apps Script calls
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return; // browser handles
  }

  // Network-first for HTML (index.html, root)
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/heebee-checklist/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
