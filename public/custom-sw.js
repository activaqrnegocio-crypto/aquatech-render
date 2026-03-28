// ============================================================
// Aquatech CRM — Custom Service Worker (Offline-First) v14
// ============================================================
const CACHE_VERSION = 'v16';
const STATIC_CACHE = `aquatech-static-${CACHE_VERSION}`;
const PAGES_CACHE  = `aquatech-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `aquatech-assets-${CACHE_VERSION}`;
const FONTS_CACHE  = `aquatech-fonts-${CACHE_VERSION}`;
const RSC_CACHE    = `aquatech-rsc-${CACHE_VERSION}`;

// Files to pre-cache on install (always available offline)
const PRE_CACHE = [
  '/offline.html',
  '/logo.jpg',
  '/manifest.json',
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW v16] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW v16] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => 
            key.startsWith('aquatech-') && 
            ![STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE, FONTS_CACHE, RSC_CACHE].includes(key)
          )
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, ws, etc.
  if (!url.protocol.startsWith('http')) return;

  // ── Next.js auth/session → Shadow auth fallback
  if (url.pathname === '/api/auth/session') {
    event.respondWith(
      fetch(request).catch(async () => {
        try {
          const auth = await getAuthFromIndexedDB();
          if (auth) {
            return new Response(JSON.stringify({
              user: {
                name: auth.name,
                email: auth.username,
                role: auth.role,
                image: null,
                id: auth.userId
              },
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          console.error('[SW] Auth shadow fallback failed', err);
        }
        
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/auth')) {
    return; // Let browser handle other auth naturally
  }

  // ── API requests → Network Only (don't cache sensitive data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => 
        new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ── Google Fonts → Cache First (long-lived)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }

  // ── Next.js static assets → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // ── Static files (images, fonts, css, js) → StaleWhileRevalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }

  // ── RSC (React Server Component) requests — these are client-side navigations
  // Next.js App Router uses RSC header for client-side transitions, NOT navigate mode
  const isRSC = request.headers.get('RSC') === '1' || 
                request.headers.get('Next-Router-Prefetch') === '1' ||
                url.searchParams.has('_rsc');
  
  if (isRSC) {
    event.respondWith(rscNetworkFirst(request));
    return;
  }

  // ── Full-page navigation → Network First with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // ── Everything else → Network First with cache
  event.respondWith(networkFirst(request, ASSETS_CACHE));
});

// ─── STRATEGIES ─────────────────────────────────────────────

/**
 * RSC Network First — specialized for React Server Component payloads.
 * Caches by URL path only (ignoring RSC-specific headers/params) so that
 * a prefetched response can serve a real navigation request offline.
 */
async function rscNetworkFirst(request) {
  // Build a normalized cache key: just the pathname (strip _rsc param)
  const url = new URL(request.url);
  url.searchParams.delete('_rsc');
  const cacheKey = url.toString();

  try {
    const response = await fetchWithTimeout(request, 6000);
    if (response.ok) {
      const cache = await caches.open(RSC_CACHE);
      // Store using the normalized URL as key so it matches regardless of _rsc param
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (e) {
    // Network failed — try cache with the normalized key
    const cache = await caches.open(RSC_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) {
      console.log('[SW] Serving RSC from cache:', cacheKey);
      return cached;
    }
    
    // Also try exact match with ignoreVary
    const exactCached = await caches.match(request, { ignoreVary: true, ignoreSearch: false });
    if (exactCached) return exactCached;

    // Return error so Next.js can handle it gracefully
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Navigation handler — for full page loads (first visit, refresh).
 * Try network → PAGES_CACHE only → offline.html
 * IMPORTANT: We ONLY search PAGES_CACHE here, never RSC_CACHE or ASSETS_CACHE,
 * because RSC payloads are NOT valid HTML and would render as raw text.
 */
async function navigationHandler(request) {
  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok || response.type === 'opaqueredirect') {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // ONLY search PAGES_CACHE — never global caches.match() which would 
    // return RSC payloads from RSC_CACHE and display raw JSON text
    const pagesCache = await caches.open(PAGES_CACHE);
    const cached = await pagesCache.match(request, { ignoreVary: true });
    if (cached) return cached;

    // Nothing in cache → show offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('<h1>Sin conexión</h1><p>Por favor, conéctate a internet.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Network First — try network, fallback to cache.
 */
async function networkFirst(request, cacheName) {
  if (request.method !== 'GET') return fetch(request);
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreVary: true });
    return cached || Response.error();
  }
}

/**
 * Cache First — serve from cache, fetch if miss.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return Response.error();
  }
}

/**
 * Stale While Revalidate — serve cache immediately, update in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  if (request.method !== 'GET') return fetch(request);
  const cached = await caches.match(request, { ignoreVary: true });
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(cacheName).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

/**
 * Fetch with timeout to avoid hanging on slow networks.
 */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Check if a URL path points to a static asset.
 */
function isStaticAsset(pathname) {
  return /\.(?:js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif|mp4|webm)$/i.test(pathname);
}

/**
 * Helper to read shadow auth from IndexedDB inside a Service Worker.
 */
function getAuthFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AquatechOfflineDB');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      
      try {
        const transaction = db.transaction(['auth'], 'readonly');
        const store = transaction.objectStore('auth');
        const getRequest = store.get('last_session');
        
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      } catch (err) {
        resolve(null);
      }
    };
  });
}

// ─── MESSAGES ───────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Allow manual cache clearing
  if (event.data === 'clearCache') {
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k.startsWith('aquatech-')).map(k => caches.delete(k)))
    ).then(() => {
      event.source?.postMessage({ type: 'cacheCleared' });
    });
  }

  // Allow explicit pre-caching of URLs
  if (event.data && event.data.type === 'PRECACHE_URLS') {
    const urls = event.data.urls || [];
    console.log('[SW] Pre-caching', urls.length, 'URLs');
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const response = await fetch(url, { credentials: 'same-origin' });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (e) {
            // Skip failed pre-caches silently
          }
        }
      })
    );
  }
});
