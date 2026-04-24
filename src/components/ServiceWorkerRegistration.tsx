'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!window.location.pathname.startsWith('/admin')) return

    navigator.serviceWorker.register('/custom-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[App] SW registrado:', registration.scope)

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
