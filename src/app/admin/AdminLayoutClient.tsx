'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import GlobalSyncWorker from '@/components/GlobalSyncWorker'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <GlobalSyncWorker />
      <Sidebar />
      <main className="admin-content">
        {children}
      </main>
    </div>
  )
}
