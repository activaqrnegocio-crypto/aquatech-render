'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration — ONLY registers the SW.
 * The warm-up cache is triggered from AdminLayoutClient (after login).
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const registerSW = async () => {
      const paths = ['/api/serve-sw', '/custom-sw.js', '/sw.js'];
      
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
          return; // Success
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
