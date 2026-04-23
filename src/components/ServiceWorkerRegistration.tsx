'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration
 * 
 * Tries multiple registration paths to ensure the SW installs:
 * 1. /api/serve-sw (API route with guaranteed correct Content-Type)
 * 2. /custom-sw.js (direct file)
 * 3. /sw.js (bridge file)
 * 
 * The Next.js standalone server sometimes serves static files with
 * incorrect Content-Type headers, which causes Chrome to reject
 * Service Worker registration. The API route bypasses this issue.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const registerSW = async () => {
      // Try registration paths in order of reliability
      const paths = ['/api/serve-sw', '/custom-sw.js', '/sw.js'];
      
      for (const swPath of paths) {
        try {
          const reg = await navigator.serviceWorker.register(swPath, { scope: '/' });
          console.log(`[App] SW registered via ${swPath}, scope: ${reg.scope}`);

          // Force activate if waiting
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

          // Warm-up cache after 3s
          setTimeout(() => warmUpCache(), 3000);

          // Check for updates every 30 minutes
          setInterval(() => reg.update(), 30 * 60 * 1000);

          // Success — stop trying other paths
          return;
        } catch (err) {
          console.warn(`[App] SW registration failed for ${swPath}:`, err);
        }
      }

      console.error('[App] ALL SW registration paths failed');
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  return null;
}

function warmUpCache(retries = 0) {
  if (!navigator.serviceWorker.controller) {
    if (retries < 5) setTimeout(() => warmUpCache(retries + 1), 2000);
    return;
  }

  const path = window.location.pathname;
  const isOperator = path.includes('/operador');
  const isSubcon = path.includes('/subcontratista');

  const pages = [
    '/admin', '/admin/', '/admin/login',
    '/admin/cotizaciones', '/admin/cotizaciones/',
    '/admin/cotizaciones/offline', '/admin/inventario',
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
