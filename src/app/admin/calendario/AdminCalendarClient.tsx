'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import CalendarView from '@/components/Calendar/CalendarView'
import DayOverviewModal from '@/components/Calendar/DayOverviewModal'
import CalendarAssistant from '@/components/Calendar/CalendarAssistant'
import { getLocalNow } from '@/lib/date-utils'

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
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all')
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(getLocalNow())
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [initialEditEventId, setInitialEditEventId] = useState<number | string | null>(null)
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

  // v274: Consolidated loading logic to prevent race conditions and empty UI
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      // 1. Try to load from cache first for instant feedback
      const cached = await db.appointmentsCache.toArray()
      if (isMounted && cached.length > 0) {
        const filtered = selectedOperatorId === 'all' 
          ? cached 
          : cached.filter((a: any) => {
              if (Number(a.userId) === Number(selectedOperatorId)) return true
              if (a.assignedUsers) {
                try {
                  const parsed = typeof a.assignedUsers === 'string' ? JSON.parse(a.assignedUsers) : a.assignedUsers
                  return Array.isArray(parsed) && parsed.some((u: any) => Number(u.id) === Number(selectedOperatorId))
                } catch (e) {
                  return false
                }
              }
              return false
            })
        setAppointments(filtered)
        setInitialDataLoaded(true)
        // If we have cache, we can hide the big spinner early, but we'll still fetch fresh data
        setLoading(false)
      }

      // 2. Fetch fresh data from server
      await fetchAppointments(cached.length > 0) // silent if we already have cache
      
      if (isMounted) {
        setInitialDataLoaded(true)
        setLoading(false)
      }
    }

    loadData()

    const handleRefresh = () => fetchAppointments(true)
    window.addEventListener('calendar-refresh', handleRefresh)
    
    return () => {
      isMounted = false
      window.removeEventListener('calendar-refresh', handleRefresh)
    }
  }, [selectedOperatorId])

  // v274: Listen for sync events to refresh data automatically
  useEffect(() => {
    const handleSyncFinished = (event: any) => {
      if (event.data?.type === 'OUTBOX_SYNC_FINISHED') {
        console.log('[Calendar] Background sync finished, refreshing...')
        fetchAppointments(true)
      }
    }

    const handleSyncSuccess = (event: any) => {
      if (event.detail?.type === 'TASK') {
        console.log('[Calendar] Task sync success, refreshing...')
        fetchAppointments(true)
      }
    }

    const syncChannel = new BroadcastChannel('aquatech-sync')
    syncChannel.addEventListener('message', handleSyncFinished)
    window.addEventListener('sync-success' as any, handleSyncSuccess)

    return () => {
      syncChannel.removeEventListener('message', handleSyncFinished)
      syncChannel.close()
      window.removeEventListener('sync-success' as any, handleSyncSuccess)
    }
  }, [selectedOperatorId])

  // v278: Visibility change fallback & Periodic Sync registration
  useEffect(() => {
    const registerPeriodicSync = async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        // @ts-ignore
        if ('periodicSync' in reg) {
          try {
            // @ts-ignore
            await reg.periodicSync.register('sync-outbox', {
              minInterval: 15 * 60 * 1000, // 15 minutes (standard min for most browsers)
            });
            console.log('[Calendar] Periodic Sync registered');
          } catch (e) {
            console.warn('[Calendar] Periodic Sync could not be registered:', e);
          }
        }
      }
    };

    registerPeriodicSync();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Calendar] App visible, checking for pending syncs...')
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            if ('sync' in reg) {
              (reg as any).sync.register('sync-outbox').catch(() => {});
            }
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_OUTBOX' });
            }
          });
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
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
        
        // v274: Defensive check — ensure data is an array before setting state or caching
        if (Array.isArray(data)) {
          setAppointments(data)
          
          // Always cache to IndexedDB for offline persistence
          if (selectedOperatorId === 'all') {
            await db.appointmentsCache.clear()
            await db.appointmentsCache.bulkPut(data)
          } else {
            // Specific operator: update/merge (we don't clear so we don't lose other operators' data offline)
            await db.appointmentsCache.bulkPut(data)
          }
        }
        setLoading(false)
      } else {
        // v274: Improved error handling for 504 (timeout) and 500
        const isTimeout = res.status === 504;
        if (retryCount < 1 && !isTimeout) {
          console.warn(`Fetch fallido (Status: ${res.status}). Reintentando...`)
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

    const combined = [...appointments, ...pending]
    const seenIds = new Set()
    const result: any[] = []

    // 1. Process real appointments first
    for (const a of combined) {
      if (typeof a.id === 'number' && !seenIds.has(a.id)) {
        seenIds.add(a.id)
        result.push(a)
      }
    }

    // 2. Add pending only if they don't match a real one by content/time
    for (const a of combined) {
      if (typeof a.id === 'string' && a.id.startsWith('pending-')) {
        const isDuplicate = result.some(ra => 
          ra.title === a.title && 
          ra.projectId === a.projectId &&
          Math.abs(new Date(ra.startTime).getTime() - new Date(a.startTime).getTime()) < 60000
        )
        if (!isDuplicate && !seenIds.has(a.id)) {
          seenIds.add(a.id)
          result.push(a)
        }
      }
    }

    return result
  }, [appointments, pendingTasks])

  const handleSaveAppointment = async (data: any) => {
    if (isSaving || saveLockRef.current) return
    saveLockRef.current = true
    setIsSaving(true)

    try {
      const isNew = !data.id
      const url = isNew ? '/api/appointments' : `/api/appointments/${data.id}`
      const method = isNew ? 'POST' : 'PATCH'

      // Build payload — include userIds for multi-assignment
      const payload: any = { ...data }
      if (data.userIds && Array.isArray(data.userIds)) {
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

          // v334: Si online, mandar push silencioso para despertar al SW
          if (navigator.onLine) {
            fetch('/api/push/wake-up', { method: 'POST', priority: 'low' }).catch(() => {});
          }
        }

        alert('📅 Tarea guardada localmente. El sistema la subirá en segundo plano automáticamente.')
        return
      }

      let res;
      try {
        res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (fetchErr) {
        // Network error (Lie-Fi) - fallback to offline outbox
        console.warn('Network error during save, falling back to offline outbox:', fetchErr);
        await db.outbox.add({
          type: 'TASK',
          projectId: Number(payload.projectId) || 0,
          payload: { ...payload, isNew },
          timestamp: Date.now(),
          status: 'pending'
        });
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_OUTBOX' });
        }
        alert('📅 Tarea encolada. Se guardará cuando la conexión mejore.');
        return;
      }
      
      if (res && res.ok) {
        fetchAppointments()
      } else {
        let errorMsg = 'Error al guardar en el servidor'
        try {
          const errorBody = await res?.json()
          if (errorBody?.error) errorMsg = errorBody.error
        } catch {}
        throw new Error(errorMsg)
      }
    } catch (err) {
      console.error('Error saving task:', err)
      throw err // Re-lanzar para que DayOverviewModal sepa que falló
    } finally {
      setIsSaving(false)
      saveLockRef.current = false
    }
  }

  const handleDeleteAppointment = async (id: number) => {
    // Optimistic UI update
    const previousAppointments = [...appointments]
    setAppointments(prev => prev.filter(a => a.id !== id))

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
        <button className="btn btn-primary add-task-btn" onClick={() => { setSelectedDate(getLocalNow()); setIsOverviewOpen(true); }}>
          + Agendar
        </button>
      </div>

      <div className="card mb-lg calendar-card" style={{ marginTop: 'var(--space-md)' }}>
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

        <div className="calendar-wrapper">
          {loading && !initialDataLoaded ? (
            <div className="calendar-skeleton">
              <div className="skeleton-header" />
              <div className="skeleton-grid">
                {[...Array(28)].map((_, i) => (
                  <div key={i} className="skeleton-cell" />
                ))}
              </div>
            </div>
          ) : (
            <CalendarView 
              events={allAppointments}
              isAdmin={isAdmin}
              viewMode="WEEK"
              onAddEvent={(date) => { 
                  setSelectedDate(date); 
                  setInitialEditEventId(null);
                  setIsOverviewOpen(true); 
              }}
              onEditEvent={(event) => { 
                  setSelectedDate(new Date(event.startTime)); 
                  setInitialEditEventId(event.id);
                  setIsOverviewOpen(true); 
              }}
            />
          )}
        </div>
      </div>

      {isOverviewOpen && (
        <DayOverviewModal 
          isOpen={isOverviewOpen}
          onClose={() => setIsOverviewOpen(false)}
          date={selectedDate}
          appointments={allAppointments}
          operators={cachedOperators}
          initialEditEventId={initialEditEventId}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          refreshAppointments={() => fetchAppointments(true)}
        />
      )}

      <CalendarAssistant />

      <style jsx>{`
        .calendar-wrapper {
          min-height: 600px;
          position: relative;
        }
        .calendar-skeleton {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .skeleton-header {
          height: 40px;
          width: 300px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          animation: pulse 1.5s infinite;
        }
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .skeleton-cell {
          height: 120px;
          background: var(--bg-card);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0.5; }
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
