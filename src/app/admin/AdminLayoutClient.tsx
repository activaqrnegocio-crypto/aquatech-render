'use client'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import GlobalSyncWorker from '@/components/GlobalSyncWorker'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import { Suspense } from 'react'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const isDashboard = pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/operador' || pathname === '/admin/operador/'

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <ServiceWorkerRegistration />
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
