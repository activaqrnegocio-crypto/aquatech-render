'use client'

import { useState, useMemo, useEffect } from 'react'
import { getLocalNow, formatToEcuador } from '@/lib/date-utils'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import Link from 'next/link'
import AppointmentModal from '@/components/Calendar/AppointmentModal'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { NotificationOnboarding } from '@/components/NotificationOnboarding'
import { IosInstallBanner } from '@/components/IosInstallBanner'
import { hasModuleAccess } from '@/lib/rbac'
import ProjectCacheManager from '@/components/ProjectCacheManager'
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
  const [activeTab, setActiveTab] = useState<'PROYECTOS' | 'TAREAS'>('TAREAS')
  const [appointments, setAppointments] = useState(initialAppointments)
  // Use Dexie as live source for projects to support offline correctly
  const projectsFromCache = useLiveQuery(
    async () => {
      const allProjects = await db.projectsCache.toArray()
      if (!user?.id) return []
      
      // Filtrar localmente para asegurar que solo vea los suyos
      return allProjects.filter(p => 
        p.team?.some((m: any) => m.userId === Number(user.id)) ||
        p.createdById === Number(user.id)
      )
    },
    [user?.id]
  ) || []

  // Combine initial projects with cache
  const projects = useMemo(() => {
    // If we have projects in cache, use them (they are more complete for offline)
    if (projectsFromCache.length > 0) return projectsFromCache
    return initialProjects
  }, [projectsFromCache, initialProjects])

  const [selectedTask, setSelectedTask] = useState<any>(null)

  const canManageCalendar = hasModuleAccess(user, 'calendario')

  // 1. Initial hydration and offline cache for appointments
  useEffect(() => {
    if (initialAppointments.length > 0) {
      localStorage.setItem('operator_appointments_cache', JSON.stringify(initialAppointments))
    } else {
      const cached = localStorage.getItem('operator_appointments_cache')
      if (cached) {
        try { setAppointments(JSON.parse(cached)) } catch (e) {}
      }
    }
  }, [initialAppointments])

  // 2. Local outbox tasks (created offline)
  const pendingTasksRaw = useLiveQuery(
    () => db.outbox.where('type').equals('TASK').toArray()
  ) || []
  
  const pendingStatusToggles = useLiveQuery(
    () => db.outbox.where('type').equals('TASK_STATUS_TOGGLE').toArray()
  ) || []

  // 3. Merge server appointments + local pending tasks + pending status toggles
  const allAppointments = useMemo(() => {
    let merged = [...appointments]

    // Apply pending status toggles
    pendingStatusToggles.forEach(toggle => {
      const idx = merged.findIndex(a => a.id === toggle.payload.appointmentId)
      if (idx !== -1) {
        merged[idx] = { ...merged[idx], status: toggle.payload.status }
      }
    })

    const pendingMapped = pendingTasksRaw.map(t => ({
      ...t.payload,
      id: `pending-${t.id}`, // pseudo-id
      status: t.payload.status || 'PENDIENTE',
      startTime: new Date(t.payload.startTime),
      endTime: new Date(t.payload.endTime),
      project: projects.find((p: any) => p.id === Number(t.payload.projectId)) || null,
      isOffline: true // flag for UI
    }))
    return [...merged, ...pendingMapped]
  }, [appointments, pendingTasksRaw, pendingStatusToggles, projects, user.id])

  const [pushDismissed, setPushDismissed] = useState(true)
  const { 
    status: pushStatus, 
    subscribe: pushSubscribe, 
    isSubscribing,
    showOnboarding,
    setShowOnboarding 
  } = usePushNotifications()

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
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      
      try {
        const [projRes, appRes] = await Promise.all([
          fetch('/api/operator/projects'),
          fetch(`/api/appointments?userId=${user.id}`)
        ])

        if (projRes.ok) {
          const freshProjects = await projRes.json()
          // Update cache with fresh basic data if we are online
          if (freshProjects.length > 0) {
             for (const p of freshProjects) {
               const existing = await db.projectsCache.get(p.id)
               await db.projectsCache.put({ 
                 ...(existing || {}), 
                 ...p, 
                 lastAccessedAt: Date.now() 
               })
             }
          }
        }
        if (appRes.ok) {
          const freshApps = await appRes.json()
          setAppointments(freshApps)
        }
      } catch (err) {
        console.error('Error polling operator data:', err)
      }
    }
    
    const interval = setInterval(fetchAllData, 10000) // Slower poll to avoid excessive DB writes
    return () => clearInterval(interval)
  }, [user.id])

  // Redundant sync removed - Handled by GlobalSyncWorker

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
    return allAppointments
      .filter(a => {
        const d = new Date(a.startTime)
        return d.getDate() === today.getDate() && 
               d.getMonth() === today.getMonth() && 
               d.getFullYear() === today.getFullYear()
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [allAppointments])

  const fetchAppointments = async () => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem('operator_appointments_cache')
      if (cached) {
        try { setAppointments(JSON.parse(cached)) } catch (e) {}
      }
      return
    }
    try {
      const res = await fetch(`/api/appointments?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data)
        localStorage.setItem('operator_appointments_cache', JSON.stringify(data))
      }
    } catch (err) {
      console.warn("Failed to fetch appointments, falling back to cache")
    }
  }



  const toggleStatus = async (task: any) => {
    if (task.isOffline) {
      alert('Esta tarea aún no se ha sincronizado con el servidor. Por favor, espera a tener conexión para marcarla como completada.')
      return
    }

    const newStatus = task.status === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'

    // Actualización optimista local
    setAppointments(prev => prev.map(a => a.id === task.id ? { ...a, status: newStatus } : a))
    if (selectedTask && selectedTask.id === task.id) {
      setSelectedTask({ ...selectedTask, status: newStatus })
    }

    if (!navigator.onLine) {
      await db.outbox.add({
        type: 'TASK_STATUS_TOGGLE',
        projectId: task.project?.id || 0,
        payload: { appointmentId: task.id, status: newStatus },
        timestamp: Date.now(),
        status: 'pending'
      })
      return
    }

    try {
      const res = await fetch(`/api/appointments/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        await fetchAppointments()
      } else {
        // Revertir en caso de error
        await fetchAppointments() 
      }
    } catch (e) {
      // Offline fallback: Revertir si falló
      await fetchAppointments()
    }
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

      {/* iOS Install Guide (Only if needed) */}
      <IosInstallBanner />

      {/* Sync Manager for Offline (Available for Operators too) */}
      <div style={{ marginTop: '15px' }}>
        <ProjectCacheManager />
      </div>

      {/* Notification Onboarding Modal */}
      {showOnboarding && (
        <NotificationOnboarding onDone={() => setShowOnboarding(false)} />
      )}

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
        {canManageCalendar && (
          <Link 
            href="/admin/calendario"
            className="tab" 
            style={{ 
              flex: 1, 
              padding: '10px 4px', 
              fontSize: '0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: 'var(--text-muted)'
            }}
          >
             <CalendarIcon size={14} /> 
             <span style={{ whiteSpace: 'nowrap' }}>
               Agenda <span className="d-none d-md-inline">Semanal</span>
             </span>
          </Link>
        )}
      </div>

      {/* Action header depending on active tab */}


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
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>{project.title}</h3>
                      {(project.city || project.client?.city) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          📍 {project.city || project.client?.city}
                        </div>
                      )}
                    </div>
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


      </div>

      {/* MODAL DETALLES DE TAREA (Multimedia support) */}
      {selectedTask && (
        <AppointmentModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={async (data) => {
            // Reutilizar la lógica de toggleStatus o similar para guardar cambios del operador
            try {
              const res = await fetch(`/api/appointments/${data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              })
              if (res.ok) {
                await fetchAppointments()
                setSelectedTask(null)
              } else {
                alert('Error al actualizar tarea')
              }
            } catch (e) {
              alert('Error de conexión')
            }
          }}
          initialData={selectedTask}
          userId={Number(user.id)}
          projects={projects}
          operators={[user]} // El operador solo se ve a sí mismo generalmente
          isAdminView={false}
        />
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
