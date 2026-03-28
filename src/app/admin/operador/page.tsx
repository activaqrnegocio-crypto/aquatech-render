import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import OfflinePrefetcher from '@/components/OfflinePrefetcher'

export const dynamic = 'force-dynamic'

export default async function OperatorDashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/admin/login')
  }

  // Redirect admins to their dashboard
  if (session.user.role === 'ADMIN') {
    redirect('/admin')
  }

  const userId = Number(session.user.id)

  const activeProjects = await prisma.project.findMany({
    where: {
      team: { some: { userId } },
      status: { in: ['ACTIVO', 'PENDIENTE'] }
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      client: { select: { name: true, city: true, address: true } },
      phases: { 
        orderBy: { displayOrder: 'asc' },
        select: { id: true, title: true, status: true } 
      },
    }
  })

  // Get active day record if exists
  const activeDayRecord = await prisma.dayRecord.findFirst({
    where: {
      userId,
      endTime: null
    },
    include: {
      project: { select: { title: true } }
    }
  })

  // Build URLs to pre-cache for offline use
  const prefetchUrls = [
    ...activeProjects.map(p => `/admin/operador/proyecto/${p.id}`),
    '/admin/inventario',
    '/admin/cotizaciones',
    '/admin/cotizaciones/nuevo',
    '/admin/cotizaciones/offline',
    '/admin/recursos',
  ]

  return (
    <div className="operator-dashboard">
      {/* Pre-cache project pages for offline access */}
      <OfflinePrefetcher urls={prefetchUrls} />

      <div className="operator-header">
        <div className="operator-welcome">
          <h1 className="page-title">Hola, {session.user.name.split(' ')[0]}</h1>
          <p className="page-subtitle">Aquí están tus proyectos asignados para hoy.</p>
        </div>
        {activeDayRecord && (
          <div className="active-day-badge">
            <span className="pulse-dot"></span>
            Día Iniciado en: {activeDayRecord.project.title}
          </div>
        )}
      </div>

      <div className="grid-responsive">
        {activeProjects.map(project => {
          const completedPhases = project.phases.filter(p => p.status === 'COMPLETADA').length
          const totalPhases = project.phases.length
          const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
          
          return (
            <Link href={`/admin/operador/proyecto/${project.id}`} prefetch={true} key={project.id} className="card interactive" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <span className={`status-badge status-${project.status.toLowerCase()}`}>
                  {project.status === 'ACTIVO' ? 'Activo' : 'Pendiente'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{project.phases.length} fases</span>
              </div>
              
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: 'var(--text)' }}>{project.title}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {project.client?.city || 'Sin ciudad'}{project.client?.address ? `, ${project.client.address.substring(0, 20)}...` : ''}
              </div>

              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progreso global</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{progress}%</span>
                </div>
                <div className="progress-bar" style={{ height: '6px' }}>
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </Link>
          )
        })}

        {activeProjects.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--text-muted)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 style={{ margin: '0 0 10px 0' }}>No tienes proyectos activos</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>El administrador aún no te ha asignado a ningún proyecto en curso.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
