'use client'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import GlobalSyncWorker from '@/components/GlobalSyncWorker'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import { Suspense } from 'react'

import { useSession } from 'next-auth/react'
import OfflinePrefetcher from '@/components/OfflinePrefetcher'
import OfflineErrorBoundary from '@/components/OfflineErrorBoundary'
import { useState, useEffect } from 'react'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const isDashboard = pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/operador' || pathname === '/admin/operador/'

  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine pages to pre-cache for offline availability
  const getPagesToPrefetch = () => {
    if (!session?.user) return []
    const role = (session.user as any).role
    const isOp = role === 'OPERATOR' || role === 'OPERADOR' || role === 'SUBCONTRATISTA'
    
    if (isOp) {
      return ['/admin/operador', '/admin/operador/nuevo', '/admin/inventario', '/admin/cotizaciones', '/admin/calendario', '/admin/proyectos/nuevo']
    }
    return ['/admin', '/admin/proyectos', '/admin/proyectos/nuevo', '/admin/inventario', '/admin/cotizaciones', '/admin/calendario']
  }

  const pagesToPrefetch = getPagesToPrefetch()

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <ServiceWorkerRegistration />
      <GlobalSyncWorker />
      <OfflinePrefetcher urls={pagesToPrefetch} />
      <Suspense fallback={<div style={{ width: '260px', height: '100vh', background: 'var(--bg-card)' }} />}>
        <Sidebar />
      </Suspense>
      <main className="admin-content">
        {!isOnline && (
          <div style={{
            background: '#f59e0b', color: 'white', padding: '10px 20px', 
            textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem',
            position: 'sticky', top: 0, zIndex: 50,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            📡 Modo Offline — Los cambios se guardarán y sincronizarán automáticamente
          </div>
        )}
        <OfflineErrorBoundary>
          {!isDashboard && (
            <div style={{ padding: '10px 20px 0 20px', marginBottom: '-10px' }}>
              <button 
                onClick={() => {
                  // v233: Explicit back navigation to prevent getting stuck offline
                  if (pathname.includes('/operador/proyecto')) {
                    router.push('/admin/operador');
                  } else if (pathname.includes('/admin/proyectos/')) {
                    router.push('/admin/proyectos');
                  } else if (pathname.includes('/admin/cotizaciones/')) {
                    router.push('/admin/cotizaciones');
                  } else {
                    router.back();
                  }
                }}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span>Volver</span>
              </button>
            </div>
          )}
          {children}
        </OfflineErrorBoundary>
      </main>
    </div>
  )
}
