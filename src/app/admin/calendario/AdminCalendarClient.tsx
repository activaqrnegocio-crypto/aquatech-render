'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import CalendarView from '@/components/Calendar/CalendarView'
import AppointmentModal from '@/components/Calendar/AppointmentModal'
import CalendarAssistant from '@/components/Calendar/CalendarAssistant'

interface AdminCalendarClientProps {
  operators: any[]
  projects: any[]
  isAdmin?: boolean
  userId?: number
}

export default function AdminCalendarClient({ 
  operators, 
  projects, 
  isAdmin = true, 
  userId = 0 
}: AdminCalendarClientProps) {
  const [cachedOperators, setCachedOperators] = useState<any[]>(operators)
  const [cachedProjects, setCachedProjects] = useState<any[]>(projects)
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(isAdmin ? 'all' : userId.toString())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initCache() {
      // Handle Operators Cache
      if (operators.length > 0) {
        setCachedOperators(operators)
        localStorage.setItem('admin_calendar_operators', JSON.stringify(operators))
      } else {
        const cached = localStorage.getItem('admin_calendar_operators')
        if (cached) { try { setCachedOperators(JSON.parse(cached)) } catch(e){} }
      }

      // Handle Projects Cache (Dexie)
      if (projects.length > 0) {
        setCachedProjects(projects)
        // Update cache without clearing to preserve full data from other pages
        await db.projectsCache.bulkPut(projects)
      } else {
        const cached = await db.projectsCache.toArray()
        if (cached.length > 0) setCachedProjects(cached)
      }
    }
    initCache()
  }, [operators, projects])

  const fetchAppointments = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const url = `/api/appointments?userId=${selectedOperatorId}`
      const res = await fetch(url)
      
      if (res.ok) {
        const data = await res.json()
        setAppointments(data)
        // Cache to Dexie only for "all" to avoid incomplete caches
        if (selectedOperatorId === 'all') {
          await db.appointmentsCache.clear()
          await db.appointmentsCache.bulkPut(data)
        }
      } else {
        // Fallback to cache if offline/error
        const cached = await db.appointmentsCache.toArray()
        if (cached.length > 0) {
          const filtered = selectedOperatorId === 'all' 
            ? cached 
            : cached.filter((a: any) => a.userId === Number(selectedOperatorId))
          setAppointments(filtered)
        }
      }
    } catch (error) {
      console.error('Error fetching appointments (falling back to cache):', error)
      const cached = await db.appointmentsCache.toArray()
      if (cached.length > 0) {
        const filtered = selectedOperatorId === 'all' 
          ? cached 
          : cached.filter((a: any) => a.userId === Number(selectedOperatorId))
        setAppointments(filtered)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Effect to load cache immediately if offline
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      db.appointmentsCache.toArray().then(cached => {
        if (cached.length > 0 && appointments.length === 0) {
          setAppointments(cached)
          setLoading(false)
        }
      })
    }
  }, [])

  // --- OFFLINE SUPPORT ---
  const pendingTasks = useLiveQuery(
    () => db.outbox.where('type').equals('TASK').toArray(),
    []
  ) || []

  const allAppointments = useMemo(() => {
    const pending = pendingTasks.map(item => ({
      ...item.payload,
      id: `pending-${item.id}`,
      isPending: true,
      status: 'PENDING'
    }))
    return [...appointments, ...pending]
  }, [appointments, pendingTasks])

  useEffect(() => {
    fetchAppointments()

    const handleRefresh = () => fetchAppointments(true)
    window.addEventListener('calendar-refresh', handleRefresh)
    return () => window.removeEventListener('calendar-refresh', handleRefresh)
  }, [selectedOperatorId])

  const handleSaveAppointment = async (data: any) => {
    const isNew = !data.id
    const url = isNew ? '/api/appointments' : `/api/appointments/${data.id}`
    const method = isNew ? 'POST' : 'PATCH'

    // Build payload — include userIds for multi-assignment on create
    const payload: any = { ...data }
    if (isNew && data.userIds && Array.isArray(data.userIds)) {
      payload.userIds = data.userIds
    }

    // Offline interceptor
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await db.outbox.add({
          type: 'TASK',
          projectId: Number(payload.projectId) || 0,
          payload: { ...payload, isNew },
          timestamp: Date.now(),
          status: 'pending'
        })
        setIsModalOpen(false)
        
        // Register background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register('sync-outbox');
          } catch (e) {
            console.warn('Sync registration failed:', e);
          }
        }

        alert('Tarea guardada localmente. Se sincronizará y notificará a los operadores cuando vuelvas a tener internet.')
        return
      } catch (err) {
        console.error('Error saving task offline:', err)
        alert('Error al guardar localmente')
        return
      }
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      setIsModalOpen(false)
      fetchAppointments()
    }
  }

  const handleDeleteAppointment = async (id: number) => {
    // Optimistic UI update
    const previousAppointments = [...appointments]
    setAppointments(prev => prev.filter(a => a.id !== id))
    setIsModalOpen(false)

    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('Failed to delete')
      }
      // Silently refresh in background to ensure sync
      fetchAppointments(true)
    } catch (error) {
      console.error('Error deleting appointment:', error)
      alert('No se pudo eliminar la tarea. Se restaurará en el calendario.')
      setAppointments(previousAppointments)
    }
  }

  return (
    <div className="admin-calendar-page animate-fade-in">
      <div className="page-header calendar-header-mobile">
        <div>
          <h1 className="page-title">Calendario Maestro</h1>
          <p className="page-subtitle">Gestión centralizada de tareas y agenda del equipo</p>
        </div>
        <button className="btn btn-primary add-task-btn" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}>
          + Agendar
        </button>
      </div>

      <div className="card mb-lg calendar-card" style={{ marginTop: 'var(--space-md)' }}>
        {isAdmin && (
          <div className="filter-container">
             <label className="filter-label">Filtrar por Operador:</label>
             <select 
               className="form-select operator-select" 
               value={selectedOperatorId}
               onChange={(e) => setSelectedOperatorId(e.target.value)}
             >
               <option value="all">Todos los operadores</option>
               {cachedOperators.map(op => (
                 <option key={op.id} value={op.id}>{op.name}</option>
               ))}
             </select>
             {loading && <span className="loading-text">Cargando agenda...</span>}
          </div>
        )}

        <div className="calendar-wrapper">
          <CalendarView 
            events={allAppointments}
            isAdmin={isAdmin}
            viewMode="WEEK"
            onAddEvent={(date) => { 
                setEditingEvent({ startTime: date }); 
                setIsModalOpen(true); 
            }}
            onEditEvent={(event) => { 
                setEditingEvent(event); 
                setIsModalOpen(true); 
            }}
          />
        </div>
      </div>

      {isModalOpen && (
        <AppointmentModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          initialData={editingEvent}
          userId={selectedOperatorId === 'all' ? 0 : Number(selectedOperatorId)} // This will be handled by the specialized modal
          projects={cachedProjects}
          operators={cachedOperators} // New prop for admin selection
          isAdminView={true}
        />
      )}

      <CalendarAssistant />

      <style jsx>{`
        .calendar-wrapper {
          min-height: 600px;
        }
        .calendar-header-mobile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }
        .filter-container {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          margin-bottom: var(--space-md);
          padding: var(--space-sm);
        }
        .filter-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .operator-select {
          width: auto;
          min-width: 200px;
        }
        .loading-text {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .admin-calendar-page {
            overflow-x: hidden;
            width: 100%;
            max-width: 100vw;
          }
          .calendar-header-mobile {
            flex-direction: column;
            align-items: flex-start;
            padding: 0 10px;
          }
          .add-task-btn {
            width: 100%;
          }
          .filter-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            width: 100%;
          }
          .operator-select {
            width: 100%;
          }
          .calendar-card {
            padding: 12px !important;
            margin: 10px 0 !important;
            border-radius: 0;
            border-left: none;
            border-right: none;
            width: 100%;
            box-sizing: border-box;
          }
          .calendar-wrapper {
            min-height: 400px;
            width: 100%;
            overflow-x: hidden;
          }
        }
      `}</style>
    </div>
  )
}
