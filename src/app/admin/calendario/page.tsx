import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminCalendarClient from './AdminCalendarClient'

export default async function AdminCalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const userRole = (session.user as any).role
  if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA' && userRole !== 'SUPERADMIN') {
    redirect('/admin')
  }

  const operators = await prisma.user.findMany({
    where: { 
      role: { in: ['OPERATOR', 'SUBCONTRATISTA'] },
      isActive: true
    },
    select: { id: true, name: true }
  })

  const projects = await prisma.project.findMany({
    where: { status: { not: 'CANCELADO' } },
    select: { id: true, title: true, status: true }
  })

  return <AdminCalendarClient operators={operators} projects={projects} />
}
