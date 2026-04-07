import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SubcontratistaDashboardClient from './SubcontratistaDashboardClient'
import { deepSerialize } from '@/lib/serializable'

export const dynamic = 'force-dynamic'

export default async function SubcontratistaDashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/admin/login')
  }

  // Redirect admins to their dashboard
  if (session.user.role === 'ADMIN' || session.user.role === 'ADMINISTRADORA' || session.user.role === 'SUPERADMIN') {
    redirect('/admin')
  }

  // Redirect operators to their own dashboard
  if (session.user.role === 'OPERATOR') {
    redirect('/admin/operador')
  }

  const userId = Number(session.user.id)

  // Fetch data in parallel — only projects, appointments (tasks), and active day record
  const [activeProjects, activeDayRecord, appointments] = await Promise.all([
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
    })
  ])

  return (
    <SubcontratistaDashboardClient 
      user={session.user}
      activeProjects={deepSerialize(activeProjects)}
      activeDayRecord={deepSerialize(activeDayRecord)}
      appointments={deepSerialize(appointments)}
    />
  )
}
