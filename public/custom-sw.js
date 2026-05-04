const VERSION = 'v315'; // v315: Silence Warm-cache failed if offline, prevent banner from reverting from green
const STATIC_CACHE = `aquatech-static-${VERSION}`;
const PAGES_CACHE  = `aquatech-pages-${VERSION}`;
const ASSETS_CACHE = `aquatech-assets-${VERSION}`;
const FONTS_CACHE  = `aquatech-fonts-${VERSION}`;
const RSC_CACHE    = `aquatech-rsc-${VERSION}`;

function getUploadTimeout(sizeInBytes) {
  if (sizeInBytes < 1 * 1024 * 1024)    return 120_000;   // <1MB    → 2 min
  if (sizeInBytes < 10 * 1024 * 1024)   return 300_000;   // <10MB   → 5 min
  if (sizeInBytes < 50 * 1024 * 1024)   return 600_000;   // <50MB   → 10 min
  if (sizeInBytes < 100 * 1024 * 1024)  return 1_200_000; // <100MB  → 20 min
  return 1_800_000;                                        // 200MB+  → 30 min
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
  '/admin/login',
  '/admin/proyectos',
  '/admin/calendario',
  '/admin/cotizaciones',
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


// ─── INSTALL ────────────────────────────────────────────────


self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);
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
      .then(() => self.skipWaiting())
  );
});

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
      // v268: Reduced RSC timeout to 8s for snappier mobile feel
      const response = await fetchWithTimeout(request.clone(), 8000);
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
    
    const fetchPromise = fetchWithTimeout(request.clone(), 8000).then(async (response) => {
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

    const isProjectDetail = url.pathname.match(/\/(proyecto|proyectos)\/\d+/);
    const isDashboard = url.pathname === '/admin/proyectos' || url.pathname === '/admin/proyectos/' ||
                        url.pathname === '/admin/operador' || url.pathname === '/admin/operador/';
    const isCalendar = url.pathname === '/admin/calendario' || url.pathname === '/admin/calendario/';
                        
    let cached = null;
    
    // v311 FIX: For specific project routes (e.g. /admin/proyectos/1094):
    // ↳ If ONLINE → skip shell and go straight to network (no broken flash)
    // ↳ If OFFLINE → serve shell immediately (fast offline experience)
    // Dashboards and calendar still use cache-first (less data-intensive)
    const isSpecificProjectRoute = isProjectDetail && 
      url.pathname.match(/\/admin\/(proyectos|operador\/proyecto)\/\d+/);
    
    if (isSpecificProjectRoute && navigator.onLine) {
      // ONLINE + Project route: Skip shell, go straight to network
      // The cache update will happen below after network succeeds
    } else if (isProjectDetail || isDashboard || isCalendar) {
      // Direct shell search for projects (Fast path - used OFFLINE or for dashboards)
      if (isProjectDetail) {
        const shellUrl = url.pathname.includes('/operador/') 
          ? '/admin/operador/proyecto/offline-shell' 
          : '/admin/proyectos/offline-shell';
        cached = await caches.match(shellUrl, { ignoreVary: true, ignoreSearch: true });
        if (cached && isValidHTMLResponse(cached)) {
          // console.log(`[SW v311] Offline shell: Serving project shell for ${url.pathname}`);
          updatePageInBackground(request.clone(), url.pathname);
          return cleanResponse(cached);
        }
      }

      // Generic cache search (Dashboards, Calendar, or Project Fallback)
      cached = await findCachedPage(request.url, url.pathname, false);
      if (cached && isValidHTMLResponse(cached)) {
        // console.log(`[SW v311] Cached page: Serving for ${url.pathname}`);
        updatePageInBackground(request.clone(), url.pathname);
        return cleanResponse(cached);
      }
    }

    // ── STEP 2: Network first with timeout (v311: 8s)

    try {
      const response = await fetchWithTimeout(request.clone(), 8000);
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
          if (response.redirected && finalUrl) {
            cache.put(finalUrl, response.clone());
          }
          // console.log('[SW] Cached page:', url.pathname);
          // v222: Increased limit to preserve project shells (300 projects + margin)
          trimCache(PAGES_CACHE, 400);
        }
      }
      return response;
    } catch (e) {
    }

    // ── STEP 2.5: v289 — Project URL offline? Serve the correct shell immediately.
    // This is faster than findCachedPage() because it goes direct, no scanning.
    const isAdminProjectNav = url.pathname.match(/\/admin\/proyectos\/\d+/);
    const isOperatorProjectNav = url.pathname.match(/\/admin\/operador\/proyecto\/\d+/) || 
                                url.pathname.match(/\/operador\/proyecto\/\d+/);
    
    if (isAdminProjectNav || isOperatorProjectNav) {
      const shellUrl = (isOperatorProjectNav || url.pathname.includes('/operador/'))
        ? '/admin/operador/proyecto/offline-shell'
        : '/admin/proyectos/offline-shell';
        
      const directShell = await caches.match(shellUrl, { ignoreVary: true, ignoreSearch: true });
      if (isValidHTMLResponse(directShell)) {
        console.log(`[SW ${VERSION}] Emergency shell recovery for: ${url.pathname}`);
        return cleanResponse(directShell);
      }
      
      // Secondary fallback — search broadly in all caches for ANY project shell
      const allCaches = await caches.keys();
      for (const cName of allCaches) {
        const c = await caches.open(cName);
        const match = await c.match(shellUrl, { ignoreVary: true, ignoreSearch: true });
        if (isValidHTMLResponse(match)) return cleanResponse(match);
      }
    }


    // ── STEP 3: Last chance — Try shells if network failed or we are offline
    const shell = await findCachedPage(request.url, url.pathname, true); // true = force serve
    if (shell) {
      // v243: If we found a shell and it's NOT the absolute fallback, serve it.
      // If it IS the absolute fallback (contains "Sin Conexión"), we only serve it if offline.
      const isAbsoluteFallback = shell.headers.get('X-SW-Fallback') === 'absolute';
      if (!isAbsoluteFallback || !navigator.onLine) {
        // console.log('[SW] Serving shell or offline fallback');
        return cleanResponse(shell);
      }
    }

    // v243: If we are online but everything failed, throw to catch and retry or show real error
    if (navigator.onLine) {
      console.warn('[SW] Online but navigation failed, letting browser handle error');
      throw new Error('Network failed but online');
    }

    // ── STEP 4: Try offline.html
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    // ── STEP 5: Inline fallback (absolute last resort)
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
    // Absolute fallback in case something throws unhandled error
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

  // v282: CRITICAL FIX — Instead of dead-end "Sin Conexión" page, auto-redirect
  // to the offline-shell which contains the real app UI with Dexie data.
  // The old fallback caused the "click does nothing" because the browser received
  // a non-interactive HTML page with no Next.js router.
  const isOpProject = pathname.match(/\/admin\/operador\/proyecto\//);
  const isAdmProject = pathname.match(/\/admin\/proyectos\//);
  const shellRedirect = isOpProject 
    ? '/admin/operador/proyecto/offline-shell'
    : isAdmProject 
      ? '/admin/proyectos/offline-shell'
      : null;
      
  if (shellRedirect) {
    // v288: CRITICAL — STOP PHYSICAL REDIRECTS. Serve the shell content directly
    // while keeping the original project URL. This allows the client-side recovery
    // logic to work without losing the project ID in the URL.
    const shellMatch = await caches.match(shellRedirect, { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(shellMatch)) {
      // console.log(`[SW v288] Serving shell directly for: ${pathname}`);
      return shellMatch;
    }
    // console.warn(`[SW v288] Shell ${shellRedirect} not in cache, fallback to absolute.`);
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

  // v273: Support specific sync types via postMessage
  if (event.data && (event.data.type === 'TRIGGER_SYNC' || event.data.type === 'FORCE_SYNC_OUTBOX')) {
    const isForced = event.data.type === 'FORCE_SYNC_OUTBOX';
    const specificType = event.data.specificType || null;
    console.log(`[SW] Sync triggered via postMessage (Forced: ${isForced}, Type: ${specificType})`);
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

            const isRsc = url.includes('_rsc=');
            const response = await fetchWithTimeout(new Request(url, { 
              credentials: 'same-origin',
              headers: { 
                'Cache-Control': 'no-cache', 
                'Accept': isRsc ? 'text/x-component, text/html' : 'text/html',
                ...(isRsc ? { 'RSC': '1' } : {}),
                ...(options.headers || {})
              }
            }), 20000);

            if (response.ok) {
              const contentType = response.headers.get('Content-Type') || '';
              const isHTML = contentType.includes('text/html');
              const finalUrl = response.url || '';
              const isLoginRedirect = finalUrl.includes('/login');
              
              // v305: Strict validation. Pages MUST be HTML. RSC payloads go to RSC_CACHE if needed.
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

  if (syncTags.includes(event.tag)) {
    console.log(`[SW] Background sync triggered by OS: ${event.tag}. Forcing immediate upload...`);
    // v268: Force sync when triggered by the OS to bypass any "active tab" checks
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
    const request = indexedDB.open('AquatechOfflineDB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {};
  });
}

let isSyncingGlobal = false;

async function processOutboxSync(isForced = false, specificType = null) {
  if (isSyncingGlobal && !isForced) {
    console.log('[SW] Sync already in progress, skipping concurrent execution.');
    return;
  }
  isSyncingGlobal = true;
  try {
    await _internalProcessOutbox(isForced, specificType);
  } finally {
    isSyncingGlobal = false;
    console.log('[SW] Global sync lock released.');
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
    const GLOBAL_SYNC_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutos máximo por ciclo completo
    const globalSyncTimer = setTimeout(async () => {
      console.warn('[SW] Timeout global de sync alcanzado. Liberando lock...');
      isSyncingGlobal = false;
      try {
        const notifs = await self.registration.getNotifications();
        notifs.forEach(n => { if (n.tag === 'sync-progress') n.close(); });
      } catch(e) {}
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
                if (stuckTime > 300000) { // 5 minutes (v317: allow for large file uploads)
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

      const transaction = db.transaction(['outbox'], 'readwrite');
      const outboxStore = transaction.objectStore('outbox');
      const getAllRequest = outboxStore.getAll();

    getAllRequest.onsuccess = async () => {
      try {
        const allItems = getAllRequest.result || [];
        
        // Filtrar por tipo si se especificó una etiqueta de sync
        let toSync = allItems.filter(i => (i.status === 'pending' || i.status === 'failed'));
        if (specificType) {
          toSync = toSync.filter(i => i.type === specificType);
        }
        
        // v272: Sort chronologically (FIFO) for dependency order
        toSync.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // Marcamos todos como 'syncing' en la misma transacción original
        for (const item of toSync) {
          const lockedItem = { ...item, status: 'syncing' };
          outboxStore.put(lockedItem);
        }

        const pendingItems = toSync;

    if (pendingItems.length === 0) {
      resolve();
      return;
    }

    console.log(`[SW] Claimed ${pendingItems.length} items for atomic sync (FIFO order)`);

    const now = Date.now();
    const failedContexts = new Set(); // v272: Track failed projects

    // v278: Sticky Sync - Show a subtle notification to prevent OS suspension
    if (pendingItems.length > 0 && !isForced) {
      try {
        self.registration.showNotification('Sincronizando Aquatech', {
          body: `Procesando ${pendingItems.length} cambios en segundo plano...`,
          icon: '/icon-192.png',
          tag: 'sync-progress',
          silent: true,
          // @ts-ignore
          priority: 'low'
        });
      } catch (e) {}
    }

    // v278: Pre-fetch storage config once per cycle for better performance
    let storageConfig = null;
    try {
      // v286: Use fetchWithTimeout for config retrieval
      const configResp = await fetchWithTimeout(new Request('/api/storage/config'), 10000);
      if (configResp.ok) storageConfig = await configResp.json();
    } catch (e) {
      console.warn('[SW] Could not pre-fetch storage config');
    }

    for (const item of pendingItems) {
      // v301: PROBLEMA 4 — Items zombie y Backoff exponencial
      if (item.attempts >= 10) {
        console.warn(`[SW] Item ${item.id} (${item.type}) eliminado tras 10 intentos fallidos (zombie)`);
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

      // Backoff exponencial: esperar más tiempo entre intentos
      if (item.attempts > 0) {
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

      // v316: Contexto para evitar enviar dependientes si falla el padre (ej: mensaje si falló proyecto)
      const ctx = item.projectId || item.payload?.projectId || item.payload?.id;
      if (ctx && failedContexts.has(ctx)) {
        console.log(`[SW] Saltando item ${item.id} porque el contexto ${ctx} falló anteriormente`);
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
        try {
          const retry = await fetchWithTimeout(new Request('/api/storage/config'), 8000);
          if (retry.ok) storageConfig = await retry.json();
        } catch(e) {
          console.warn('[SW] Emergency config retry failed');
        }
        if (!storageConfig) {
          throw new Error('No storage config available after retry — aborting media sync for this item');
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
          else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') {
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
            if (!config) throw new Error('storageConfig not available — aborting media sync');
            
            // v316: Copia profunda del payload para trabajar
            let payload = JSON.parse(JSON.stringify(item.payload));
            let needsDbUpdate = false;

            // Función para actualizar el item en outbox si cambiamos algo (evita re-subidas)
            const persistProgress = async () => {
              try {
                const tx = db.transaction(['outbox'], 'readwrite');
                tx.objectStore('outbox').put({ ...item, payload, status: 'syncing' });
                await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
              } catch(e) {}
            };

            const uploadMediaSW = async (source, name, mimeType, subfolder = 'general') => {
              try {
                let blob;
                if (source instanceof Blob) {
                  blob = source;
                } else if (source instanceof ArrayBuffer) {
                  blob = new Blob([source], { type: mimeType || 'application/octet-stream' });
                } else if (typeof source === 'string' && source.startsWith('data:')) {
                  const parts = source.split(';base64,');
                  const contentType = parts[0].split(':')[1];
                  const raw = atob(parts[1]);
                  const uInt8Array = new Uint8Array(raw.length);
                  for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
                  blob = new Blob([uInt8Array], { type: contentType });
                } else if (typeof source === 'string' && source.startsWith('blob:')) {
                  const res = await fetchWithTimeout(new Request(source), 5000);
                  blob = await res.blob();
                } else {
                  return source; // Already a URL or unknown
                }
                
                // v273: Use chunked upload for anything > 1MB
                if (blob.size > 1024 * 1024) {
                   const url = await uploadInChunksSW(blob, name, subfolder);
                   if (!url) throw new Error('Chunked upload returned no URL');
                   return url;
                }

                const timestamp = Date.now();
                const safeName = (name || `file_${timestamp}`).replace(/[^a-zA-Z0-9.-]/g, '_');
                
                // v316: Improved folder organization for Gallery
                let folderPath = item.projectId ? `projects/${item.projectId}` : subfolder;
                if (subfolder === 'gallery' && item.projectId) {
                  folderPath = `projects/${item.projectId}/gallery`;
                }
                
                const path = `/${config.storageZone}/${folderPath}/${timestamp}-${safeName}`;
                const uploadUrl = `https://${config.storageHost}${path}`;
                
                // v286: Use fetchWithTimeout for Bunny storage upload
                const res = await fetchWithTimeout(new Request(uploadUrl, {
                  method: 'PUT',
                  headers: { 
                    'AccessKey': config.accessKey, 
                    'Content-Type': blob.type || 'application/octet-stream' 
                  },
                  body: blob
                }), getUploadTimeout(blob.size)); // ← dinámico según tamaño
                if (!res.ok) throw new Error(`Bunny upload failed with status ${res.status}`);
                const finalUrl = `${config.pullZoneUrl}/${folderPath}/${timestamp}-${safeName}`;
                console.log('[SW] Upload success:', finalUrl);
                return finalUrl;
              } catch (e) {
                console.error('[SW] Upload failed:', e);
                throw e; // v275: Throw so the caller knows sync failed
              }
            };

            const uploadInChunksSW = async (blob, filename, subfolder = 'uploads') => {
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

                    // Notificar progreso real
                    try {
                      await self.registration.showNotification('Aquatech — Subiendo archivo', {
                        body: `${filename}: parte ${i + 1} de ${totalChunks}`,
                        tag: 'sync-progress',
                        silent: true,
                      });
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

            // v316: Also process media for PROJECT creation if provided
            if (item.type === 'PROJECT' && (payload.image || payload.fileData)) {
              const source = payload.fileData || payload.image;
              if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                payload.image = await uploadMediaSW(source, payload.filename || 'project_image.jpg', payload.mimeType, 'projects');
                delete payload.fileData;
                await persistProgress();
              }
            }

            // 4. Handle TASK (Attachments & Links)
            if (item.type === 'TASK') {
              const uploadedMap = {};
              if (payload.attachments) {
                for (let a of payload.attachments) {
                  const source = a.fileData || a.base64 || a.data || a.url;
                  if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                    const cacheKey = typeof source === 'string' ? (source.length > 100 ? source.substring(0, 100) : source) : source;
                    if (!uploadedMap[cacheKey]) {
                      uploadedMap[cacheKey] = await uploadMediaSW(source, a.name, a.mimeType, 'appointments');
                    }
                    a.url = uploadedMap[cacheKey];
                    a.data = a.url;
                    delete a.fileData;
                    delete a.base64;
                    await persistProgress();
                  }
                }
              }
              if (payload.files) {
                for (let f of payload.files) {
                  const source = f.fileData || f.url;
                  if (source && (source instanceof ArrayBuffer || (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))))) {
                    f.url = await uploadMediaSW(source, f.name, f.mimeType, 'appointments');
                    delete f.fileData;
                    await persistProgress();
                  }
                }
              }
            }

            return payload;
          };

          const finalPayload = await processMedia(item);

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
              body: JSON.stringify({ 
                ...finalPayload, 
                lat: item.lat, 
                lng: item.lng, 
                createdAt: new Date(item.timestamp).toISOString(),
                isOfflineSync: true
              })
            }), 30000); // 30s timeout for API

            if (res.ok) {
               await new Promise((deleteRes) => {
                 const txd = db.transaction(['outbox'], 'readwrite');
                 const stored = txd.objectStore('outbox');
                 const req = stored.delete(item.id);
                 req.onsuccess = deleteRes;
                 req.onerror = deleteRes; // Prevent hang on error
               });
               console.log(`[SW] Successfully synced ${item.type} (ID: ${item.id})`);
            } else {
               throw new Error('Server returned ' + res.status);
            }
          }
        } catch (e) {
          console.error(`[SW] Failed to sync item ${item.id}:`, e);
          // v272: Mark context as failed so dependents are skipped
          if (ctx) failedContexts.add(ctx);
          await new Promise((res) => {
            try {
              const txError = db.transaction(['outbox'], 'readwrite');
              const storeError = txError.objectStore('outbox');
              item.status = 'failed';
              item.attempts = (item.attempts || 0) + 1;
              item.lastAttemptAt = Date.now();
              const req = storeError.put(item);
              req.onsuccess = res;
              req.onerror = res; // Prevent hang on error
            } catch (err) {
              res(); // Resolve if transaction creation fails
            }
          });
        }
        // v261: Pacing delay between items to prevent server saturation
        await new Promise(r => setTimeout(r, 500));
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
            console.log(`[SW] ${count} items still pending. Scheduling retry in 30s...`);
            setTimeout(() => processOutboxSync(false), 30000);
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

// ─── BACKGROUND SYNC ───────────────────────────────────────
// ─── BACKGROUND SYNC ───────────────────────────────────────
// v288: The "Robot" — wakes up when internet returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox' || event.tag === 'sync-outbox-periodic' || event.tag === 'test-tag-from-devtools') {
    // console.log('[SW] Background Sync triggered:', event.tag);
    event.waitUntil(processOutboxSync(false));
  }
});

// v288: Periodic Background Sync (requires PWA installation)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-outbox' || event.tag === 'sync-outbox-periodic') {
    // console.log('[SW] Periodic Background Sync triggered:', event.tag);
    event.waitUntil(processOutboxSync(false));
  }
});

// ─── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', (event) => {
  // v288: Wake up the robot silently when a push arrives
  // This is a robust way to ensure sync even if the OS throttles 'sync' events
  event.waitUntil(processOutboxSync(false).catch(() => {}));

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
    vibrate: [200, 100, 200, 100, 400], // Patrón más premium
    tag: data.tag || 'aquatech-update',
    renotify: true,
    requireInteraction: true, // Mantener hasta que el usuario la vea
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
