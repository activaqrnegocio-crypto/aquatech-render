'use client'

import { useEffect, useState } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    setIsOffline(offline)
    
    // Si la app está offline y Next.js falló al cargar la navegación del servidor (RSC),
    // forzar la recarga "hard" (completa) permite que el Service Worker atrape la petición
    // de tipo "navigate" y responda directamente con el HTML cacheado de forma nativa.
    if (offline) {
      const reloadKey = 'offline_reload_attempt';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      
      // Only auto-reload if we haven't tried in the last 10 seconds
      if (!lastReload || (now - parseInt(lastReload) > 10000)) {
        sessionStorage.setItem(reloadKey, now.toString());
        setTimeout(() => {
          window.location.reload()
        }, 300)
      }
    }
  }, [error])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui', height: '100vh', background: 'var(--bg)' }}>
      <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>No se pudo cargar la página</h2>
      <p style={{ color: 'var(--text)', marginBottom: '2rem' }}>{error.message || 'Error de conexión interno'}</p>
      
      {isOffline ? (
        <div style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Estás temporalmente sin internet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando versión offline segura, por favor espera un momento...</p>
        </div>
      ) : (
        <button 
          onClick={() => reset()} 
          className="btn btn-primary"
          style={{ padding: '12px 24px', fontSize: '1.1rem' }}
        >
          Volver a intentar
        </button>
      )}
    </div>
  )
}
