'use client'

import { useState, useMemo, useEffect } from 'react'
import { getLocalNow, formatToEcuador } from '@/lib/date-utils'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import Link from 'next/link'
import CalendarView from '@/components/Calendar/CalendarView'
import { usePushNotifications } from '@/hooks/usePushNotifications'
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
const MessageCircle = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>

interface OperatorDashboardClientProps {
  user: any
  activeProjects: any[]
  activeDayRecord: any
  appointments: any[]
}

export default function OperatorDashboardClient({
  user,
  activeProjects: initialProjects,
  activeDayRecord,
  appointments: initialAppointments
}: OperatorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'PROYECTOS' | 'TAREAS' | 'CALENDARIO'>('TAREAS')
  const [appointments, setAppointments] = useState(initialAppointments)
  const [projects, setProjects] = useState(initialProjects)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [pushDismissed, setPushDismissed] = useState(true)
  const { status: pushStatus, subscribe: pushSubscribe, isSubscribing } = usePushNotifications()

  // Show push banner if not subscribed and not recently dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('push_dismissed')
    if (dismissed) {
      const dismissedAt = Number(dismissed)
      // Show again after 7 days
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        setPushDismissed(false)
      }
    } else {
      setPushDismissed(false)
    }
  }, [])

  // Polling for live project updates
  useEffect(() => {
    const fetchAllData = async () => {
      // Solo hacer el request si la pestaña está activa para no saturar la base de datos
      if (document.visibilityState !== 'visible') return;
      
      try {
        const [projRes, appRes] = await Promise.all([
          fetch('/api/operator/projects'),
          fetch(`/api/appointments?userId=${user.id}`)
        ])

        if (projRes.ok) {
          const freshProjects = await projRes.json()
          setProjects(freshProjects)
        }
        if (appRes.ok) {
          const freshApps = await appRes.json()
          setAppointments(freshApps)
        }
      } catch (err) {
        console.error('Error polling operator data:', err)
      }
    }
    
    // Polling cada 5 segundos para mantener la agenda y proyectos actualizados
    const interval = setInterval(fetchAllData, 5000)
    return () => clearInterval(interval)
  }, [user.id])

  // Syncing projects from Outbox
  useEffect(() => {
    const syncOutboxProject = async () => {
      if (!navigator.onLine) return
      
      const pendingProjects = await db.outbox.where('type').equals('PROJECT').toArray()
      if (pendingProjects.length === 0) return

      for (const item of pendingProjects) {
        try {
          const resp = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          })
          
          if (resp.ok) {
            await db.outbox.delete(item.id!)
            // Re-fetch projects to show the new one
            const projRes = await fetch('/api/operator/projects')
            if (projRes.ok) {
              const freshProjects = await projRes.json()
              setProjects(freshProjects)
            }
          }
        } catch (err) {
          console.error('Failed to sync offline project from outbox:', err)
        }
      }
    }

    syncOutboxProject()
    window.addEventListener('online', syncOutboxProject)
    return () => window.removeEventListener('online', syncOutboxProject)
  }, [])

  // Legacy localStorage Cleanup (One-time)
  useEffect(() => {
    const legacy = localStorage.getItem('offlineProjects')
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy)
        parsed.forEach(async (p: any) => {
          await db.outbox.add({
            type: 'PROJECT',
            projectId: 0,
            payload: p.payload,
            timestamp: Date.now(),
            status: 'pending'
          })
        })
        localStorage.removeItem('offlineProjects')
      } catch (e) {}
    }
  }, [])

  const totalUnread = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.unreadCount || 0), 0)
  }, [projects])

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
            <h1 className="page-title">Hola, {user.name.split(' ')[0]}</h1>
            <p className="page-subtitle">Panel de Control de Operaciones</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <Link href="/admin/operador/nuevo" className="btn btn-secondary">
               Crear Proyecto
             </Link>
          </div>
        </div>
        {/* activeDayRecord && (
          <div className="active-day-badge" style={{ marginTop: '15px' }}>
            <span className="pulse-dot"></span>
            Día Iniciado en: {activeDayRecord.project.title}
          </div>
        ) */}
      </div>

      {/* Push Notification Banner */}
      {pushStatus !== 'subscribed' && pushStatus !== 'unsupported' && pushStatus !== 'denied' && pushStatus !== 'loading' && !pushDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, #0070c0, #38bdf8)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          flexWrap: 'wrap',
          margin: '15px 0 0 0',
          boxShadow: '0 4px 20px rgba(0, 112, 192, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '1.8rem' }}>🔔</span>
            <div>
              <p style={{ margin: 0, color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Activa las Notificaciones</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>Recibe alertas de mensajes, tareas y proyectos en tu celular</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={async () => {
                const ok = await pushSubscribe()
                if (ok) setPushDismissed(true)
              }}
              disabled={isSubscribing}
              style={{
                backgroundColor: 'white',
                color: '#0070c0',
                fontWeight: 'bold',
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {isSubscribing ? 'Activando...' : '✓ Activar'}
            </button>
            <button
              onClick={() => {
                localStorage.setItem('push_dismissed', String(Date.now()))
                setPushDismissed(true)
              }}
              style={{
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Luego
            </button>
          </div>
        </div>
      )}

      <div className="tabs tabs-nowrap" style={{ 
        marginTop: 'var(--space-lg)', 
        display: 'flex', 
        width: '100%', 
        gap: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button 
          className={`tab ${activeTab === 'TAREAS' ? 'active' : ''}`} 
          onClick={() => setActiveTab('TAREAS')}
          style={{ 
            flex: 1, 
            padding: '10px 4px', 
            fontSize: '0.75rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px'
          }}
        >
           <ListTodo size={14} /> 
           <span style={{ whiteSpace: 'nowrap' }}>
             Tareas <span className="d-none d-md-inline">de Hoy</span> ({todayTasks.length})
           </span>
        </button>
        <button 
          className={`tab ${activeTab === 'PROYECTOS' ? 'active' : ''}`} 
          onClick={() => setActiveTab('PROYECTOS')}
          style={{ 
            flex: 1, 
            padding: '10px 4px', 
            fontSize: '0.75rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px',
            position: 'relative'
          }}
        >
           <Briefcase size={14} /> 
           <span style={{ whiteSpace: 'nowrap' }}>
             <span className="d-none d-md-inline">Mis</span> Proyectos ({projects.length})
           </span>
           {totalUnread > 0 && (
             <span className="tab-badge" style={{ position: 'static', marginLeft: '4px', transform: 'none' }}>
               {totalUnread}
             </span>
           )}
        </button>
        <button 
          className={`tab ${activeTab === 'CALENDARIO' ? 'active' : ''}`} 
          onClick={() => setActiveTab('CALENDARIO')}
          style={{ 
            flex: 1, 
            padding: '10px 4px', 
            fontSize: '0.75rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px'
          }}
        >
           <CalendarIcon size={14} /> 
           <span style={{ whiteSpace: 'nowrap' }}>
             Agenda <span className="d-none d-md-inline">Semanal</span>
           </span>
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
                <div 
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => setSelectedTask(task)}
                >
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
            {projects.map(project => {
              const completedPhases = project.phases.filter((p: any) => p.status === 'COMPLETADA').length
              const totalPhases = project.phases.length
              const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
              
              return (
                <Link href={`/admin/operador/proyecto/${project.id}`} key={project.id} className="card interactive" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
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
          </div>
        )}

        {activeTab === 'CALENDARIO' && (
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <CalendarView 
              events={appointments}
              isAdmin={false}
              onAddEvent={() => {}}
              onEditEvent={(evt) => setSelectedTask(evt)}
              viewMode="WEEK"
            />
          </div>
        )}
      </div>

      {/* MODAL DETALLES DE TAREA */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', padding: '24px', borderRadius: '16px', background: 'var(--bg-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--brand-primary)' }}>Detalle de Tarea</h2>
              <button 
                onClick={() => setSelectedTask(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>TÍTULO</strong>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '4px' }}>{selectedTask.title}</div>
            </div>

            {selectedTask.description && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>DESCRIPCIÓN O NOTAS</strong>
                <div style={{ 
                  marginTop: '4px', 
                  whiteSpace: 'pre-wrap', 
                  color: 'var(--text)', 
                  fontSize: '0.95rem', 
                  background: 'var(--bg-surface)', 
                  padding: '12px', 
                  borderRadius: '8px',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere'
                }}>
                  {selectedTask.description}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>HORA DE INICIO</strong>
                <div style={{ marginTop: '4px', fontSize: '0.95rem' }}>{formatToEcuador(selectedTask.startTime, { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>HORA DE FIN</strong>
                <div style={{ marginTop: '4px', fontSize: '0.95rem' }}>{formatToEcuador(selectedTask.endTime, { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>

            {selectedTask.project && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>PROYECTO ASOCIADO</strong>
                <div style={{ marginTop: '4px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={16} /> {selectedTask.project.title}
                </div>
              </div>
            )}

            {selectedTask.location && (
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>UBICACIÓN</strong>
                <div style={{ marginTop: '4px', fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>📍</span> 
                  <span>{selectedTask.location}</span>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span className={`badge ${selectedTask.status === 'COMPLETADA' ? 'badge-success' : 'badge-warning'}`}>
                 Estado: {selectedTask.status}
               </span>
               <button 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedTask(null)}
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
               >
                 Cerrar
               </button>
            </div>
          </div>
        </div>
      )}
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
  )
}
