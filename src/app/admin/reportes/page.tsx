import { prisma } from '@/lib/prisma'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
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
