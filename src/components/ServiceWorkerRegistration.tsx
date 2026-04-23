'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration
 * 
 * Registers /sw.js which forwards to /custom-sw.js via importScripts.
 * This approach ensures:
 * - Old cached JS (that registers /sw.js) still works
 * - New code also registers /sw.js
 * - No unregister/re-register gap that leaves the app without a SW
 * - Both paths execute the same custom-sw.js offline-first logic
 * 
 * After registration, sends PRECACHE_URLS to warm-up the cache
 * with critical pages while the user has an active session.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('[App] SW registered, scope:', reg.scope);

          // Force the new SW to activate immediately if waiting
          if (reg.waiting) {
            reg.waiting.postMessage('skipWaiting');
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage('skipWaiting');
                }
              });
            }
          });

          // Warm-up cache after SW activates (3s delay to ensure activation)
          setTimeout(() => {
            warmUpCache();
          }, 3000);

          // Check for SW updates every 30 minutes
          setInterval(() => {
            reg.update();
          }, 30 * 60 * 1000);

        } catch (err) {
          console.error('[App] SW registration failed:', err);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}

/**
 * Warm-up cache: sends a message to the active SW to pre-cache
 * critical pages. Runs AFTER mount so session cookies are available,
 * ensuring cached pages are the actual dashboard (not login redirects).
 */
function warmUpCache() {
  if (!navigator.serviceWorker.controller) {
    // SW not controlling yet, retry in 2s
    setTimeout(() => warmUpCache(), 2000);
    return;
  }

  const isOperator = window.location.pathname.includes('/operador');
  const isSubcon = window.location.pathname.includes('/subcontratista');

  const criticalPages = [
    '/admin',
    '/admin/',
    '/admin/login',
    '/admin/cotizaciones',
    '/admin/cotizaciones/',
    '/admin/cotizaciones/offline',
    '/admin/inventario',
  ];

  if (isOperator) {
    criticalPages.push(
      '/admin/operador',
      '/admin/operador/',
      '/admin/operador/nuevo',
    );
  } else if (isSubcon) {
    criticalPages.push(
      '/admin/subcontratista',
    );
  } else {
    criticalPages.push(
      '/admin/proyectos',
      '/admin/recursos',
      '/admin/reportes',
    );
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'PRECACHE_URLS',
    urls: criticalPages,
  });

  console.log('[App] Warm-up cache sent for', criticalPages.length, 'pages');
}
