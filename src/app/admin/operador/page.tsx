import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import OperatorDashboardClient from './OperatorDashboardClient'
import OfflinePrefetcher from '@/components/OfflinePrefetcher'
import { deepSerialize } from '@/lib/serializable'

export const dynamic = 'force-dynamic'

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

  const userId = Number(session.user.id)

  let activeProjects: any[] = []
  let activeDayRecord: any = null
  let appointments: any[] = []
  let userViews: any[] = []

  try {
    // v224: Parallel fetching without unread counts (faster response)
    const results = await Promise.all([
      prisma.project.findMany({
        where: {
          team: { some: { userId } },
          status: { in: ['LEAD', 'ACTIVO', 'PENDIENTE', 'COMPLETADO'] }
        },
        take: 30, // Increased slightly but kept fast
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          client: { select: { name: true, city: true, address: true } },
          phases: { 
            orderBy: { displayOrder: 'asc' },
            select: { id: true, title: true, status: true } 
          },
        }
      }),
      prisma.dayRecord.findFirst({
          where: { userId, endTime: null },
          include: { project: { select: { title: true } } }
      }),
      prisma.appointment.findMany({
          where: { 
            userId,
            startTime: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } // Last 7 days and future
          },
          orderBy: { startTime: 'asc' },
          take: 40,
          include: { project: { select: { title: true } } }
      }),
      prisma.projectView.findMany({
        where: { userId },
        orderBy: { lastSeen: 'desc' },
        take: 50 // Limit to recent views for performance
      })
    ])

    activeProjects = results[0]
    activeDayRecord = results[1]
    appointments = results[2]
    userViews = results[3]
  } catch (err) {
    console.warn("DB error in operator page", err)
  }

  // Build URLs for offline use
  const prefetchUrls = [
    '/admin/operador',
    '/admin/operador/proyecto/offline-shell',
    ...activeProjects.map((p: any) => `/admin/operador/proyecto/${p.id}`),
    '/admin/operador/nuevo',
    '/admin/inventario',
    '/admin/cotizaciones',
    '/admin/cotizaciones/nuevo',
    '/admin/cotizaciones/offline',
  ]

  return (
    <>
      <OfflinePrefetcher urls={prefetchUrls} />
      <OperatorDashboardClient 
        user={session.user}
        activeProjects={deepSerialize(activeProjects)}
        activeDayRecord={deepSerialize(activeDayRecord)}
        appointments={deepSerialize(appointments)}
        userViews={deepSerialize(userViews)}
      />
    </>
  )
}
