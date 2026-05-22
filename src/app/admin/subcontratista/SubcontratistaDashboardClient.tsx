'use client'

import { useState, useMemo } from 'react'
import { getLocalNow, formatToEcuador } from '@/lib/date-utils'
import Link from 'next/link'
import CalendarView from '@/components/Calendar/CalendarView'

// Inline SVG icons to match project pattern
const svgProps = (size: number, style?: React.CSSProperties, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', ...style }, className
})

const Briefcase = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
const CalendarIcon = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>
const CheckCircle2 = ({ size = 24, style, className, fill = 'none' }: any) => <svg {...svgProps(size, style, className)} fill={fill}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
const Clock = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const ListTodo = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 10 2 2 4-4"/><path d="M7 16h10"/></svg>
const Plus = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M12 5v14M5 12h14"/></svg>
const HardHat = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 15V6a2 2 0 0 1 4 0v9"/><path d="M4 15v-3a6 6 0 0 1 6-6h0"/><path d="M14 6a6 6 0 0 1 6 6v3"/></svg>

interface SubcontratistaDashboardClientProps {
  user: any
  activeProjects: any[]
  activeDayRecord: any
  appointments: any[]
}

export default function SubcontratistaDashboardClient({
  user,
  activeProjects,
  activeDayRecord,
  appointments: initialAppointments
}: SubcontratistaDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'PROYECTOS' | 'TAREAS' | 'CALENDARIO'>('TAREAS')
  const [appointments, setAppointments] = useState(initialAppointments)

  const totalUnread = useMemo(() => {
    return activeProjects.reduce((acc, p) => acc + (p.unreadCount || 0), 0)
  }, [activeProjects])

  const todayTasks = useMemo(() => {
    const today = getLocalNow()
    return appointments
      .filter(a => {
        const d = new Date(a.startTime)
        return d.getDate() === today.getDate() && 
               d.getMonth() === today.getMonth() && 
               d.getFullYear() === today.getFullYear()
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [appointments])

  const fetchAppointments = async () => {
    const res = await fetch(`/api/appointments?userId=${user.id}`)
    if (res.ok) setAppointments(await res.json())
  }

  const toggleStatus = async (task: any) => {
    const newStatus = task.status === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'
    const res = await fetch(`/api/appointments/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    if (res.ok) await fetchAppointments()
  }

  return (
    <div className="operator-dashboard">
      <div className="operator-header">
        <div className="operator-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardHat size={28} style={{ color: 'var(--warning)' }}/> Hola, {user.name.split(' ')[0]}
            </h1>
            <p className="page-subtitle">Panel de Subcontratista</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             {/* Read-only calendar for subcontractors */}
          </div>
        </div>
        {activeDayRecord && (
          <div className="active-day-badge" style={{ marginTop: '15px' }}>
            <span className="pulse-dot"></span>
            Día Iniciado en: {activeDayRecord.project.title}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginTop: 'var(--space-lg)' }}>
        <button className={`tab ${activeTab === 'TAREAS' ? 'active' : ''}`} onClick={() => setActiveTab('TAREAS')}>
           <ListTodo size={16} style={{marginRight: '8px'}}/> Tareas de Hoy ({todayTasks.length})
        </button>
        <button className={`tab ${activeTab === 'PROYECTOS' ? 'active' : ''}`} onClick={() => setActiveTab('PROYECTOS')}>
           <Briefcase size={16} style={{marginRight: '8px'}}/> Mis Trabajos ({activeProjects.length})
           {totalUnread > 0 && <span className="tab-badge">{totalUnread}</span>}
        </button>
        <button className={`tab ${activeTab === 'CALENDARIO' ? 'active' : ''}`} onClick={() => setActiveTab('CALENDARIO')}>
           <CalendarIcon size={16} style={{marginRight: '8px'}}/> Agenda Semanal
        </button>
      </div>

      <div className="tab-content" style={{ marginTop: 'var(--space-md)' }}>
        {activeTab === 'TAREAS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {todayTasks.length > 0 ? todayTasks.map(task => (
              <div key={task.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
                <button 
                  onClick={() => toggleStatus(task)}
                  style={{ background: 'none', border: 'none', color: task.status === 'COMPLETADA' ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <CheckCircle2 size={24} fill={task.status === 'COMPLETADA' ? 'var(--success-bg)' : 'none'}/>
                </button>
                <div style={{ flex: 1 }}>
                   <h3 style={{ margin: 0, fontSize: '1.1rem', textDecoration: task.status === 'COMPLETADA' ? 'line-through' : 'none', opacity: task.status === 'COMPLETADA' ? 0.6 : 1 }}>
                     {task.title}
                   </h3>
                   <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12}/> {formatToEcuador(task.startTime, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {task.project && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Briefcase size={12}/> {task.project.title}
                        </span>
                      )}
                   </div>
                </div>
                <span className={`badge ${task.status === 'COMPLETADA' ? 'badge-success' : 'badge-warning'}`}>
                   {task.status}
                </span>
              </div>
            )) : (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: 'var(--text-muted)' }}>No tienes tareas agendadas para hoy.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'PROYECTOS' && (
          <div className="grid-responsive">
            {activeProjects.map(project => {
              const completedPhases = project.phases.filter((p: any) => p.status === 'COMPLETADA').length
              const totalPhases = project.phases.length
              const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
              
              return (
                <Link href={`/admin/subcontratista/proyecto/${project.id}`} key={project.id} className="card interactive" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <span className={`status-badge status-${project.status.toLowerCase()}`}>
                      {project.status}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{project.phases.length} fases</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', flex: 1 }}>{project.title}</h3>
                    {project.unreadCount > 0 && (
                      <span className="unread-dot-badge" title="Mensajes sin leer">
                        {project.unreadCount}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <div className="progress-bar" style={{ height: '4px' }}>
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                </Link>
              )
            })}
            {activeProjects.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                <HardHat size={48} style={{ color: 'var(--text-muted)', marginBottom: '15px' }}/>
                <p style={{ color: 'var(--text-muted)' }}>No tienes proyectos asignados actualmente.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'CALENDARIO' && (
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <CalendarView 
              events={appointments}
              isAdmin={false}
              onAddEvent={() => {}}
              onEditEvent={() => {}}
              viewMode="WEEK"
            />
            <style jsx>{`
        .tab-badge {
          background: var(--danger);
          color: white;
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 8px;
          font-weight: bold;
        }
        .unread-dot-badge {
          background: var(--danger);
          color: white;
          font-size: 0.75rem;
          min-width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          margin-left: 10px;
        }
      `}</style>
    </div>
        )}
      </div>
    </div>
  )
}
