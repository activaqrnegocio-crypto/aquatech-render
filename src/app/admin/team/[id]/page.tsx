import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  
  if (isNaN(userId)) return notFound()

  // 1. Fetch User
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      projectTeams: { include: { project: true } }
    }
  })

  if (!user) return notFound()

  // 2. Fetch Activities
  const [dayRecords, expenses, projects, quotes] = await Promise.all([
    prisma.dayRecord.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, include: { project: true } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, include: { project: true } }),
    prisma.project.findMany({ where: { createdBy: userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.quote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
  ])

  // Process activities into a unified timeline
  const activities: any[] = []

  dayRecords.forEach(dr => {
    activities.push({
      type: 'WORK_LOG',
      date: dr.createdAt,
      title: `Jornada Laboral en ${dr.project.title}`,
      description: `Ingresó a las ${new Date(dr.startTime).toLocaleTimeString()}${dr.endTime ? ` - Salió a las ${new Date(dr.endTime).toLocaleTimeString()}` : ' (Sin cierre)'}`,
      color: 'var(--primary)'
    })
  })

  expenses.forEach(ex => {
    activities.push({
      type: 'EXPENSE',
      date: ex.createdAt,
      title: `Gasto Registrado: $${Number(ex.amount).toFixed(2)}`,
      description: `${ex.description || 'Sin descripción'} en ${ex.project.title}`,
      color: 'var(--danger)'
    })
  })

  projects.forEach(pr => {
    activities.push({
      type: 'PROJECT',
      date: pr.createdAt,
      title: `Proyecto Creado: ${pr.title}`,
      description: `Estado: ${pr.status}`,
      color: 'var(--success)'
    })
  })

  quotes.forEach(qt => {
    activities.push({
      type: 'QUOTE',
      date: qt.createdAt,
      title: `Presupuesto Generado #${qt.id}`,
      description: `Total: $${Number(qt.totalAmount).toFixed(2)} - Estado: ${qt.status}`,
      color: 'var(--warning)'
    })
  })

  activities.sort((a, b) => b.date.getTime() - a.date.getTime())

  const statusColor = user.role === 'ADMIN' ? 'var(--success)' : (user.role === 'ADMINISTRADORA' ? 'var(--info)' : 'var(--primary)')

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link href="/admin/team" className="btn btn-secondary">
          &larr; Volver al Equipo
        </Link>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>Perfil del Miembro</h2>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px', background: `linear-gradient(135deg, var(--bg-card), ${statusColor}10)` }}>
        <div style={{ 
            width: '80px', height: '80px', borderRadius: '24px', 
            backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '2rem', color: statusColor, fontWeight: 'bold', border: `2px solid ${statusColor}20` 
        }}>
          {user.image ? <img src={user.image} style={{width: '100%', height: '100%', borderRadius: '22px', objectFit: 'cover'}} /> : user.name.substring(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', backgroundColor: `${statusColor}20`, color: statusColor, fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
            {user.role}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold' }}>{user.name}</h1>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {user.phone && <span>📞 {user.phone}</span>}
            {user.email && <span>📧 {user.email}</span>}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.4rem', marginBottom: '20px', fontWeight: 'bold' }}>Bitácora de Movimientos</h3>
      {activities.length > 0 ? (
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: '0', 
          borderLeft: '2px solid var(--border-color)', marginLeft: '15px' 
        }}>
          {activities.map((act, i) => (
            <div key={i} style={{ position: 'relative', paddingLeft: '30px', paddingBottom: '30px' }}>
              <div style={{ 
                position: 'absolute', left: '-9px', top: '0', 
                width: '16px', height: '16px', borderRadius: '50%', 
                backgroundColor: act.color, border: '3px solid var(--bg-deep)' 
              }} />
              
              <div className="card" style={{ padding: '15px 20px', marginTop: '-8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.05rem', fontWeight: '600' }}>{act.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(act.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{act.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '40px', color: 'var(--text-muted)' }}>
          Este miembro aún no ha registrado ninguna actividad en el sistema.
        </div>
      )}
    </div>
  )
}
