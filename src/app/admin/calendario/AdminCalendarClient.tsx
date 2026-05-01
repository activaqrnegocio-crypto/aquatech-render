'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [isSaving, setIsSaving] = useState(false)
  const [initialDataLoaded, setInitialDataLoaded] = useState(false) // v267: avoid empty screen on slow network
  const saveLockRef = useRef(false)

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

  // Load cache immediately on mount
  useEffect(() => {
    async function loadInitialCache() {
      const cached = await db.appointmentsCache.toArray()
      if (cached.length > 0) {
        // Map to selected operator if needed
        const filtered = selectedOperatorId === 'all' 
          ? cached 
          : cached.filter((a: any) => a.userId === Number(selectedOperatorId))
        setAppointments(filtered)
      }
      setInitialDataLoaded(true)
      // Safety timeout for loading spinner
      setTimeout(() => setLoading(false), 2000)
    }
    loadInitialCache()
  }, [selectedOperatorId])

  const fetchAppointments = async (silent = false, retryCount = 0) => {
    if (!silent && appointments.length === 0) setLoading(true)
    try {
      // Limit to 1 month ago and 2 months ahead for speed
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()
      
      const url = `/api/appointments?userId=${selectedOperatorId}&start=${start}&end=${end}`
      const res = await fetch(url)
      
      if (res.ok) {
        const data = await res.json()
        setAppointments(data)
        
        // Always cache to IndexedDB for offline persistence
        // If it's "all", we replace the whole cache
        if (selectedOperatorId === 'all') {
          await db.appointmentsCache.clear()
          await db.appointmentsCache.bulkPut(data)
        } else {
          // If it's a specific operator, we merge/update
          await db.appointmentsCache.bulkPut(data)
        }
        setLoading(false)
      } else {
        // Si la base de datos cortó la conexión (error 500), reintentamos silenciosamente una vez
        if (retryCount < 1) {
          console.warn(`Fetch fallido (Status: ${res.status}). Reintentando conexión a DB en 500ms...`)
          setTimeout(() => fetchAppointments(silent, retryCount + 1), 500)
          return
        }
        setLoading(false)
      }
    } catch (error) {
      if (retryCount < 2) { // v267: 2 retries instead of 1
        console.warn('Error de red detectado. Reintentando conexión a DB...', error)
        setTimeout(() => fetchAppointments(silent, retryCount + 1), 1000)
        return
      }
      console.warn('Network fetch failed, staying with cache:', error)
      setLoading(false)
    }
  }

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
    if (isSaving || saveLockRef.current) return
    saveLockRef.current = true
    setIsSaving(true)

    try {
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
        await db.outbox.add({
          type: 'TASK',
          projectId: Number(payload.projectId) || 0,
          payload: { ...payload, isNew },
          timestamp: Date.now(),
          status: 'pending'
        })
        setIsModalOpen(false)
        
        // v268: Aggressive Background Sync Trigger
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          
          // 1. Register standard background sync (for OS wakeup)
          if ('sync' in reg) {
            try { await (reg as any).sync.register('sync-outbox'); } catch(e){}
          }
          
          // 2. Immediate "Kick" to Service Worker (Force upload before app suspends)
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_OUTBOX' });
          }
        }

        alert('📅 Tarea guardada localmente. El sistema la subirá en segundo plano automáticamente.')
        return
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        setIsModalOpen(false)
        fetchAppointments()
      } else {
        alert('Error al guardar en el servidor')
      }
    } catch (err) {
      console.error('Error saving task:', err)
      alert('Error crítico al guardar la tarea')
    } finally {
      setIsSaving(false)
      saveLockRef.current = false
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
               onChange={(e) => setSelectedOperatorId(e.target.value)}
             >
               <option value="all">Todos los operadores</option>
               {cachedOperators.map(op => (
                 <option key={op.id} value={op.id}>{op.name}</option>
               ))}
             </select>
             {loading && <span className="loading-text spinner-xs">Sincronizando...</span>}
             {!loading && initialDataLoaded && (
               <button 
                 onClick={() => fetchAppointments()}
                 style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.7rem', cursor: 'pointer', padding: '0 5px', textDecoration: 'underline' }}
               >
                 Actualizar
               </button>
             )}
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
