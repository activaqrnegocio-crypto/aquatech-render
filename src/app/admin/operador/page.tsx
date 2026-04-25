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
    // Fetch data in parallel
    const results = await Promise.all([
      prisma.project.findMany({
        where: {
          team: { some: { userId } },
          status: { in: ['LEAD', 'ACTIVO', 'PENDIENTE'] }
        },
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
          where: { userId },
          orderBy: { startTime: 'asc' },
          include: { project: { select: { title: true } } }
      }),
      prisma.projectView.findMany({
        where: { userId }
      })
    ])

    activeProjects = results[0]
    activeDayRecord = results[1]
    appointments = results[2]
    userViews = results[3]
  } catch (err) {
    console.warn("Offline or DB error, passing empty operator data to client for cache fallback")
  }

  // Calculate unread counts for each project
  const projectsWithUnread = await Promise.all(activeProjects.map(async (project: any) => {
    const view = userViews.find((v: any) => v.projectId === project.id);
    const lastSeen = view?.lastSeen || new Date(0);

    const unreadCount = await prisma.chatMessage.count({
      where: {
        projectId: project.id,
        userId: { not: userId },
        createdAt: { gt: lastSeen }
      }
    });

    return {
      ...project,
      unreadCount
    };
  }));

  // Build URLs for offline use
  const prefetchUrls = [
    ...activeProjects.map((p: any) => `/admin/operador/proyecto/${p.id}`),
    '/admin/operador/nuevo',
    '/admin/inventario',
    '/admin/cotizaciones',
    '/admin/cotizaciones/nuevo',
    '/admin/cotizaciones/offline',
    '/admin/recursos',
  ]

  return (
    <>
      <OfflinePrefetcher urls={prefetchUrls} />
      <OperatorDashboardClient 
        user={session.user}
        activeProjects={deepSerialize(projectsWithUnread)}
        activeDayRecord={deepSerialize(activeDayRecord)}
        appointments={deepSerialize(appointments)}
      />
    </>
  )
}
