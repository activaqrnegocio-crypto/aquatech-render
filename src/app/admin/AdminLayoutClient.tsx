'use client'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

import { useSession } from 'next-auth/react'
import OfflineErrorBoundary from '@/components/OfflineErrorBoundary'

// Fase 2: Dynamic import — these are invisible background workers (51KB + 1KB)
// They don't affect visual render, so they load AFTER the UI paints
const GlobalSyncWorker = dynamic(() => import('@/components/GlobalSyncWorker'), { ssr: false })
const OfflinePrefetcher = dynamic(() => import('@/components/OfflinePrefetcher'), { ssr: false })
const SyncToast = dynamic(() => import('@/components/SyncToast'), { ssr: false })
import { useState, useEffect } from 'react'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const isDashboard = 
    pathname === '/admin' || pathname === '/admin/' || 
    pathname === '/admin/operador' || pathname === '/admin/operador/' ||
    pathname === '/admin/subcontratista' || pathname === '/admin/subcontratista/' ||
    pathname === '/admin/proyectos' || pathname === '/admin/proyectos/'

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
      const base = role === 'SUBCONTRATISTA' ? '/admin/subcontratista' : '/admin/operador'
      return [base, `${base}/nuevo`, `${base}/proyecto/offline-shell`, '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
    }
    return ['/admin', '/admin/proyectos', '/admin/proyectos/offline-shell', '/admin/proyectos/nuevo', '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
  }

  const pagesToPrefetch = getPagesToPrefetch()

  const [showSync, setShowSync] = useState(false)
  
  useEffect(() => {
    // v273: Delay heavy background workers to let the main page load first
    const timer = setTimeout(() => setShowSync(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <ServiceWorkerRegistration />
      {showSync && (
        <>
          <GlobalSyncWorker />
          <OfflinePrefetcher urls={pagesToPrefetch} />
          <SyncToast />
        </>
      )}
      <Sidebar />
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
                  // v291: Robust role-aware navigation for Offline/Shell environments
                  if (pathname.includes('/operador/proyecto')) {
                    router.push('/admin/operador');
                  } else if (pathname.includes('/subcontratista/proyecto')) {
                    router.push('/admin/subcontratista');
                  } else if (pathname.includes('/admin/proyectos/')) {
                    router.push('/admin/proyectos');
                  } else if (pathname.includes('/admin/cotizaciones/')) {
                    router.push('/admin/cotizaciones');
                  } else if (pathname.includes('/offline-shell')) {
                    const isOp = pathname.includes('/operador') || pathname.includes('/subcontratista');
                    router.push(isOp ? (pathname.includes('/subcontratista') ? '/admin/subcontratista' : '/admin/operador') : '/admin/proyectos');
                  } else {
                    // Fallback to back but prioritize explicit routes if available
                    if (pathname.startsWith('/admin/operador')) router.push('/admin/operador');
                    else if (pathname.startsWith('/admin/proyectos')) router.push('/admin/proyectos');
                    else router.back();
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
          {/* Fase 1: Suspense boundary — Sidebar/Header/Footer render INSTANTLY,
              page content shows skeleton while loading */}
          <Suspense fallback={
            <div style={{ padding: '24px' }}>
              <div style={{ height: '28px', width: '220px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: '180px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
            </div>
          }>
            {children}
          </Suspense>
        </OfflineErrorBoundary>
      </main>
    </div>
  )
}
