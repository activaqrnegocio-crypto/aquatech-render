// ============================================================
// Aquatech CRM — Custom Service Worker (Offline-First)
// ============================================================
const CACHE_VERSION = 'v13';
const STATIC_CACHE = `aquatech-static-${CACHE_VERSION}`;
const PAGES_CACHE  = `aquatech-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `aquatech-assets-${CACHE_VERSION}`;
const FONTS_CACHE  = `aquatech-fonts-${CACHE_VERSION}`;

// Files to pre-cache on install (always available offline)
const PRE_CACHE = [
  '/offline.html',
  '/logo.jpg',
  '/manifest.json',
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => 
            key.startsWith('aquatech-') && 
            ![STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE, FONTS_CACHE].includes(key)
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

  // ── Next.js auth endpoints → Network Only with Shadow Fallback
  if (url.pathname === '/api/auth/session') {
    event.respondWith(
      fetch(request).catch(async () => {
        // Network failed (offline), try shadow auth from IndexedDB
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
        
        // Final fallback: no session
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

  // ── Google Fonts → Cache First (long-lived)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, FONTS_CACHE, 365 * 24 * 60 * 60));
    return;
  }

  // ── Next.js static assets → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // ── Static files (images, fonts, css, js) → StaleWhileRevalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }

  // ── Navigation requests (HTML pages) → Network First with offline fallback
  // Only show offline.html for actual full-page navigations, not AJAX/RSC fetches
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // ── Everything else → Network First with cache
  event.respondWith(networkFirst(request, ASSETS_CACHE));
});

// ─── STRATEGIES ─────────────────────────────────────────────

/**
 * Network First with offline fallback for navigation.
 * Try network → cache → offline.html
 */
async function networkFirstWithOfflineFallback(request) {
  if (request.method !== 'GET') return fetch(request);
  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok || response.type === 'opaqueredirect') {
      const responseToCache = response.clone();
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, responseToCache);
    }
    return response;
  } catch (e) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Nothing in cache → show offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    // Absolute fallback
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
      const responseToCache = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, responseToCache);
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

/**
 * Cache First — serve from cache, fetch if miss.
 */
async function cacheFirst(request, cacheName, maxAge) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, responseToCache);
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
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, responseToCache));
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
    // We use the same name as in db.ts: AquatechOfflineDB
    const request = indexedDB.open('AquatechOfflineDB');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      
      // Dexie version 2 has 'auth' store with 'id' as primary key
      try {
        const transaction = db.transaction(['auth'], 'readonly');
        const store = transaction.objectStore('auth');
        const getRequest = store.get('last_session');
        
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      } catch (err) {
        // If 'auth' store doesn't exist yet (v1), fallback peacefully
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
});
