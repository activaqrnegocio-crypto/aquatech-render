// ============================================================
// Aquatech CRM — Custom Service Worker v201-DEPLOY-FIX
// CLEAN: Calendar removed, deploy pipeline fixed
// ============================================================
const STATIC_CACHE = 'aquatech-static';
const PAGES_CACHE  = 'aquatech-pages';
const ASSETS_CACHE = 'aquatech-assets';
const FONTS_CACHE  = 'aquatech-fonts';
const RSC_CACHE    = 'aquatech-rsc';

// Only pre-cache truly PUBLIC files (no auth required)
const PRE_CACHE = [
  '/admin',
  '/admin/operador',
  '/admin/login',
  '/offline.html',
  '/app-start.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.jpg',
  '/cotizacion.jpg'
];

const VERSION = 'v246';

// v242: Helper to bypass Chrome's "redirected response" security block
function cleanResponse(response) {
  if (!response || !response.redirected) return response;
  const headers = new Headers(response.headers);
  return new Response(response.body, {
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
        for (const url of PRE_CACHE) {
          try {
            const response = await fetch(url);
            // v239: Allow caching redirected responses for the entry points
            if (response.ok) {
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
    event.respondWith(networkFirst(request, 'aquatech-apis-v1', 15000));
    return;
  }

  // ── Google Fonts → Cache First (long-lived)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
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
    // v246: ONLY use SWR for routes exclusive to one role.
    // Shared routes (inventario, cotizaciones, /admin) use network-first to avoid
    // serving admin RSC payloads to operator users (causes Server Components render error).
    const isAdminOnlyRoute = url.pathname === '/admin/proyectos' || 
                             url.pathname === '/admin/calendario';
    const isOperatorOnlyRoute = url.pathname === '/admin/operador';
    
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
    const response = await fetchWithTimeout(request.clone(), 10000);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(RSC_CACHE);
      cache.put(cacheKey, response.clone());
      // v222: Increased limit for RSC to preserve project data shells (Admin scale)
      trimCache(RSC_CACHE, 400);
    }
    return response;
  } catch (e) {
    const cache = await caches.open(RSC_CACHE);
    
    // 1. Try exact match
    let cached = await cache.match(cacheKey) || await cache.match(originalUrl);
    if (cached) return cached;
    
    // 2. v225: Universal RSC Shell for Projects
    // Instead of random project data, we serve the lightweight official shell
    const isAdminProjectRsc = url.pathname.match(/\/admin\/proyectos\/\d+/);
    const isOperatorProjectRsc = url.pathname.match(/\/admin\/operador\/proyecto\/\d+/) || url.pathname.match(/\/operador\/proyecto\/\d+/);
    
    if (isAdminProjectRsc || isOperatorProjectRsc) {
      if (isAdminProjectRsc) {
        console.log(`[SW ${VERSION}] RSC Cache miss for admin project, serving Universal RSC Shell...`);
        const shellMatch = await caches.match('/admin/proyectos/offline-shell?_rsc=1', { ignoreVary: true }) || 
                           await caches.match('/admin/proyectos/offline-shell', { ignoreVary: true, ignoreSearch: true });
        if (shellMatch) return shellMatch;
      } else if (isOperatorProjectRsc) {
        console.log(`[SW ${VERSION}] RSC Cache miss for operator project, serving Universal RSC Shell...`);
        const shellMatch = await caches.match('/admin/operador/proyecto/offline-shell?_rsc=1', { ignoreVary: true }) || 
                           await caches.match('/admin/operador/proyecto/offline-shell', { ignoreVary: true, ignoreSearch: true });
        if (shellMatch) return shellMatch;
      }
    }
    return undefined; // Let network error bubble up
  }
}

/**
 * v245: RSC Stale While Revalidate — Instant response for core navigations.
 */
async function rscStaleWhileRevalidate(request) {
  const url = new URL(request.url);
  url.searchParams.delete('_rsc');
  const cacheKey = url.toString();
  
  const cache = await caches.open(RSC_CACHE);
  const cached = await cache.match(cacheKey);
  
  const fetchPromise = fetchWithTimeout(request.clone(), 10000).then(async (response) => {
    if (response.ok && !response.redirected) {
      const cacheToUpdate = await caches.open(RSC_CACHE);
      cacheToUpdate.put(cacheKey, response.clone());
    }
    return response;
  }).catch(() => null);

  if (cached) {
    console.log(`[SW ${VERSION}] Serving RSC from cache (SWR):`, url.pathname);
    return cached;
  }

  return fetchPromise;
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
      console.log(`[SW ${VERSION}] Login detected, bypassing SW completely`);
      return fetch(request);
    }

    console.log(`[SW ${VERSION}] Navigation:`, url.pathname);

    // ── STEP 1: Check cache first for instant offline response
    // v238: For projects, if we are offline, we PREFER the shell even if we have a full page cached.
    // This prevents hydration errors from 'real' pages that might be missing chunks.
    const isProject = url.pathname.includes('/proyecto/') || url.pathname.includes('/proyectos/');
    let cached = null;
    
    if (isProject && !navigator.onLine) {
      console.log(`[SW ${VERSION}] Project detected offline, forcing shell to avoid chunk errors`);
      cached = await findCachedPage(request.url, url.pathname, true); // true = force shell
    } else {
      cached = await findCachedPage(request.url, url.pathname);
    }
    
    if (cached) {
      // Validate: don't serve cached login pages for non-login URLs
      const cachedUrl = cached.url || '';
      if (!url.pathname.includes('/login') && cachedUrl.includes('/login')) {
        console.log('[SW] Cached response is login redirect, checking network...');
        // If we are online, we skip cache and try network (to get the real page)
        // If we are offline, we MIGHT have to serve it or fallback to a shell
        if (navigator.onLine) {
          cached = null;
        } else {
          console.log('[SW] Offline and only have redirect, trying shells...');
          // Fallback to shells before giving up
        }
      }
    }

    if (cached) {
      console.log('[SW] Serving from cache:', url.pathname);
      // Update in background (stale-while-revalidate for pages)
      updatePageInBackground(request.clone(), url.pathname);
      return cleanResponse(cached);
    }

    // ── STEP 2: Cache miss → try network with RELAXED timeout (15s)
    try {
      const response = await fetchWithTimeout(request.clone(), 15000);
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
          console.log('[SW] Cached page:', url.pathname);
          // v222: Increased limit to preserve project shells (300 projects + margin)
          trimCache(PAGES_CACHE, 400);
        }
      }
      return response;
    } catch (e) {
      console.warn('[SW] Navigation network failed:', url.pathname);
    }

    // ── STEP 3: Last chance — Try shells if network failed or we are offline
    const shell = await findCachedPage(request.url, url.pathname, true); // true = force serve
    if (shell) {
      // v243: If we found a shell and it's NOT the absolute fallback, serve it.
      // If it IS the absolute fallback (contains "Sin Conexión"), we only serve it if offline.
      const isAbsoluteFallback = shell.headers.get('X-SW-Fallback') === 'absolute';
      if (!isAbsoluteFallback || !navigator.onLine) {
        console.log('[SW] Serving shell or offline fallback');
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
    if (!forceServe && !pathname.includes('/login') && (cached.url || '').includes('/login')) {
       // skip
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
  const isAdminProject = pathname.match(/\/admin\/proyectos\/\d+/);
  const isOperatorProject = pathname.match(/\/admin\/operador\/proyecto\/\d+/) || pathname.match(/\/operador\/proyecto\/\d+/);
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
    const shellMatch = await caches.match('/admin/operador/proyecto/offline-shell', { ignoreVary: true, ignoreSearch: true });
    if (isValidHTMLResponse(shellMatch)) return shellMatch;

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

  // v233: ABSOLUTE FALLBACK (Memory-resident HTML)
  // This prevents the "removeChild of null" and Next.js infinite loop errors
  // by providing a valid, minimal HTML structure that doesn't trigger a router retry.
  console.warn(`[SW ${VERSION}] No shell found in cache, serving absolute memory-fallback for: ${pathname}`);
  return new Response(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline | Aquatech</title>
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
        <p>Esta sección no está disponible offline todavía. Por favor, regresa cuando tengas internet.</p>
        <button onclick="window.history.back()">Regresar</button>
      </div>
      <script>
        window.__NEXT_DATA__ = { props: { pageProps: {} }, page: "${pathname}", query: {}, buildId: "offline", isFallback: false, gip: true };
        console.log("SW: Absolute fallback active.");
      </script>
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
    // v233: Only cache valid, non-redirected responses
    if (response && response.ok && !response.redirected) {
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

  // Warm-up pre-caching — caches responses INCLUDING redirects (except login)
  if (event.data && event.data.type === 'PRECACHE_URLS') {
    const urls = event.data.urls || [];
    console.log('[SW] Warm-up pre-caching request for', urls.length, 'URLs');
    
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        // v223: Process one by one with longer delays to prevent Nginx 502/504 saturation
        for (const url of urls) {
          try {
            // v233: Strict skip if already in cache and response is valid
            const existing = await cache.match(url);
            if (existing && existing.ok && !existing.redirected) {
               // console.log('[SW] Valid cache exists, skipping:', url);
               continue;
            }

            const response = await fetchWithTimeout(new Request(url, { 
              credentials: 'same-origin',
              headers: { 'Cache-Control': 'no-cache', 'Accept': 'text/html' }
            }), 12000); // Increased timeout

            if (response.ok) {
              const contentType = response.headers.get('Content-Type') || '';
              const isHTML = contentType.includes('text/html');
              const finalUrl = response.url || '';
              const isLoginRedirect = finalUrl.includes('/login');
              
              if (isHTML && !isLoginRedirect) {
                await cache.put(url, response.clone());
                const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
                await cache.put(alt, response.clone());
                
                // v227: Extract and pre-cache JS chunks found in the HTML
                try {
                  const htmlText = await response.clone().text();
                  // Find all _next/static/... references
                  const chunkMatches = htmlText.matchAll(/\/_next\/static\/[^"'\s]+/g);
                  const assetsCache = await caches.open(ASSETS_CACHE);
                  
                  for (const match of chunkMatches) {
                    const chunkUrl = match[0];
                    const fullChunkUrl = new URL(chunkUrl, self.location.origin).href;
                    
                    // Small check to avoid re-fetching if already in assets cache
                    const hasChunk = await assetsCache.match(fullChunkUrl);
                    if (!hasChunk) {
                      fetch(fullChunkUrl, { priority: 'low' })
                        .then(r => {
                          if (r.ok) assetsCache.put(fullChunkUrl, r);
                        }).catch(() => {});
                    }
                  }
                } catch (err) {
                  console.warn('[SW] Chunk extraction failed for:', url);
                }

                console.log('[SW] Warm-cached success (+chunks):', url);
              }
            }
            
            // v223: Longer delay between requests (800ms)
            await new Promise(r => setTimeout(r, 800));
          } catch (e) {
            console.warn('[SW] Warm-cache failed for:', url);
          }
        }
        console.log('[SW] Pre-caching sequence finished');
        trimCache(PAGES_CACHE, 400); 
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

      const now = Date.now();
      for (const item of pendingItems) {
        // Priority to UI: Only sync if item has been pending for more than 15 seconds
        // This gives the active tab enough time to sync every 5 seconds.
        if (now - item.timestamp < 15000) {
          console.log(`[SW] Skipping item ${item.id}, too fresh for SW sync (Priority to UI)`);
          continue;
        }

        // Re-check status inside a transaction to ensure it's still pending
        const stillPending = await new Promise((res) => {
          const tx = db.transaction(['outbox'], 'readonly');
          const store = tx.objectStore('outbox');
          const req = store.get(item.id);
          req.onsuccess = () => {
            const result = req.result;
            res(result && (result.status === 'pending' || result.status === 'failed'));
          };
          req.onerror = () => res(false);
        });

        if (!stillPending) continue;

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
            endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.itemId}`;
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

          // Special handling for TASK with base64 media
          if (item.type === 'TASK' && item.payload && (item.payload.attachments?.some(a => a.base64) || item.payload.attachmentLinks?.some(l => l.base64))) {
            try {
              console.log('[SW] Processing base64 media for TASK...');
              const configResp = await fetch('/api/storage/config');
              if (configResp.ok) {
                const config = await configResp.json();
                
                // Helper to upload base64 to Bunny from SW
                const uploadBase64 = async (base64, name) => {
                  const parts = base64.split(';base64,');
                  const contentType = parts[0].split(':')[1];
                  const raw = atob(parts[1]);
                  const rawLength = raw.length;
                  const uInt8Array = new Uint8Array(rawLength);
                  for (let i = 0; i < rawLength; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
                  const blob = new Blob([uInt8Array], { type: contentType });
                  
                  const timestamp = Date.now();
                  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
                  const path = `/${config.storageZone}/appointments/${timestamp}-${safeName}`;
                  const uploadUrl = `https://${config.storageHost}${path}`;
                  
                  const res = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'AccessKey': config.accessKey, 'Content-Type': 'application/octet-stream' },
                    body: blob
                  });
                  if (!res.ok) throw new Error('Bunny upload failed');
                  return `${config.pullZoneUrl}/appointments/${timestamp}-${safeName}`;
                };

                if (item.payload.attachments) {
                  for (let a of item.payload.attachments) {
                    if (a.base64) {
                      a.data = await uploadBase64(a.base64, a.name);
                      delete a.base64;
                    }
                  }
                }
                if (item.payload.attachmentLinks) {
                  for (let l of item.payload.attachmentLinks) {
                    if (l.base64) {
                      l.url = await uploadBase64(l.base64, l.name);
                      delete l.base64;
                    }
                  }
                }
              }
            } catch (mediaErr) {
              console.error('[SW] Media sync failed, sending without media or retrying', mediaErr);
            }
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
                isOfflineSync: true,
                isNew: item.payload.isNew // Carry over the flag for the API
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
