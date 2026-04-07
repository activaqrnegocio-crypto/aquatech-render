import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin((session.user as any).role)) {
    redirect('/admin')
  }
  const projects = await prisma.project.findMany({
    where: { 
      status: { in: ['ACTIVO', 'PENDIENTE'] }
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-6">
      <div className="dashboard-header mb-lg">
        <div>
          <h2 className="page-title">Reportes y Bitácora</h2>
          <p className="page-subtitle">Resumen estadístico de bitácoras, horas trabajadas y avances de proyectos.</p>
        </div>
      </div>

      <ReportesClient initialProjects={projects} />
    </div>
  )
}
