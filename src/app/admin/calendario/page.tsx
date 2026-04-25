import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminCalendarClient from './AdminCalendarClient'
import { isAdmin, hasModuleAccess } from '@/lib/rbac'

export default async function AdminCalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const userRole = (session.user as any).role
  const canAccess = isAdmin(userRole) || hasModuleAccess(session.user as any, 'calendario')

  if (!canAccess) {
    redirect('/admin')
  }

  let operators: any[] = []
  let projects: any[] = []

  try {
    operators = await prisma.user.findMany({
      where: { 
        role: { in: ['OPERATOR', 'SUBCONTRATISTA'] },
        isActive: true
      },
      select: { id: true, name: true }
    })

    projects = await prisma.project.findMany({
      where: { status: { not: 'CANCELADO' } },
      select: { id: true, title: true, status: true }
    })
  } catch (error) {
    console.warn("Offline or DB error, passing empty arrays to client for cache fallback")
  }

  return <AdminCalendarClient operators={operators} projects={projects} />
}
