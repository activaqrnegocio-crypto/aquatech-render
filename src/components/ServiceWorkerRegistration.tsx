'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration
 * 
 * Registers /custom-sw.js directly as the Service Worker.
 * Also attempts /sw.js as a bridge (which imports custom-sw.js)
 * for backward compatibility with devices that have the old SW.
 * 
 * CRITICAL: Does NOT unregister existing SWs to avoid gaps
 * where no SW is active (which causes ERR_FAILED offline).
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      const registerSW = async () => {
        try {
          // Register custom-sw.js directly — this will update any existing
          // registration for scope '/' regardless of what script URL was used before
          const reg = await navigator.serviceWorker.register('/custom-sw.js', { scope: '/' });
          console.log('[App] SW registered (custom-sw.js), scope:', reg.scope);

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

          // Warm-up cache after SW activates
          setTimeout(() => warmUpCache(), 3000);

          // Check for SW updates every 30 minutes
          setInterval(() => reg.update(), 30 * 60 * 1000);

        } catch (err) {
          console.error('[App] SW registration failed:', err);
          // Fallback: try sw.js (bridge file) if custom-sw.js fails
          try {
            const fallbackReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log('[App] SW fallback registered (sw.js), scope:', fallbackReg.scope);
            setTimeout(() => warmUpCache(), 3000);
          } catch (fallbackErr) {
            console.error('[App] SW fallback also failed:', fallbackErr);
          }
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
 * Warm-up cache: pre-cache critical pages with active session cookies.
 * Retries if SW hasn't claimed the page yet.
 */
function warmUpCache(retries = 0) {
  if (!navigator.serviceWorker.controller) {
    if (retries < 5) {
      setTimeout(() => warmUpCache(retries + 1), 2000);
    }
    return;
  }

  const path = window.location.pathname;
  const isOperator = path.includes('/operador');
  const isSubcon = path.includes('/subcontratista');

  const pages = [
    '/admin',
    '/admin/',
    '/admin/login',
    '/admin/cotizaciones',
    '/admin/cotizaciones/',
    '/admin/cotizaciones/offline',
    '/admin/inventario',
  ];

  if (isOperator) {
    pages.push('/admin/operador', '/admin/operador/', '/admin/operador/nuevo');
  } else if (isSubcon) {
    pages.push('/admin/subcontratista');
  } else {
    pages.push('/admin/proyectos', '/admin/recursos', '/admin/reportes');
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'PRECACHE_URLS',
    urls: pages,
  });

  console.log('[App] Warm-up cache sent for', pages.length, 'pages');
}
