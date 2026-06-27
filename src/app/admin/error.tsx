'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOffline, setIsOffline] = useState(false)
  const [hasCache, setHasCache] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const isChunkError = error && (
      error.message?.includes('Loading chunk') ||
      error.message?.includes('loading chunk') ||
      error.message?.includes('chunk') ||
      error.name === 'ChunkLoadError'
    );
    if (isChunkError) {
      const lastChunkReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastChunkReload || now - Number(lastChunkReload) > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        console.log('[AdminError] Chunk load error detected! Auto-recovering via full reload...');
        window.location.reload();
        return;
      }
    }

    const checkCacheAndOnline = async () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setIsOffline(offline)
      
      // v500: Solo auto-reload en APK si NO hay datos cacheados
      // Si hay cache en SQLite, el usuario ya sync'd antes y puede entrar directo
      if (offline && Capacitor.isNativePlatform()) {
        try {
          // Verificar si hay sesión guardada en SQLite (意味着 ya syncizó antes)
          const { isSqliteReady, isNativePlatform, getAuthCache } = await import('@/lib/storage')
          
          if (isNativePlatform()) {
            const nativeReady = await isSqliteReady()
            
            if (nativeReady && getAuthCache) {
              // Consultar SQLite directamente - NO usar fetch (fallará offline)
              const cachedAuth = await getAuthCache()
              if (cachedAuth && cachedAuth.token && cachedAuth.userId) {
                // Hay sesión en SQLite, el usuario ya syncizó antes
                setHasCache(true)
                console.log('[AdminError] APK offline con cache en SQLite — entrando directo')
              } else {
                setHasCache(false)
              }
            } else {
              setHasCache(false)
            }
          } else {
            setHasCache(false)
          }
        } catch (e) {
          console.warn('[AdminError] Error verificando cache:', e)
          setHasCache(false)
        }
      } else if (offline) {
        // PWA: no verificar cache, dejar que el SW maneje
        setHasCache(true)
      }
      
      setChecking(false)
    }
    
    checkCacheAndOnline()
  }, [error])

  // Si está offline Y tiene cache (ya syncizó antes) → NO hacer reload, entrar directo
  // Si está offline Y NO tiene cache (nunca syncizó) → Mostrar modal de espera
  const showReloadUI = isOffline && !hasCache && !checking

  // Si tiene cache y está offline, simplemente mostrar el banner de offline
  // sin hacer reload automático — la app funciona con datos cacheados
  if (isOffline && hasCache && !checking) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '2rem', 
        textAlign: 'center', 
        fontFamily: 'system-ui', 
        height: '100vh', 
        background: 'var(--bg)' 
      }}>
        <div style={{ 
          padding: '1rem', 
          background: '#f59e0b', 
          borderRadius: '12px', 
          border: '1px solid #d97706',
          maxWidth: '400px'
        }}>
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>📡 Modo Offline</p>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Mostrando datos guardados. Los cambios se sincronizarán cuando recuperes conexión.
          </p>
        </div>
      </div>
    )
  }

  // Solo mostrar modal de reload si está offline y NO hay cache
  if (checking) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '2rem', 
        textAlign: 'center', 
        fontFamily: 'system-ui', 
        height: '100vh', 
        background: 'var(--bg)' 
      }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Verificando datos disponibles...</p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui', height: '100vh', background: 'var(--bg)' }}>
      <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>No se pudo cargar la página</h2>
      <p style={{ color: 'var(--text)', marginBottom: '2rem' }}>{error.message || 'Error de conexión interno'}</p>
      
      {showReloadUI ? (
        <div style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Estás temporalmente sin internet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando versión offline segura, por favor espera un momento...</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              marginTop: '1rem', 
              padding: '10px 20px', 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
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
