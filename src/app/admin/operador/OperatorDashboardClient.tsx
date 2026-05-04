'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
import ManualSyncButton from '@/components/ManualSyncButton'
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

import { useSearchParams } from 'next/navigation'

interface OperatorDashboardClientProps {
  user: any
  activeProjects: any[]
  activeDayRecord: any
  appointments: any[]
  userViews: any[]
}

export default function OperatorDashboardClient({
  user,
  activeProjects: initialProjects,
  activeDayRecord: initialActiveDayRecord,
  appointments: initialAppointments,
  userViews: initialUserViews
}: OperatorDashboardClientProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab')

  const [activeTab, setActiveTab] = useState<null | 'PROYECTOS' | 'TAREAS' | 'CALENDARIO'>(() => {
    if (tabParam === 'calendario') return 'CALENDARIO'
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('operator_active_tab')
      // v282: Si no hay nada guardado, no seleccionar ninguna pestaña (carga rápida)
      if (saved && saved !== 'null' && saved !== 'INICIO') return saved as any
      return null
    }
    return null
  })

  useEffect(() => {
    if (tabParam === 'calendario') {
      setActiveTab('CALENDARIO')
    }
  }, [tabParam])

  useEffect(() => {
    sessionStorage.setItem('operator_active_tab', activeTab ?? 'null')
  }, [activeTab])

  // v287: Robust User recovery for offline sessions
  const [localUser, setLocalUser] = useState(user)
  const [isHydratingAuth, setIsHydratingAuth] = useState(true)

  const [appointments, setAppointments] = useState<any[]>(() => {
    // v316: Recuperación síncrona de tareas con localStorage para sobrevivir al cierre de app
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('last_op_tasks_snapshot')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch (e) {}
    }
    return initialAppointments || []
  })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [activeDayRecord, setActiveDayRecord] = useState(initialActiveDayRecord)
  const [userViews, setUserViews] = useState(initialUserViews)

  // v287: Robust Data Hydration
  // Removed old loadData block since day-records and userViews are handled differently and throw 401/404 in offline shell.


  useEffect(() => {
    const recoverAuth = async () => {
      if (!user?.id) {
        try {
          const savedAuth = await db.auth.get('last_session')
          if (savedAuth) {
            console.log('[Offline] Recovered user from Dexie:', savedAuth.name)
            setLocalUser(savedAuth)
          }
        } catch (e) {
          console.error('[Offline] Auth recovery failed:', e)
        }
      }
      setIsHydratingAuth(false)
    }
    recoverAuth()
  }, [user?.id])

  // Use Dexie as live source for projects to support offline correctly
  const projectsFromCache = useLiveQuery(
    async () => {
      // v292: Try user prop first (available immediately), fallback to localUser
      const uId = user?.id || localUser?.id
      if (!uId) {
        // v316: Si no tenemos userId todavía, intentar cargar TODOS los proyectos
        // del cache sin filtro. En offline, si el operador solo tiene sus proyectos
        // en el cache (porque el backend ya filtró), esto es seguro.
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
        if (isOffline) {
          const allProjects = await db.projectsCache
            .orderBy('lastAccessedAt')
            .reverse()
            .limit(500)
            .toArray()
          if (allProjects.length > 0) {
            return allProjects
          }
        }
        return undefined
      }

      const userId = Number(uId)
      if (isNaN(userId) || userId <= 0) return undefined

      // v288: Scann ALL synced projects (up to 500) to find ownership.
      const allProjects = await db.projectsCache
        .orderBy('lastAccessedAt')
        .reverse()
        .limit(500)
        .toArray()
      
      const filtered = allProjects.filter(p => {
        // v294: Usar comparación flexible (==) y verificar tanto team como createdBy
        const isInTeam = p.team?.some((m: any) => Number(m.userId) === userId)
        const isCreator = Number(p.createdBy || p.createdById) === userId
        return isInTeam || isCreator
      })

      // v316: Si el filtro no encontró nada pero hay proyectos en cache Y estamos offline,
      // devolver todos (el backend ya los filtró al sincronizar)
      if (filtered.length === 0 && allProjects.length > 0 && !navigator.onLine) {
        return allProjects
      }

      return filtered
    },
    [localUser?.id, user?.id] // Removed isHydratingAuth to prevent blocking
  )

  // v287: Live Agenda Cache
  const appointmentsFromCache = useLiveQuery(
    async () => {
      const uId = user?.id || localUser?.id
      if (!uId) return undefined
      
      const appts = await db.appointmentsCache
        .where('userId')
        .equals(Number(uId))
        .toArray()
      
      return appts
    },
    [localUser?.id, user?.id] // Removed isHydratingAuth
  )

  // v293: Persistir tareas cuando cambien en la caché (Snapshot para navegación instantánea)
  useEffect(() => {
    if (appointmentsFromCache && appointmentsFromCache.length > 0) {
      setAppointments(appointmentsFromCache)
      try { localStorage.setItem('last_op_tasks_snapshot', JSON.stringify(appointmentsFromCache)) } catch(e) {}
    }
  }, [appointmentsFromCache])

  // v292: Emergency Fallback for Offline "DEAD" state
  const [emergencyProjects, setEmergencyProjects] = useState<any[] | undefined>(() => {
    // v316: Usar localStorage en vez de sessionStorage para que el snapshot sobreviva
    // al cierre y reapertura de la app (sessionStorage se borra al cerrar la pestaña)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('last_op_projects_snapshot')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch (e) {}
    }
    return undefined
  })

  useEffect(() => {
    // v293: Reducido a 400ms para una respuesta instantánea al navegar.
    // Dexie suele responder en <100ms, así que 400ms es un margen seguro
    // para evitar el flash de "0 proyectos" si la query tarda un poco.
    const timer = setTimeout(async () => {
      if (projectsFromCache && projectsFromCache.length > 0) return 
      
      try {
        const uId = user?.id || localUser?.id
        if (!uId) return
        const userId = Number(uId)
        
        const allProjects = await db.projectsCache
          .orderBy('lastAccessedAt').reverse().limit(500).toArray()
        
        const myProjects = allProjects.filter(p => {
          const isInTeam = p.team?.some((m: any) => Number(m.userId) === userId)
          const isCreator = Number(p.createdBy || p.createdById) === userId
          return isInTeam || isCreator
        })
        
        if (myProjects.length > 0) {
          // console.log(`[EmergencyLoad] Loaded ${myProjects.length} projects directly from Dexie`)
          setEmergencyProjects(myProjects)
          // v316: Persistir en localStorage para sobrevivir al cierre de app
          try { localStorage.setItem('last_op_projects_snapshot', JSON.stringify(myProjects)) } catch(e) {}
        }
      } catch (e) {
        console.error('[EmergencyLoad] Failed:', e)
      }
    }, 400)
    
    return () => clearTimeout(timer)
  }, [projectsFromCache, user?.id, localUser?.id])

  // v293: Efecto adicional para persistir cuando el LiveQuery cambie (siempre mantener el snapshot fresco)
  useEffect(() => {
    if (projectsFromCache && projectsFromCache.length > 0) {
      // v316: Persistir en localStorage para sobrevivir al cierre de app
      try { localStorage.setItem('last_op_projects_snapshot', JSON.stringify(projectsFromCache)) } catch(e) {}
    }
  }, [projectsFromCache])

  // v264: Delayed unread counts to prevent UI blocking on mobile
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({})
  
  useEffect(() => {
    // v274: Highly optimized unread counts (staggered & idle-aware)
    const timer = setTimeout(async () => {
      const userId = Number(user?.id);
      const projectsToProcess = [...(projectsFromCache || [])]
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, 30);

      if (!userId || !projectsToProcess.length) return;

      const counts: Record<number, number> = {};
      
      // Process in small batches of 5 to keep frame rate high
      for (let i = 0; i < projectsToProcess.length; i += 5) {
        const batch = projectsToProcess.slice(i, i + 5);
        
        await db.transaction('r', [db.chatCache], async () => {
          const projectIds = batch.map(p => p.id);
          const chats = await db.chatCache.bulkGet(projectIds);
          
          batch.forEach((p, index) => {
            const chat = chats[index];
            counts[p.id] = p.unreadCount || 0;
            if (chat && chat.messages) {
              const lastSeen = new Date(0);
              counts[p.id] = chat.messages.filter((m: any) => 
                new Date(m.createdAt) > lastSeen && m.userId !== userId
              ).length;
            }
          });
        });

        setUnreadCounts(prev => ({ ...prev, ...counts }));
        
        // v274: Yield to main thread between batches
        if ('requestIdleCallback' in window) {
          await new Promise(resolve => (window as any).requestIdleCallback(resolve, { timeout: 1000 }));
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }, 8000); // 8s delay to completely clear the LCP path
    return () => clearTimeout(timer);
  }, [projectsFromCache, user?.id]);


  // v291: Search and Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Merge server projects with cache projects (Smart Merge v317)
  const projects = useMemo(() => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // v317: Robust Source Selection (Priority: LiveQuery > Emergency > Server Props)
    // If projectsFromCache is undefined, it means Dexie hasn't responded yet.
    // If emergencyProjects is also undefined, we are in the initial window.
    const sourceProjects = 
      (projectsFromCache && projectsFromCache.length > 0) ? projectsFromCache :
      (emergencyProjects && emergencyProjects.length > 0) ? emergencyProjects :
      (projectsFromCache === undefined || isHydratingAuth) ? undefined :
      initialProjects;

    // v317: Si estamos cargando o hidratando auth, NO caer a initialProjects (que es [] offline)
    if (sourceProjects === undefined) {
       return undefined; // Mantiene el estado de carga (spinner)
    }

    // v317: Si estamos offline y el source sigue siendo [], intentar forzar el snapshot de emergencia una vez más
    if (isOffline && sourceProjects.length === 0 && emergencyProjects === undefined) {
       return undefined; // Esperar un ciclo más por el emergency sync
    }

    const projectMap = new Map();
    sourceProjects.forEach((p: any) => projectMap.set(p.id, p));

    return Array.from(projectMap.values())
      .map(p => ({
        ...p,
        unreadCount: unreadCounts?.[p.id] ?? p.unreadCount ?? 0
      }))
      .filter(p => {
        const matchesSearch = !searchTerm || 
          p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.city?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
      })
      .sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
  }, [projectsFromCache, emergencyProjects, initialProjects, unreadCounts, searchTerm, isHydratingAuth])

  const paginatedProjects = useMemo(() => {
    if (!projects) return undefined;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return projects.slice(start, start + ITEMS_PER_PAGE);
  }, [projects, currentPage]);

  const totalPages = Math.ceil((projects?.length || 0) / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1); // Reset page on search
  }, [searchTerm]);

  const [selectedTask, setSelectedTask] = useState<any>(null)

  const canManageCalendar = hasModuleAccess(user, 'calendario')

  // 1. Initial hydration and offline cache for appointments
  const syncTriggeredRef = useRef(false);

  // v289/v302: Stable warm-cache logic with 30min throttling
  const warmedProjectIdsRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    const triggerWarmCache = async () => {
      if (!projects || projects.length === 0 || !navigator.onLine) return;

      // v302: Use the same cache key as CacheManager to ensure sync consistency
      const userId = user?.id || localUser?.id || 'default';
      const cacheKey = `projects_bulk_${userId}`;
      
      // 30min Throttling check
      const meta = await db.cacheMetadata.get(cacheKey);
      if (meta?.lastSync) {
        const minsSinceLastSync = (Date.now() - meta.lastSync) / 60000;
        if (minsSinceLastSync < 30) {
          // console.log(`[WarmCache-Op] Skipping. Last sync was ${Math.round(minsSinceLastSync)}m ago.`);
          return;
        }
      }
      
      // Extract only stable IDs to compare
      const currentIds = projects.slice(0, 20)
        .filter(p => p.id && !String(p.id).startsWith('pending'))
        .map(p => Number(p.id));
      
      // Check if we have any new projects to warm
      const newIds = currentIds.filter(id => !warmedProjectIdsRef.current.has(id));
      
      if (newIds.length > 0) {
        const urls = newIds.map(id => `/admin/operador/proyecto/${id}`);
        console.log(`[WarmCache] Messaging SW to pre-cache ${urls.length} NEW operator projects`);
        
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'PRECACHE_URLS',
            urls
          });
          // Mark as warmed
          newIds.forEach(id => warmedProjectIdsRef.current.add(id));
          
          // v315: Removed db.cacheMetadata.update(cacheKey, { status: 'syncing' })
          // Warm caching now happens silently in the background without disturbing the green UI.
        }
      }
    };

    triggerWarmCache();
  }, [projects?.length, user?.id, localUser?.id]);

  // v264: Instant Outbox Kick - Force sync when returning to focus or online
  useEffect(() => {
    const triggerSync = async () => {
      if (typeof window !== 'undefined' && navigator.serviceWorker.controller && navigator.onLine) {
        // Trigger the outbox sync explicitly
        navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_OUTBOX' });
      }
    };

    window.addEventListener('focus', triggerSync);
    window.addEventListener('online', triggerSync);
    triggerSync(); // Initial trigger

    return () => {
      window.removeEventListener('focus', triggerSync);
      window.removeEventListener('online', triggerSync);
    };
  }, []);


  // 2. Local outbox tasks (created offline)
  const pendingTasksRaw = useLiveQuery(
    () => db.outbox.where('type').equals('TASK').toArray()
  ) || []
  
  const pendingStatusToggles = useLiveQuery(
    () => db.outbox.where('type').equals('TASK_STATUS_TOGGLE').toArray()
  ) || []

  // 3. Merge server appointments + local pending tasks + pending status toggles
  const allAppointments = useMemo(() => {
    // Priority: use cached appointments if available, fallback to props
    let baseAppts = appointmentsFromCache || appointments || []
    let merged = [...baseAppts]

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
      project: (projects || []).find((p: any) => p.id === Number(t.payload.projectId)) || null,
      isOffline: true // flag for UI
    }))
    return [...merged, ...pendingMapped].sort((a, b) => {
      const tA = new Date(a.startTime).getTime()
      const tB = new Date(b.startTime).getTime()
      if (isNaN(tA) && isNaN(tB)) return 0;
      if (isNaN(tA)) return 1;
      if (isNaN(tB)) return -1;
      return tA - tB;
    })
  }, [appointments, appointmentsFromCache, pendingTasksRaw, pendingStatusToggles, projects])

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
    return projects?.reduce((acc, p) => acc + (p.unreadCount || 0), 0) || 0
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

  const toggleStatus = async (task: any) => {
    if (task.isOffline) {
      alert('Esta tarea aún no se ha sincronizado con el servidor. Por favor, espera a tener conexión para marcarla como completada.')
      return
    }

    const newStatus = task.status === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'

    // Actualización optimista local
    // Nota: Como usamos LiveQuery, la actualización vendrá de DB si guardamos en outbox o esperamos respuesta
    try {
      const res = await fetch(`/api/appointments/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Network error')
      
      // Update local cache for instant feedback if online
      await db.appointmentsCache.update(task.id, { status: newStatus })
    } catch (e) {
      console.warn('[Offline] Task status toggle failed or offline, adding to outbox')
      await db.outbox.add({
        type: 'TASK_STATUS_TOGGLE',
        projectId: task.project?.id || task.projectId || 0,
        payload: { appointmentId: task.id, status: newStatus },
        timestamp: Date.now(),
        status: 'pending'
      })
    }
  }

  return (
    <div className="operator-dashboard">
      <div className="operator-header">
        <div className="operator-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 className="page-title">Hola, {(localUser?.name || user?.name || 'Operador').split(' ')[0]}</h1>
            <p className="page-subtitle">Panel de Control de Operaciones</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <ManualSyncButton />
              <Link 
                href="/admin/operador/nuevo"
                className="btn btn-secondary"
              >
                Crear Proyecto
              </Link>
          </div>
        </div>
      </div>

      <IosInstallBanner />

      <div style={{ marginTop: '15px' }}>
        <ProjectCacheManager userId={localUser?.id || user?.id} />
      </div>

      {showOnboarding && (
        <NotificationOnboarding onDone={() => setShowOnboarding(false)} />
      )}

      {pushStatus !== 'subscribed' && pushStatus !== 'loading' && !pushDismissed && (
        <div style={{
          background: pushStatus === 'denied' || pushStatus === 'unsupported' 
            ? 'rgba(255,255,255,0.05)' 
            : 'linear-gradient(135deg, #0070c0, #38bdf8)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          flexWrap: 'wrap',
          margin: '15px 0 0 0',
          boxShadow: pushStatus === 'denied' ? 'none' : '0 4px 20px rgba(0, 112, 192, 0.2)',
          border: pushStatus === 'denied' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          position: 'relative',
          animation: 'fade-in 0.5s ease-out',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '1.8rem' }}>{pushStatus === 'denied' ? '🚫' : pushStatus === 'unsupported' ? '📱' : '🔔'}</span>
            <div>
              <p style={{ margin: 0, color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>
                {pushStatus === 'denied' 
                  ? 'Notificaciones Bloqueadas' 
                  : pushStatus === 'unsupported'
                  ? 'Notificaciones no soportadas'
                  : 'Activa las Notificaciones'}
              </p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>
                {pushStatus === 'denied'
                  ? 'Debes habilitar los permisos en los ajustes de tu navegador.'
                  : pushStatus === 'unsupported'
                  ? 'Tu iPhone (sin instalar) no permite avisos push.'
                  : 'Recibe alertas de mensajes y tareas en tu celular'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', zIndex: 5 }}>
            {(pushStatus === 'denied' || pushStatus === 'unsupported' || /android|iphone|ipad/i.test(navigator.userAgent)) && (
              <button
                onClick={() => setShowOnboarding(true)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: '600',
                  padding: '10px 15px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  touchAction: 'manipulation'
                }}
              >
                Ayuda
              </button>
            )}

            {pushStatus === 'prompt' || pushStatus === 'unsubscribed' ? (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const result = await pushSubscribe()
                  if (result.success) {
                    setPushDismissed(true)
                  } else {
                    alert(result.error || 'No se pudo activar. Asegúrate de tener internet. En iPhone, instala la app primero.')
                  }
                }}
                disabled={isSubscribing}
                style={{
                  backgroundColor: 'white',
                  color: '#0070c0',
                  fontWeight: 'bold',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  touchAction: 'manipulation',
                  opacity: isSubscribing ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  transform: isSubscribing ? 'scale(0.98)' : 'scale(1)'
                }}
              >
                {isSubscribing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid #0070c0', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                    <span>...</span>
                  </div>
                ) : 'Activar'}
              </button>
            ) : null}

            <button 
              onClick={() => {
                localStorage.setItem('push_dismissed', Date.now().toString())
                setPushDismissed(true)
              }}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer', 
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem' 
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="tabs tabs-nowrap" style={{ 
        marginTop: 'var(--space-lg)', 
        display: 'flex', 
        width: '100%', 
        gap: '0',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden'
      }}>
        <button 
          className={`tab ${activeTab === 'TAREAS' ? 'active' : ''}`}
          onClick={() => setActiveTab('TAREAS')}
          style={{ 
            flex: 1, 
            padding: '16px 10px', 
            fontSize: '0.9rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px',
            borderRadius: '0',
            borderBottom: activeTab === 'TAREAS' ? '3px solid var(--primary)' : '3px solid transparent'
          }}
        >
           <CheckCircle2 size={18} /> 
           <span style={{ whiteSpace: 'nowrap', fontWeight: activeTab === 'TAREAS' ? '700' : '500' }}>
             Hoy ({allAppointments === undefined ? '...' : todayTasks.length})
           </span>
        </button>

        <button 
          className={`tab ${activeTab === 'PROYECTOS' ? 'active' : ''}`} 
          onClick={() => setActiveTab('PROYECTOS')}
          style={{ 
            flex: 1, 
            padding: '16px 10px', 
            fontSize: '0.9rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '0',
            borderBottom: activeTab === 'PROYECTOS' ? '3px solid var(--primary)' : '3px solid transparent',
            position: 'relative'
          }}
        >
           <Briefcase size={18} /> 
           <span style={{ whiteSpace: 'nowrap', fontWeight: activeTab === 'PROYECTOS' ? '700' : '500' }}>
            Proyectos ({projects === undefined ? '...' : projects.length})
           </span>
           {totalUnread > 0 && (
             <span className="tab-badge" style={{ position: 'static', marginLeft: '8px', transform: 'none' }}>
               {totalUnread}
             </span>
           )}
        </button>
      </div>

      {activeTab === 'PROYECTOS' && (
        <div style={{ marginTop: '20px' }}>
          <div className="search-container" style={{ marginBottom: '20px' }}>
            <div className="input-group" style={{ backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span className="input-group-text bg-transparent border-0 pe-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input 
                type="text" 
                className="form-control bg-transparent border-0 ps-3" 
                placeholder="Buscar por proyecto, cliente o ciudad..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '1rem', height: '54px', color: 'var(--text)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Action header depending on active tab */}


      <div className="tab-content" style={{ marginTop: 'var(--space-sm)' }}>
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
            {paginatedProjects === undefined ? (
               <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div className="loading-spinner" style={{ width: '30px', height: '30px', margin: '0 auto 15px' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Hidratando proyectos desde memoria local...</p>
               </div>
            ) : paginatedProjects.length > 0 ? (
              <>
                {paginatedProjects.map(project => {
                  const completedPhases = (project.phases || []).filter((p: any) => p.status === 'COMPLETADA').length
                  const totalPhases = (project.phases || []).length
                  const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
                  
                  return (
                    <Link 
                      href={`/admin/operador/proyecto/${project.id}`} 
                      key={project.id} 
                      prefetch={false}
                      onClick={(e) => {
                        if (!project.id) return;
                        // v289: Store ID in sessionStorage as emergency fallback for offline-shell
                        sessionStorage.setItem('last_op_project_id', String(project.id));
                        console.log('[OpNav] Navigating to project:', project.id);
                        
                        // v289: If offline, force full-page navigation to keep the URL correct for the shell
                        if (typeof navigator !== 'undefined' && !navigator.onLine) {
                          e.preventDefault();
                          window.location.href = `/admin/operador/proyecto/${project.id}`;
                        }
                      }}
                      className="card interactive" 
                      style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                        <span className={`status-badge status-${project.status.toLowerCase()}`}>
                          {project.status}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(project.phases || []).length} fases</span>
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
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '15px' }}>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-ghost"
                      style={{ 
                        opacity: currentPage === 1 ? 0.2 : 1, 
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        padding: '8px 16px'
                      }}
                    >
                      ← Anterior
                    </button>
                    <div style={{ 
                      backgroundColor: 'var(--bg-surface)', 
                      padding: '6px 14px', 
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: 'var(--primary)',
                      border: '1px solid var(--border)'
                    }}>
                      {currentPage} / {totalPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-ghost"
                      style={{ 
                        opacity: currentPage === totalPages ? 0.2 : 1, 
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        padding: '8px 16px'
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '20px', opacity: 0.3 }}>📂</div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No hay proyectos disponibles</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', fontSize: '0.9rem' }}>
                  Si crees que esto es un error, intenta sincronizar manualmente o conectar a internet.
                </p>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('trigger-bulk-sync', { detail: { force: true } }))}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '20px' }}
                >
                  Sincronizar ahora
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'CALENDARIO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="card" style={{ padding: 'var(--space-md)', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)' }}>
                <strong>📅 Agenda Semanal</strong>: Aquí puedes ver tus próximos compromisos y tareas asignadas.
              </p>
            </div>
            
            {allAppointments.length > 0 ? (
              // Agrupar por fecha
              Object.entries(
                allAppointments.reduce((acc: any, curr) => {
                  const date = new Date(curr.startTime).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(curr);
                  return acc;
                }, {})
              ).sort((a: any, b: any) => {
                const tA = new Date(a[1][0].startTime).getTime();
                const tB = new Date(b[1][0].startTime).getTime();
                if (isNaN(tA) && isNaN(tB)) return 0;
                if (isNaN(tA)) return 1;
                if (isNaN(tB)) return -1;
                return tA - tB;
              }).map(([date, tasks]: [string, any]) => (
                <div key={date} style={{ marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'capitalize', marginBottom: '8px', paddingLeft: '10px', borderLeft: '3px solid var(--primary)' }}>
                    {date}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tasks.sort((a: any, b: any) => {
                      const tA = new Date(a.startTime).getTime();
                      const tB = new Date(b.startTime).getTime();
                      if (isNaN(tA) && isNaN(tB)) return 0;
                      if (isNaN(tA)) return 1;
                      if (isNaN(tB)) return -1;
                      return tA - tB;
                    }).map((task: any) => (
                      <div key={task.id} className="card interactive" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => setSelectedTask(task)}>
                        <div style={{ textAlign: 'center', minWidth: '50px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{formatToEcuador(task.startTime, { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{task.title}</div>
                          {task.project && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📂 {task.project.title}</div>}
                        </div>
                        <span className={`badge ${task.status === 'COMPLETADA' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: 'var(--text-muted)' }}>No tienes tareas para esta semana.</p>
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link href="/admin/calendario" className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Ver Calendario Completo ↗
              </Link>
            </div>
          </div>
        )}


      </div>

      {/* MODAL DETALLES DE TAREA (Multimedia support) */}
      {selectedTask && (
        <AppointmentModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={async (data) => {
            try {
              const res = await fetch(`/api/appointments/${data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              })
              if (res.ok) {
                // Update local cache
                await db.appointmentsCache.put(data)
                setSelectedTask(null)
              } else {
                alert('Error al actualizar tarea')
              }
            } catch (e) {
              alert('Error de conexión. Las ediciones detalladas requieren internet.')
            }
          }}
          initialData={selectedTask}
          userId={Number(user.id)}
          projects={projects || []}
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
