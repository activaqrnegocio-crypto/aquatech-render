// ============================================================
// Aquatech CRM — Custom Service Worker v273
// v273: Chunked Media Upload & Robust Shell Recovery
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
  '/favicon.png',
  '/logo.jpg',
  '/cotizacion.jpg',
  '/admin/proyectos/offline-shell',
  '/admin/operador/proyecto/offline-shell'
];

const VERSION = 'v277';

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
    // v274: EXCLUDE critical data APIs from SW cache to let Dexie handle it exclusively.
    // This prevents stale/partial SW cache from overwriting reliable Dexie data.
    const isCriticalApi = 
      url.pathname.includes('/api/appointments') || 
      url.pathname.includes('/api/projects') || 
      url.pathname.includes('/api/users');

    if (isCriticalApi) {
      return; // Fall through to browser fetch (components handle offline via Dexie)
    }
    
    // v274: Reduced API timeout to 5s for faster offline fallback
    event.respondWith(networkFirst(request, 'aquatech-apis-v1', 5000));
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
    // v286: Use SWR for routes that are role-exclusive or critical for speed.
    // This makes project navigation INSTANT.
    const isAdminOnlyRoute = url.pathname === '/admin/proyectos' || 
                             url.pathname === '/admin/calendario' ||
                             url.pathname.match(/\/admin\/proyectos\/\d+/);
    const isOperatorOnlyRoute = url.pathname.startsWith('/admin/operador');
    
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
    const cache = await caches.open(RSC_CACHE);
    
    // 1. Try exact match
    let cached = await cache.match(cacheKey) || await cache.match(originalUrl);
    if (cached) return cached;
    
    // 2. v225: Universal RSC Shell for Projects
    // v268: Improved regex to catch all operator project variants
    const isAdminProjectRsc = url.pathname.match(/\/admin\/proyectos\/\d+/);
    const isOperatorProjectRsc = url.pathname.match(/\/admin\/operador\/proyecto\/\d+/) || 
                                 url.pathname.match(/\/operador\/proyecto\/\d+/) ||
                                 url.pathname.includes('/operador/proyecto/');

    if (isAdminProjectRsc || isOperatorProjectRsc) {
      const rscCache = await caches.open(RSC_CACHE);
      const pagesCache = await caches.open(PAGES_CACHE);
      const staticCache = await caches.open(STATIC_CACHE);

      const findShellInAllCaches = async (path) => {
        // v273: Aggressive search for shell in all relevant caches
        return await rscCache.match(path) || 
               await pagesCache.match(path) || 
               await staticCache.match(path) ||
               await caches.match(path + '?_rsc=1', { ignoreVary: true }) ||
               await caches.match(path, { ignoreVary: true, ignoreSearch: true });
      };

      if (isAdminProjectRsc) {
        console.log(`[SW ${VERSION}] RSC Cache miss for admin project, serving Universal RSC Shell...`);
        const shellMatch = await findShellInAllCaches('/admin/proyectos/offline-shell');
        if (shellMatch) return shellMatch;
      } else if (isOperatorProjectRsc) {
        console.log(`[SW ${VERSION}] RSC Cache miss for operator project, serving Universal RSC Shell...`);
        const shellMatch = await findShellInAllCaches('/admin/operador/proyecto/offline-shell');
        if (shellMatch) return shellMatch;
      }
    }
    console.warn(`[SW ${VERSION}] RSC Network First failed completely for:`, url.pathname);
    return Response.error(); // v251: Prevent TypeError by returning a valid error response
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
  
  const fetchPromise = fetchWithTimeout(request.clone(), 8000).then(async (response) => {
    if (response.ok && !response.redirected) {
      const cacheToUpdate = await caches.open(RSC_CACHE);
      cacheToUpdate.put(cacheKey, response.clone());
    }
    // v272: If SWR fetch fails with 502/etc, don't return the error to browser if we are in a critical navigation
    if (!response.ok) return null;
    return response;
  }).catch(() => null);

  if (cached) {
    console.log(`[SW ${VERSION}] Serving RSC from cache (SWR):`, url.pathname);
    return cached;
  }

  // v251: Ensure we NEVER return null to respondWith()
  return fetchPromise.then(res => res || Response.error());
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

    // v269: Added /admin/calendario to the "force shell" list for faster mobile entry.
    const isProject = url.pathname.includes('/proyecto/') || url.pathname.includes('/proyectos/');
    const isOperatorDashboard = url.pathname === '/admin/operador' || url.pathname === '/admin/operador/';
    const isCalendar = url.pathname === '/admin/calendario' || url.pathname === '/admin/calendario/';
    let cached = null;
    
    if (isProject || isOperatorDashboard || isCalendar) {
      console.log(`[SW ${VERSION}] Fast-track route detected, forcing shell/cache for instant load...`);
      cached = await findCachedPage(request.url, url.pathname, true); 
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

    // ── STEP 2: Cache miss → try network with tighter timeout for mobile (v268: 8s)
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
  // v268: Robust operator project detection
  const isAdminProject = pathname.match(/\/admin\/proyectos\/\d+/);
  const isOperatorProject = pathname.match(/\/admin\/operador\/proyecto\/\d+/) || 
                            pathname.match(/\/operador\/proyecto\/\d+/) ||
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
    
    // v272: If server returns error (502, 500), try fallback to cache
    if (!response.ok && response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
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
    console.log('[SW] Warm-up pre-caching request for', urls.length, 'URLs');
    
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        let current = 0;
        const total = urls.length;

        for (const url of urls) {
          current++;
          try {
            const existing = await cache.match(url);
            if (existing && existing.ok && !existing.redirected) {
               if (replyPort) replyPort.postMessage({ done: true, url, cached: true });
               continue;
            }

            if (url.startsWith('data:')) {
              if (replyPort) replyPort.postMessage({ done: true, url, skipped: true });
              continue;
            }

            const isRsc = url.includes('_rsc=');
            const response = await fetchWithTimeout(new Request(url, { 
              credentials: 'same-origin',
              headers: { 
                'Cache-Control': 'no-cache', 
                'Accept': isRsc ? 'text/x-component, text/html' : 'text/html',
                ...(isRsc ? { 'RSC': '1' } : {})
              }
            }), 20000); // v286: Increased to 20s for slow dev servers

            if (response.ok) {
              const contentType = response.headers.get('Content-Type') || '';
              const isHTML = contentType.includes('text/html');
              const isRscResponse = contentType.includes('text/x-component');
              const finalUrl = response.url || '';
              const isLoginRedirect = finalUrl.includes('/login');
              
              if ((isHTML || isRscResponse) && !isLoginRedirect) {
                await cache.put(url, response.clone());
                const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
                await cache.put(alt, response.clone());
                
                try {
                  const htmlText = await response.clone().text();
                  const chunkMatches = Array.from(htmlText.matchAll(/\/(_next\/static\/[^"'\s>]+)/g));
                  const assetsCache = await caches.open(ASSETS_CACHE);
                  
                  const maxChunks = 25; // v286: Increased from 10 to 25 for better coverage
                  let chunkCount = 0;
                  for (const match of chunkMatches) {
                    if (chunkCount >= maxChunks) break;
                    chunkCount++;
                    const chunkPath = match[1];
                    const fullChunkUrl = new URL('/' + chunkPath, self.location.origin).href;
                    
                    // Removed syncChannel chunk reporting to avoid UI flicker

                    const hasChunk = await assetsCache.match(fullChunkUrl);
                    if (!hasChunk) {
                      try {
                        const r = await fetch(fullChunkUrl, { priority: 'low' });
                        if (r.ok) await assetsCache.put(fullChunkUrl, r);
                      } catch (e) {}
                    }
                  }
                } catch (err) {
                  console.warn('[SW] Chunk extraction failed for:', url);
                }

                console.log(`[SW ${VERSION}] Warm-cached success (+chunks):`, url);
              } else if (!isLoginRedirect) {
                await cache.put(url, response.clone());
              }
            }
            
            if (replyPort) replyPort.postMessage({ done: true, url });
            // v286: Minimal 100ms delay to keep the process fast but safe
            await new Promise(r => setTimeout(r, 100)); 
          } catch (e) {
            console.warn(`[SW ${VERSION}] Warm-cache failed for:`, url);
            if (replyPort) replyPort.postMessage({ done: true, url, error: true });
          }
        }
        console.log(`[SW ${VERSION}] Pre-caching sequence finished`);
        trimCache(PAGES_CACHE, 400); 
      })
    );
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
                if (stuckTime > 120000) { // 2 minutes
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
    // v262: Captura atómica de items pendientes. 
    // Usamos una transacción de escritura para marcar todos los pendientes como 'syncing' 
    // de un solo golpe, evitando que otra instancia los reclame.
    const pendingItems = await new Promise((res) => {
      const tx = db.transaction(['outbox'], 'readwrite');
      const store = tx.objectStore('outbox');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        let allItems = getAll.result || [];
        
        // Filtrar por tipo si se especificó una etiqueta de sync
        let toSync = allItems.filter(i => (i.status === 'pending' || i.status === 'failed'));
        if (specificType) {
          toSync = toSync.filter(i => i.type === specificType);
        }
        
        // v272: Sort chronologically (FIFO) for dependency order
        toSync.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // Marcamos todos como 'syncing' en la misma transacción
        for (const item of toSync) {
          const lockedItem = { ...item, status: 'syncing' };
          store.put(lockedItem);
        }
        res(toSync);
      };
      getAll.onerror = () => res([]);
    });

    if (pendingItems.length === 0) {
      resolve();
      return;
    }

    console.log(`[SW] Claimed ${pendingItems.length} items for atomic sync (FIFO order)`);

    const now = Date.now();
    const failedContexts = new Set(); // v272: Track failed projects
    for (const item of pendingItems) {
      // v272: Skip items whose project/context already failed
      const ctx = item.projectId ? `proj-${item.projectId}` : ((item.type === 'DAY_START' || item.type === 'DAY_END') ? 'day-record' : null);
      if (ctx && failedContexts.has(ctx)) {
        console.log(`[SW] Skipping ${item.type} — earlier dependency for ${ctx} failed`);
        // Reset to pending so it retries next cycle
        await new Promise(r => { const tx = db.transaction(['outbox'], 'readwrite'); tx.objectStore('outbox').put({...item, status: 'pending'}).onsuccess = r; });
        continue;
      }

      // Re-verificamos el backup de reintentos
      if (item.attempts >= 5) {
        const hoursSinceLastAttempt = (now - (item.lastAttemptAt || item.timestamp)) / 3600000;
        if (hoursSinceLastAttempt < 1) continue;
      }

      try {
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
            const configResp = await fetch('/api/storage/config');
            if (!configResp.ok) return item.payload;
            const config = await configResp.json();
            const payload = { ...item.payload };

            const uploadMediaSW = async (source, name, subfolder = 'general') => {
              try {
                let blob;
                if (source instanceof Blob) {
                  blob = source;
                } else if (typeof source === 'string' && source.startsWith('data:')) {
                  const parts = source.split(';base64,');
                  const contentType = parts[0].split(':')[1];
                  const raw = atob(parts[1]);
                  const uInt8Array = new Uint8Array(raw.length);
                  for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
                  blob = new Blob([uInt8Array], { type: contentType });
                } else if (typeof source === 'string' && source.startsWith('blob:')) {
                  const res = await fetch(source);
                  blob = await res.blob();
                } else {
                  return source; // Already a URL or unknown
                }
                
                // v273: Use chunked upload for anything > 1MB
                if (blob.size > 1024 * 1024) {
                   const url = await uploadInChunksSW(blob, name);
                   if (!url) throw new Error('Chunked upload returned no URL');
                   return url;
                }

                const timestamp = Date.now();
                const safeName = (name || `file_${timestamp}`).replace(/[^a-zA-Z0-9.-]/g, '_');
                const folderPath = item.projectId ? `projects/${item.projectId}` : subfolder;
                const path = `/${config.storageZone}/${folderPath}/${timestamp}-${safeName}`;
                const uploadUrl = `https://${config.storageHost}${path}`;
                
                const res = await fetch(uploadUrl, {
                  method: 'PUT',
                  headers: { 
                    'AccessKey': config.accessKey, 
                    'Content-Type': blob.type || 'application/octet-stream' 
                  },
                  body: blob
                });
                if (!res.ok) throw new Error(`Bunny upload failed with status ${res.status}`);
                return `${config.pullZoneUrl}/${folderPath}/${timestamp}-${safeName}`;
              } catch (e) {
                console.error('[SW] Upload failed:', e);
                throw e; // v275: Throw so the caller knows sync failed
              }
            };

            const uploadInChunksSW = async (blob, filename) => {
              console.log(`[SW] Starting chunked upload for ${filename} (${blob.size} bytes)`);
              const CHUNK_SIZE = 1 * 1024 * 1024; 
              const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
              const uploadId = self.crypto.randomUUID();

              for (let i = 0; i < totalChunks; i++) {
                const chunk = blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('uploadId', uploadId);
                formData.append('chunkIndex', i.toString());
                formData.append('totalChunks', totalChunks.toString());
                formData.append('filename', filename);

                const res = await fetch('/api/upload/chunk', {
                  method: 'POST',
                  body: formData
                });

                if (!res.ok) throw new Error(`Chunk ${i} failed`);
                const data = await res.json();
                if (data.url) return data.url;
              }
              return null;
            };

            // 1. Handle MESSAGE / MEDIA_UPLOAD
            if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') {
              if (payload.media) {
                const source = payload.media.base64 || payload.media.url;
                if (source && (source.startsWith('data:') || source.startsWith('blob:'))) {
                  payload.media.url = await uploadMediaSW(source, payload.media.filename, 'messages');
                  delete payload.media.base64;
                }
              }
            }

            // 2. Handle EXPENSE
            if (item.type === 'EXPENSE' && payload.receiptPhoto) {
              if (payload.receiptPhoto.startsWith('data:') || payload.receiptPhoto.startsWith('blob:')) {
                payload.receiptPhoto = await uploadMediaSW(payload.receiptPhoto, 'receipt.jpg', 'expenses');
              }
            }

            // 3. Handle GALLERY_UPLOAD
            if (item.type === 'GALLERY_UPLOAD' && payload.url) {
              if (payload.url.startsWith('data:') || payload.url.startsWith('blob:')) {
                payload.url = await uploadMediaSW(payload.url, payload.filename || 'gallery_item.jpg', 'gallery');
              }
            }

            // 4. Handle TASK (Attachments & Links)
            if (item.type === 'TASK') {
              const uploadedMap = {};
              if (payload.attachments) {
                for (let a of payload.attachments) {
                  const source = a.base64 || a.data || a.url;
                  if (source && (typeof source !== 'string' || source.startsWith('data:') || source.startsWith('blob:'))) {
                    const cacheKey = source.length > 100 ? source.substring(0, 100) : source;
                    if (!uploadedMap[cacheKey]) {
                      uploadedMap[cacheKey] = await uploadMediaSW(source, a.name, 'appointments');
                    }
                    const finalUrl = uploadedMap[cacheKey];
                    a.data = finalUrl;
                    a.url = finalUrl;
                    delete a.base64;
                  }
                }
              }
              if (payload.attachmentLinks) {
                for (let l of payload.attachmentLinks) {
                  const source = l.base64 || l.url || l.data;
                  if (source && (typeof source !== 'string' || source.startsWith('data:') || source.startsWith('blob:'))) {
                    const cacheKey = source.length > 100 ? source.substring(0, 100) : source;
                    if (!uploadedMap[cacheKey]) {
                      uploadedMap[cacheKey] = await uploadMediaSW(source, l.name, 'appointments');
                    }
                    const finalUrl = uploadedMap[cacheKey];
                    l.url = finalUrl;
                    l.data = finalUrl;
                    delete l.base64;
                  }
                }
              }
              if (payload.files) {
                for (let f of payload.files) {
                  const source = f.base64 || f.url || f.data;
                  if (source && (typeof source !== 'string' || source.startsWith('data:') || source.startsWith('blob:'))) {
                    const cacheKey = source.length > 100 ? source.substring(0, 100) : source;
                    if (!uploadedMap[cacheKey]) {
                      uploadedMap[cacheKey] = await uploadMediaSW(source, f.name, 'appointments');
                    }
                    const finalUrl = uploadedMap[cacheKey];
                    f.url = finalUrl;
                    f.data = finalUrl;
                    delete f.base64;
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
            const res = await fetch(endpoint, {
              method,
              headers: { 
                'Content-Type': 'application/json',
                'x-sync-id': `sync-${item.id}-${item.timestamp}` // v261: Idempotency Key
              },
              credentials: 'same-origin',
              body: JSON.stringify({ 
                ...finalPayload, 
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
          // v272: Mark context as failed so dependents are skipped
          if (ctx) failedContexts.add(ctx);
          await new Promise((res) => {
            const txError = db.transaction(['outbox'], 'readwrite');
            const storeError = txError.objectStore('outbox');
            item.status = 'failed';
            item.attempts = (item.attempts || 0) + 1;
            item.lastAttemptAt = Date.now();
            storeError.put(item).onsuccess = res;
          });
        }
        // v261: Pacing delay between items to prevent server saturation
        await new Promise(r => setTimeout(r, 500));
      }

      // v274: Notify UI that sync cycle finished
      const syncChannel = new BroadcastChannel('aquatech-sync');
      syncChannel.postMessage({ type: 'OUTBOX_SYNC_FINISHED' });
      syncChannel.close();

      resolve();
    };

    getAllRequest.onerror = () => {
      console.error('[SW] Failed to read outbox for sync');
      reject(getAllRequest.error);
    };
    }); // Close the then block for clients.matchAll
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
