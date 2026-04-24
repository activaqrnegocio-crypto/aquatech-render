// ============================================================
// Aquatech CRM — Custom Service Worker (Standalone Offline-First) v45
// FIX: Content-Type validation — only cache HTML for navigation
// ============================================================
const STATIC_CACHE = 'aquatech-static';
const PAGES_CACHE  = 'aquatech-pages';
const ASSETS_CACHE = 'aquatech-assets';
const FONTS_CACHE  = 'aquatech-fonts';
const RSC_CACHE    = 'aquatech-rsc';

// Only pre-cache truly PUBLIC files (no auth required)
const PRE_CACHE = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.jpg',
  '/cotizacion.jpg',
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW v45] Installing...');
  event.waitUntil(
    // PURGE pages cache to wipe any corrupt RSC data from previous version
    caches.delete(PAGES_CACHE)
      .then(() => caches.delete(RSC_CACHE))
      .then(() => caches.open(STATIC_CACHE))
      .then(async (cache) => {
        for (const url of PRE_CACHE) {
          try {
            const response = await fetch(url);
            if (response.ok && !response.redirected) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn(`[SW] Pre-cache skipped (offline?): ${url}`);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  // DON'T delete any caches — they must survive across SW updates
  // (especially when the update happens while the user is offline)
  // Old versioned caches (aquatech-*-v42, etc.) can be cleaned up safely
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('aquatech-') && key.match(/-v\d+$/))
          .map(key => {
            console.log('[SW] Removing old versioned cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return; // Invalid URL, let browser handle
  }

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
    event.respondWith(networkFirst(request, 'aquatech-apis-v1', 15000));
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

  // ── RSC (React Server Component) requests — client-side navigations
  const isRSC = request.headers.get('RSC') === '1' || 
                request.headers.get('Next-Router-Prefetch') === '1' ||
                url.searchParams.has('_rsc');
  
  if (isRSC) {
    event.respondWith(rscNetworkFirst(request));
    return;
  }

  // ── Full-page navigation → CACHE FIRST with network update
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // ── Everything else → Network First with cache
  event.respondWith(
    networkFirst(request, ASSETS_CACHE).catch(() => 
      caches.match('/offline.html')
    )
  );
});

// ─── STRATEGIES ─────────────────────────────────────────────

/**
 * RSC Network First — specialized for React Server Component payloads.
 */
async function rscNetworkFirst(request) {
  const url = new URL(request.url);
  url.searchParams.delete('_rsc');
  const cacheKey = url.toString();

  try {
    const response = await fetchWithTimeout(request.clone(), 10000);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(RSC_CACHE);
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (e) {
    const cache = await caches.open(RSC_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Navigation handler — CACHE-FIRST for instant offline response.
 * 
 * Strategy:
 * 1. Check cache FIRST (instant response if available)
 * 2. If cache hit → serve it AND update in background
 * 3. If cache miss → try network with short timeout
 * 4. If all fails → offline.html → inline HTML
 */
async function navigationHandler(request) {
  const url = new URL(request.url);
  console.log('[SW] Navigation:', url.pathname);

  // ── STEP 1: Check cache first for instant offline response
  let cached = await findCachedPage(request.url, url.pathname);
  
  if (cached) {
    // Validate: don't serve cached login pages for non-login URLs
    const cachedUrl = cached.url || '';
    if (!url.pathname.includes('/login') && cachedUrl.includes('/login')) {
      console.log('[SW] Cached response is login redirect, skipping');
      cached = null;
    }
  }

  if (cached) {
    console.log('[SW] Serving from cache:', url.pathname);
    // Update in background (stale-while-revalidate for pages)
    updatePageInBackground(request.clone(), url.pathname);
    return cached;
  }

  // ── STEP 2: Cache miss → try network with SHORT timeout (3s)
  try {
    const response = await fetchWithTimeout(request.clone(), 3000);
    if (response.ok) {
      const contentType = response.headers.get('Content-Type') || '';
      const isHTML = contentType.includes('text/html');
      const finalUrl = response.url || '';
      const isLoginRedirect = finalUrl.includes('/login');
      
      // ONLY cache actual HTML responses, never RSC payloads or JSON
      if (isHTML && !isLoginRedirect) {
        const cache = await caches.open(PAGES_CACHE);
        cache.put(request.url, response.clone());
        const alt = request.url.endsWith('/') ? request.url.slice(0, -1) : request.url + '/';
        cache.put(alt, response.clone());
        // If redirected, also cache under final URL
        if (response.redirected && finalUrl) {
          cache.put(finalUrl, response.clone());
        }
        console.log('[SW] Cached page:', url.pathname, response.redirected ? `→ ${new URL(finalUrl).pathname}` : '');
      }
    }
    return response;
  } catch (e) {
    console.warn('[SW] Navigation network failed:', url.pathname);
  }

  // ── STEP 3: Try offline.html
  const offlinePage = await caches.match('/offline.html');
  if (offlinePage) return offlinePage;

  // ── STEP 4: Inline fallback (absolute last resort)
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Sin conexión</title></head>' +
    '<body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0a0f1e;color:white;">' +
    '<h1 style="margin-bottom:16px;">📡 Sin conexión</h1>' +
    '<p style="color:#94a3b8;">Conecta a internet y recarga.</p>' +
    '<button onclick="window.location.reload()" style="margin-top:20px;padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;">Reintentar</button>' +
    '</body></html>', 
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/**
 * Validate a cached response is actual HTML (not RSC or JSON)
 */
function isValidHTMLResponse(response) {
  if (!response) return false;
  const ct = response.headers.get('Content-Type') || '';
  return ct.includes('text/html');
}

/**
 * Find a cached page by URL, with multiple fallback strategies
 */
async function findCachedPage(requestUrl, pathname) {
  // Try exact URL
  let cached = await caches.match(requestUrl, { ignoreVary: true, ignoreSearch: true });
  if (isValidHTMLResponse(cached)) return cached;

  // Try slash variant
  const alt = requestUrl.endsWith('/') ? requestUrl.slice(0, -1) : requestUrl + '/';
  cached = await caches.match(alt, { ignoreVary: true, ignoreSearch: true });
  if (isValidHTMLResponse(cached)) return cached;

  // Try by pathname across all caches
  const allCacheNames = await caches.keys();
  for (const cacheName of allCacheNames) {
    if (cacheName.includes('rsc') || cacheName.includes('fonts')) continue;
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (const key of keys) {
      try {
        const keyUrl = new URL(key.url);
        if (keyUrl.pathname === pathname || keyUrl.pathname === pathname + '/' || keyUrl.pathname + '/' === pathname) {
          const match = await cache.match(key);
          if (isValidHTMLResponse(match)) return match;
        }
      } catch (e) { /* skip invalid URLs */ }
    }
  }

  // Try app shell fallback
  const isOperator = pathname.includes('/operador');
  const isSubcon = pathname.includes('/subcontratista');
  const shells = isOperator 
    ? ['/admin/operador', '/admin/operador/'] 
    : isSubcon 
      ? ['/admin/subcontratista', '/admin/subcontratista/']
      : ['/admin', '/admin/'];
  
  for (const shell of shells) {
    cached = await caches.match(shell, { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(cached)) return cached;
  }

  return null;
}

/**
 * Update a page in the background (for stale-while-revalidate)
 */
function updatePageInBackground(request, pathname) {
  fetch(request).then(response => {
    if (response.ok && !response.redirected) {
      caches.open(PAGES_CACHE).then(cache => {
        cache.put(request.url, response.clone());
        const alt = request.url.endsWith('/') ? request.url.slice(0, -1) : request.url + '/';
        cache.put(alt, response.clone());
      });
    }
  }).catch(() => { /* offline, ignore */ });
}

/**
 * Network First — try network, fallback to cache.
 */
async function networkFirst(request, cacheName, timeout = 10000) {
  if (request.method !== 'GET') return fetch(request);
  try {
    const response = await fetchWithTimeout(request, timeout);
    if ((response.ok || response.status === 0) && !response.redirected) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    
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
        cache.put(request, responseToCache).catch(() => {});
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
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('authShadow', 'readonly');
        const store = tx.objectStore('authShadow');
        const getReq = store.get('current');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
  });
}

// ─── MESSAGE HANDLER ───────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k.startsWith('aquatech-')).map(k => caches.delete(k)))
    ).then(() => {
      event.source?.postMessage({ type: 'cacheCleared' });
    });
  }

  // Warm-up pre-caching — caches responses INCLUDING redirects (except login)
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
            if (response.ok) {
              const contentType = response.headers.get('Content-Type') || '';
              const isHTML = contentType.includes('text/html');
              const finalUrl = response.url || '';
              const isLoginRedirect = finalUrl.includes('/login');
              
              // ONLY cache HTML — never RSC/JSON payloads
              if (isHTML && !isLoginRedirect) {
                await cache.put(url, response.clone());
                const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
                await cache.put(alt, response.clone());
                if (response.redirected && finalUrl) {
                  await cache.put(finalUrl, response.clone());
                }
                console.log('[SW] Warm-cached:', url);
              }
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

function openAquatechDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AquatechOfflineDB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {};
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
          await new Promise((res, rej) => {
            const tx = db.transaction(['outbox'], 'readwrite');
            const store = tx.objectStore('outbox');
            item.status = 'syncing';
            const req = store.put(item);
            req.onsuccess = res;
            req.onerror = rej;
          });

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
    vibrate: [200, 100, 200],
    tag: data.tag || 'aquatech-update',
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    image: '/logo.jpg',
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
        for (const client of windowClients) {
          if (client.url.includes('/admin/') && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
