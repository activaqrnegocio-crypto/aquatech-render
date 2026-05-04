'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const SW_VERSION = 'v331'; 
    const swUrl = `/custom-sw.js?v=${SW_VERSION}`
    console.log('[App] Solicitando registro de Robot v331 (Syntax Fix)...');
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[App] Nuevo Robot activo. Recargando...');
      window.location.reload();
    });

    navigator.serviceWorker.register(swUrl, { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] Actualización detectada. Forzando activación...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        navigator.serviceWorker.ready.then((reg) => {
          const isOperador = window.location.pathname.includes('/operador')
          const isSubcon = window.location.pathname.includes('/subcontratista')

          const urlsToCache = isOperador
            ? ['/admin/operador', '/offline.html']
            : isSubcon
            ? ['/admin/subcontratista', '/offline.html']
            : ['/admin', '/offline.html']

          reg.active?.postMessage({ type: 'PRECACHE_URLS', urls: urlsToCache })
        })
      })
      .catch((err) => console.error('[App] Error registrando SW:', err))
  }, [])

  return null
}
