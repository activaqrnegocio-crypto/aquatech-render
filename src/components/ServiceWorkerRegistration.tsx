'use client'

import { useEffect } from 'react'
import { db } from '@/lib/db'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const SW_VERSION = 'v375'; // v375: SW retry chain skips GALLERY_UPLOAD (GSW handles)
    const swUrl = `/custom-sw.js?v=${SW_VERSION}`
    console.log(`[App] Solicitando registro de Robot ${SW_VERSION} (Fetch Trigger)...`);
    // v338: NO recargar la página cuando un nuevo SW toma control.
    // El nuevo SW se activará en la próxima navegación sin recarga forzada.

    navigator.serviceWorker.register(swUrl, { scope: '/' })
      .then(async (registration) => {
        // v333: Log installation to IndexedDB → visible in /admin/debug/sync
        try {
          await db.syncLogs.add({
            timestamp: Date.now(),
            level: 'success',
            message: `🤖 Robot ${SW_VERSION} instalado correctamente en este dispositivo`,
            type: 'heartbeat',
            details: `SW scope: ${registration.scope}, state: ${registration.installing?.state || registration.active?.state || 'registered'}`
          });
        } catch (e) { /* silent */ }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', async () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] Actualización detectada. Forzando activación...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              // v333: Log update
              try {
                await db.syncLogs.add({
                  timestamp: Date.now(),
                  level: 'info',
                  message: `🔄 Actualización de Robot detectada — aplicando...`,
                  type: 'heartbeat'
                });
              } catch (e) {}
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
          
          // v333: PING al SW cada 60s para verificar que responde
          const pingInterval = setInterval(async () => {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'PING', timestamp: Date.now() });
            }
          }, 60000);
          
          // Cleanup on unmount
          window.addEventListener('beforeunload', () => clearInterval(pingInterval));
        })
      })
      .catch(async (err) => {
        console.error('[App] Error registrando SW:', err)
        try {
          await db.syncLogs.add({
            timestamp: Date.now(),
            level: 'error',
            message: `❌ Error al instalar Robot: ${err.message || err}`,
            type: 'heartbeat',
            details: JSON.stringify(err)
          });
        } catch (e) {}
      })
  }, [])

  return null
}
