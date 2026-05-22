import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OperatorDashboardClient from './OperatorDashboardClient'

export const dynamic = 'force-dynamic'

// v282: Página ultra-ligera — solo autentica en servidor.
// Todas las queries de DB se hacen en el cliente vía API para eliminar
// la espera de 20-30s causada por queries lentas bloqueando el HTML inicial.
export default async function OperatorDashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/admin/login')
  }

  // Redirect admins to their dashboard
  if (session.user.role === 'ADMIN' || session.user.role === 'ADMINISTRADORA' || session.user.role === 'SUPERADMIN') {
    redirect('/admin')
  }

  // Redirect subcontratistas to their dashboard
  if (session.user.role === 'SUBCONTRATISTA') {
    redirect('/admin/subcontratista')
  }

  // Fase 9: Removed duplicated OfflinePrefetcher — AdminLayoutClient already handles prefetching
  return (
    <OperatorDashboardClient 
      user={session.user}
      activeProjects={[]}
      activeDayRecord={null}
      appointments={[]}
      userViews={[]}
    />
  )
}
