'use client'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import GlobalSyncWorker from '@/components/GlobalSyncWorker'
import { Suspense, useEffect } from 'react'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const isDashboard = pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/operador' || pathname === '/admin/operador/'

  // ── Warm-up SW cache AFTER login (user has valid session cookies)
  useEffect(() => {
    if (isLoginPage) return; // Don't warm-up on login page
    if (!('serviceWorker' in navigator)) return;

    const warmUp = () => {
      if (!navigator.serviceWorker.controller) {
        // SW not yet active, retry
        setTimeout(warmUp, 2000);
        return;
      }

      const isOperator = pathname.includes('/operador');
      const isSubcon = pathname.includes('/subcontratista');

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
      console.log('[App] Warm-up cache sent (post-login) for', pages.length, 'pages');
    };

    // Wait 3s after mount to let the page fully load
    const timer = setTimeout(warmUp, 3000);
    return () => clearTimeout(timer);
  }, [isLoginPage, pathname]);

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <GlobalSyncWorker />
      <Suspense fallback={<div style={{ width: '260px', height: '100vh', background: 'var(--bg-card)' }} />}>
        <Sidebar />
      </Suspense>
      <main className="admin-content">
        {!isDashboard && (
          <div style={{ padding: '10px 20px 0 20px', marginBottom: '-10px' }}>
            <button 
              onClick={() => router.back()}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              <span>Volver</span>
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

