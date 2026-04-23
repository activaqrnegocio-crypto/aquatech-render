// ============================================================
// Aquatech CRM — Custom Service Worker (Standalone Offline-First) v42
// Standalone: No Workbox dependency. Registered directly as /custom-sw.js
// ============================================================
const CACHE_VERSION = 'v42';
const STATIC_CACHE = `aquatech-static-${CACHE_VERSION}`;
const PAGES_CACHE  = `aquatech-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `aquatech-assets-${CACHE_VERSION}`;
const FONTS_CACHE  = `aquatech-fonts-${CACHE_VERSION}`;
const RSC_CACHE    = `aquatech-rsc-${CACHE_VERSION}`;

// Files to pre-cache on install (always available offline)
const PRE_CACHE = [
  '/',
  '/offline.html',
  '/logo.jpg',
  '/cotizacion.jpg',
  '/manifest.json',
  '/admin',
  '/admin/',
  '/admin/operador',
  '/admin/operador/',
  '/admin/operador/nuevo',
  '/admin/proyectos/nuevo',
  '/admin/inventario',
  '/admin/cotizaciones',
  '/admin/cotizaciones/',
  '/admin/cotizaciones/offline',
  '/admin/login',
  '/favicon.ico',
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW ${CACHE_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        // Fetch individually to prevent a single 302/404 from breaking the whole install
        for (const url of PRE_CACHE) {
          try {
            // Include credentials to ensure we capture the actual dashboard if logged in
            const response = await fetch(new Request(url, { 
              credentials: 'same-origin',
              redirect: 'follow'
            }));
            
            if (response.ok) {
              await cache.put(url, response);
            } else {
              console.warn(`[SW] Pre-cache skipped for ${url} (status: ${response.status})`);
            }
          } catch (err) {
            console.warn(`[SW] Pre-cache failed for ${url}:`, err);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW ${CACHE_VERSION}] Activating...`);
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

  // ── API requests
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      // Cache GET requests (Network First) so projects and data load offline
      // Increased timeout to 15s to prevent "0 projects" on slow connections
      event.respondWith(networkFirst(request, 'aquatech-apis-v1', 15000));
    } else {
      // POST, PATCH, DELETE are network only (mutations)
      event.respondWith(
        fetch(request).catch(() => 
          new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      );
    }
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
  try {
    event.respondWith(
      networkFirst(request, ASSETS_CACHE).catch(() => 
        caches.match('/offline.html')
      )
    );
  } catch (err) {
    console.error('[SW] Critical fetch listener error:', err);
  }
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
    const response = await fetchWithTimeout(request.clone(), 10000);
    if (response.ok) {
      const cache = await caches.open(RSC_CACHE);
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (e) {
    const cache = await caches.open(RSC_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    
    const exactCached = await caches.match(request.clone(), { ignoreVary: true });
    if (exactCached) return exactCached;

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
  const url = new URL(request.url);
  console.log('[SW] Handling navigation for:', url.pathname);
  
  // ── STEP 1: Try network first (8s timeout)
  try {
    const response = await fetchWithTimeout(request.clone(), 8000);
    if (response.ok && response.status === 200) {
      // Cache the successful navigation for future offline use
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request.url, response.clone());
      // Also cache without/with trailing slash variant
      const alt = request.url.endsWith('/') ? request.url.slice(0, -1) : request.url + '/';
      cache.put(alt, response.clone());
    }
    return response;
  } catch (e) {
    console.warn('[SW] Navigation network failed for:', url.pathname, e.message);
  }
  
  // ── OFFLINE FALLBACK CHAIN ──
  // Search ALL caches (not just specific ones) to find any cached version
  
  // STEP 2: Try exact URL match across all caches
  let cached = await caches.match(request.url, { ignoreVary: true, ignoreSearch: true });
  if (cached) {
    console.log('[SW] Found exact cache match');
    return cached;
  }

  // STEP 3: Try with/without trailing slash
  const altUrl = request.url.endsWith('/') ? request.url.slice(0, -1) : request.url + '/';
  cached = await caches.match(altUrl, { ignoreVary: true, ignoreSearch: true });
  if (cached) {
    console.log('[SW] Found alternate slash cache match');
    return cached;
  }

  // STEP 4: Try just the pathname (in case the full URL with host doesn't match)
  const allCacheNames = await caches.keys();
  for (const cacheName of allCacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (const key of keys) {
      const keyUrl = new URL(key.url);
      if (keyUrl.pathname === url.pathname) {
        const match = await cache.match(key);
        if (match) {
          console.log('[SW] Found pathname match in cache:', cacheName);
          return match;
        }
      }
    }
  }

  // STEP 5: APP SHELL FALLBACK — serve the parent dashboard shell
  const isOperatorPath = url.pathname.includes('/operador');
  const isSubconPath = url.pathname.includes('/subcontratista');
  const shellPaths = isOperatorPath 
    ? ['/admin/operador', '/admin/operador/'] 
    : (isSubconPath 
      ? ['/admin/subcontratista', '/admin/subcontratista/'] 
      : ['/admin', '/admin/']);
  
  for (const shellPath of shellPaths) {
    cached = await caches.match(shellPath, { ignoreVary: true, ignoreSearch: true });
    if (cached) {
      console.log('[SW] Serving app shell fallback:', shellPath);
      return cached;
    }
  }

  // STEP 6: Try root /
  cached = await caches.match('/', { ignoreVary: true, ignoreSearch: true });
  if (cached) {
    console.log('[SW] Serving root fallback');
    return cached;
  }

  // STEP 7: Any cached HTML page at all (last resort before offline.html)
  for (const cacheName of allCacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (const key of keys) {
      const match = await cache.match(key);
      if (match && match.headers.get('content-type')?.includes('text/html')) {
        console.log('[SW] Serving any cached HTML as emergency fallback');
        return match;
      }
    }
  }

  // STEP 8: Show offline page
  const offlinePage = await caches.match('/offline.html');
  if (offlinePage) return offlinePage;

  // STEP 9: Generate inline offline page (absolute last resort)
  console.error('[SW] ALL cache lookups failed — generating inline offline page');
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Sin conexión</title></head>' +
    '<body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0a0f1e;color:white;">' +
    '<h1 style="margin-bottom:16px;">📡 Sin conexión</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px;">La app necesita cargar al menos una vez con internet para funcionar offline.</p>' +
    '<p style="color:#64748b;font-size:0.85rem;margin-bottom:24px;">Conecta el WiFi, abre la app, navega un momento, y luego podrás usarla sin internet.</p>' +
    '<button onclick="window.location.reload()" style="padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Reintentar</button>' +
    '</body></html>', 
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

/**
 * Network First — try network, fallback to cache.
 */
async function networkFirst(request, cacheName, timeout = 10000) {
  if (request.method !== 'GET') return fetch(request);
  try {
    const response = await fetchWithTimeout(request, timeout);
    if (response.ok || response.status === 0) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    
    // If it's a JSON request, return a clean offline error instead of breaking
    if (request.headers.get('Accept')?.includes('application/json') || request.url.includes('/api/')) {
       return new Response(JSON.stringify([]), {
         status: 200, 
         headers: { 'Content-Type': 'application/json' }
       });
    }
    
    return Response.error();
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
    if (response && (response.ok || response.status === 0)) {
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => {
        cache.put(request, responseToCache).catch(err => {
          console.warn('[SW] Cache put failed:', err);
        });
      });
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

  // Allow explicit pre-caching of URLs (pages with auth cookies)
  if (event.data && event.data.type === 'PRECACHE_URLS') {
    const urls = event.data.urls || [];
    console.log('[SW] Warm-up pre-caching', urls.length, 'URLs');
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const response = await fetch(url, { 
              credentials: 'same-origin',
              redirect: 'follow'
            });
            if (response.ok && response.status === 200) {
              // Cache under the exact URL
              await cache.put(url, response.clone());
              // Also cache the variant (with/without trailing slash)
              const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
              await cache.put(alt, response.clone());
              console.log('[SW] Warm-cached:', url);
            }
          } catch (e) {
            console.warn('[SW] Warm-cache failed for:', url);
          }
        }
      })
    );
  }
});

// ─── BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    console.log('[SW] Background sync triggered: sync-outbox');
    event.waitUntil(processOutboxSync());
  }
});

/**
 * Native IndexedDB connection inside the Service Worker
 * because we cannot import Dexie/lib directly here.
 */
function openAquatechDB() {
  return new Promise((resolve, reject) => {
    // Open without version to use latest
    const request = indexedDB.open('AquatechOfflineDB');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    // Don't abort - let it open even if upgrade needed, 
    // though Dexie should handle the actual schema definition
    request.onupgradeneeded = (e) => {
      console.log('[SW] DB Upgrade needed in SW context...');
    };
  });
}

async function processOutboxSync() {
  let db;
  try {
    db = await openAquatechDB();
  } catch (err) {
    console.error('[SW] Failed to open IndexedDB for sync:', err);
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['outbox'], 'readwrite');
    const outboxStore = transaction.objectStore('outbox');
    const getAllRequest = outboxStore.getAll();

    getAllRequest.onsuccess = async () => {
      const items = getAllRequest.result || [];
      const pendingItems = items.filter(i => 
        (i.status === 'pending' || i.status === 'failed')
      );

      if (pendingItems.length === 0) {
        resolve();
        return;
      }

      console.log(`[SW] Found ${pendingItems.length} pending items to sync`);

      for (const item of pendingItems) {
        try {
          // 1. Update status to syncing
          await new Promise((res, rej) => {
            const tx = db.transaction(['outbox'], 'readwrite');
            const store = tx.objectStore('outbox');
            item.status = 'syncing';
            const req = store.put(item);
            req.onsuccess = res;
            req.onerror = rej;
          });

          // 2. Fetch API specialized by type
          let endpoint = '';
          let method = 'POST';
          
          if (item.type === 'QUOTE') endpoint = '/api/quotes';
          else if (item.type === 'MATERIAL') endpoint = '/api/materials';
          else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') {
            endpoint = `/api/projects/${item.projectId}/messages`;
          } else if (item.type === 'EXPENSE') {
            endpoint = `/api/projects/${item.projectId}/expenses`;
          } else if (item.type === 'DAY_START') {
            endpoint = '/api/day-records';
          } else if (item.type === 'DAY_END') {
            endpoint = '/api/day-records';
            method = 'PUT';
          } else if (item.type === 'PHASE_COMPLETE') {
            endpoint = `/api/projects/${item.projectId}/phases/${item.payload.phaseId}`;
            method = 'PATCH';
          } else if (item.type === 'PROJECT') {
            endpoint = '/api/projects';
          }

          if (endpoint) {
            const res = await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ...item.payload, 
                lat: item.lat, 
                lng: item.lng, 
                createdAt: new Date(item.timestamp).toISOString(),
                isOfflineSync: true 
              })
            });

            if (res.ok) {
               // 3. Delete on success
               await new Promise((deleteRes) => {
                 const txd = db.transaction(['outbox'], 'readwrite');
                 const stored = txd.objectStore('outbox');
                 const req = stored.delete(item.id);
                 req.onsuccess = deleteRes;
               });
               console.log(`[SW] Successfully synced ${item.type} (ID: ${item.id})`);
            } else {
               throw new Error('Server returned ' + res.status);
            }
          }
        } catch (e) {
          console.error(`[SW] Failed to sync item ${item.id}:`, e);
          // 4. Mark as failed
          await new Promise((res) => {
            const txError = db.transaction(['outbox'], 'readwrite');
            const storeError = txError.objectStore('outbox');
            item.status = 'failed';
            storeError.put(item).onsuccess = res;
          });
        }
      }
      resolve();
    };

    getAllRequest.onerror = () => {
      console.error('[SW] Failed to read outbox for sync');
      reject(getAllRequest.error);
    };
  });
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'Aquatech CRM', body: event.data?.text() || 'Nueva notificación' };
  }

  const options = {
    body: data.body || 'Nueva actualización en tu proyecto',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200], // Short, safe vibration pattern
    tag: data.tag || 'aquatech-update', // Static tag so renotify works properly
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    image: '/logo.jpg', // Large image for better visibility
    data: {
      url: data.url || '/admin/operador',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '📂 Ver Detalles' },
      { action: 'close', title: '✕ Ignorar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Aquatech CRM', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/admin/operador';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If there's already an open window with the CRM, focus and navigate
        for (const client of windowClients) {
          if (client.url.includes('/admin/') && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});

