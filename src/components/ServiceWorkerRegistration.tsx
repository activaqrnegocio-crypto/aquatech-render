'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration — registers from /custom-sw.js directly.
 * MUST use a root-level file (not /api/serve-sw) to ensure scope '/' works
 * reliably on WebAPK (installed PWA) without Service-Worker-Allowed header.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const registerSW = async () => {
      try {
        // First: unregister any SW with wrong scope (e.g., from /api/serve-sw)
        const existingRegs = await navigator.serviceWorker.getRegistrations();
        for (const reg of existingRegs) {
          const scopeUrl = new URL(reg.scope);
          if (scopeUrl.pathname !== '/') {
            console.log('[App] Unregistering SW with wrong scope:', reg.scope);
            await reg.unregister();
          }
        }
      } catch (e) {
        console.warn('[App] Failed to clean old SW registrations:', e);
      }

      // Register from root-level file — guarantees scope '/'
      const paths = ['/custom-sw.js', '/sw.js'];
      
      for (const swPath of paths) {
        try {
          const reg = await navigator.serviceWorker.register(swPath, { scope: '/' });
          console.log(`[App] SW registered via ${swPath}, scope: ${reg.scope}`);

          if (reg.waiting) reg.waiting.postMessage('skipWaiting');
          
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

          setInterval(() => reg.update(), 30 * 60 * 1000);
          return; // Success — stop trying other paths
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
