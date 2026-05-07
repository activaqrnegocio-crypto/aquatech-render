const SW_VERSION = 'v371-crash-fix';
const VERSION = SW_VERSION;
const STATIC_CACHE = `aquatech-static-${SW_VERSION}`;
const PAGES_CACHE  = `aquatech-pages-${SW_VERSION}`;
const ASSETS_CACHE = `aquatech-assets-${SW_VERSION}`;
const FONTS_CACHE  = `aquatech-fonts-${SW_VERSION}`;
const RSC_CACHE    = `aquatech-rsc-${SW_VERSION}`;

// ─── v337: SELF-WAKING POLLER ───────────────────────────────
// The ONLY reliable way to ensure background sync on mobile devices.
// Sync events and online events are unreliable — the SW can be dormant
// when connectivity changes. This poller checks the outbox every 60s
// and processes pending items regardless of external triggers.
// 
// Stops polling when the outbox is empty to save battery.
// custom-sw.js - v368: Data Loss Prevention (Net/Auth error handling)
let outboxPollerInterval = null;
let pollerCheckCount = 0;
let lastOutboxCount = -1;

function startOutboxPoller() {
  if (outboxPollerInterval) return;
  
  console.log('[SW] 🤖 Aggressive poller started (15s interval)');
  logSyncSW('info', '🤖 Poller agresivo iniciado (15s)', 'poller').catch(() => {});
  
  outboxPollerInterval = setInterval(async () => {
    pollerCheckCount++;
    try {
      const db = await openAquatechDB();
      const result = await new Promise((resolve) => {
        const tx = db.transaction(['outbox'], 'readonly');
        const countReq = tx.objectStore('outbox').count();
        const getAllReq = tx.objectStore('outbox').getAll();
        let count = 0;
        let items = [];
        countReq.onsuccess = () => { count = countReq.result; };
        getAllReq.onsuccess = () => { items = getAllReq.result; };
        tx.oncomplete = () => resolve({ count, items });
        tx.onerror = () => resolve({ count: 0, items: [] });
      });
      
      const count = result.count;
      const items = result.items;
      
      // Only log if count changed or every 8 checks (~2 min)
      if (count !== lastOutboxCount || pollerCheckCount % 8 === 0) {
        const types = [...new Set(items.map(i => i.type))].join(',');
        if (count > 0) {
          console.log(`[SW] Poller #${pollerCheckCount}: ${count} items [${types}]`);
        }
        lastOutboxCount = count;
      }
      
      if (count > 0 && !isSyncingGlobal) {
        // v369: Do NOT process if the page is open and visible. GlobalSyncWorker will handle it.
        // This completely eliminates the race condition where custom-sw.js steals text messages
        // while GlobalSyncWorker is busy uploading an image.
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const isVisible = windowClients.some(c => c.visibilityState === 'visible');
        
        if (isVisible) {
          // console.log(`[SW] Poller #${pollerCheckCount}: Page is visible. Deferring to GlobalSyncWorker.`);
        } else {
          console.log(`[SW] Poller found ${count} pending items — waking robot!`);
          await logSyncSW('info', '🔍 Poller #' + pollerCheckCount + ': ' + count + ' items pendientes — procesando', 'poller').catch(() => {});
          processOutboxSync(true).catch(() => {});
        }
      }
    } catch (e) {
      // Outbox might not be accessible yet
    }
  }, 15000); // Every 15 seconds
}

function stopOutboxPoller() {
  if (outboxPollerInterval) {
    clearInterval(outboxPollerInterval);
    outboxPollerInterval = null;
    console.log('[SW] Poller stopped');
  }
}

// Start poller immediately when SW loads
startOutboxPoller();

// v317: Auto-cleanup sync notifications on activation
self.addEventListener('install', event => {
  console.log(`[SW ${VERSION}] Robot ${SW_VERSION} instalándose...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        const CRITICAL_URLS = [
          '/admin/proyectos/offline-shell',
          '/admin/operador/proyecto/offline-shell',
          '/offline.html',
          '/favicon.ico',
          '/logo.jpg'
        ];

        // 1. First, ENSURE critical shells are cached. If this fails, the SW is useless offline.
        for (const url of CRITICAL_URLS) {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
              await cache.put(url, response.clone());
              // Auto-extract assets for critical shells immediately
              await extractAndCacheAssets(response, url);
            } else {
              throw new Error(`Failed to fetch critical ${url}: ${response.status}`);
            }
          } catch (err) {
            console.error(`[SW] CRITICAL Pre-cache FAILED: ${url}`, err);
            // We don't throw here to allow partial install, but it's dangerous
          }
        }

        // 2. Cache the rest of PRE_CACHE
        for (const url of PRE_CACHE) {
          if (CRITICAL_URLS.includes(url)) continue;
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn(`[SW] Non-critical pre-cache skipped: ${url}`);
          }
        }
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.getNotifications().then(notifications => {
        notifications.forEach(notification => {
          if (notification.tag === 'sync-progress' || notification.tag === 'sync-status') {
            notification.close();
          }
        });
      }),
      clients.claim()
    ])
  );
});

// ─── v334: ONLINE DETECTION ─────────────────────────────────
// When the device comes back online, immediately process any
// pending outbox items. This is the fastest possible reaction.
self.addEventListener('online', () => {
  console.log('[SW] 📶 Device back online! Checking outbox...');
  logSyncSW('info', '📶 Conexión detectada — procesando cola pendiente', 'network').catch(() => {});
  // Force sync to process ALL pending items immediately
  processOutboxSync(true).catch(() => {});
});

function getUploadTimeout(sizeInBytes) {
  if (sizeInBytes < 1 * 1024 * 1024)    return 60_000;    // <1MB    → 1 min
  if (sizeInBytes < 10 * 1024 * 1024)   return 120_000;   // <10MB   → 2 min
  if (sizeInBytes < 50 * 1024 * 1024)   return 300_000;   // <50MB   → 5 min
  if (sizeInBytes < 100 * 1024 * 1024)  return 600_000;   // <100MB  → 10 min
  return 1_200_000;                                      // 200MB+  → 20 min
}

function getChunkSize(fileSizeBytes) {
  if (fileSizeBytes < 5 * 1024 * 1024)   return 1 * 1024 * 1024;  // <5MB   → chunks 1MB
  if (fileSizeBytes < 20 * 1024 * 1024)  return 3 * 1024 * 1024;  // <20MB  → chunks 3MB
  if (fileSizeBytes < 100 * 1024 * 1024) return 8 * 1024 * 1024;  // <100MB → chunks 8MB
  return 15 * 1024 * 1024;                                         // 200MB+ → chunks 15MB
}

// Only pre-cache truly PUBLIC files (no auth required)
// v278: Added critical Admin routes to ensure list navigation works offline
const PRE_CACHE = [
  '/admin',
  '/admin/operador',
  '/admin/operador/nuevo',
  '/admin/login',
  '/admin/proyectos',
  '/admin/proyectos/nuevo',
  '/admin/calendario',
  '/admin/cotizaciones',
  '/admin/cotizaciones/nuevo',
  '/admin/inventario',
  '/offline.html',
  '/app-start.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/logo.jpg',
  '/cotizacion.jpg',
  '/admin/proyectos/offline-shell',
  '/admin/operador/proyecto/offline-shell',
  'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400&display=swap'
];

let precacheQueueSet = new Set(); // v291: Use a Set for robust pending count deduplication

// v242: Helper to bypass Chrome's "redirected response" security block
function cleanResponse(response) {
  if (!response || !response.redirected) return response;
  const headers = new Headers(response.headers);
  
  // v310: Fix "Response with null body status cannot have body" (204, 304, etc)
  const nullBodyStatuses = [101, 204, 205, 304];
  const body = nullBodyStatuses.includes(response.status) ? null : response.body;
  
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

/**
 * Helper to extract and cache JS/CSS from an HTML response
 */
async function extractAndCacheAssets(htmlResponse, sourceUrl) {
  try {
    const text = await htmlResponse.clone().text();
    const assetRegex = /([\/a-zA-Z0-9._\-\[\]\(\)%@+~]+\.(js|css|woff2))/g;
    const matches = Array.from(text.matchAll(assetRegex))
      .filter(m => m[1].includes('_next/static/') || m[1].includes('/fonts/'));
    
    // v312: Explicitly extract link and preload tags to catch tricky CSS files
    const linkRegex = /<link[^>]+href=["']([^"']+\.(css|js))["'][^>]*>/gi;
    const linkMatches = Array.from(text.matchAll(linkRegex)).map(m => [m[0], m[1]]);
    for (const lm of linkMatches) {
        if (!matches.some(m => m[1] === lm[1]) && (lm[1].includes('_next/static/') || lm[1].includes('/fonts/'))) {
            matches.push([lm[0], lm[1]]);
        }
    }
    
    const assetsCache = await caches.open(ASSETS_CACHE);
    const origin = self.location.origin;

    for (const match of matches) {
      const path = match[1];
      const fullUrl = path.startsWith('http') ? path : new URL(path.startsWith('/') ? path : '/' + path, origin).href;
      
      const hasAsset = await assetsCache.match(fullUrl, { ignoreSearch: true });
      if (!hasAsset) {
        try {
          const r = await fetch(fullUrl, { priority: 'high' });
          if (r.ok) await assetsCache.put(fullUrl, r);
        } catch(e) {}
      }
    }
    console.log(`[SW] Extracted assets for ${sourceUrl}`);
  } catch (err) {
    console.warn(`[SW] Asset extraction failed for ${sourceUrl}`, err);
  }
}


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
          .filter(key => key.startsWith('aquatech-') && key.match(/-v\d+$/) && !key.includes(VERSION))
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

  // v339: Reject data: and blob: URLs immediately — they're not network requests.
  // The URL constructor accepts them but fetch() / caches don't, causing ERR_INVALID_URL.
  if (request.url.startsWith('data:') || request.url.startsWith('blob:')) return;

  // v317: Handle Background Fetch dummy trigger
  const requestUrl = new URL(request.url);
  
  if (requestUrl.pathname === '/api/sync/background-trigger') {
    event.respondWith(new Response(JSON.stringify({ triggered: true }), {
      headers: { 'Content-Type': 'application/json' }
    }));
    return;
  }

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
            // v232: Include permissions so UI renders identically offline
            return new Response(JSON.stringify({
              user: {
                name: auth.name,
                email: auth.username,
                role: auth.role,
                image: null,
                id: auth.userId,
                permissions: auth.permissions || null
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

  // ── API requests (Bypass SW for bulk-cache to avoid timeouts)
  if (url.pathname.startsWith('/api/projects/bulk-cache')) {
    return; // Let browser handle high-data sync directly
  }

  if (url.pathname.startsWith('/api/')) {
    // v274: EXCLUDE critical data APIs from SW cache to let Dexie handle it exclusively.
    // This prevents stale/partial SW cache from overwriting reliable Dexie data.
    const isCriticalApi = 
      request.method !== 'GET' ||
      url.pathname.includes('/api/push') ||
      url.pathname.includes('/api/appointments') || 
      url.pathname.includes('/api/projects') || 
      url.pathname.includes('/api/users');

    if (isCriticalApi) {
      return; // Fall through to browser fetch (components handle offline via Dexie)
    }
    
    // v301: Increased API timeout to 15s for slower VPS responses
    event.respondWith(networkFirst(request, 'aquatech-apis-v1', 15000));
    return;
  }

  // ── Google Fonts → Cache First (long-lived)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }
  
  // v312: EXPLICIT CSS CHUNKS HANDLING → CACHE FIRST (Immutable)
  if (url.pathname.startsWith('/_next/static/css/')) {
    event.respondWith(
      caches.match(request, { ignoreVary: true, ignoreSearch: true }).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(response => {
          if (response.ok && !response.redirected) {
             const responseToCache = response.clone();
             caches.open(ASSETS_CACHE).then(cache => cache.put(request, responseToCache));
          }
          return response;
        }).catch(() => new Response(null, { status: 204 }));
      })
    );
    return;
  }

  // ── Next.js static assets → Cache First with auto-save
  // v226: Use StaleWhileRevalidate for assets to ensure they are always updated 
  // but available instantly. Added specific handling for chunks.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
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
    // v286: Use SWR for routes that are role-exclusive or critical for speed.
    // This makes project navigation INSTANT.
    const isAdminOnlyRoute = url.pathname.startsWith('/admin/proyectos') || 
                             url.pathname.startsWith('/admin/calendario') ||
                             url.pathname.startsWith('/admin/inventario') ||
                             url.pathname.startsWith('/admin/cotizaciones') ||
                             url.pathname.startsWith('/admin/blog') ||
                             url.pathname === '/admin';
    const isOperatorOnlyRoute = url.pathname.startsWith('/admin/operador') || 
                                url.pathname.startsWith('/operador');
    
    if (isAdminOnlyRoute || isOperatorOnlyRoute) {
      event.respondWith(rscStaleWhileRevalidate(request));
    } else {
      event.respondWith(rscNetworkFirst(request));
    }
    return;
  }

  // ── Full-page navigation → CACHE FIRST with network update
  if (request.mode === 'navigate') {
    event.respondWith(
      navigationHandler(request).catch((err) => {
        console.error('[SW] Navigation handler crashed:', err);
        // ABSOLUTE FALLBACK — never show ERR_FAILED
        return caches.match('/offline.html').then(offlinePage => {
          if (offlinePage) return offlinePage;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Sin conexión</title></head>' +
            '<body style="font-family:system-ui;text-align:center;padding:50px;background:#0a0f1e;color:white;">' +
            '<h1>📡 Sin conexión</h1><p>Conecta a internet y recarga.</p>' +
            '<button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;">Reintentar</button>' +
            '</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
    );
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
  const originalUrl = url.toString();
  url.searchParams.delete('_rsc');
  const cacheKey = url.toString();

  try {
    // v302: Wrap everything in a secondary try/catch for extreme safety
    try {
      // v340: Increased RSC timeout to 20s for cold SSR
      const response = await fetchWithTimeout(request.clone(), 20000);
      // v272: If server returns error (502, 500, 404), fallback to cache/shell
      if (!response.ok) {
        console.warn(`[SW ${VERSION}] RSC Network error ${response.status}, falling back to cache/shell...`);
        throw new Error(`HTTP ${response.status}`);
      }
      
      if (!response.redirected) {
        const cache = await caches.open(RSC_CACHE);
        cache.put(cacheKey, response.clone());
        // v222: Increased limit for RSC to preserve project data shells (Admin scale)
        trimCache(RSC_CACHE, 400);
      }
      return response;
    } catch (e) {
      const rscCache = await caches.open(RSC_CACHE);
      const pagesCache = await caches.open(PAGES_CACHE);
      
      // 1. Try exact match in RSC_CACHE and PAGES_CACHE (bulk sync saves here)
      let cached = await rscCache.match(cacheKey) || 
                   await rscCache.match(originalUrl) ||
                   await pagesCache.match(originalUrl);
                   
      if (cached) return cached;
      
      // 2. v225: Universal RSC Shell for Projects
      const isAdminProjectRsc = url.pathname.match(/\/admin\/proyectos\/\d+/);
      const isOperatorProjectRsc = url.pathname.match(/\/admin\/operador\/proyecto\/\d+/) || 
                                   url.pathname.match(/\/operador\/proyecto\/\d+/) ||
                                   url.pathname.includes('/operador/proyecto/');

      if (isAdminProjectRsc || isOperatorProjectRsc) {
        console.log(`[SW ${VERSION}] RSC cache miss for project — trying Universal RSC Shell...`);
        const shellRscUrl = isOperatorProjectRsc 
          ? '/admin/operador/proyecto/offline-shell'
          : '/admin/proyectos/offline-shell';
        
        const shellRsc = await rscCache.match(shellRscUrl, { ignoreVary: true, ignoreSearch: true });
        if (shellRsc) return shellRsc;

        return new Response(null, { status: 204 }); 
      }
      console.warn(`[SW ${VERSION}] RSC Network First failed completely for:`, url.pathname);
      return new Response(null, { status: 204 }); 
    }
  } catch (globalErr) {
    console.error(`[SW ${VERSION}] Critical failure in rscNetworkFirst:`, globalErr);
    return new Response(null, { status: 204 });
  }
}

/**
 * v245: RSC Stale While Revalidate — Instant response for core navigations.
 */
async function rscStaleWhileRevalidate(request) {
  try {
    const url = new URL(request.url);
    url.searchParams.delete('_rsc');
    const cacheKey = url.toString();
    
    const cache = await caches.open(RSC_CACHE);
    const pagesCache = await caches.open(PAGES_CACHE);
    
    let cached = await cache.match(cacheKey) || await pagesCache.match(request.url);
    
    const fetchPromise = fetchWithTimeout(request.clone(), 20000).then(async (response) => {
      if (response && response.ok && !response.redirected) {
        const cacheToUpdate = await caches.open(RSC_CACHE);
        cacheToUpdate.put(cacheKey, response.clone());
      }
      if (response && !response.ok) return null;
      return response;
    }).catch(() => null);

    if (cached) {
      return cached;
    }

    // v251: Ensure we NEVER return null to respondWith()
    return fetchPromise.then(async res => {
      if (res) return res;

      // v287: Fallback to Universal RSC Shell if SWR fails (Network + Cache Miss)
      const isAdminProjectRsc = url.pathname.match(/\/admin\/proyectos\/\d+/);
      const isOperatorProjectRsc = url.pathname.match(/\/admin\/operador\/proyecto\/\d+/) || 
                                   url.pathname.match(/\/operador\/proyecto\/\d+/) ||
                                   url.pathname.includes('/operador/proyecto/');

      if (isAdminProjectRsc || isOperatorProjectRsc) {
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 204 });
    });
  } catch (globalErr) {
    console.error(`[SW ${VERSION}] Critical failure in rscStaleWhileRevalidate:`, globalErr);
    return new Response(null, { status: 204 });
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
  try {
    const url = new URL(request.url);
    
    // Removed the entry point bypass from v236 because bypassing SW completely 
    // means those routes (like /admin/operador) will fail entirely when offline.
    // The 15s timeout below is enough to handle slow network redirects without breaking offline mode.
    const isLoginPage = url.pathname === '/admin/login' || url.pathname === '/admin/login/';
    if (isLoginPage) {
      // console.log(`[SW ${VERSION}] Login detected, bypassing SW completely`);
      return fetch(request);
    }

    // v340: ROBUST STRATEGY — Cache-first for offline, network-first for online
    
    // ── STEP 2: CACHE FIRST (instant for offline, background update for online) ──
    // For admin/operator routes, prefer serving the cached shell immediately
    const isOpNav = url.pathname.includes('/operador/') || url.pathname === '/admin/operador' || url.pathname === '/admin/operador/';
    const isAdminNav = url.pathname.includes('/admin/proyectos') || url.pathname.includes('/admin/calendario') || url.pathname === '/admin';

    // 2a. Try exact URL cache
    let cached = await caches.match(request.url, { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(cached)) {
      // Serve immediately, update in background if online
      updatePageInBackground(request.clone(), url.pathname);
      return cleanResponse(cached);
    }

    // 2b. Try shell for admin/operator routes (except /nuevo — son formularios, no detalles de proyecto)
    const isNuevoPage = url.pathname.endsWith('/nuevo') || url.pathname.endsWith('/nuevo/');
    if (!isNuevoPage && (isOpNav || isAdminNav)) {
      const shellUrl = isOpNav
        ? '/admin/operador/proyecto/offline-shell'
        : '/admin/proyectos/offline-shell';
      const shell = await caches.match(shellUrl, { ignoreVary: true, ignoreSearch: true });
      if (isValidHTMLResponse(shell)) {
        console.log(`[SW v340] Serving offline-shell for: ${url.pathname}`);
        updatePageInBackground(request.clone(), url.pathname);
        return shell;
      }
      // Search ALL caches (in case shell is in a different versioned cache)
      const allCaches = await caches.keys();
      for (const cName of allCaches) {
        const c = await caches.open(cName);
        const match = await c.match(shellUrl, { ignoreVary: true, ignoreSearch: true });
        if (isValidHTMLResponse(match)) {
          console.log(`[SW v340] Shell found in cache '${cName}' for: ${url.pathname}`);
          updatePageInBackground(request.clone(), url.pathname);
          return match;
        }
      }
    }

    // ── STEP 3: NETWORK FIRST (online fallback) ─────────────────
    if (navigator.onLine) {
      try {
        const response = await fetchWithTimeout(request.clone(), 25000);
        if (response.ok) {
          const ct = response.headers.get('Content-Type') || '';
          const finalUrl = response.url || '';
          if (ct.includes('text/html') && !finalUrl.includes('/login')) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request.url, response.clone());
            const alt = request.url.endsWith('/') ? request.url.slice(0, -1) : request.url + '/';
            cache.put(alt, response.clone());
            if (response.redirected && finalUrl) cache.put(finalUrl, response.clone());
            trimCache(PAGES_CACHE, 400);
          }
        }
        return response;
      } catch (_e) {
        // Network failed — try one more time with native fetch
        try {
          const nativeRes = await fetch(request);
          if (nativeRes.ok) {
            const ct = nativeRes.headers.get('Content-Type') || '';
            if (ct.includes('text/html') && !nativeRes.url?.includes('/login')) {
              const cache = await caches.open(PAGES_CACHE);
              cache.put(request.url, nativeRes.clone());
            }
          }
          return nativeRes;
        } catch (_e2) {
          // Both failed — fall through to offline recovery
        }
      }
    }

    // ── STEP 4: OFFLINE FALLBACK ────────────────────────────
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    // ── STEP 5: Absolute last resort ────────────────────────
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
  } catch (fatalError) {
    console.error('[SW] FATAL in navigation handler:', fatalError);
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    return new Response(
      '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Sin conexión</title></head>' +
      '<body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0a0f1e;color:white;">' +
      '<h1 style="margin-bottom:16px;">📡 Error de navegación</h1>' +
      '<p style="color:#94a3b8;">Por favor, conecta a internet y recarga la página.</p>' +
      '<button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;">Reintentar</button>' +
      '</body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Trim cache to a maximum number of items to prevent "exploding" storage.
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Borrar el más antiguo (el primero de la lista)
    await cache.delete(keys[0]);
    // Recursivo hasta que estemos bajo el límite
    await trimCache(cacheName, maxItems);
  }
}

/**
 * Validate a cached response is actual HTML (not RSC or JSON)
 */
function isValidHTMLResponse(response) {
  if (!response || !response.ok) return false; // v240: Ignore redirects (status 3xx)
  const ct = response.headers.get('Content-Type') || '';
  return ct.includes('text/html');
}

/**
 * Find a cached page by URL, with multiple fallback strategies
 */
async function findCachedPage(requestUrl, pathname, forceServe = false) {
  // Try exact URL
  let cached = await caches.match(requestUrl, { ignoreVary: true, ignoreSearch: true });
  if (isValidHTMLResponse(cached)) {
    // v304: Strict check — if we are NOT going to login, but the cache is a login page, skip it.
    const isLoginPath = pathname.includes('/login');
    const isCachedLogin = (cached.url || '').includes('/login');
    if (!forceServe && !isLoginPath && isCachedLogin) {
       // skip invalid cache pollution from online redirects
    } else {
       return cached;
    }
  }

  // Try slash variant
  const alt = requestUrl.endsWith('/') ? requestUrl.slice(0, -1) : requestUrl + '/';
  cached = await caches.match(alt, { ignoreVary: true, ignoreSearch: true });
  if (isValidHTMLResponse(cached)) {
    if (!forceServe && !pathname.includes('/login') && (cached.url || '').includes('/login')) {
       // skip
    } else {
       return cached;
    }
  }

  // Try app shell fallback (Specific for main sections)
  const shells = [];
  
  // v225: Improved Shell logic for Projects
  // v268: Robust operator project detection
  const isAdminProject = pathname.match(/\/admin\/proyectos\/[^/]+/);
  const isOperatorProject = pathname.match(/\/admin\/operador\/proyecto\/[^/]+/) || 
                            pathname.match(/\/operador\/proyecto\/[^/]+/) ||
                            pathname.includes('/operador/proyecto/');
  const isLoginPage = pathname === '/admin/login' || pathname === '/admin/login/';
  const isRootAdmin = pathname === '/admin' || pathname === '/admin/';
  
  if (isLoginPage) return null; 

  // v239: If we are hitting /admin offline, we most likely want the operator or admin dashboard
  if (isRootAdmin && !navigator.onLine) {
    console.log(`[SW ${VERSION}] Root /admin hit offline, trying to find a dashboard shell...`);
    const opDashboard = await caches.match('/admin/operador', { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(opDashboard)) return opDashboard;
    const adminDashboard = await caches.match('/admin', { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(adminDashboard)) return adminDashboard;
  }

  if (isAdminProject) {
    console.log(`[SW ${VERSION}] Admin Project detail detected, looking for a valid shell...`);
    const shellMatch = await caches.match('/admin/proyectos/offline-shell', { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(shellMatch)) return shellMatch;
    
  } else if (isOperatorProject) {
    console.log(`[SW ${VERSION}] Operator Project detail detected, looking for a valid shell...`);
    
    // v254: Aggressive shell search across ALL caches with multiple variants
    const shellVariants = [
      '/admin/operador/proyecto/offline-shell',
      '/admin/operador/proyecto/offline-shell/',
    ];
    
    // Search in PAGES_CACHE first
    for (const variant of shellVariants) {
      const shellMatch = await caches.match(variant, { ignoreVary: true, ignoreSearch: true });
      if (isValidHTMLResponse(shellMatch)) {
        console.log(`[SW] Operator shell found in cache: ${variant}`);
        return shellMatch;
      }
    }
    
    // Search across ALL caches as fallback
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const c = await caches.open(cacheName);
      for (const variant of shellVariants) {
        const shellMatch = await c.match(variant, { ignoreVary: true, ignoreSearch: true });
        if (isValidHTMLResponse(shellMatch)) {
          console.log(`[SW] Operator shell found in cache '${cacheName}': ${variant}`);
          return shellMatch;
        }
      }
    }

    // v254: As last resort, try the ADMIN project shell (same component structure)
    const adminShell = await caches.match('/admin/proyectos/offline-shell', { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(adminShell)) {
      console.log(`[SW] Using Admin project shell as fallback for Operator`);
      return adminShell;
    }

    // Priority 2: The Operator Dashboard (better than offline.html)
    if (pathname.includes('/operador')) {
      shells.push('/admin/operador', '/admin/operador/');
    }
  }

  if (pathname.includes('/admin/operador/nuevo')) shells.push('/admin/operador', '/admin/operador/');
  else if (pathname.includes('/admin/operador')) shells.push('/admin/operador', '/admin/operador/');
  else if (pathname.includes('/operador')) shells.push('/admin/operador', '/admin/operador/');
  else if (pathname.includes('/subcontratista')) shells.push('/admin/subcontratista', '/admin/subcontratista/');
  else if (pathname.includes('/admin/proyectos/nuevo')) shells.push('/admin/proyectos', '/admin/proyectos/');
  else if (pathname.includes('/admin/proyectos')) shells.push('/admin/proyectos', '/admin/proyectos/');
  else if (pathname.includes('/admin/calendario')) shells.push('/admin/calendario', '/admin/calendario/');
  else {
    shells.push('/admin', '/admin/');
  }

  for (const shell of shells) {
    const shellMatch = await caches.match(shell, { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(shellMatch)) {
       console.log('[SW] Shell found for fallback:', shell);
       return shellMatch;
    }
  }

  // v340: CRITICAL FIX — Dashboard shell fallback.
  // When offline and visiting /admin/operador or /admin/proyectos (dashboards),
  // serve the offline-shell instead of the dead-end "Sin Conexión" page.
  // The shell contains the real Next.js app which can hydrate from Dexie data.
  const isOperatorDashboard = pathname === '/admin/operador' || pathname === '/admin/operador/';
  const isAdminDashboard = pathname === '/admin/proyectos' || pathname === '/admin/proyectos/';
  const isOpProject = pathname.match(/\/admin\/operador\/proyecto\//);
  const isAdmProject = pathname.match(/\/admin\/proyectos\//);
  const shellRedirect = isOpProject 
    ? '/admin/operador/proyecto/offline-shell'
    : isAdmProject 
      ? '/admin/proyectos/offline-shell'
      : isOperatorDashboard
        ? '/admin/operador/proyecto/offline-shell'
        : isAdminDashboard
          ? '/admin/proyectos/offline-shell'
          : null;
      
  if (shellRedirect) {
    // v288: CRITICAL — STOP PHYSICAL REDIRECTS. Serve the shell content directly
    // while keeping the original project URL. This allows the client-side recovery
    // logic to work without losing the project ID in the URL.
    const shellMatch = await caches.match(shellRedirect, { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(shellMatch)) {
      // console.log(`[SW v340] Dashboard shell fallback for: ${pathname}`);
      return shellMatch;
    }
    // console.warn(`[SW v340] Shell ${shellRedirect} not in cache, fallback to absolute.`);
  }
  
  console.warn(`[SW ${VERSION}] No shell found in cache, serving absolute memory-fallback for: ${pathname}`);
  return new Response(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sin conexión | Aquatech</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; }
        .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); max-width: 400px; }
        h1 { margin-top: 0; color: #38bdf8; }
        button { background: #38bdf8; color: #0f172a; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Sin Conexión</h1>
        <p>Conecta a internet para ver esta sección.</p>
        <button onclick="window.history.back()">Regresar</button>
      </div>
    </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'X-SW-Fallback': 'absolute'
    }
  });
}

/**
 * Update a page in the background (for stale-while-revalidate)
 */
function updatePageInBackground(request, pathname) {
  if (!navigator.onLine) return; // Don't even try if offline
  
  fetch(request).then(response => {
    if (response.ok && !response.redirected) {
      const ct = response.headers.get('Content-Type') || '';
      if (ct.includes('text/html')) {
        caches.open(PAGES_CACHE).then(cache => {
          cache.put(request.url, response.clone());
        });
      }
    }
  }).catch(() => { /* offline, ignore */ });
}

/**
 * Network First — try network, fallback to cache.
 */
async function networkFirst(request, cacheName, timeout = 10000) {
  if (request.method !== 'GET') return fetch(request);
  const url = new URL(request.url);
  const isNextChunk = url.pathname.includes('/_next/static/') && url.pathname.endsWith('.js');

  try {
    const response = await fetchWithTimeout(request, timeout);
    
    // v272/v302: If server returns error (502, 500) OR a 404 for a chunk, handle it
    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (response.status === 404 && isNextChunk) {
        console.warn(`[SW] Chunk obsoleto detectado en red (404): ${url.pathname}. Forzando recarga...`);
        caches.keys().then(keys => {
          keys.forEach(k => {
            if (k.startsWith('aquatech-pages') || k.startsWith('aquatech-rsc')) {
              caches.delete(k);
            }
          });
        });
        return new Response(
          'window.location.reload(true);',
          { status: 200, headers: { 'Content-Type': 'application/javascript' } }
        );
      }
    }

    // v233: NEVER cache errors (500) or redirects
    if (response.ok && !response.redirected) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    
    // v227: Special fallback for JS chunks to prevent "Loading chunk failed" white screen
    if (isNextChunk) {
      console.warn('[SW] Critical chunk missing offline:', url.pathname);
      return new Response(
        'console.error("Aquatech: Chunk load failed offline. Please reconnect.");',
        { status: 200, headers: { 'Content-Type': 'application/javascript' } }
      );
    }

    if (request.headers.get('Accept')?.includes('application/json') || request.url.includes('/api/')) {
       // v274: DON'T return empty array if we have no cache. Return 504 so the UI knows it's a network failure.
       return new Response(JSON.stringify({ error: 'Network failure', isOffline: true }), {
         status: 504, 
         headers: { 'Content-Type': 'application/json' }
       });
    }

    // v254: Clean fallback for images/favicons to avoid console ERR_FAILED
    if (request.destination === 'image' || isStaticAsset(url.pathname)) {
      return new Response(
        Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0)),
        { status: 200, headers: { 'Content-Type': 'image/gif' } }
      );
    }
    
    return new Response(null, { status: 204 });
  }
}

/**
 * Cache First — serve from cache, fetch if miss.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreVary: true, ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}

/**
 * Stale While Revalidate — serve cache immediately, update in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  if (request.method !== 'GET') return fetch(request);
  const url = new URL(request.url);
  const isNextChunk = url.pathname.includes('/_next/static/') && url.pathname.endsWith('.js');
  const cached = await caches.match(request, { ignoreVary: true, ignoreSearch: true });
  
  const fetchPromise = fetch(request).then(response => {
    // v233: Only cache valid, non-redirected responses
    if (response && response.ok && !response.redirected) {
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => {
        cache.put(request, responseToCache).catch(() => {});
      });
    }

    // v302: Auto-recuperación de ChunkLoadError. 
    // Si un chunk falla (404 por nuevo build), limpiamos el caché de páginas y forzamos recarga.
    if (response && response.status === 404 && isNextChunk) {
      console.warn(`[SW] Chunk obsoleto detectado (404): ${url.pathname}. Limpiando caché y recargando...`);
      caches.keys().then(keys => {
        keys.forEach(k => {
          if (k.startsWith('aquatech-pages') || k.startsWith('aquatech-rsc')) {
            caches.delete(k);
          }
        });
      });
      return new Response(
        'window.location.reload(true);',
        { status: 200, headers: { 'Content-Type': 'application/javascript' } }
      );
    }

    return response;
  }).catch(() => null);

  // v339 FIX: StaleWhileRevalidate for JS chunks — when offline and chunk not cached,
  // return a noop instead of crashing the page with ChunkLoadError.
  if (cached) return cached;
  const networkResult = await fetchPromise;
  if (networkResult) return networkResult;
  // v339: Last resort — return empty JS. Prevents ChunkLoadError crash.
  // The component that called import() will fail gracefully with a module error
  // that React error boundaries can catch, instead of a fatal page crash.
  // NOTE: status 200 with empty body, NOT 204 — 204 disallows body and throws.
  if (isNextChunk) {
    return new Response('/* chunk unavailable offline */', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
  }
  return Response.error();
}

/**
 * Fetch with timeout to avoid hanging on slow networks.
 */
/**
 * Fetch with timeout using AbortController to actually terminate the request.
 */
async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // v352: Never spread a Request object — it corrupts the body (especially for large uploads).
    // Simply pass the signal as the init parameter.
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Check if a URL path points to a static asset.
 */
function isStaticAsset(pathname) {
  return /\.(?:js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif|mp4|webm)$/i.test(pathname);
}

/**
 * Helper to read shadow auth from IndexedDB inside
 * Service Worker v100-STABLE
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

  // v335: Call the REAL processOutboxSync (not a shadow/local no-op!)
  if (event.data && (event.data.type === 'TRIGGER_SYNC' || event.data.type === 'FORCE_SYNC_OUTBOX')) {
    const isForced = event.data.type === 'FORCE_SYNC_OUTBOX';
    const specificType = event.data.specificType || null;
    console.log(`[SW] postMessage sync triggered. Forced: ${isForced}, Type: ${specificType}`);
    // Call the GLOBAL processOutboxSync defined below, NOT a local shadow
    event.waitUntil(processOutboxSync(isForced, specificType));
  }

  // Warm-up pre-caching — caches responses INCLUDING redirects (except login)
  // v267: Supports replyPort (MessageChannel) so the client can await completion per-URL.
  if (event.data && event.data.type === 'PRECACHE_URLS') {
    const urls = event.data.urls || [];
    const replyPort = event.data.replyPort || null;
    const projectName = event.data.projectName || '';
    const options = event.data.options || {};
    
    // v291: Deduplicate URLs and update pending set
    const newUrls = urls.filter(u => !precacheQueueSet.has(u));
    newUrls.forEach(u => precacheQueueSet.add(u));
    
    // Safety: If the set is huge (> 500) and we just received a new batch, 
    // it might be a leak or stuck. Trim it.
    if (precacheQueueSet.size > 500 && urls.length > 0) {
      console.warn('[SW] Precache queue seems stuck. Resetting to current batch.');
      precacheQueueSet = new Set(urls);
    }

    // Notify clients immediately that work started
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'ASSETS_CACHED', count: precacheQueueSet.size }));
    });
    
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const existing = await cache.match(url);
            if (existing && existing.ok && !existing.redirected) {
               if (replyPort) replyPort.postMessage({ done: true, url, cached: true });
               precacheQueueSet.delete(url);
               continue;
            }

            if (url.startsWith('data:')) {
              if (replyPort) replyPort.postMessage({ done: true, url, skipped: true });
              precacheQueueSet.delete(url);
              continue;
            }

            const isRsc = url.includes('_rsc=') || options.headers?.['RSC'] === '1' || options.isRsc === true;
            const response = await fetchWithTimeout(new Request(url, { 
              credentials: 'same-origin',
              headers: { 
                'Cache-Control': 'no-cache', 
                'Accept': isRsc ? 'text/x-component, text/html, */*' : 'text/html',
                ...(isRsc ? { 'RSC': '1' } : {}),
                ...(options.headers || {})
              }
            }), 20000);

            if (response.ok) {
              const contentType = response.headers.get('Content-Type') || '';
              const isHTML = contentType.includes('text/html');
              const isRscResponse = contentType.includes('text/x-component') || isRsc;
              const finalUrl = response.url || '';
              const isLoginRedirect = finalUrl.includes('/login');
              
              // v359: Cache HTML in PAGES_CACHE and RSC in RSC_CACHE
              if (isRscResponse && !isLoginRedirect) {
                const rscCache = await caches.open(RSC_CACHE);
                // v359: Use the original URL without _rsc for the cache key to match the router's request
                const cacheUrl = new URL(url, self.location.origin);
                cacheUrl.searchParams.delete('_rsc');
                await rscCache.put(cacheUrl.toString(), response.clone());
                // Also cache with original URL just in case
                await rscCache.put(url, response.clone());
              }

              if (isHTML && !isLoginRedirect) {
                await cache.put(url, response.clone());
                const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
                await cache.put(alt, response.clone());
                
                // Asset extraction for HTML pages
                try {
                  const htmlText = await response.clone().text();
                  const assetRegex = /([\/a-zA-Z0-9._\-\[\]\(\)%@+~]+\.(js|css|woff2|png|jpg|webp))/g;
                  const assetMatches = Array.from(htmlText.matchAll(assetRegex))
                    .filter(m => m[1].includes('_next/static/') || m[1].includes('/fonts/'));
                  
                  const assetsCache = await caches.open(ASSETS_CACHE);
                  const isShell = url.includes('offline-shell');
                  const isAdminOrOp = url.includes('/admin/proyectos/') || url.includes('/admin/operador/proyecto/');
                  const maxAssets = isShell ? 999 : (isAdminOrOp ? 200 : 60); 
                  
                  let newAssets = 0;
                  let existingAssets = 0;
                  for (const match of assetMatches) {
                    if ((newAssets + existingAssets) >= maxAssets) break;
                    const assetPath = match[1];
                    const fullAssetUrl = assetPath.startsWith('http') 
                      ? assetPath 
                      : new URL(assetPath.startsWith('/') ? assetPath : '/' + assetPath, self.location.origin).href;
                    
                    const hasAsset = await assetsCache.match(fullAssetUrl);
                    if (!hasAsset) {
                      newAssets++;
                      if (isAdminOrOp) {
                        const projPrefix = projectName ? `[${projectName}] ` : '';
                        console.log(`[SW] ${projPrefix}Descargando Chunk (${newAssets}): ${assetPath.split('/').pop()}`);
                      }
                      let attempts = 0;
                      let success = false;
                      while (attempts < 2 && !success) {
                        attempts++;
                        try {
                          const r = await fetchWithTimeout(new Request(fullAssetUrl), 15000);
                          if (r.ok) {
                            await assetsCache.put(fullAssetUrl, r);
                            success = true;
                          }
                        } catch (e) {
                          if (attempts < 2) await new Promise(r => setTimeout(r, 500));
                        }
                      }
                    } else {
                      existingAssets++;
                    }
                  }
                  if (isShell || isAdminOrOp) {
                    const projPrefix = projectName ? `[${projectName}] ` : '';
                    console.log(`[SW ${VERSION}] ${projPrefix}Chunks listos (${url}): ${newAssets} nuevos, ${existingAssets} ya en caché.`);
                  }
                } catch (err) {
                  console.warn('[SW] Asset extraction failed for:', url);
                }
              }
            }
            
            precacheQueueSet.delete(url); // Finished one URL
            
            // v289: Broadcast count AFTER EVERY URL for constant UI heartbeat
            try {
              const allClients = await self.clients.matchAll();
              allClients.forEach(client => {
                client.postMessage({ type: 'ASSETS_CACHED', count: precacheQueueSet.size });
              });
            } catch (e) {}

            await new Promise(r => setTimeout(r, 100)); 
          } catch (e) {
            precacheQueueSet.delete(url); // Count even if failed
            // v315: Silence Warm-cache failed if offline
            if (self.navigator && self.navigator.onLine === false) {
               console.info(`[SW ${VERSION}] Warm-cache skipped (offline) for:`, url);
            } else {
               console.warn(`[SW ${VERSION}] Warm-cache failed for:`, url);
            }
            // v291: Notify error too so heartbeat continues
            self.clients.matchAll().then(clients => {
              clients.forEach(c => c.postMessage({ type: 'ASSETS_CACHED', count: precacheQueueSet.size }));
            });
          }
        }
        if (replyPort) replyPort.postMessage({ done: true, urls });
        
        trimCache(PAGES_CACHE, 400); 
      })
    );
  }

  if (event.data && event.data.type === 'GET_PRECACHE_STATUS') {
    // Siempre reportar el estado actual, incluso si es 0, para que la UI 
    // pueda actualizarse correctamente al recuperar el foco.
    event.source?.postMessage({ type: 'ASSETS_CACHED', count: precacheQueueSet.size });
  }

  // v333: PING/PONG — Permite al cliente verificar que el SW está vivo
  if (event.data && event.data.type === 'PING') {
    event.source?.postMessage({
      type: 'PONG',
      version: SW_VERSION,
      timestamp: Date.now(),
      isSyncing: isSyncingGlobal,
      pendingUrls: precacheQueueSet.size
    });
    // También loggear a IndexedDB que el robot respondió
    logSyncSW('info', `🏓 PONG — Robot vivo (${SW_VERSION})`, 'heartbeat').catch(() => {});
  }
});

// ─── BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  const syncTags = [
    'sync-outbox',
    'sync-MESSAGE',
    'sync-MEDIA_UPLOAD',
    'sync-IMAGE',
    'sync-VIDEO',
    'sync-AUDIO',
    'sync-GALLERY_UPLOAD',
    'sync-TASK',
    'sync-EXPENSE',
    'sync-DAY_START',
    'sync-DAY_END',
    'sync-PROJECT',
    'sync-mensaje',
    'sync-gasto',
    'sync-calendario',
    'sync-imagen',
    'sync-video'
  ];

  // v335: Anti-flood — solo procesar si no estamos ya en un ciclo
  // El SO dispara el sync event MUCHAS veces simultáneas (una por cada tag),
  // pero solo necesitamos UN procesamiento que revise TODA la cola.
  if (syncTags.includes(event.tag)) {
    if (isSyncingGlobal) {
      console.log(`[SW] Sync event ${event.tag} ignored — already processing.`);
      return;
    }
    console.log(`[SW] Background sync triggered by OS: ${event.tag}. Processing outbox...`);
    event.waitUntil(processOutboxSync(true));
  }
});

// ─── PERIODIC BACKGROUND SYNC (Android/Chrome 80+) ────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-outbox-periodic') {
    console.log('[SW] Periodic background sync triggered. Forcing upload check...');
    event.waitUntil(processOutboxSync(true));
  }
});


function openAquatechDB() {
  return new Promise((resolve, reject) => {
    // v322: Abrir la DB sin especificar versión para no chocar con la versión 150 de Dexie
    const request = indexedDB.open('AquatechOfflineDB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => {
      console.warn('[SW DB] Upgrade blocked. Please close other tabs.');
    };
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('syncLogs')) {
        db.createObjectStore('syncLogs', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * v319: Centralized logger for SW to IndexedDB
 */
async function logSyncSW(level, message, type = 'general', details = '') {
  try {
    const db = await openAquatechDB();
    const tx = db.transaction(['syncLogs'], 'readwrite');
    const store = tx.objectStore('syncLogs');
    store.add({
      timestamp: Date.now(),
      level,
      message,
      type,
      details: typeof details === 'string' ? details : JSON.stringify(details)
    });
    
    // Auto-trim logs (keep last 200)
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > 200) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) cursor.delete();
        };
      }
    };
  } catch (e) {
    console.error('[SW] Logging failed:', e);
  }
}


let isSyncingGlobal = false;
// v317: Phase 2 - Web Locks to prevent cross-tab duplication
async function processOutboxSync(isForced = false, specificType = null) {
  // v332: Removed navigator.locks that were causing permanent blocks
  if (isSyncingGlobal && !isForced) {
    console.log('[SW] Already syncing, skipping...');
    return;
  }

  isSyncingGlobal = true;
  await logSyncSW('info', `🚀 Robot ${SW_VERSION} iniciando ciclo de sync${isForced ? ' (FORZADO)' : ''}${specificType ? ' tipo: '+specificType : ''}`, 'system');
  console.log('[SW] Starting processOutboxSync...');
  try {
    await _internalProcessOutbox(isForced, specificType);
  } catch (e) {
    console.error('[SW] Sync failed:', e);
  } finally {
    isSyncingGlobal = false;
    console.log('[SW] Sync finished.');
    // v317: Ensure notification is closed even if _internalProcessOutbox hangs or crashes
    try {
      const notifs = await self.registration.getNotifications();
      notifs.forEach(n => {
        if (n.tag === 'sync-progress' || n.title?.includes('Sincronizando')) {
          n.close();
        }
      });
    } catch (e) {}
  }
}

async function _internalProcessOutbox(isForced = false, specificType = null) {
  let db;
  try {
    db = await openAquatechDB();
  } catch (err) {
    console.error('[SW] Failed to open IndexedDB for sync:', err);
    return;
  }

  return new Promise((resolve, reject) => {
    const abortController = new AbortController();
    const GLOBAL_SYNC_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutos máximo por ciclo completo
    const globalSyncTimer = setTimeout(async () => {
      try {
        const dbT = await openAquatechDB();
        const tx = dbT.transaction(['outbox'], 'readwrite');
        const store = tx.objectStore('outbox');
        const req = store.getAll();
        req.onsuccess = () => {
          for (const item of req.result) {
            if (item.status === 'syncing') store.put({ ...item, status: 'pending' });
          }
        };
      } catch(e) {}
    }, GLOBAL_SYNC_TIMEOUT_MS);


    // Evitar race condition: Si la app está abierta, GlobalSyncWorker se encargará
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // v272: Always process outbox items even if app is visible.
      // The previous "delegate to GlobalSyncWorker" logic caused a deadlock
      // because GlobalSyncWorker's syncOutbox was blocked by startBulkSync's syncLock.
      const isAppActive = windowClients.some(client => client.visibilityState === 'visible');
      if (isAppActive && !isForced) {
        console.log('[SW] App is visible but processing outbox anyway (v272 fix).');
      }

      // v272: Reset items stuck in 'syncing' for more than 2 minutes (sequential)
      await new Promise((resolveReset) => {
        try {
          const resetTx = db.transaction(['outbox'], 'readwrite');
          const resetStore = resetTx.objectStore('outbox');
          const resetGetAll = resetStore.getAll();
          resetGetAll.onsuccess = () => {
            const allItems = resetGetAll.result || [];
            const now = Date.now();
            let resetCount = 0;
            for (const item of allItems) {
              if (item.status === 'syncing') {
                const stuckTime = now - (item.lastAttemptAt || item.timestamp || 0);
                if (stuckTime > 30000) { // v324: 30 seconds — items marked syncing at cycle start need fast recovery
                  console.log(`[SW] Resetting stuck item ${item.id} (${item.type}) from 'syncing' to 'pending'`);
                  item.status = 'pending';
                  resetStore.put(item);
                  resetCount++;
                }
              }
            }
            if (resetCount > 0) console.log(`[SW] Reset ${resetCount} stuck items`);
          };
          resetTx.oncomplete = () => resolveReset();
          resetTx.onerror = () => resolveReset();
        } catch (e) {
          resolveReset();
        }
      });
      
      // v331: Fixed syntax error (failedContexts) that was killing the robot
      if (isForced) {
        console.log('[SW] Forced sync requested.');
      }

      const transaction = db.transaction(['outbox'], 'readwrite');
      const outboxStore = transaction.objectStore('outbox');
      const getAllRequest = outboxStore.getAll();

      getAllRequest.onsuccess = async () => {
        try {
          const allItems = getAllRequest.result || [];
          
          // v366: Strictly FIFO — get pending/failed items sorted by timestamp
          let toSync = allItems.filter(i => (i.status === 'pending' || i.status === 'failed'));
          toSync.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          // v366: NO MARCAR TODOS COMO SYNCING AL PRINCIPIO.
          // Esto causaba que si el SW moría a mitad de un upload grande, 
          // todos los mensajes de texto quedaran bloqueados en 'syncing' permanentemente.
          // Ahora marcamos uno a uno justo antes de procesar.

          await new Promise((resolveTx) => {
            transaction.oncomplete = () => resolveTx();
            transaction.onerror = () => resolveTx();
          });

    const pendingItems = toSync;

    if (allItems.length > 0) {
      await logSyncSW('info', `Robot ${SW_VERSION}: Encontrados ${allItems.length} ítems en cola.`, 'system');
    }
    await logSyncSW('info', `Iniciando ciclo de sincronización (Forced: ${isForced})`, 'system');
    
    if (pendingItems.length === 0) {
      isSyncingGlobal = false;
      await logSyncSW('info', 'Nada pendiente en la cola.', 'system');
      resolve();
      return;
    }

    console.log(`[SW] Claimed ${pendingItems.length} items for atomic sync (FIFO order)`);

    const now = Date.now();
    const failedContexts = new Set(); // v272: Track failed projects

    // v278: Sticky Sync - Show a subtle notification to prevent OS suspension
    if (pendingItems.length > 0 && !isForced) {
      try {
        // v325: Solo mostrar notificación si hay internet o es forzado, para evitar el titileo offline
        if (self.Notification && self.Notification.permission === 'granted' && (navigator.onLine || isForced)) {
          await self.registration.showNotification('Sincronizando Aquatech', {
            body: `Procesando ${pendingItems.length} cambios en segundo plano...`,
            icon: '/icon-192.png',
            tag: 'sync-progress',
            silent: true,
            // @ts-ignore
            priority: 'low'
          });
        }
      } catch (e) {}
    }

    // v339 FIX: When offline, storage config WILL fail. Don't penalize items for that.
    // Instead, abort the sync cycle early so items stay 'pending' for when we're back online.
    if (!navigator.onLine && !isForced) {
      console.log('[SW] Device is offline — aborting sync cycle (items preserved for online)');
      // Reset items from 'syncing' back to 'pending' so they're picked up when online
      await new Promise(r => {
        try {
          const resetTx = db.transaction(['outbox'], 'readwrite');
          const resetStore = resetTx.objectStore('outbox');
          const resetReq = resetStore.getAll();
          resetReq.onsuccess = () => {
            const items = resetReq.result || [];
            for (const it of items) {
              if (it.status === 'syncing') {
                it.status = 'pending';
                resetStore.put(it);
              }
            }
          };
          resetTx.oncomplete = r;
          resetTx.onerror = r;
        } catch(e) { r(); }
      });
      isSyncingGlobal = false;
      resolve();
      return;
    }

    // v278: Pre-fetch storage config once per cycle for better performance
    let storageConfig = null;
    let configFailedPermanently = false;
    try {
      // v318: Use explicit signal for config fetch
      const configResp = await fetchWithTimeout(new Request('/api/storage/config', { 
        credentials: 'same-origin',
        signal: abortController.signal 
      }), 10000);
      
      if (configResp.ok) {
        storageConfig = await configResp.json();
      } else if (configResp.status === 401 || configResp.status === 403) {
        console.warn('[SW] Auth error fetching config — aborting sync cycle');
        isSyncingGlobal = false;
        resolve();
        return;
      }
    } catch (e) {
      console.warn('[SW] Could not pre-fetch storage config (Network issue?)');
    }

    let processedCount = 0;
    const totalToSync = pendingItems.length;

    for (let item of toSync) {
      // v366: Re-fetch item to ensure it's still pending (avoid race with GlobalSyncWorker)
      const freshItem = await new Promise(r => {
        try {
          const tx = db.transaction(['outbox'], 'readonly');
          const req = tx.objectStore('outbox').get(item.id);
          req.onsuccess = () => r(req.result);
          req.onerror = () => r(null);
        } catch(e) { r(null); }
      });

      if (!freshItem || (freshItem.status !== 'pending' && freshItem.status !== 'failed')) {
        continue;
      }
      item = freshItem;

      // v366: Mark ONLY THIS item as syncing
      await new Promise(r => {
        try {
          const tx = db.transaction(['outbox'], 'readwrite');
          tx.objectStore('outbox').put({ ...item, status: 'syncing', lastAttemptAt: Date.now() });
          tx.oncomplete = r; tx.onerror = r;
        } catch(e) { r(); }
      });

      processedCount++;
      await logSyncSW('info', `Procesando item ${processedCount}/${totalToSync}: ${item.type}`, item.type, { itemId: item.id });

      // Actualizar notificación de progreso principal
      try {
        if (self.Notification && self.Notification.permission === 'granted' && (navigator.onLine || isForced)) {
          self.registration.showNotification(`Sincronizando (${SW_VERSION})`, {
            body: `Item ${processedCount} de ${totalToSync}: Procesando ${item.type}...`,
            icon: '/icon-192.png',
            tag: 'sync-progress',
            silent: true,
            priority: 'low'
          });
        }
      } catch (e) {}

      // v341: Store item size to decide throttling later
      let lastItemSize = 0;
      if (item.payload?.media?.fileData) lastItemSize = item.payload.media.fileData.byteLength || 0;
      else if (item.payload?.fileData) lastItemSize = item.payload.fileData.byteLength || 0;
      else if (item.payload?.files) lastItemSize = item.payload.files.reduce((acc, f) => acc + (f.fileData?.byteLength || 0), 0);

      // v317: Phase 4 - Strict retry limit for production stability
      if (item.attempts >= 5) {
        console.warn(`[SW] Item ${item.id} (${item.type}) permanently failed after 5 attempts.`);
        await logSyncSW('error', `☠ Item ${item.id} (${item.type}) eliminado tras 5 intentos fallidos`, item.type);
        await new Promise(r => {
          try {
            const tx = db.transaction(['outbox'], 'readwrite');
            tx.objectStore('outbox').delete(item.id);
            tx.oncomplete = r;
            tx.onerror = r;
          } catch(e) { r(); }
        });
        
        // Notificar a la UI
        self.clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({
            type: 'ITEM_DEAD',
            itemId: item.id,
            itemType: item.type,
            reason: 'max_attempts_reached'
          }));
        });
        continue;
      }

      // Backoff exponencial: esperar más tiempo entre intentos (Omitir si es forzado)
      if (item.attempts > 0 && !isForced) {
        const waitMs = Math.min(1000 * Math.pow(2, item.attempts), 300_000); // máx 5 min
        const timeSinceLastAttempt = now - (item.lastAttemptAt || 0);
        if (timeSinceLastAttempt < waitMs) {
          console.log(`[SW] Item ${item.id} en backoff (${Math.round((waitMs - timeSinceLastAttempt)/1000)}s restantes)`);
          // Reset status to pending so it can be picked up later
          await new Promise(r => {
            try {
              const tx = db.transaction(['outbox'], 'readwrite');
              tx.objectStore('outbox').put({ ...item, status: 'pending' });
              tx.oncomplete = r;
              tx.onerror = r;
            } catch(e) { r(); }
          });
          continue;
        }
      }

      // v324 FIX: failedContexts now ONLY blocks items whose parent PROJECT creation failed.
      // Messages, gallery, expenses etc. are standalone and must NOT be blocked by a failed project creation.
      // The ctx is only relevant for items that depend on a PROJECT existing on the server.
      const ctx = item.payload?.id; // Only PROJECT type sets payload.id as the local context key
      const isProjectDependent = item.type === 'PROJECT'; // Only block cascading failures for new PROJECT creation
      if (isProjectDependent && ctx && failedContexts.has(ctx)) {
        console.log(`[SW] Saltando item ${item.id} (${item.type}) porque el proyecto padre ${ctx} falló.`);
        await new Promise(r => {
          try {
            const tx = db.transaction(['outbox'], 'readwrite');
            tx.objectStore('outbox').put({ ...item, status: 'failed' });
            tx.oncomplete = r; tx.onerror = r;
          } catch(e) { r(); }
        });
        continue;
      }

      try {
      // v294: PROBLEMA 3 — Retry del storageConfig dentro del ciclo si el item tiene media
      const itemTieneMedia = (i) => {
        const p = i.payload || {};
        return i.type === 'MEDIA_UPLOAD' || 
               i.type === 'GALLERY_UPLOAD' || 
               i.type === 'EXPENSE' || 
               i.type === 'QUOTE' ||
               i.type === 'PROJECT' ||
               (i.type === 'MESSAGE' && (p.media || p.fileData)) ||
               (i.type === 'TASK' && (p.attachments?.length || p.attachmentLinks?.length || p.files?.length || p.previews?.length));
      };

      if (!storageConfig && itemTieneMedia(item)) {
        console.log(`[SW] Item ${item.id} requires media sync but config is missing. Retrying config fetch...`);
        let retryOk = false;
        try {
          const retry = await fetchWithTimeout(new Request('/api/storage/config', { credentials: 'same-origin' }), 8000);
          if (retry.ok) {
            storageConfig = await retry.json();
            retryOk = true;
          } else if (retry.status === 401 || retry.status === 403) {
            console.warn('[SW] Auth error during config retry — aborting sync');
            // Reset this item to pending and stop cycle
            await new Promise(r => {
               try {
                 const tx = db.transaction(['outbox'], 'readwrite');
                 tx.objectStore('outbox').put({ ...item, status: 'pending' });
                 tx.oncomplete = r; tx.onerror = r;
               } catch(e) { r(); }
            });
            isSyncingGlobal = false;
            resolve();
            return;
          }
        } catch(e) {
          console.warn('[SW] Emergency config retry failed (Offline?)');
        }
        
        if (!storageConfig) {
          // v339 FIX: Don't kill the item — reset to 'pending' and skip.
          console.warn(`[SW] Item ${item.id} skipped — storage config unavailable. Will retry on next cycle.`);
          await new Promise(r => {
            try {
              const tx = db.transaction(['outbox'], 'readwrite');
              tx.objectStore('outbox').put({ ...item, status: 'pending' });
              tx.oncomplete = r; tx.onerror = r;
            } catch(e) { r(); }
          });
          continue;
        }
      }

        // ... el resto del bucle ya procesará los items marcados como syncing

          let endpoint = '';
          let method = 'POST';
          
          if (item.type === 'QUOTE') endpoint = '/api/quotes';
          else if (item.type === 'TASK') {
            if (!item.payload.isNew && (item.payload.id || item.payload._id)) {
              endpoint = `/api/appointments/${item.payload.id || item.payload._id}`;
              method = 'PATCH';
            } else {
              endpoint = '/api/appointments';
              method = 'POST';
            }
          }
          else if (item.type === 'MATERIAL') endpoint = '/api/materials';
          else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD' || item.type === 'LOCATION') {
            endpoint = `/api/projects/${item.projectId}/messages`;
          } else if (item.type === 'GALLERY_UPLOAD') {
            endpoint = `/api/projects/${item.projectId}/gallery`;
          } else if (item.type === 'GALLERY_DELETE') {
            endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.galleryId}`;
            method = 'DELETE';
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
          } else if (item.type === 'TEAM_UPDATE') {
            endpoint = `/api/projects/${item.projectId}/team`;
            method = 'PUT';
          } else if (item.type === 'PROJECT') {
            endpoint = '/api/projects';
          }

          // --- NEW: UNIFIED MEDIA SYNC LOGIC FOR SERVICE WORKER ---
          const processMedia = async (item) => {
            const config = storageConfig;
            // v339: If config is unavailable, return payload unchanged.
            // Items with media are already skipped earlier in the loop when config is null.
            // Non-media items (text messages, etc.) don't need config.
            if (!config) return item.payload;
            
            // v316: Copia profunda del payload para trabajar
            let payload = JSON.parse(JSON.stringify(item.payload));
            let needsDbUpdate = false;

            // Función para actualizar el item en outbox si cambiamos algo (evita re-subidas)
            const persistProgress = async () => {
              try {
                const tx = db.transaction(['outbox'], 'readwrite');
                tx.objectStore('outbox').put({ ...item, payload, status: 'syncing', lastAttemptAt: Date.now() });
                await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
              } catch(e) {}
            };

            const uploadMediaSW = async (source, name, mimeType, subfolder = 'general') => {
              try {
                let blob;
                // v317: More robust Blob detection and fallback
                if (source instanceof Blob) {
                  blob = source;
                } else if (source instanceof ArrayBuffer || (source && source.buffer instanceof ArrayBuffer)) {
                  const data = source.buffer || source;
                  blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
                } else if (typeof source === 'string' && source.startsWith('data:')) {
                  const parts = source.split(';base64,');
                  if (parts.length < 2) throw new Error("Invalid base64 data");
                  const contentType = parts[0].split(':')[1];
                  const raw = atob(parts[1]);
                  const uInt8Array = new Uint8Array(raw.length);
                  for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
                  blob = new Blob([uInt8Array], { type: contentType });
                } else if (typeof source === 'string' && source.startsWith('blob:')) {
                  try {
                    const res = await fetchWithTimeout(new Request(source), 5000);
                    blob = await res.blob();
                  } catch(e) {
                    throw new Error(`Failed to fetch blob source: ${e.message}`);
                  }
                } else {
                  // If it's already a URL, return it
                  if (typeof source === 'string' && (source.startsWith('http') || source.includes('bunny'))) {
                    return source;
                  }
                  throw new Error(`Unsupported media source type: ${typeof source}`);
                }
                
                // v317: Verify storage space before upload
                if ('storage' in navigator && navigator.storage.estimate) {
                  const estimate = await navigator.storage.estimate();
                  const remaining = (estimate.quota || 0) - (estimate.usage || 0);
                  if (remaining < blob.size * 2) {
                    console.warn('[SW] LOW STORAGE: Storage pressure might cause sync failure.');
                  }
                }

                // v352fix: ALWAYS upload directly to Bunny CDN via PUT.
                // Chunked uploads (uploadInChunksSW) were causing truncated files
                // because the server-side assembly had race conditions and retry duplication bugs.
                // Bunny CDN supports files up to 5TB via PUT — no chunking needed.
                // Timeouts are generous: up to 20 min for files >200MB.
                const timestamp = Date.now();
                const safeName = (name || `file_${timestamp}`).replace(/[^a-zA-Z0-9.-]/g, '_');
                
                let folderPath = item.projectId ? `projects/${item.projectId}` : subfolder;
                if (subfolder === 'gallery' && item.projectId) {
                  folderPath = `projects/${item.projectId}/gallery`;
                }
                
                const path = `/${config.storageZone}/${folderPath}/${timestamp}-${safeName}`;
                const uploadUrl = `https://${config.storageHost}${path}`;
                
                const res = await fetchWithTimeout(new Request(uploadUrl, {
                  method: 'PUT',
                  headers: { 
                    'AccessKey': config.accessKey, 
                    'Content-Type': blob.type || 'application/octet-stream' 
                  },
                  body: blob,
                  signal: abortController.signal
                }), getUploadTimeout(blob.size));
                if (!res.ok) throw new Error(`Bunny upload failed status ${res.status}`);
                const finalUrl = `${config.pullZoneUrl}/${folderPath}/${timestamp}-${safeName}`;
                
                // v352fix: Verify the uploaded file size matches the original blob.
                // If sizes don't match, the upload was truncated — throw to trigger retry.
                try {
                  const headCheck = await fetchWithTimeout(new Request(finalUrl, { method: 'HEAD' }), 15000);
                  if (headCheck.ok) {
                    const contentLength = parseInt(headCheck.headers.get('Content-Length') || '0', 10);
                    if (contentLength > 0 && Math.abs(contentLength - blob.size) > 1024) {
                      console.error(`[SW] SIZE MISMATCH after upload! Expected ${blob.size}, got ${contentLength}. Retrying...`);
                      throw new Error(`Upload size mismatch: expected ${blob.size}, got ${contentLength}`);
                    }
                    console.log(`[SW] Verified upload: ${(contentLength/1024/1024).toFixed(1)}MB matches original`);
                  }
                } catch (checkErr) {
                  if (checkErr.message?.includes('size mismatch') || checkErr.message?.includes('SIZE MISMATCH')) throw checkErr;
                  console.warn('[SW] Could not verify upload size (non-fatal):', checkErr.message);
                }
                
                return finalUrl;
              } catch (e) {
                console.error('[SW] uploadMediaSW failed:', e.message);
                throw e;
              }
            };

const uploadInChunksSW = async (blob, filename, subfolder = 'uploads', mimeType = '') => {
              const CHUNK_SIZE = getChunkSize(blob.size);
              const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
              const uploadId = self.crypto.randomUUID();
              console.log(`[SW] Chunked upload: ${filename} | ${(blob.size/1024/1024).toFixed(2)}MB | ${totalChunks} chunks de ${(CHUNK_SIZE/1024/1024).toFixed(0)}MB`);

              for (let i = 0; i < totalChunks; i++) {
                const chunk = blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('uploadId', uploadId);
                formData.append('chunkIndex', i.toString());
                formData.append('totalChunks', totalChunks.toString());
                formData.append('filename', filename);
                formData.append('mimeType', mimeType || blob.type || 'application/octet-stream');
                
                // v316: Ensure we send the correct subfolder
                let finalSubfolder = subfolder;
                if (subfolder === 'gallery' && item.projectId) {
                  finalSubfolder = `projects/${item.projectId}/gallery`;
                }
                formData.append('subfolder', finalSubfolder);

                let chunkSuccess = false;
                let chunkAttempts = 0;

                while (!chunkSuccess && chunkAttempts < 4) {
                  chunkAttempts++;
                  try {
                    const chunkTimeout = getUploadTimeout(chunk.size) * chunkAttempts;
                    const res = await fetchWithTimeout(
                      new Request('/api/upload/chunk', { method: 'POST', body: formData }),
                      chunkTimeout
                    );
                    if (!res.ok) throw new Error(`Chunk ${i} HTTP ${res.status}`);
                    const data = await res.json();

                    // Notificar progreso real integrado en la notificación principal
                    try {
                      if (self.Notification && self.Notification.permission === 'granted') {
                        const percent = Math.round(((i + 1) / totalChunks) * 100);
                        await self.registration.showNotification('Sincronizando Aquatech', {
                          body: `Subiendo ${filename}: ${percent}% (${i + 1}/${totalChunks})`,
                          tag: 'sync-progress',
                          silent: true,
                        });
                      }
                    } catch(e) {}

                    // Notificar a la UI si está abierta
                    self.clients.matchAll().then(clients => {
                      clients.forEach(c => c.postMessage({
                        type: 'UPLOAD_PROGRESS',
                        filename,
                        chunk: i + 1,
                        totalChunks,
                        percent: Math.round(((i + 1) / totalChunks) * 100)
                      }));
                    });

                    // v317: Update lastAttemptAt so the watchdog knows we are alive
                    await persistProgress();

                    if (data.url) return data.url;
                    chunkSuccess = true;
                  } catch(e) {
                    console.warn(`[SW] Chunk ${i} intento ${chunkAttempts} falló:`, e.message);
                    if (chunkAttempts >= 4) throw new Error(`Chunk ${i} falló después de 4 intentos`);
                    await new Promise(r => setTimeout(r, 3000 * chunkAttempts)); // 3s, 6s, 9s
                  }
                }
              }
              return null;
            };

            // 1. Handle MESSAGE / MEDIA_UPLOAD
            if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') {
              if (payload.media) {
                const source = payload.media.fileData || payload.media.base64 || payload.media.url;
                if (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:')))) {
                  payload.media.url = await uploadMediaSW(source, payload.media.filename, payload.media.mimeType, 'messages');
                  delete payload.media.fileData;
                  delete payload.media.base64;
                  await persistProgress(); // v316: Persistir URL para no repetir upload si falla el API
                }
              }
            }

            // 2. Handle EXPENSE
            if (item.type === 'EXPENSE') {
              const source = payload.receiptFileData || payload.receiptPhoto;
              if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                payload.receiptPhoto = await uploadMediaSW(source, 'receipt.jpg', payload.receiptMimeType, 'expenses');
                delete payload.receiptFileData;
                await persistProgress();
              }
            }

            // 3. Handle GALLERY_UPLOAD
            if (item.type === 'GALLERY_UPLOAD') {
              const source = payload.fileData || payload.url;
              if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                // v316: Use 'gallery' subfolder to trigger specialized path logic
                payload.url = await uploadMediaSW(source, payload.filename || 'gallery_item.jpg', payload.mimeType, 'gallery');
                delete payload.fileData;
                await persistProgress();
              }
            }

            // v352: Process media for PROJECT creation — image + ALL attached files (videos, fotos, docs)
            // Cada archivo se sube individualmente a Bunny CDN para evitar payloads JSON enormes.
            // v352fix: Priorizar el File crudo (item.payload.files[i].file) sobre base64.
            // El File crudo sobrevive structured clone de IndexedDB y evita la decodificación
            // de base64 (atob + loop charCodeAt de millones de iteraciones que corrompe videos grandes).
            if (item.type === 'PROJECT') {
              // 1. Main project image
              if (payload.image || payload.fileData) {
                const source = payload.fileData || payload.image;
                if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                  payload.image = await uploadMediaSW(source, payload.filename || 'project_image.jpg', payload.mimeType, 'projects');
                  delete payload.fileData;
                  await persistProgress();
                }
              }
              // 2. All attached files (ProjectFile[]) — one by one to Bunny CDN
              if (payload.files && Array.isArray(payload.files)) {
                for (let fi = 0; fi < payload.files.length; fi++) {
                  const f = payload.files[fi];
                  // v352fix: Use raw File from original payload (survives IDB structured clone)
                  // instead of base64 → atob → Uint8Array → Blob (which is slow and can corrupt large files).
                  const originalFile = item.payload?.files?.[fi]?.file;
                  const isRawFile = originalFile instanceof File || originalFile instanceof Blob;
                  const source = isRawFile ? originalFile : (f.fileData || f.url);
                  if (source && (isRawFile || source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                    f.url = await uploadMediaSW(source, f.filename || f.name || 'project_file.jpg', f.mimeType, 'projects');
                    delete f.fileData;
                    // v352fix: Remove raw File from original payload to save IDB space
                    if (isRawFile && item.payload?.files?.[fi]) {
                      delete item.payload.files[fi].file;
                    }
                    await persistProgress();
                  }
                }
              }
            }

            // 4. Handle TASK (Attachments & Links)
            if (item.type === 'TASK') {
              const uploadedMap = {};
              // v358: Deduplicate allMedia by content/name to avoid double-uploading same file
              const uniqueMediaSources = [];
              const seenMedia = new Set();
              
              const rawMedia = [
                ...(payload.attachments || []),
                ...(payload.attachmentLinks || []),
                ...(payload.files || [])
              ];

              for (let m of rawMedia) {
                const src = m.fileData || m.base64 || m.data || m.url;
                const finger = `${m.name}_${typeof src === 'string' ? src.substring(0, 100) : 'binary'}`;
                if (!seenMedia.has(finger) && src) {
                  seenMedia.add(finger);
                  uniqueMediaSources.push(m);
                }
              }
              
              for (let media of uniqueMediaSources) {
                const source = media.fileData || media.base64 || media.data || media.url;
                if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                  const cacheKey = typeof source === 'string' ? (source.length > 100 ? source.substring(0, 100) : source) : source;
                  if (!uploadedMap[cacheKey]) {
                    // Avoid multiple uploads of the same binary data
                    uploadedMap[cacheKey] = await uploadMediaSW(source, media.name, media.mimeType, 'appointments');
                  }
                  
                  const finalUrl = uploadedMap[cacheKey];

                  // v358: Update ALL occurrences of this source in both arrays to the same final URL
                  const updateAll = (arr) => {
                    if (!arr) return;
                    for (let item of arr) {
                      const itemSrc = item.fileData || item.base64 || item.data || item.url;
                      if (itemSrc === source) {
                        item.url = finalUrl;
                        if (item.data !== undefined) item.data = finalUrl;
                        delete item.fileData;
                        delete item.base64;
                      }
                    }
                  };
                  
                  updateAll(payload.attachments);
                  updateAll(payload.attachmentLinks);
                  updateAll(payload.files);
                  await persistProgress();
                }
              }
            }

            return payload;
          };

          const finalPayload = await processMedia(item);

          // v340: SAFETY CHECK — Re-read item from DB to verify it still exists.
          // The page-side syncOutbox (GlobalSyncWorker.tsx) may have already processed
          // and deleted this item while we were uploading media. Without this check,
          // we'd send a DUPLICATE API request with a different syncId structure.
          try {
            const recheckTx = db.transaction(['outbox'], 'readonly');
            const recheckStore = recheckTx.objectStore('outbox');
            const recheckGet = recheckStore.get(item.id);
            const recheckItem = await new Promise(r => {
              recheckGet.onsuccess = () => r(recheckGet.result);
              recheckGet.onerror = () => r(null);
            });
            if (!recheckItem) {
              console.log(`[SW v340] Item ${item.id} (${item.type}) already deleted by page sync — skipping`);
              continue;
            }
          } catch(e) {
            console.warn('[SW v340] Re-check failed, continuing anyway:', e);
          }

          // v260: Clean client-only fields from TASK payloads before sending
          if (item.type === 'TASK') {
            delete finalPayload.isNew;
            delete finalPayload.mediaFiles;
            delete finalPayload.previews;
            if (Array.isArray(finalPayload.files)) {
              finalPayload.files = finalPayload.files.map(f => {
                const clean = { ...f };
                delete clean.isOffline;
                delete clean.isNew;
                return clean;
              });
            }
            // v370: Also clean attachmentLinks and attachments so WhatsApp message
            // doesn't get polluted with base64 or isOffline flags
            if (Array.isArray(finalPayload.attachmentLinks)) {
              finalPayload.attachmentLinks = finalPayload.attachmentLinks.map(a => {
                const clean = { ...a };
                delete clean.isOffline;
                delete clean.isNew;
                return clean;
              });
            }
            if (Array.isArray(finalPayload.attachments)) {
              finalPayload.attachments = finalPayload.attachments.map(a => {
                const clean = { ...a };
                delete clean.isOffline;
                delete clean.isNew;
                return clean;
              });
            }
          }

          if (endpoint) {
            // v286: Use fetchWithTimeout for main sync request
            const res = await fetchWithTimeout(new Request(endpoint, {
              method,
              headers: { 
                'Content-Type': 'application/json',
                'x-sync-id': item.syncId || `sync-${item.id}-${item.timestamp}` // v301: Prioritize explicit syncId
              },
              credentials: 'same-origin',
              signal: abortController.signal,
                body: JSON.stringify({ 
                ...finalPayload, 
                // v366: Secure lat/lng preservation
                lat: (item.lat !== undefined && item.lat !== null) ? item.lat : (finalPayload.lat || null), 
                lng: (item.lng !== undefined && item.lng !== null) ? item.lng : (finalPayload.lng || null), 
                createdAt: new Date(item.timestamp).toISOString(),
                isOfflineSync: true
              })
            }), 30000); // 30s timeout for API

            if (res.ok) {
                const resData = await res.clone().json().catch(() => ({}));
                // v366: CRITICAL IDEMPOTENCY FIX
                // If the server returns id: 0, it means the syncId is claimed but the result is still pending.
                // We must NOT delete the item from the outbox yet.
                if (resData.isDuplicate && resData.id === 0) {
                  console.log(`[SW] Item ${item.id} is still pending on server (id: 0). Skipping delete to allow retry.`);
                  await new Promise(r => {
                    try {
                      const tx = db.transaction(['outbox'], 'readwrite');
                      tx.objectStore('outbox').put({ ...item, status: 'pending', lastAttemptAt: Date.now() });
                      tx.oncomplete = r; tx.onerror = r;
                    } catch(e) { r(); }
                  });
                  continue;
                }

                // v352: For PROJECT sync, save the newly created project into projectsCache
                if (item.type === 'PROJECT') {
                  try {
                    const serverProject = resData; // Use the parsed data
                    if (serverProject && serverProject.id) {
                      const cacheEntry = {
                        ...finalPayload,
                        id: serverProject.id,
                        team: finalPayload.team ? finalPayload.team.map((uid) => ({ userId: Number(uid) })) : [],
                        client: finalPayload.client || null,
                        phases: finalPayload.phases || [],
                        lastAccessedAt: Date.now(),
                        createdAt: serverProject.createdAt || new Date(item.timestamp).toISOString(),
                        updatedAt: serverProject.updatedAt || new Date().toISOString(),
                        status: serverProject.status || finalPayload.status || 'LEAD',
                        isSkeleton: false
                      };
                      const putTx = db.transaction(['projectsCache'], 'readwrite');
                      const putStore = putTx.objectStore('projectsCache');
                      putStore.put(cacheEntry);
                      await new Promise(r => { putTx.oncomplete = r; putTx.onerror = r; });
                      console.log(`[SW v352] Saved synced project #${serverProject.id} to projectsCache for instant UI update`);
                      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                        clients.forEach(c => c.postMessage({
                          type: 'PROJECT_SYNCED',
                          projectId: serverProject.id,
                          projectTitle: finalPayload.title || ''
                        }));
                      });
                    }
                  } catch (parseErr) {
                    console.warn('[SW v352] Could not save project to cache after sync:', parseErr);
                  }
                }

                await new Promise((deleteRes) => {
                  const txd = db.transaction(['outbox'], 'readwrite');
                  const stored = txd.objectStore('outbox');
                  const req = stored.delete(item.id);
                  req.onsuccess = deleteRes;
                  req.onerror = deleteRes;
                });
                console.log(`[SW] Successfully synced ${item.type} (ID: ${item.id})`);
                await logSyncSW('success', `Item completado exitosamente: ${item.type}`, item.type, { itemId: item.id });
            } else {
               throw new Error('Server returned ' + res.status);
            }
          }
        } catch (e) {
          console.error(`[SW] Failed to sync item ${item.id}:`, e);
          logSyncSW('error', `Error procesando item: ${item.id} (${item.type})`, item.type, { error: e.message });
          
          // v368: INTELLIGENT ERROR HANDLING
          // We must NOT increment attempts for network errors or auth issues.
          const isNetworkError = e.message?.includes('Failed to fetch') || 
                                 e.message?.includes('network error') || 
                                 e.message?.includes('timeout') ||
                                 e.message?.includes('disconnected');
          
          const isAuthError = e.message?.includes('401') || e.message?.includes('403');

          if (isAuthError) {
            console.warn('[SW] Authentication error — stopping sync to preserve items');
            await new Promise(r => {
              try {
                const tx = db.transaction(['outbox'], 'readwrite');
                tx.objectStore('outbox').put({ ...item, status: 'pending' }); // Reset to pending
                tx.oncomplete = r; tx.onerror = r;
              } catch(err) { r(); }
            });
            isSyncingGlobal = false;
            resolve();
            return;
          }

          if (isNetworkError) {
            console.log(`[SW] Item ${item.id} failed due to network. Retrying as 'pending' without penalty.`);
            await new Promise(r => {
              try {
                const tx = db.transaction(['outbox'], 'readwrite');
                tx.objectStore('outbox').put({ ...item, status: 'pending' });
                tx.oncomplete = r; tx.onerror = r;
              } catch(err) { r(); }
            });
            continue;
          }

          // If it's a real server error (500, etc), then increment attempts
          if (ctx && item.type === 'PROJECT') failedContexts.add(ctx);
          await new Promise((res) => {
            try {
              const txError = db.transaction(['outbox'], 'readwrite');
              const storeError = txError.objectStore('outbox');
              item.status = 'failed';
              item.attempts = (item.attempts || 0) + 1;
              item.lastAttemptAt = Date.now();
              const req = storeError.put(item);
              req.onsuccess = res;
              req.onerror = res;
            } catch (err) {
              res();
            }
          });
        }
        // v341: Dynamic Pacing Delay — Give more time to the UI after large uploads
        // This is crucial to prevent "Network Error" crashes on mobile when navigating during sync.
        const throttleTime = lastItemSize > 2 * 1024 * 1024 ? 1500 : 500;
        await new Promise(r => setTimeout(r, throttleTime));
      }

        // v316: Enviar señal de fin de ciclo para que la UI se actualice (indicador verde)
        try {
          const syncChannel = new BroadcastChannel('aquatech-sync');
          syncChannel.postMessage({ type: 'OUTBOX_SYNC_FINISHED' });
        } catch(e) {}

      } catch (fatal) {
        console.error('[SW] Fatal error in outbox sync loop:', fatal);
      } finally {
        clearTimeout(globalSyncTimer);
        
        // v279: Cleanup definitively
        try {
          const allNotifications = await self.registration.getNotifications();
          allNotifications.forEach(n => {
            if (n.tag === 'sync-progress' || n.title?.includes('Sincronizando')) {
              n.close();
            }
          });
        } catch (e) {}

        // v286: Improved retry check - check if there are still items to sync
        try {
          const dbRetry = await openAquatechDB();
          const count = await new Promise(r => {
            try {
              const tx = dbRetry.transaction(['outbox'], 'readonly');
              const req = tx.objectStore('outbox').count();
              req.onsuccess = () => r(req.result);
              req.onerror = () => r(0);
            } catch(e) { r(0); }
          });
          if (count > 0) {
            console.log(`[SW] ${count} items still pending. Starting retry chain...`);
            // v333: Cadena de reintentos agresivos — 15s, 30s, 60s, 120s, 300s
            // Esto mantiene al SW vivo incluso sin Chrome abierto
            const retryDelays = [15000, 30000, 60000, 120000, 300000];
            let retryIndex = 0;
            const scheduleRetry = () => {
              if (retryIndex >= retryDelays.length) {
                console.log('[SW] Retry chain exhausted. Registering sync tag for OS wake-up.');
                // Darle al navegador la pista de que hay trabajo pendiente
                if (self.registration && 'sync' in self.registration) {
                  (self.registration.sync).register('sync-outbox').catch(() => {});
                }
                return;
              }
              const delay = retryDelays[retryIndex];
              console.log(`[SW] Scheduling retry ${retryIndex + 1}/${retryDelays.length} in ${delay/1000}s`);
              setTimeout(() => {
                retryIndex++;
                processOutboxSync(false).finally(() => {
                  // Después de cada intento, verificar si quedan items
                  openAquatechDB().then(dbCheck => {
                    const txCheck = dbCheck.transaction(['outbox'], 'readonly');
                    const reqCheck = txCheck.objectStore('outbox').count();
                    reqCheck.onsuccess = () => {
                      if (reqCheck.result > 0) scheduleRetry();
                      else console.log('[SW] All items cleared during retry chain.');
                    };
                  }).catch(() => scheduleRetry());
                });
              }, delay);
            };
            scheduleRetry();
          }
        } catch (e) {
          console.warn('[SW] Retry check failed:', e);
        }
        
        resolve();
      }
    };

    getAllRequest.onerror = () => {
      console.error('[SW] Failed to read outbox for sync');
      reject(getAllRequest.error);
    };
    }); // Close the then block for clients.matchAll
  });
}

// ─── BACKGROUND FETCH (Phase 1: Robust Sync) ──────────────
// v317: System-managed sync for large uploads (survives tab closure)
self.addEventListener('backgroundfetchsuccess', (event) => {
  console.log('[SW] Background Fetch Success:', event.registration.id);
  
  event.waitUntil(async function() {
    try {
      const records = await event.registration.matchAll();
      const results = await Promise.all(records.map(async (record) => {
        const response = await record.responseReady;
        return response && response.ok;
      }));
      
      const allOk = results.every(ok => ok);
      
      if (allOk) {
        // Notify client and cleanup outbox if needed
        const channel = new BroadcastChannel('aquatech-sync');
        channel.postMessage({ 
          type: 'SYNC_FINISHED', 
          success: true, 
          source: 'background-fetch',
          id: event.registration.id 
        });
        
        // Trigger a normal sync to clean up the outbox (the SW will see items are now on server)
        await processOutboxSync(true);
      }
      
      await event.updateUI({ title: '✅ Sincronización Completada' });
    } catch (err) {
      console.error('[SW] Background Fetch success handling failed:', err);
    }
  }());
});

self.addEventListener('backgroundfetchfail', (event) => {
  console.error('[SW] Background Fetch Failed:', event.registration.id);
  event.waitUntil(async function() {
    await event.updateUI({ title: '❌ Sincronización Fallida' });
    const channel = new BroadcastChannel('aquatech-sync');
    channel.postMessage({ 
      type: 'SYNC_FINISHED', 
      success: false, 
      source: 'background-fetch',
      id: event.registration.id 
    });
  }());
});

self.addEventListener('backgroundfetchabort', (event) => {
  console.warn('[SW] Background Fetch Aborted:', event.registration.id);
});

self.addEventListener('backgroundfetchclick', (event) => {
  event.waitUntil(async function() {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windowClients.length > 0) {
      await windowClients[0].focus();
    } else {
      await clients.openWindow('/admin/operador');
    }
  }());
});

// ─── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', (event) => {
  // v334: Always wake up the robot when a push arrives.
  // Silent pushes (no title) only sync without notification.
  // This is the MOST RELIABLE way to ensure background sync.
  event.waitUntil(processOutboxSync(true).catch(() => {}));

  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'Aquatech CRM', body: event.data?.text() || 'Nueva notificación' };
  }

  // v334: Silent push — wake up SW only, no visible notification
  if (data.silent || data.action === 'wake-up-sync') {
    console.log('[SW] Silent push received — processing outbox only, no notification.');
    logSyncSW('info', '🔕 Push silencioso: despertando robot para sync', 'push').catch(() => {});
    return; // No mostrar notificación
  }

  const options = {
    body: data.body || 'Nueva actualización en tu proyecto',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 400],
    tag: data.tag || 'aquatech-update',
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    data: {
      url: data.url || '/admin/operador',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '📂 Ver Detalles' },
      { action: 'close', title: '✕ Ignorar' }
    ]
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Aquatech CRM', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const rawUrl = event.notification.data?.url || '/admin/operador';

  event.waitUntil((async function() {
    let targetUrl = rawUrl;
    
    try {
      const auth = await getAuthFromIndexedDB();
      const role = auth?.role?.toUpperCase() || '';
      const isAdmin = role === 'ADMIN' || role === 'ADMINISTRADORA' || role === 'SUPERADMIN';

      if (rawUrl.startsWith('URL_PROJECT_CHAT:')) {
         const projectId = rawUrl.split(':')[1];
         if (isAdmin) {
           targetUrl = `/admin/proyectos/${projectId}?view=chat`;
         } else {
           targetUrl = `/admin/operador/proyecto/${projectId}?view=chat`;
         }
      } else if (rawUrl.startsWith('URL_TASK:')) {
         const parts = rawUrl.split(':');
         const projectId = parts[1];
         const taskId = parts[2];
         if (isAdmin) {
           targetUrl = `/admin/calendario?taskId=${taskId}`;
         } else {
           targetUrl = `/admin/operador/proyecto/${projectId}?view=records&taskId=${taskId}`;
         }
      } else if (rawUrl === 'URL_CALENDAR') {
         if (isAdmin) {
           targetUrl = `/admin/calendario`;
         } else {
           targetUrl = `/admin/operador`;
         }
      }
    } catch (e) {
      console.warn('[SW] Error resolving dynamic url', e);
    }

    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if (client.url.includes('/admin/') && 'focus' in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
