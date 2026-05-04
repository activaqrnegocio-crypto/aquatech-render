'use client'

import { useState, useEffect, useTransition, useMemo, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  generateProfessionalPDF, 
  generateProjectReportPDF, 
  addAquatechHeader 
} from '@/lib/pdf-generator'
import { useSession } from 'next-auth/react'
import { formatToEcuador, ECUADOR_TIMEZONE, formatTimeEcuador, formatDateEcuador } from '@/lib/date-utils'
import { compressImage as optimizedCompress, isCompressibleImage, blobToBase64 } from '@/lib/image-optimization'
import { prepareFileForOutbox, generateSyncId } from '@/lib/offline-utils'

import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useOutboxStatus } from '@/hooks/useOutboxStatus'
import ProjectChatUnified from './chat/ProjectChatUnified'
import { translateType, translateCategory } from '@/lib/constants'
import { formatDate } from '@/lib/date-utils'

export default function ProjectExecutionClient({ 
  project: initialProject, 
  initialChat, 
  activeRecord, 
  expenses, 
  userId,
  clientName,
  projectAddress,
  projectCity,
  availableOperators = [],
  panelBase = '/admin/operador'
}: any) {
  const GALLERY_LABEL = "Planos y Referencias"
  // 1. Core Lifecycle & Navigation
  const [mounted, setMounted] = useState(false)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const { pending: globalPending, syncing: isSyncingGlobal, failed: globalFailed } = useOutboxStatus()

  // 2. Connectivity & Mode States (Consolidated)
  const [isOnline, setIsOnline] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)
  const [cacheNotFound, setCacheNotFound] = useState(false)

  // v253: Robust ID extraction
  // v255: Ultra-robust ID extraction for mobile offline-shell
  // v288: Exclude 'offline-shell' from direct extraction to prevent ghost navigations
  const idFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    
    // 1. Try URL parameters (from search string)
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('id');
    if (qId && /^\d+$/.test(qId)) return Number(qId);

    // 2. Try Regex from path (Only match numeric IDs)
    const path = window.location.pathname;
    const match = path.match(/\/proyecto[s]?\/(\d+)/i);
    if (match) return Number(match[1]);

    // 3. Last segment fallback (Only if numeric)
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^\d+$/.test(last)) return Number(last);

    // 4. MOBILE FALLBACK: If we are in the shell, use the last remembered ID
    const isOp = path.includes('/operador/');
    const storageKey = isOp ? 'last_op_project_id' : 'last_admin_project_id';

    if (path.includes('offline-shell') && typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && !isNaN(Number(stored))) return Number(stored);
    }

    return 0;
  }, [pathname, searchParams]);

  // 3. Project & Data State
  const [localProject, setLocalProject] = useState<any>(null)
  const [localChat, setLocalChat] = useState<any[]>([])
  const [liveChat, setLiveChat] = useState<any[]>(initialChat || [])
  const [localExpenses, setLocalExpenses] = useState<any[]>(expenses || [])

  // v316: Local state for props that need Dexie fallback (offline recovery)
  const [localClientName, setLocalClientName] = useState(clientName || '')
  const [localProjectAddress, setLocalProjectAddress] = useState(projectAddress || '')
  const [localProjectCity, setLocalProjectCity] = useState(projectCity || '')

  // v288: Critical Identity Check
  // If the initialProject (from props/RSC) doesn't match the current URL ID, 
  // we MUST treat it as a skeleton until Dexie hydrates the correct one.
  const isIdentityMismatch = initialProject && idFromUrl > 0 && Number(initialProject.id) !== idFromUrl;
  const project = isIdentityMismatch ? { ...initialProject, isSkeleton: true, title: 'Cargando...' } : (localProject || initialProject);

  // 4. UI UI State
  const [activeTab, setActiveTab] = useState<'records' | 'chat' | 'gallery'>('records')
  const [isFichaOpen, setIsFichaOpen] = useState(false)
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<any>(null)
  const [handleDownloadLoading, setHandleDownloadLoading] = useState<string | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const [localTeam, setLocalTeam] = useState<any[]>(project?.team || [])
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>(project?.team?.map((t: any) => t.id) || [])

  // 5. Refs
  const expensesInitialized = useRef(false)
  const isSyncingRef = useRef(false)
  const hasRecoveredRef = useRef(false)
  const liveChatInitialized = useRef(false)
  const liveChatRef = useRef(liveChat)
  const saveLockRef = useRef(false)
  const teamLockRef = useRef(false)

  // v317: Helper to wake up SW and register background sync / background fetch
  const triggerBackgroundSync = async () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        
        // Phase 1: Check for large items in outbox to trigger Background Fetch
        const pendingItems = await db.outbox.where('status').equals('pending').toArray();
        const hasMedia = pendingItems.some(item => item.type === 'GALLERY_UPLOAD' || item.type === 'MEDIA_UPLOAD' || (item.type === 'MESSAGE' && item.payload.media));

        if (hasMedia && 'backgroundFetch' in reg) {
          try {
            const syncId = `aquatech-media-sync-${Date.now()}`;
            // We register the fetch. The SW will handle the actual requests or we can pass URLs.
            // For now, we trigger a special fetch that the SW will intercept to process the outbox.
            await (reg as any).backgroundFetch.fetch(syncId, ['/api/sync/background-trigger'], {
              title: 'Sincronizando Multimedia Aquatech',
              icons: [{ src: '/favicon.png', sizes: '192x192', type: 'image/png' }]
            });
            console.log('[Sync] Background Fetch registered for media');
          } catch (bfErr) {
            console.warn('[Sync] Background Fetch registration failed, falling back to normal sync', bfErr);
          }
        }

        // Always register normal sync for lightweight items
        if ('sync' in reg) {
          await (reg as any).sync.register('sync-outbox');
          console.log('[Sync] Registered SW sync from ProjectExecution');
        }
        
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC_OUTBOX' });
        }
      } catch (e) {
        console.warn('Background sync registration failed:', e);
      }
    }
  };

  // Persist the ID so the shell can find it if Next.js redirects
  useEffect(() => {
    if (idFromUrl > 0 && typeof sessionStorage !== 'undefined') {
      const isOp = window.location.pathname.includes('/operador/');
      const storageKey = isOp ? 'last_op_project_id' : 'last_admin_project_id';
      sessionStorage.setItem(storageKey, idFromUrl.toString());
    }
    
    // v288: RESET HYDRATION STATE ON ID CHANGE
    // This prevents showing data from the previous project when navigating client-side
    setLocalProject(null);
    setLocalChat([]);
    setLocalExpenses(expenses || []);
    hasRecoveredRef.current = false;
    liveChatInitialized.current = false;
    expensesInitialized.current = false;
    setCacheNotFound(false);
  }, [idFromUrl, expenses]);
  
  const pendingItems = useLiveQuery(() => db.outbox.where('projectId').equals(idFromUrl).toArray(), [idFromUrl]) || []

  // Sync refs
  useEffect(() => { liveChatRef.current = liveChat }, [liveChat])

  // Sync team state when project updates online
  useEffect(() => {
    if (project?.team && project.team.length > 0) {
      setLocalTeam(project.team.map((t: any) => ({
        id: t.userId || t.id,
        name: t.user?.name || t.name || 'Operador',
        role: t.user?.role || t.role || 'OPERATOR',
        phone: t.user?.phone || t.phone
      })));
    }
  }, [project?.team])

  // Single mount effect
  useEffect(() => {
    setMounted(true)
    const checkSize = () => setIsSmallScreen(window.innerWidth < 768)
    checkSize()
    window.addEventListener('resize', checkSize)

    const updateOnlineStatus = () => {
      const online = navigator.onLine
      setIsOnline(online)
      setIsOfflineMode(!online)
      if (online) {
        triggerBackgroundSync()
      }
    }
    
    const handleSyncSuccess = (e: any) => {
      if (e.detail?.projectId === idFromUrl) {
        // console.log('[UI] Background sync success detected. Refreshing data...');
        router.refresh()
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    window.addEventListener('sync-success', handleSyncSuccess)
    updateOnlineStatus()

    // v281: Deep Link - Auto-switch tab based on query param
    const view = searchParams?.get('view')
    if (view === 'chat') {
      setActiveTab('chat')
    } else if (view === 'gallery') {
      setActiveTab('gallery')
    }

    return () => {
      window.removeEventListener('resize', checkSize)
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      window.removeEventListener('sync-success', handleSyncSuccess)
    }
  }, [])

  // --- HELPER FUNCTIONS ---
  const deduplicateMessages = (messages: any[]) => {
    const seenIds = new Set();
    const result: any[] = [];
    
    // 1. Prioritize real IDs
    const sorted = [...messages].sort((a, b) => {
      const aIsTemp = typeof a.id === 'string' && a.id.startsWith('temp-');
      const bIsTemp = typeof b.id === 'string' && b.id.startsWith('temp-');
      if (aIsTemp && !bIsTemp) return 1;
      if (!aIsTemp && bIsTemp) return -1;
      return 0;
    });

    for (const msg of sorted) {
      // If we have a real ID, use it as unique key
      if (typeof msg.id === 'number') {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          result.push(msg);
        }
      } else {
        // If it's a temp ID, only add if no real message matches its content/type
        const isDuplicate = result.some(rm => 
          rm.content === msg.content && 
          rm.type === msg.type && 
          Math.abs(new Date(rm.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 30000
        );
        if (!isDuplicate && !seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          result.push(msg);
        }
      }
    }
    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const fetchMessages = async (since?: string): Promise<any[]> => {
    try {
      const url = `/api/projects/${idFromUrl}/messages?_t=${Date.now()}${since ? `&since=${since}` : ''}`
      const resp = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      if (!resp.ok) return []
      const newMsgs = await resp.json()
      return (newMsgs || []).map((m: any) => ({
        ...m,
        isMe: Number(m.userId) === Number(userId),
        userName: m.user?.name || 'Usuario',
        userBranch: m.user?.branch || null
      }))
    } catch (err) {
      console.error('[CHAT SYNC] Network error:', err)
      return []
    }
  }

  const handleDownload = async (url: string, filename: string) => {
    setHandleDownloadLoading(url)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download error:', error)
      window.open(url, '_blank')
    } finally {
      setHandleDownloadLoading(null)
    }
  }

  const handleSaveTeam = async () => {
    if (teamLockRef.current || isSavingTeam) return
    teamLockRef.current = true
    setIsSavingTeam(true)

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await db.outbox.add({
          type: 'TEAM_UPDATE',
          projectId: idFromUrl,
          payload: { operatorIds: selectedTeamIds },
          timestamp: Date.now(),
          status: 'pending'
        })
        
        // Optimistic update for local UI
        const newTeam = availableOperators
          .filter((op: any) => selectedTeamIds.includes(op.id))
          .map((op: any) => ({ id: op.id, name: op.name, role: op.role || 'OPERADOR' }))
        
        setLocalTeam(newTeam)
        setIsEditingTeam(false)
        triggerBackgroundSync()
        return
      }

      const res = await fetch(`/api/projects/${project?.id || idFromUrl}/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorIds: selectedTeamIds })
      })

      if (res.ok) {
        const newTeam = availableOperators
          .filter((op: any) => selectedTeamIds.includes(op.id))
          .map((op: any) => ({ id: op.id, name: op.name, role: op.role || 'OPERADOR' }))
        
        setLocalTeam(newTeam)
        setIsEditingTeam(false)
        if (typeof navigator !== 'undefined' && navigator.onLine) router.refresh()
      } else {
        alert('Error al actualizar el equipo')
      }
    } catch (error) {
      console.error('Error saving team:', error)
      alert('Error de conexión')
    } finally {
      setIsSavingTeam(false)
      teamLockRef.current = false
    }
  }

  const handleDeleteGalleryItem = async (itemId: number | string) => {
    if (!window.confirm('¿Estás seguro de eliminar este archivo?')) return
    
    // --- PENDING ITEM HANDLING ---
    if (typeof itemId === 'string' && itemId.startsWith('pending-')) {
      try {
        const outboxId = Number(itemId.replace(/pending-ev-|pending-chat-|pending-/, ''))
        await db.outbox.delete(outboxId)
        return
      } catch (e) {
        console.error('Error deleting pending item:', e)
      }
    }

    // Offline support for server items
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await db.outbox.add({
          type: 'GALLERY_DELETE',
          projectId: project?.id || idFromUrl,
          payload: { galleryId: itemId }, // v255: Consistente con GlobalSyncWorker
          timestamp: Date.now(),
          status: 'pending'
        })
        triggerBackgroundSync()
        return
      } catch (e) {
        console.error('Error saving offline deletion:', e)
      }
    }

    try {
      const res = await fetch(`/api/projects/${project?.id || idFromUrl}/gallery/${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        startTransition(() => { if (typeof navigator !== 'undefined' && navigator.onLine) router.refresh() })
      } else { alert('Error eliminando archivo') }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Error de conexión')
    }
  }

  // Initial project recovery effect — with polling for sync race conditions
  useEffect(() => {
    if (!mounted || !idFromUrl || idFromUrl <= 0) return;
    
    // Si ya tenemos el proyecto correcto y no es un esqueleto, no hace falta recuperar nada
    if (project && Number(project.id) === idFromUrl && !project.isSkeleton) {
      setIsSyncingOffline(false);
      hasRecoveredRef.current = true;
      return;
    }

    setIsSyncingOffline(true);
    let cancelled = false;
    let retries = 0;
    const MAX_RETRIES = 10; // 10 segundos máximo

    async function tryRecover(): Promise<boolean> {
      try {
        const cached = await db.projectsCache.get(idFromUrl);
        if (cached && !cancelled) {
          console.log('[Offline] Proyecto recuperado de IndexDB:', idFromUrl);
          setLocalProject(cached);
          const chat = await db.chatCache.get(idFromUrl);
          setLocalChat(chat?.messages || []);

          // v316: Recover clientName, address, city from cached data
          if (cached.client) {
            setLocalClientName(cached.client.name || clientName || '');
            setLocalProjectAddress(cached.address || cached.client.address || projectAddress || '');
            setLocalProjectCity(cached.city || cached.client.city || projectCity || '');
          } else {
            if (cached.address) setLocalProjectAddress(cached.address);
            if (cached.city) setLocalProjectCity(cached.city);
          }

          // v316: Recover expenses from cached data
          if (cached.expenses && cached.expenses.length > 0 && localExpenses.length === 0) {
            setLocalExpenses(cached.expenses.map((e: any) => ({
              id: e.id, description: e.description, amount: Number(e.amount),
              date: e.date, isNote: e.isNote, userName: e.user?.name || 'Operador'
            })));
          }

          // v316: Recover team from cached data
          if (cached.team && cached.team.length > 0) {
            setLocalTeam(cached.team.map((t: any) => ({
              id: t.userId || t.id,
              name: t.user?.name || t.name || 'Operador',
              role: t.user?.role || t.role || 'OPERATOR',
              phone: t.user?.phone || t.phone
            })));
          }

          hasRecoveredRef.current = true;
          setIsSyncingOffline(false);
          setCacheNotFound(false);
          return true;
        }
      } catch (err) {
        console.warn('[ProjectClient] Error en Dexie:', err);
      }
      return false;
    }

    // Intento inmediato
    tryRecover();

    const pollInterval = setInterval(async () => {
      if (cancelled || hasRecoveredRef.current) {
        clearInterval(pollInterval);
        return;
      }
      retries++;
      const found = await tryRecover();
      if (found || retries >= MAX_RETRIES) {
        clearInterval(pollInterval);
        if (!found && !cancelled) {
          setIsSyncingOffline(false);
          setCacheNotFound(true);
        }
      }
    }, 1000);

    const handleSyncDone = () => { if (!hasRecoveredRef.current && !cancelled) tryRecover(); };
    window.addEventListener('bulk-cache-sync-finished', handleSyncDone);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      window.removeEventListener('bulk-cache-sync-finished', handleSyncDone);
    };
  }, [mounted, idFromUrl, project?.id, project?.isSkeleton]); // v255: Dependencias más precisas

  const userRole = session?.user?.role
  const isFieldStaff = userRole === 'OPERATOR' || userRole === 'OPERADOR' || userRole === 'SUBCONTRATISTA'
  const hasActiveRecordInThisProject = activeRecord && Number(activeRecord.projectId) === Number(idFromUrl)
  const hasActiveRecordInOtherProject = activeRecord && !hasActiveRecordInThisProject

  // 1. Chat Effects (Ref sync handled at top)

  useEffect(() => {
    if (!idFromUrl) return; 
    const markAsSeen = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      try {
        await fetch('/api/notifications/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: idFromUrl })
        })
      } catch (e) { }
    }
    markAsSeen()

    if (!liveChatInitialized.current) {
      liveChatInitialized.current = true
      fetchMessages().then(msgs => {
        if (msgs && msgs.length > 0) {
          setLiveChat(msgs)
          markAsSeen()
        }
      })
    }

        const pollInterval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      if (typeof document !== 'undefined' && document.hidden) return
      const currentChat = liveChatRef.current
      const lastMsg = currentChat[currentChat.length - 1]
      const since = lastMsg?.createdAt
      try {
        const freshMsgs = await fetchMessages(since)
        if (freshMsgs && freshMsgs.length > 0) {
          setLiveChat((prev: any[]) => deduplicateMessages([...prev, ...freshMsgs]))
        }
      } catch (err) { console.error(err) }
    }, 5000) 
    
    const handleFocus = () => fetchMessages().then(msgs => {
      if (msgs && msgs.length > 0) {
        setLiveChat((prev: any[]) => deduplicateMessages([...prev, ...msgs]))
      }
    })

    if (typeof window !== 'undefined') window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(pollInterval)
      if (typeof window !== 'undefined') window.removeEventListener('focus', handleFocus)
    }
  }, [idFromUrl])

  useEffect(() => {
    if (localChat && localChat.length > 0) {
      setLiveChat(prev => deduplicateMessages([...localChat, ...prev]))
    }
  }, [localChat])

  // 2. Expenses & Gallery Hooks (States moved to top)

  useEffect(() => {
    if (!mounted || !idFromUrl) return; 
    const fetchExpenses = async () => {
      if (!navigator.onLine) return
      try {
        const resp = await fetch(`/api/operator/projects/${project?.id || idFromUrl}/expenses?_t=${Date.now()}`, { cache: 'no-store' })
        if (resp.ok) {
          const fresh = await resp.json()
          if (Array.isArray(fresh) && fresh.length > 0) setLocalExpenses(fresh)
        }
      } catch (e) {}
    }
    const expInterval = setInterval(fetchExpenses, 5000)
    return () => clearInterval(expInterval)
  }, [mounted, idFromUrl])

  const allExpenses = useMemo(() => {
    let list = [...localExpenses]
    pendingItems.filter((item: any) => item.type === 'EXPENSE').forEach((item: any) => {
      const p = item.payload || {};
      let receiptUrl = p.receiptPhoto || '';
      
      // v317: Robust receipt preview
      if (!receiptUrl || receiptUrl.startsWith('blob:')) {
        if (p.receiptBase64) {
          receiptUrl = p.receiptBase64;
        } else if (p.receiptFileData) {
          try {
            const data = p.receiptFileData.buffer || p.receiptFileData;
            const blob = new Blob([data], { type: p.receiptMimeType || 'image/jpeg' });
            receiptUrl = URL.createObjectURL(blob);
          } catch(e) {}
        }
      }

      list.push({
        id: `pending-${item.id}`, 
        description: p.description, 
        amount: Number(p.amount),
        receiptPhoto: receiptUrl,
        date: new Date(item.timestamp).toISOString(), 
        isNote: p.isNote, 
        isPending: true, 
        userName: 'Yo (Pendiente)'
      })
    })
    liveChat.filter((msg: any) => msg.type === 'EXPENSE_LOG' || msg.type === 'EXPENSE').forEach((msg: any) => {
      const amount = msg.extraData?.amount ?? msg.amount
      const isNote = msg.extraData?.isNote ?? msg.isNote
      const exists = list.some(le => le.chatMessageId === msg.id || (le.description === msg.content && Math.abs(le.amount - amount) < 0.01))
      if (!exists) {
        list.push({
          id: `chat-exp-${msg.id}`, chatMessageId: msg.id, description: msg.content, amount: Number(amount),
          date: msg.createdAt, isNote: !!isNote, userName: msg.userName || 'Usuario'
        })
      }
    })
    return list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [localExpenses, pendingItems, liveChat])

  const myTotalSpent = useMemo(() => {
    return (allExpenses || []).filter((e: any) => !e.isNote && !e.isPending).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)
  }, [allExpenses])

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseFormFields, setExpenseFormFields, removeExpenseDraft] = useLocalStorage(`project_${idFromUrl}_expense_draft`, {
    amount: '', description: '', isNote: false, date: new Date().toISOString().split('T')[0]
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS'>('ALL')

  const masterGallery = useMemo(() => {
    const pendingDeletions = (pendingItems || []).filter((i: any) => i.type === 'GALLERY_DELETE').map((i: any) => i.payload.galleryId);

    const baseFiles = (project?.gallery || []).filter((item: any) => {
      if (item.isFromChat) return false
      const cat = (item.category || 'MASTER').toUpperCase()
      return cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO'
    }).map((item: any) => {
      if (pendingDeletions.includes(item.id)) return { ...item, isPendingDelete: true };
      return item;
    })
    const expenseFiles = (localExpenses || []).map((exp: any) => ({
      id: `exp-${exp.id}`, url: exp.receiptUrl || '', filename: exp.description || 'Recibo',
      mimeType: exp.receiptUrl ? 'image/jpeg' : 'text/plain', category: 'MASTER', isExpense: true
    })).filter((e: any) => e.url)
    const pendingGallery = (pendingItems || []).filter((item: any) => {
      if (item.type !== 'MEDIA_UPLOAD' && item.type !== 'GALLERY_UPLOAD') return false
      const cat = (item.payload?.category || 'MASTER').toUpperCase()
      return cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO'
    }).map((item: any) => {
      // v317: Use persistent preview logic
      let objUrl = '';
      const p = item.payload || {};
      if (p.url && !p.url.startsWith('blob:')) {
        objUrl = p.url;
      } else if (p.base64) {
        objUrl = p.base64;
      } else if (p.fileData) {
        try {
          const data = p.fileData.buffer || p.fileData;
          const blob = new Blob([data], { type: p.mimeType || 'image/jpeg' });
          objUrl = URL.createObjectURL(blob);
        } catch(e) { console.warn("Failed to create preview blob", e); }
      }
      
      return {
        id: `pending-${item.id}`, 
        url: objUrl || '/placeholder-image.png',
        filename: p.filename || 'Pendiente...', 
        mimeType: p.mimeType || 'image/jpeg',
        category: p.category || 'MASTER', 
        isPending: true
      }
    })
    const list = [...baseFiles, ...expenseFiles, ...pendingGallery]
    return list.filter((item: any) => {
      const url = (item.url || '').toLowerCase();
      const mime = (item.mimeType || '').toLowerCase();
      const isImage = mime.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|heic|svg)$/);
      const isVideo = mime.startsWith('video/') || url.match(/\.(mp4|mov|avi|webm|mkv|3gp|m4v)$/);
      const isAudio = mime.startsWith('audio/') || url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
      if (galleryFilter === 'IMAGES') return isImage;
      if (galleryFilter === 'VIDEOS') return isVideo;
      if (galleryFilter === 'AUDIOS') return isAudio;
      if (galleryFilter === 'DOCS') return !isImage && !isVideo && !isAudio;
      return true;
    })
  }, [project?.gallery, galleryFilter, localExpenses, pendingItems])

  const chatGallery = useMemo(() => {
    const pendingDeletions = (pendingItems || []).filter((i: any) => i.type === 'GALLERY_DELETE').map((i: any) => i.payload.galleryId);

    const fromChat = liveChat.filter((msg: any) => msg.media && msg.media.length > 0).flatMap((msg: any) => msg.media.map((m: any) => ({
      ...m, isFromChat: true, userName: msg.userName, createdAt: msg.createdAt, isPendingDelete: pendingDeletions.some((pdId: any) => String(pdId) === String(m.id))
    })))
    const pendingChat = (pendingItems || []).filter((item: any) => item.type === 'MESSAGE' && item.payload?.media).map((item: any) => {
      const m = item.payload.media;
      let objUrl = '';
      if (m.url && !m.url.startsWith('blob:')) {
        objUrl = m.url;
      } else if (m.base64) {
        objUrl = m.base64;
      } else if (m.fileData) {
        try {
          const data = m.fileData.buffer || m.fileData;
          const blob = new Blob([data], { type: m.mimeType || 'image/jpeg' });
          objUrl = URL.createObjectURL(blob);
        } catch(e) {}
      }

      return {
        id: `pending-chat-${item.id}`, 
        url: objUrl || '/placeholder-image.png',
        filename: m.filename || 'Enviando...', 
        mimeType: m.mimeType || 'image/jpeg',
        isFromChat: true, 
        isPending: true, 
        createdAt: new Date(item.timestamp).toISOString()
      };
    })

    const combined = [...fromChat, ...pendingChat]
    const seen = new Set()
    return combined.filter(m => {
      const uid = m.id
      if (seen.has(uid)) return false
      seen.add(uid)
      return true
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [liveChat, pendingItems])

  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS'>('ALL')
  const evidenceGallery = useMemo(() => {
    if (!project?.gallery) return []
    const pendingDeletions = (pendingItems || []).filter((i: any) => i.type === 'GALLERY_DELETE').map((i: any) => i.payload.galleryId);
    
    const list = [...project.gallery.filter((item: any) => !item.isFromChat && (item.category || '').toUpperCase() === 'EVIDENCE')].map((item: any) => {
      if (pendingDeletions.some((pdId: any) => String(pdId) === String(item.id))) return { ...item, isPendingDelete: true };
      return item;
    })
    const pendingEvidence = (pendingItems || []).filter((item: any) => {
      const isGalleryType = item.type === 'GALLERY_UPLOAD' || item.type === 'MEDIA_UPLOAD'
      const cat = (item.payload?.category || '').toUpperCase()
      // v317: Fix 'Finales' visibility - both 'EVIDENCE' and 'FINALES' mapping
      return isGalleryType && (cat === 'EVIDENCE' || cat === 'FINALES')
    }).map((item: any) => {
      const p = item.payload || {};
      let objUrl = '';
      if (p.url && !p.url.startsWith('blob:')) {
        objUrl = p.url;
      } else if (p.base64) {
        objUrl = p.base64;
      } else if (p.fileData) {
        try {
          const data = p.fileData.buffer || p.fileData;
          const blob = new Blob([data], { type: p.mimeType || 'image/jpeg' });
          objUrl = URL.createObjectURL(blob);
        } catch(e) {}
      }

      return {
        id: `pending-ev-${item.id}`, 
        url: objUrl || '/placeholder-image.png',
        filename: p.filename || 'Pendiente...', 
        mimeType: p.mimeType || 'image/jpeg',
        category: 'EVIDENCE', 
        isPending: true
      }
    })
    const combinedList = [...list, ...pendingEvidence]
    const seen = new Set()
    const uniqueList = combinedList.filter(item => {
      const uid = item.id
      if (seen.has(uid)) return false
      seen.add(uid)
      return true
    })

    if (evidenceFilter === 'ALL') return uniqueList
    return uniqueList.filter((item: any) => {
      const url = (item.url || '').toLowerCase();
      const mime = (item.mimeType || '').toLowerCase();
      const isImage = mime.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|heic|svg)$/);
      const isVideo = mime.startsWith('video/') || url.match(/\.(mp4|mov|avi|webm|mkv|3gp|m4v)$/);
      const isAudio = mime.startsWith('audio/') || url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
      if (evidenceFilter === 'IMAGES') return isImage;
      if (evidenceFilter === 'VIDEOS') return isVideo;
      if (evidenceFilter === 'AUDIOS') return isAudio;
      if (evidenceFilter === 'DOCS') return !isImage && !isVideo && !isAudio;
      return true;
    })
  }, [project?.gallery, evidenceFilter, pendingItems])

  const costoExcedido = useMemo(() => {
    const tBudget = project?.estimatedBudget || 0
    return tBudget > 0 && myTotalSpent > tBudget
  }, [project?.estimatedBudget, myTotalSpent])
  const expenseRatio = useMemo(() => {
    const tBudget = project?.estimatedBudget || 0
    if (tBudget === 0) return 0
    return Math.min((myTotalSpent / tBudget) * 100, 100)
  }, [project?.estimatedBudget, myTotalSpent])
  const totalGastado = myTotalSpent


  const setActiveTabWithUrl = (tab: 'records' | 'chat' | 'gallery') => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'records' || view === 'chat' || view === 'gallery') {
      setActiveTab(view)
    }
  }, [searchParams])




  const [loading, setLoading] = useState(false)
  const [expenseForm, setExpenseForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [expensePhoto, setExpensePhoto] = useState<string | File | null>(null)
  const [chatFilter, setChatFilter] = useState<'all' | 'media' | 'notes' | 'text'>('all')
  const [waForwardMsg, setWaForwardMsg] = useState<any>(null)

  // WhatsApp State
  const [waCategory, setWaCategory] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSuccess, setWaSuccess] = useState(false)

  const waCategories = useMemo(() => [
    { id: 'urgencia', label: '🚨 Urgencia', color: '#ef4444', template: `⚠️ URGENCIA - Proyecto: ${project?.title || ''}\n\nDescripción: ` },
    { id: 'material', label: '📦 Falta de Material', color: '#f59e0b', template: `📦 SOLICITUD DE MATERIAL - Proyecto: ${project?.title || ''}\n\nMaterial requerido: ` },
    { id: 'cotizacion', label: '💰 Cotización', color: '#3b82f6', template: `💰 SOLICITUD DE COTIZACIÓN - Proyecto: ${project?.title || ''}\n\nDetalle: ` },
    { id: 'reporte', label: '📋 Reporte', color: '#8b5cf6', template: `📋 REPORTE DE AVANCE - Proyecto: ${project?.title || ''}\n\nEstado: ` },
    { id: 'otro', label: '💬 Otro', color: '#06b6d4', template: `📌 NOTIFICACIÓN - Proyecto: ${project?.title || ''}\n\n` },
  ], [project?.title])

  const handleWaSend = async () => {
    if (!waPhone.trim() || !waMessage.trim()) {
      alert('Por favor completa el número y el mensaje')
      return
    }
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: waPhone.replace(/\D/g, ''),
          message: waMessage,
          projectId: idFromUrl,
          category: waCategory,
        })
      })
      if (res.ok) {
        setWaSuccess(true)
        setTimeout(() => {
          setWaSuccess(false)
          setWaForwardMsg(null)
          setWaCategory('')
          setWaPhone('')
          setWaMessage('')
        }, 2000)
      } else {
        const data = await res.json()
        alert(data.error || 'Error enviando mensaje de WhatsApp')
      }
    } catch (e) {
      alert('Error de conexión al enviar WhatsApp')
    } finally {
      setWaSending(false)
    }
  }


  // Chat State
  const [message, setMessage, removeMessageDraft] = useLocalStorage(`project_${idFromUrl}_chat_draft`, '')
  const [note, setNote, removeNoteDraft] = useLocalStorage(`project_${idFromUrl}_note_draft`, '')
  const handleDayRecord = async () => {
    setLoading(true)
    try {
      // get location
      let location = null
      if ('geolocation' in navigator) {
        try {
          location = await new Promise<any>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              err => reject(err),
              { timeout: 25000, enableHighAccuracy: true }
            )
          }).catch(() => null)
        } catch(e) {}
      }

      if (!location) {
        alert("⚠️ UBICACIÓN OBLIGATORIA: Por favor activa el GPS y permite el acceso para continuar. Es necesario para la auditoría de campo.")
        setLoading(false)
        return
      }

      const isEnding = activeRecord && Number(activeRecord.projectId) === Number(project.id)
      
      // If we are offline and trying to END, but we don't have an activeRecord.id 
      // (likely because the START was also offline), we send a flag.
      const payload = isEnding 
        ? { recordId: activeRecord.id, projectId: project.id, location }
        : { projectId: project.id, location, findLatestIfEnding: true }
      const type = isEnding ? 'DAY_END' : 'DAY_START'

      // Always try local save first if offline, or if online but flaky
      if (!navigator.onLine) {
        await db.outbox.add({
          type,
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
        triggerBackgroundSync()
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/day-records', {
          method: isEnding ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('Refresh needed')
        startTransition(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
       router.refresh()
     }
        })
      } catch (err) {
        // Fallback to outbox if fetch fails
        await db.outbox.add({
          type,
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
})
        triggerBackgroundSync()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }


  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setLoading(true)

    try {
      let location: any = null
      if ('geolocation' in navigator) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 25000, enableHighAccuracy: true }
          )
        })
      }

      if (!location) {
        alert("⚠️ UBICACIÓN REQUERIDA: No podemos registrar el gasto sin coordenadas de GPS. Por favor activa la ubicación.")
        setLoading(false)
        saveLockRef.current = false;
        return
      }

      const syncId = `expense-${project.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const processExpense = async () => {
        try {
          let processedPhoto = expensePhoto;

          // v301: Robust offline preparation using helper
          let receiptPhotoData: string | ArrayBuffer | null = null;
          let receiptStorageType: 'base64' | 'arraybuffer' | null = null;

          if (processedPhoto) {
            let fileToPrepare: File | null = null;
            
            if (processedPhoto instanceof File) {
              fileToPrepare = processedPhoto;
            } else if (typeof processedPhoto === 'string') {
              if (processedPhoto.startsWith('data:')) {
                // Already base64
                receiptPhotoData = processedPhoto;
                receiptStorageType = 'base64';
              } else if (processedPhoto.startsWith('blob:')) {
                // Convert blob to File first
                try {
                  const response = await fetch(processedPhoto);
                  const blob = await response.blob();
                  fileToPrepare = new File([blob], 'receipt.jpg', { type: blob.type || 'image/jpeg' });
                } catch (e) {
                  console.warn('[Expense] Failed to fetch blob for preparation', e);
                }
              }
            }

            if (fileToPrepare) {
              const prep = await prepareFileForOutbox(fileToPrepare);
              receiptPhotoData = prep.data;
              receiptStorageType = prep.storageType;
            }
          }

          const payload = { 
            amount: Number(amount), 
            description, 
            date: new Date().toISOString(),
            isNote,
            receiptPhoto: receiptStorageType === 'base64' ? (receiptPhotoData as string) : null,
            receiptFileData: receiptStorageType === 'arraybuffer' ? (receiptPhotoData as ArrayBuffer) : null,
            receiptMimeType: 'image/jpeg',
            receiptStorageType
          }

          if (!navigator.onLine) {
            await db.transaction('rw', db.outbox, async () => {
              await db.outbox.add({
                type: 'EXPENSE',
                projectId: project.id,
                payload,
                timestamp: Date.now(),
                lat: location?.lat,
                lng: location?.lng,
                status: 'pending',
                syncId
              })
            })
            triggerBackgroundSync()
            return
          }

          try {
            const res = await fetch(`/api/projects/${project.id}/expenses`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-sync-id': syncId
              },
              body: JSON.stringify({ 
                ...payload,
                lat: location?.lat,
                lng: location?.lng
              })
            })
            if (res.ok) {
              startTransition(() => {
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                  router.refresh()
                }
              })
            }
          } catch (err) {
            await db.transaction('rw', db.outbox, async () => {
              await db.outbox.add({
                type: 'EXPENSE',
                projectId: project.id,
                payload,
                timestamp: Date.now(),
                lat: location?.lat,
                lng: location?.lng,
                status: 'pending',
                syncId
              })
            })
            triggerBackgroundSync()
          }
        } catch (e) {
          console.error("Background expense error:", e)
        }
      }

      setExpenseForm(false)
      removeExpenseDraft()
      await processExpense()
      setLoading(false)
    } catch (e) {
      console.error("Outer expense error:", e)
      setLoading(false)
    } finally {
      saveLockRef.current = false;
    }
  }


  // --- MANUAL REFRESH: Full reset from server ---
  const [isSyncing, setIsSyncing] = useState(false)
  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      // 1. Full fetch of ALL messages — no incremental, no since
      const freshMsgs = await fetchMessages()
      if (freshMsgs.length > 0) {
        setLiveChat(freshMsgs) // Complete replacement
      }
      // 2. Also refresh server component props
      if (typeof navigator !== 'undefined' && navigator.onLine) {
       router.refresh()
     }
    } catch (e) {
      console.error('[MANUAL SYNC] Error:', e)
    } finally {
      setTimeout(() => setIsSyncing(false), 800)
    }
  }

  const handleSendMessage = async (e: React.FormEvent, customMsg?: string, customPhase?: number, mediaFile?: File, extraData?: any, forcedType?: string) => {
    if (e) e.preventDefault()

    const msgToSend = customMsg || message
    const phaseIdToSend = customPhase !== undefined ? customPhase : undefined
    
    if (!msgToSend.trim() && !mediaFile && !customMsg) {
      return
    }
    
    // Generate Sync ID for Idempotency
    const syncId = generateSyncId();

    // Determine type
    const determinedType = forcedType || (extraData?.amount ? 'EXPENSE_LOG' : (
      mediaFile ? (
        mediaFile.type.startsWith('image/') ? 'IMAGE' : 
        mediaFile.type.startsWith('audio/') ? 'AUDIO' : 
        mediaFile.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'
      ) : 'TEXT'
    ))

    // --- OPTIMISTIC UI UPDATE (IMMEDIATE) ---
    const tempId = `temp-${syncId}`
    let tempMediaUrl = null
    if (mediaFile) {
      try { tempMediaUrl = URL.createObjectURL(mediaFile) } catch(e){}
    }
    
    if (!customMsg) removeMessageDraft()
    else removeNoteDraft()

    const currentSeq = Math.max(...liveChat.map(m => m.sequence || 0), 0) + 1;

    const optimisticMessage = {
      id: tempId,
      content: msgToSend,
      type: determinedType,
      media: tempMediaUrl ? { url: tempMediaUrl, mimeType: mediaFile?.type || '' } : null,
      extraData: extraData || null,
      createdAt: new Date().toISOString(),
      sequence: currentSeq, // v317: Phase 3
      isMe: true,
      userName: session?.user?.name || 'Yo',
      userBranch: (session?.user as any)?.branch || null,
      status: 'pending' // Initial status
    };

    setLiveChat((prev: any[]) => [...prev, optimisticMessage]);

    // --- ASYNC BACKGROUND PROCESSING ---
    const processMessage = async () => {
      try {
        let location: any = null
        if (extraData?.lat && extraData?.lng) {
          location = { lat: extraData.lat, lng: extraData.lng }
        } else if ('geolocation' in navigator) {
          location = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve(null),
              { enableHighAccuracy: false, timeout: 5000 }
            )
          })
        }

      let mediaData: any = null
      let uploadErrorOccurred = false;
      
      // Mandatory Compression
      let processedMedia = mediaFile;
      let finalFilename = mediaFile?.name || 'archivo';

      if (mediaFile && navigator.onLine) {
        try {
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          
          if (isCompressibleImage(mediaFile)) {
            processedMedia = (await optimizedCompress(mediaFile)) as File;
            finalFilename = finalFilename.replace(/\.[^/.]+$/, "") + ".webp"
          }

          const uploadResult = await uploadToBunnyClientSide(processedMedia!, finalFilename, `projects/${project.id}/chat`)
          mediaData = {
            url: uploadResult.url,
            filename: uploadResult.filename,
            mimeType: uploadResult.mimeType,
            type: uploadResult.type, // Include the detected type
            category: 'CHAT'
          }
        } catch (uploadError) {
          console.error('[CHAT] Upload error:', uploadError)
          uploadErrorOccurred = true;
        }
      } else if (mediaFile && !navigator.onLine) {
        uploadErrorOccurred = true; 
      }

      const cleanExtraData = extraData ? { ...extraData } : undefined;
      if (cleanExtraData && cleanExtraData.file) delete cleanExtraData.file;

      const payload: any = { 
        projectId: project.id,
        content: msgToSend,
        type: determinedType,
        phaseId: phaseIdToSend,
        extraData: cleanExtraData,
        sequence: currentSeq,
        syncId,
        media: mediaData
      }

      // --- OFFLINE OR UPLOAD ERROR FALLBACK ---
      if (!navigator.onLine || uploadErrorOccurred) {
         
         // 1. PREPARAR EL ARCHIVO FUERA DE LA TRANSACCIÓN (Para evitar TransactionInactiveError)
         if (mediaFile) {
            try {
              const prep = await prepareFileForOutbox(mediaFile);
              payload.media = {
                filename: prep.filename,
                mimeType: prep.mimeType,
                type: determinedType,
                category: 'CHAT',
                storageType: prep.storageType
              };
              
              if (prep.storageType === 'base64') {
                payload.media.base64 = prep.data;
              } else {
                payload.media.fileData = prep.data;
              }
            } catch (e) {
              console.warn('[Offline] Media preparation failed:', e);
            }
         }

         // 2. ABRIR LA TRANSACCIÓN Y GUARDAR
         await db.transaction('rw', db.outbox, async () => {
           await db.outbox.add({
              type: 'MESSAGE',
              projectId: project.id,
              payload: payload,
              timestamp: Date.now(),
              lat: location?.lat,
              lng: location?.lng,
              status: 'pending',
              syncId
           })
         });
         
         setLiveChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'pending_sync' } : m))
         triggerBackgroundSync()
         return
      }

      // --- ONLINE SEND ---
      try {
        const res = await fetch(`/api/projects/${project.id}/messages`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-sync-id': syncId 
            },
            body: JSON.stringify({ ...payload, lat: location?.lat, lng: location?.lng })
        })
        
        if (res.ok) {
          const createdMsg = await res.json()
          setLiveChat(prev => prev.map(m => m.id === tempId ? {
            ...createdMsg,
            isMe: true,
            userName: session?.user?.name || 'Yo',
            userBranch: (session?.user as any)?.branch || null
          } : m))
          
          if (payload.type === 'EXPENSE_LOG') {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              router.refresh()
            }
          }
        } else {
          throw new Error('Server error')
        }
      } catch (e) {
         
         // 1. PREPARAR FALLBACK FUERA DE LA TRANSACCIÓN
         if (mediaFile && !payload.media?.base64 && !payload.media?.fileData) {
           try {
             const fileToStore = isCompressibleImage(mediaFile) ? await optimizedCompress(mediaFile) : mediaFile;
             const base64 = await blobToBase64(fileToStore);
             payload.media = {
               base64: base64,
               filename: mediaFile.name,
               mimeType: mediaFile.type || (isCompressibleImage(mediaFile) ? 'image/webp' : 'application/octet-stream'),
               category: 'CHAT'
             };
           } catch (err) { 
             console.warn('[Offline] Serialisation fallback failed:', err); 
           }
         }

         // 2. ABRIR TRANSACCIÓN Y GUARDAR
         await db.transaction('rw', db.outbox, async () => {
           await db.outbox.add({
              type: 'MESSAGE',
              projectId: project.id,
              payload: payload,
              timestamp: Date.now(),
              lat: location?.lat,
              lng: location?.lng,
              status: 'pending',
              syncId
           })
         });
         
         setLiveChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'pending_sync' } : m))
         triggerBackgroundSync()
      }
      } catch (outerError) {
        console.error("Critical chat error:", outerError);
        setLiveChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
      }
    }

    processMessage();
  }

  const handleUploadToGallery = async (file: ProjectFile, category: string = 'MASTER') => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...file, category })
      })
      if (resp.ok) {
        // Force refresh project data to update gallery
        if (typeof navigator !== 'undefined' && navigator.onLine) {
       router.refresh()
     }
      }
    } catch (e) {
      console.error('Error uploading to gallery:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFromGallery = async (itemId: number) => {
    if (!confirm('¿Eliminar este archivo de la galería?')) return
    setLoading(true)
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, {
        method: 'DELETE'
      })
      if (resp.ok) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
       router.refresh()
     }
      }
    } catch (e) {
      console.error('Error deleting from gallery:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadMedia = async (file: ProjectFile) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setLoading(true)

    try {
      let location: any = null
      if ('geolocation' in navigator) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 5000 }
          )
        })
      }
      
      const isOffline = !navigator.onLine
      const syncId = `gallery-${project.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      let galleryPayload: any = {
        filename: file.filename,
        mimeType: file.mimeType,
        category: file.category || 'EVIDENCE',
        phaseId: undefined,
        url: ''
      };

      if (isOffline) {
        try {
          // v301: Use consistent preparation helper for Gallery
          let fileToPrepare: File;
          if (file.url.startsWith('blob:')) {
            const res = await fetch(file.url);
            const blob = await res.blob();
            fileToPrepare = new File([blob], file.filename, { type: file.mimeType });
          } else {
            // Assume it's already a File or we need to handle data:
            fileToPrepare = new File([], file.filename, { type: file.mimeType });
          }
          
          const prep = await prepareFileForOutbox(fileToPrepare);
          galleryPayload.filename = prep.filename;
          galleryPayload.mimeType = prep.mimeType;
          galleryPayload.storageType = prep.storageType;
          
          if (prep.storageType === 'base64') {
            galleryPayload.url = prep.data;
          } else {
            galleryPayload.fileData = prep.data;
            galleryPayload.url = ''; 
          }
        } catch (e) {
          console.warn('[Gallery] Offline preparation failed:', e);
          galleryPayload.url = file.url; // Fallback
        }

        await db.transaction('rw', db.outbox, async () => {
          await db.outbox.add({
            type: 'GALLERY_UPLOAD',
            projectId: project.id,
            payload: galleryPayload,
            timestamp: Date.now(),
            lat: location?.lat,
            lng: location?.lng,
            status: 'pending',
            syncId
          })
        })
        setLoading(false)
        triggerBackgroundSync()
        saveLockRef.current = false;
        return
      }

      // Online path
      galleryPayload.url = file.url;

      try {
        const res = await fetch(`/api/projects/${project.id}/gallery`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-sync-id': syncId
          },
          body: JSON.stringify({ 
            ...galleryPayload,
            lat: location?.lat,
            lng: location?.lng
          })
        })
        if (!res.ok) throw new Error('Refetch')
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
      } catch (err) {
        await db.transaction('rw', db.outbox, async () => {
          await db.outbox.add({
            type: 'GALLERY_UPLOAD',
            projectId: project.id,
            payload: galleryPayload,
            timestamp: Date.now(),
            lat: location?.lat,
            lng: location?.lng,
            status: 'pending',
            syncId
          })
        })
        triggerBackgroundSync()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      saveLockRef.current = false;
    }
  }

  // Extract all media files from the project chat messages
  // Extract all media files from the project gallery (which now includes chat media from server)
  const projectMediaFiles: ProjectFile[] = useMemo(() => {
    return (project?.gallery || []).map((m: any) => ({
      url: m.url,
      filename: m.filename,
      mimeType: m.mimeType,
      type: m.mimeType?.startsWith('image/') ? 'IMAGE' : m.mimeType?.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'
    }))
  }, [project?.gallery])

  const combinedChat = useMemo(() => {
    // 1. Filter live chat to ensure no gallery/media system messages leak into the feed
    const cleanLiveChat = liveChat.filter((m: any) => {
      const type = (m.type || 'TEXT').toUpperCase();
      // Exclude specific gallery/media types that might be in the stream but belong elsewhere
      if (type === 'GALLERY_UPLOAD' || type === 'MEDIA_UPLOAD') return false;
      return true;
    });

    const list = [
      ...cleanLiveChat.filter((m: any) => !pendingItems.some((p: any) => `temp-${p.syncId}` === m.id)),
      ...pendingItems
        .filter((item: any) => {
          // Explicitly ONLY include chat-related types
          const isChatType = item.type === 'MESSAGE' || item.type === 'EXPENSE';
          const isNotGallery = item.type !== 'GALLERY_UPLOAD' && item.type !== 'MEDIA_UPLOAD';
          return isChatType && isNotGallery;
        })
      .map((item: any) => {
        // Build media array from either existing media or stored file preview
        let mediaArr: any[] = [];
        if (item.payload.media) {
          mediaArr = [{ url: item.payload.media.url || item.payload.media.base64, filename: item.payload.media.filename || item.payload.media.name || 'archivo', mimeType: item.payload.media.mimeType || item.payload.media.type || 'image/jpeg' }];
        } else if (item.payload.receiptPhoto) {
          // Handle EXPENSE type photo
          mediaArr = [{ url: item.payload.receiptPhoto, filename: 'recibo.jpg', mimeType: 'image/jpeg' }];
        } else if (item.payload.previewBase64) {
          mediaArr = [{ url: item.payload.previewBase64, filename: item.payload.fileData?.name || 'Archivo', mimeType: item.payload.fileData?.type || 'image/jpeg' }];
        } else if (item.payload.fileData) {
          try {
            const blob = new Blob([item.payload.fileData.buffer], { type: item.payload.fileData.type });
            const blobUrl = URL.createObjectURL(blob);
            mediaArr = [{ url: blobUrl, filename: item.payload.fileData.name, mimeType: item.payload.fileData.type }];
          } catch (e) {
            mediaArr = [];
          }
        }

        // Determine content for special types
        let displayContent = item.payload.content || '';
        if (item.type === 'EXPENSE' || item.payload.type === 'EXPENSE_LOG') {
          const amt = item.payload.amount || item.payload.extraData?.amount || '0.00';
          const desc = item.payload.description || item.payload.extraData?.description || 'Gasto registrado';
          displayContent = `💰 Gasto: $${amt} - ${desc}`;
        }

        return {
          id: `pending-${item.id}`,
          projectId: item.projectId,
          userId: userId,
          userName: 'Yo (Pendiente)',
          content: displayContent || (item.payload.fileData ? `📎 ${item.payload.fileData.name}` : ''),
          type: item.payload.type || item.type,
          createdAt: new Date(item.timestamp).toISOString(),
          isMe: true,
          isPending: true,
          status: item.status,
          lat: item.lat,
          lng: item.lng,
          phaseId: item.payload.phaseId,
          sequence: item.payload.sequence || 0, // v317: Phase 3
          media: mediaArr
        };
      })
    ];
    // Sort by sequence first (Causal Order), then by createdAt as fallback
    return list.sort((a,b) => {
      if (a.sequence && b.sequence && a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [liveChat, pendingItems, userId])

  const filteredChat = combinedChat.filter((msg: any) => {
    // ALIGNED WITH ADMIN: Show ALL messages. 
    if (chatFilter === 'media') return msg.media && msg.media.length > 0
    if (chatFilter === 'notes') return msg.type === 'NOTE'
    if (chatFilter === 'text') return msg.type === 'TEXT' && (!msg.media || msg.media.length === 0)
    return true
  })

  // Chat scroll state
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)

  useEffect(() => {
    if (activeTab === 'chat' && filteredChat.length > 0) {
      const container = chatContainerRef.current
      if (!container) return
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
      
      if (!isAtBottom) {
        setHasNewMessages(true)
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        setHasNewMessages(false)

        // --- SYNC NOTIFICATIONS ---
        // If we are at the bottom and see new messages, tell the server immediately
        fetch('/api/notifications/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project?.id || idFromUrl })
        }).catch(() => {})
      }
    }
  }, [filteredChat.length, activeTab, project?.id, idFromUrl])


  
  const pendingDayAction = pendingItems.find((item: any) => item.type === 'DAY_START' || item.type === 'DAY_END')

  // --- PDF GENERATORS FOR OFFLINE SUPPORT ---
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return formatToEcuador(d, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return formatToEcuador(d, { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    })
  }

  const fetchFullProjectData = async () => {
    try {
      const resp = await fetch(`/api/projects/${project.id}/export`)
      if (!resp.ok) throw new Error('Failed to fetch full data')
      return await resp.json()
    } catch (e) {
      console.error(e)
      alert('Error descargando datos para la ficha')
      return null
    }
  }

  const generateProjectPDF = async () => {
    setIsDownloadingPdf(true)
    try {
      const fullProject = await fetchFullProjectData()
      if (!fullProject) return

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // ====== PAGE 1: PORTADA + DATOS GENERALES ======
      doc.setFillColor(12, 26, 42)
      doc.rect(0, 0, 210, 55, 'F')
      doc.setDrawColor(56, 189, 248)
      doc.setLineWidth(0.5)
      doc.line(20, 50, 190, 50)

      doc.setTextColor(56, 189, 248)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('AQUATECH S.A.', 20, 18)
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.text('FICHA TÉCNICA DE PROYECTO', 20, 33)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`#${fullProject.id} — ${fullProject.title}`, 20, 43)
      doc.text(`Fecha: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 150, 43)

      let y = 70

      // Categorías and Contratos for merging
      let categories: string[] = []
      let contracts: string[] = []
      try { categories = JSON.parse(fullProject.categoryList || '[]') } catch {}
      try { contracts = JSON.parse(fullProject.contractTypeList || '[]') } catch {}

      // 1. Datos Generales
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('1. DATOS GENERALES', 20, y)
      y += 10

      doc.setTextColor(60, 60, 60)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      const infoRows = [
        ['Título', fullProject.title],
        ['Tipo de Proyecto', translateType(fullProject.type)],
        ['Tipo de Contrato', contracts.map(c => translateType(c)).join(', ') || 'N/A'],
        ['Categorías', categories.map(c => translateCategory(c)).join(', ') || 'N/A'],
        ['Fecha Inicio', formatDate(fullProject.startDate)],
        ['Fecha Fin (Est.)', formatDate(fullProject.endDate)],
        ['Estado Actual', fullProject.status === 'ACTIVO' ? 'En Ejecución' : fullProject.status],
        ['Dirección Texto', `${fullProject.city || ''} ${fullProject.address || ''}`.trim() || 'N/A'],
        ['Ubicación Cliente', (() => {
          const link = fullProject.locationLink;
          return (link && link !== 'N/A' && link.startsWith('http')) ? link : 'No proporcionada';
        })()],
        ['Ubicación Obra (Operador)', (() => {
          const findGpsLink = (text: string) => {
            if (!text) return null
            const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
            return match ? match[0] : null
          }
          const link = findGpsLink(fullProject.technicalSpecs) || findGpsLink(fullProject.specsTranscription) || findGpsLink(fullProject.address);
          return (link && link !== fullProject.locationLink) ? link : 'Ver ubicación principal';
        })()],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Información Detallada']],
        body: infoRows,
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const cellText = data.cell.text[0];
            if (cellText && (cellText.startsWith('http') || cellText.includes('maps'))) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: cellText });
            }
          }
        }
      })
      y = (doc as any).lastAutoTable.finalY + 20

      // 2. Especificaciones Técnicas (The "3" requested, now renumbered as 2)
      let specs: any = {}
      try { specs = JSON.parse(fullProject.technicalSpecs || '{}') } catch {}
      if (specs.description || fullProject.specsTranscription) {
        doc.setTextColor(56, 189, 248)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('2. ESPECIFICACIONES TÉCNICAS', 20, y)
        y += 8
        doc.setTextColor(60, 60, 60)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const specText = fullProject.specsTranscription || specs.description || ''
        const wrapped = doc.splitTextToSize(specText, 170)
        doc.text(wrapped, 20, y)
        y += wrapped.length * 5 + 20
      }

      // ====== PAGE 2: CLIENTE Y EQUIPO ======
      if (y > 220) { doc.addPage(); y = 20; }
      
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('3. INFORMACIÓN DEL CLIENTE', 20, y)
      y += 10

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Valor']],
        body: [
          ['Nombre / Razón Social', fullProject.client?.name || 'N/A'],
          ['Teléfono', fullProject.client?.phone || 'N/A'],
          ['Email', fullProject.client?.email || 'N/A'],
          ['Dirección', fullProject.client?.address || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      })
      y = (doc as any).lastAutoTable.finalY + 20

      // Equipo Asignado
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('4. EQUIPO ASIGNADO', 20, y)
      y += 10

      const teamData = fullProject.team.map((m: any, i: number) => [
        (i + 1).toString(), m.user.name, m.user.role || 'Operador', m.user.phone || 'N/A'
      ])

      autoTable(doc, {
        startY: y,
        head: [['#', 'Nombre', 'Rol', 'Teléfono']],
        body: teamData.length > 0 ? teamData : [['—', 'Sin equipo asignado', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9 }
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text(`Aquatech CRM — Ficha Técnica #${fullProject.id}`, 20, 287)
        doc.text(`Página ${i} de ${pageCount}`, 175, 287)
      }

      doc.save(`Ficha_Tecnica_${fullProject.id}_${fullProject.title.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Error generating project PDF:', err)
      alert('Error al generar el PDF del proyecto')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Reporte de Obra removed for operators/subcontractors as per request

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este gasto?')) return
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await db.outbox.add({
          type: 'EXPENSE_DELETE',
          projectId: project.id,
          payload: { expenseId },
          timestamp: Date.now(),
          status: 'pending'
        })
        setLocalExpenses(prev => prev.filter(e => e.id !== expenseId))
        triggerBackgroundSync()
        return
      }

      const res = await fetch(`/api/projects/${project.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setLocalExpenses(prev => prev.filter(e => e.id !== expenseId))
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingExpense(true)
    try {
      const payload = {
        ...expenseFormFields,
        amount: Number(expenseFormFields.amount)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await db.outbox.add({
          type: 'EXPENSE',
          projectId: project.id,
          payload: { ...payload, id: editingExpense.id },
          timestamp: Date.now(),
          status: 'pending'
        })
        setLocalExpenses(prev => prev.map(ex => ex.id === editingExpense.id ? { ...ex, ...payload } : ex))
        setIsExpenseModalOpen(false)
        setEditingExpense(null)
        triggerBackgroundSync()
        return
      }

      const res = await fetch(`/api/projects/${project.id}/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setLocalExpenses(prev => prev.map(ex => ex.id === editingExpense.id ? { ...ex, ...payload } : ex))
        setIsExpenseModalOpen(false)
        setEditingExpense(null)
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
      }
    } catch (error) {
      console.error('Error updating expense:', error)
    } finally {
      setIsSavingExpense(false)
    }
  }


  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100vh', backgroundColor: '#0c1a2a', color: 'white',
        background: 'radial-gradient(circle at center, #1a2a3a 0%, #0c1a2a 100%)'
      }}>
        <div className="animate-pulse" style={{ marginBottom: '20px' }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: '500', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)' }}>
          Cargando Proyecto Offline...
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
          Sincronizando con base de datos local
        </div>
      </div>
    );
  }

  // v252: Premium Offline Recovery UI (Moved after all hooks to prevent Error #310)
  if (cacheNotFound) {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100vh', width: '100vw', backgroundColor: '#0c1a2a', color: 'white', padding: '40px', textAlign: 'center',
        background: 'radial-gradient(circle at center, #1a2a3a 0%, #0c1a2a 100%)'
      }}>
        <div style={{ 
          width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
          border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.1)'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '-0.02em' }}>Proyecto no disponible offline</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', lineHeight: '1.6', marginBottom: '32px' }}>
          Este proyecto no se encuentra en la memoria local de tu dispositivo. Por favor, conéctate a internet para sincronizarlo.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.reload()}
            className="btn btn-primary"
            style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold' }}
          >
            Reintentar Carga
          </button>
          <button 
            onClick={() => router.push('/admin/operador')}
            className="btn btn-secondary"
            style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            Volver al Listado
          </button>
        </div>
      </div>
    );
  }

  // v228: Loading guard while project data is fetched from Dexie or API
  if (!project && idFromUrl !== 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-deep)', color: 'white', padding: '20px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(56, 189, 248, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }}></div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Preparando Proyecto...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Hidratando memoria local (Dexie)...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
    <div className="project-execution-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-deep)',
      position: 'relative',
    }}>

      {/* Project Header */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid rgba(255,255,255,0.05)', 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        backdropFilter: 'blur(20px)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ 
              fontSize: '0.7rem', 
              color: !mounted ? 'var(--text-muted)' : (isOnline ? 'var(--success)' : 'var(--warning)'), 
              backgroundColor: 'var(--bg-deep)', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              border: '1px solid currentColor', 
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: 'currentColor'
              }}></div>
              {mounted ? (isOnline ? 'EN LÍNEA' : 'MODO OFFLINE') : '...'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{project.clientName || project.client?.name || localClientName}</span>
          </div>
        </div>
      </div>

      {/* ═══════ FICHA COMPLETA DEL PROYECTO (IGUAL A ADMIN) ═══════ */}
      <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '0' }}>
        <div 
          onClick={() => setIsFichaOpen(!isFichaOpen)}
          style={{ 
            padding: '16px 20px', 
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05), rgba(12, 26, 42, 0.3))',
            borderBottom: isFichaOpen ? '1px solid var(--border-color)' : 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Ficha del Proyecto
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isFichaOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s', opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
              </h3>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              onClick={generateProjectPDF}
              disabled={isDownloadingPdf}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.75rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
              {isDownloadingPdf ? 'Generando...' : 'Descargar Ficha Técnica'}
            </button>
          </div>
        </div>

        <div style={{ 
          maxHeight: isFichaOpen ? '2000px' : '0', 
          overflow: 'hidden', 
          transition: 'max-height 0.4s ease-out, opacity 0.3s',
          opacity: isFichaOpen ? 1 : 0
        }}>
          <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              
              {/* Datos Generales */}
              <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Datos Generales</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    ['Tipo', translateType(project.type)],
                    ['Contrato', (() => {
                      try {
                        const parsed = typeof project.contractTypeList === 'string' ? JSON.parse(project.contractTypeList) : project.contractTypeList;
                        return Array.isArray(parsed) ? parsed.join(', ') : 'N/A';
                      } catch { return 'N/A'; }
                    })()],
                    ['Ciudad', localProjectCity || 'N/A'],
                    ['Inicio', formatDate(project.startDate)],
                    ['Fin Est.', formatDate(project.endDate)]
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontWeight: '500' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cliente */}
              <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nombre</span>
                    <span style={{ fontWeight: '500' }}>{localClientName || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Ubicación</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', maxWidth: '70%' }}>
                      {(() => {
                        const findGpsLink = (text: any) => {
                          if (!text || typeof text !== 'string') return null
                          const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
                          return match ? match[0] : null
                        }

                        const clientLoc = project.locationLink && project.locationLink !== 'N/A' ? project.locationLink : null;
                        const operatorLoc = findGpsLink(project.technicalSpecs) || findGpsLink(project.specsTranscription) || findGpsLink(localProjectAddress);
                        
                        const hasClient = !!clientLoc;
                        const hasOperator = !!operatorLoc && operatorLoc !== clientLoc;

                        if (!hasClient && !hasOperator) {
                          return <span style={{ fontWeight: '500', textAlign: 'right' }}>{localProjectAddress || 'N/A'}</span>;
                        }

                        return (
                          <>
                            {hasClient && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación Cliente</span>
                                <a 
                                  href={clientLoc} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  Abrir Google Maps
                                </a>
                              </div>
                            )}
                            {hasOperator && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación Obra / Operador</span>
                                <a 
                                  href={operatorLoc} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  Ver Punto Marcado
                                </a>
                              </div>
                            )}
                            {!hasClient && hasOperator && localProjectAddress && (
                               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>{localProjectAddress}</span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Especificaciones Técnicas */}
              <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Especificaciones Técnicas</h4>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
                  {project.specsTranscription || 'Sin especificaciones detalladas.'}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '15px', 
          paddingTop: '0',
          paddingBottom: '10px',
          paddingLeft: isSmallScreen ? '10px' : '0',
          paddingRight: isSmallScreen ? '10px' : '0',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0
      }}>
        {/* v301: Sync Status Indicator */}
        {(globalPending > 0 || isSyncingGlobal || globalFailed > 0) && (
          <div style={{
            position: 'fixed',
            bottom: isSmallScreen ? '85px' : '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none'
          }}>
            <div style={{
              background: isSyncingGlobal ? 'var(--primary)' : ((globalFailed > 0 || globalPending > 0) ? '#f59e0b' : 'rgba(255,255,255,0.1)'),
              color: isSyncingGlobal ? '#000' : '#fff',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              animation: isSyncingGlobal && globalPending > 0 ? 'pulse 1.5s infinite' : 'none',
              pointerEvents: 'auto',
              opacity: isSyncingGlobal || globalPending > 0 || globalFailed > 0 ? 1 : 0,
              transition: 'all 0.3s ease'
            }}>
              {isSyncingGlobal ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                  Sincronizando...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
                  {globalPending + globalFailed} pendientes de subir
                </>
              )}
            </div>
          </div>
        )}

        {[
          { id: 'records', label: 'Registros', activeColor: 'var(--primary)', bgColor: 'rgba(0, 112, 192, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, gradient: 'linear-gradient(135deg, #0070c0, #38bdf8)' },
          { id: 'chat', label: 'Chat', activeColor: '#25D366', bgColor: 'rgba(37, 211, 102, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>, gradient: 'linear-gradient(135deg, #128C7E, #25D366)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabWithUrl(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: isSmallScreen ? '10px 16px' : '14px 28px',
              borderRadius: '16px',
              background: activeTab === tab.id ? tab.gradient : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.id ? '#000' : tab.activeColor,
              border: `1px solid ${activeTab === tab.id ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: isSmallScreen ? '0.9rem' : '1.1rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: activeTab === tab.id ? `0 8px 25px ${tab.bgColor}` : 'none',
              transform: activeTab === tab.id ? 'scale(1.05)' : 'scale(1)',
              whiteSpace: 'nowrap',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {activeTab === tab.id && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(255,255,255,0.2), transparent)', pointerEvents: 'none' }} />
            )}
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content" style={{ flex: isSmallScreen ? 1 : 'none', display: 'flex', flexDirection: 'column', overflow: isSmallScreen ? 'hidden' : 'visible' }}>
        {/* Main Content Area */}
        <div style={{ 
          flex: 1, 
          padding: activeTab === 'chat' ? '0' : '20px', 
          overflowY: activeTab === 'chat' ? 'hidden' : 'auto', // Fix: prevent infinite scroll in chat
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 1. REGISTROS */}
          <div style={{ 
            display: activeTab === 'records' ? 'grid' : 'none', 
            gap: '20px',
            paddingBottom: isSmallScreen ? '100px' : '0' 
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                
                {/* Equipo Asignado Card */}
                <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: '0px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: '0px', fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      Equipo Asignado
                    </h3>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: '4px 8px' }}
                      onClick={() => {
                        setSelectedTeamIds(localTeam.map(t => t.id))
                        setIsEditingTeam(true)
                      }}
                    >
                      Editar
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', flex: '1 1 0%' }}>
                    {localTeam.length === 0 ? (
                      <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                        Sin equipo asignado
                      </div>
                    ) : (
                      localTeam.map((member: any) => (
                        <div key={member.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '6px 8px', 
                          backgroundColor: 'var(--bg-surface)', 
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.03)',
                          minWidth: 0 // Prevent grid blowout
                        }}>
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--bg-card)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'var(--primary)', 
                            fontWeight: 'bold',
                            fontSize: '0.65rem',
                            flexShrink: 0
                          }}>
                            {member.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{member.name}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{member.role || 'OPERADOR'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Uploader para Planos y Registros */}
                <div className="card" style={{ minWidth: 0, marginBottom: '20px' }}>
                  <ProjectUploader 
                    files={[]}
                    onAddFile={handleUploadMedia}
                    title="🔼 SUBIR ARCHIVOS A: PLANOS Y REGISTROS"
                    defaultCategory="MASTER"
                    showGrid={false}
                    minimal={true}
                  />
                </div>

                {/* Galería Principal (Planos/Fotos Admin) */}
                <div className="card" style={{ minWidth: 0, marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        {GALLERY_LABEL}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{masterGallery.length} Archivos Oficiales</span>
                    </div>
                    
                     <div style={{ paddingBottom: '15px', display: 'flex', gap: '10px', overflowX: 'auto', minHeight: '42px', alignItems: 'center' }} className="hide-scrollbar">
                        {[
                          { id: 'ALL', label: 'Todo' },
                          { id: 'IMAGES', label: 'Fotos' },
                          { id: 'VIDEOS', label: 'Videos' },
                          { id: 'AUDIOS', label: 'Audio' },
                          { id: 'DOCS', label: 'Docs' }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setGalleryFilter(f.id as any)}
                            style={{ 
                              padding: '6px 14px', 
                              borderRadius: '20px', 
                              border: 'none', 
                              background: galleryFilter === f.id ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              minWidth: 'fit-content'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                     </div>

                    <div className="custom-scrollbar" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                      gap: '12px',
                      maxHeight: '450px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}>
                      {masterGallery.map((item: any) => (
                        <div 
                          key={item.id} 
                          className="group"
                          onClick={() => setSelectedPreviewImage(item)}
                          style={{ 
                            position: 'relative', 
                            aspectRatio: '1/1', 
                            borderRadius: '12px', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-surface)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            cursor: 'pointer'
                          }}
                        >
                          {/* v260: Pending Overlays */}
                          {item.isPending && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'var(--warning)', color: 'white', padding: '4px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                          )}
                          {item.isPendingDelete && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 11, background: 'rgba(239, 68, 68, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ background: 'var(--danger)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ELIMINANDO...
                              </div>
                            </div>
                          )}

                          {(() => {
                            const getCleanType = (mime: string, url: string) => {
                              const cleanMime = (mime || '').toLowerCase();
                              if (cleanMime === 'application/octet-stream' || !cleanMime) {
                                const ext = url.split('.').pop()?.toLowerCase();
                                if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg'].includes(ext || '')) return 'image/jpeg';
                                if (['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext || '')) return 'video/mp4';
                                if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) return 'audio/mpeg';
                              }
                              return cleanMime;
                            };

                            const cleanFilename = (name: string) => {
                              if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
                              return name;
                            };

                            const realMime = getCleanType(item.mimeType, item.url);
                            const fileName = cleanFilename(item.filename);

                            if (realMime.startsWith('image/')) {
                              return (
                                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                  <img 
                                    src={item.url} 
                                    alt={fileName} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} 
                                    className="group-hover:scale-110"
                                  />
                                   <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                                     {fileName}
                                   </div>
                                </div>
                              );
                            } else if (realMime.startsWith('video/')) {
                              return (
                                <div style={{ width: '100%', height: '100%', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                   <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                                     {fileName}
                                   </div>
                                </div>
                              );
                            } else {
                              return (
                                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-deep)', padding: '10px', position: 'relative' }}>
                                  {realMime.startsWith('audio/') ? (
                                    <span style={{ fontSize: '2rem' }}>🎵</span>
                                  ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.7 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                  )}
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{fileName}</span>
                                </div>
                              );
                            }
                          })()}

                          {item.isPending && (
                            <div style={{ 
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                              backgroundColor: 'rgba(0,0,0,0.5)', 
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                              zIndex: 10 
                            }}>
                              <span style={{ fontSize: '1.2rem' }}>🕒</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subiendo</span>
                            </div>
                          )}
                          {item.isPendingDelete && (
                            <div style={{ 
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                              backgroundColor: 'rgba(239, 68, 68, 0.6)', 
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                              zIndex: 10,
                              backdropFilter: 'grayscale(100%)'
                            }}>
                              <span style={{ fontSize: '1.2rem' }}>🕒</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Borrando</span>
                            </div>
                          )}

                          {/* Always-visible action badges */}
                          <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 20, display: 'flex', gap: '6px' }}>
                            {/* Delete button */}
                            {!item.isExpense && !item.isFromChat && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }} 
                                style={{ 
                                  width: '28px', height: '28px', borderRadius: '50%', 
                                  backgroundColor: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(4px)',
                                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                  border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                                  transition: 'transform 0.2s, background-color 0.2s',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.85)'; }}
                                title="Eliminar"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                            )}
                            
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDownload(item.url, item.filename); }} 
                              style={{ 
                                width: '28px', height: '28px', borderRadius: '50%', 
                                backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                                transition: 'transform 0.2s, background-color 0.2s',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.9)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.55)'; }}
                              title="Descargar"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                          </div>
                          <div style={{ 
                            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                            padding: '20px 6px 6px', display: 'flex', justifyContent: 'center'
                          }}>
                            <div style={{ 
                              backgroundColor: 'rgba(56, 189, 248, 0.9)', color: 'white', 
                              padding: '3px 10px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '700',
                              display: 'flex', alignItems: 'center', gap: '4px',
                              textTransform: 'uppercase', letterSpacing: '0.5px',
                              boxShadow: '0 2px 8px rgba(56,189,248,0.4)'
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              Ver
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

              {/* Uploader de Finales - Visible para todos en vista de operador para facilitar pruebas y uso */}
              <div className="card" style={{ minWidth: 0 }}>
                <ProjectUploader 
                  files={[]}
                  onAddFile={handleUploadMedia}
                  title="🔼 SUBIR ARCHIVOS A: FINALES (ENTREGA)"
                  defaultCategory="EVIDENCE"
                  showGrid={false}
                  minimal={true}
                />
              </div>

              {/* Galería de Finales integrada en Registros */}
              <div className="card" style={{ minWidth: 0, marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d946ef" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    Archivos Finales
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evidenceGallery.length} Archivos</span>
                </div>
                
                {evidenceGallery.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '12px', opacity: 0.6 }}>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>No hay fotos o videos finales aún.</p>
                  </div>
                ) : (
                  <div className="custom-scrollbar" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}>
                    {evidenceGallery.map((item: any, idx: number) => (
                      <div 
                        key={idx}
                        style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => setSelectedPreviewImage(item)}
                      >
                      {(() => {
                        const getCleanType = (mime: string, url: string) => {
                          if (mime === 'application/octet-stream' || !mime) {
                            const ext = url.split('.').pop()?.toLowerCase();
                            if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg'].includes(ext || '')) return 'image/jpeg';
                            if (['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext || '')) return 'video/mp4';
                            if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) return 'audio/mpeg';
                          }
                          return mime;
                        };

                        const cleanFilename = (name: string) => {
                          if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
                          return name;
                        };

                        const realMime = getCleanType(item.mimeType, item.url);
                        const fileName = cleanFilename(item.filename);

                        if (realMime.startsWith('image/')) {
                          return <img src={item.url} alt={fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                        } else if (realMime.startsWith('video/')) {
                          return (
                            <div style={{ width: '100%', height: '100%', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.5rem', color: 'white' }}>
                                {fileName}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
                              <span style={{ fontSize: '1.2rem' }}>{realMime.startsWith('audio/') ? '🎵' : '📄'}</span>
                              <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.5rem', color: 'white' }}>
                                {fileName}
                              </div>
                            </div>
                          );
                        }
                      })()}

                      {/* Always-visible action badges */}
                      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 20, display: 'flex', gap: '6px' }}>
                        {/* Delete button */}
                        {!item.isFromChat && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }} 
                            style={{ 
                              width: '28px', height: '28px', borderRadius: '50%', 
                              backgroundColor: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(4px)',
                              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                              transition: 'transform 0.2s, background-color 0.2s',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.85)'; }}
                            title="Eliminar"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        )}
                        
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(item.url, item.filename); }} 
                          style={{ 
                            width: '28px', height: '28px', borderRadius: '50%', 
                            backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                            transition: 'transform 0.2s, background-color 0.2s',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.9)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.55)'; }}
                          title="Descargar"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      </div>
                      <div style={{ 
                        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                        padding: '20px 6px 6px', display: 'flex', justifyContent: 'center'
                      }}>
                        <div style={{ 
                          backgroundColor: 'rgba(56, 189, 248, 0.9)', color: 'white', 
                          padding: '3px 10px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '700',
                          display: 'flex', alignItems: 'center', gap: '4px',
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                          boxShadow: '0 2px 8px rgba(56,189,248,0.4)'
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          Ver
                        </div>
                      </div>

                      {item.isPending && (
                        <div style={{ 
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                          backgroundColor: 'rgba(0,0,0,0.5)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: '4px',
                          zIndex: 30
                        }}>
                          <span style={{ fontSize: '1.2rem' }}>🕒</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendiente</span>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                )}
              </div>
              </div>

              {/* NOTAS DE GASTO - Solo visualización */}
              {allExpenses.filter(e => e.isNote).length > 0 && (
                <div className="card" style={{ minWidth: 0, marginTop: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    Notas de Gasto
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allExpenses.filter(e => e.isNote).map((note: any) => (
                      <div key={note.id} style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{note.userName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDateEcuador(note.date)}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', margin: 0 }}>{note.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        {/* End of REGISTROS */}
    
    {/* 2. CHAT UNIFICADO - MODAL APPROACH */}
        {activeTab === 'chat' && (
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: isSmallScreen ? '#0b141a' : 'rgba(0,0,0,0.85)', 
              backdropFilter: isSmallScreen ? 'none' : 'blur(10px)',
              zIndex: 10000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: isSmallScreen ? '0' : '40px' 
            }} 
            onClick={() => !isSmallScreen && setActiveTab('records')}
          >
            <div 
              style={{ 
                width: '100%', 
                maxWidth: isSmallScreen ? '100%' : '1000px', 
                height: isSmallScreen ? '100%' : '85%', 
                backgroundColor: '#0b141a', 
                borderRadius: isSmallScreen ? '0' : '24px', 
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column', 
                position: 'relative', 
                boxShadow: isSmallScreen ? 'none' : '0 25px 60px rgba(0,0,0,0.6)',
                border: isSmallScreen ? 'none' : '1px solid rgba(255,255,255,0.1)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              
              <ProjectChatUnified
                project={project}
                messages={combinedChat} 
                userId={userId}
                isSending={isSendingMessage}
                isOperatorView={isFieldStaff}
                onDayAction={handleDayRecord}
                activeRecord={activeRecord}
                backUrl={panelBase} 
                onBack={() => setActiveTab('records')}
                onSendMessage={(content, type, extraData) => {
                  const isTechnicalAction = type === 'EXPENSE_LOG' || type === 'FILE' || type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO'
                  /* Session validation removed */

                  if (type === 'EXPENSE_LOG') {
                     handleSendMessage(null as any, content, undefined, extraData?.file, extraData, 'EXPENSE_LOG');
                  } else if (type === 'FILE' || type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO') {
                     handleSendMessage(null as any, content || '', undefined, extraData?.file, null, type);
                  } else {
                     handleSendMessage(null as any, content, undefined, undefined, extraData, type);
                  }
                }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
      {/* End of Section Containers */}

      {/* WhatsApp Forward Modal */}
      {waForwardMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setWaForwardMsg(null)}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Reenviar por WhatsApp</span>
              </div>
              <button onClick={() => setWaForwardMsg(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-deep)', borderRadius: '8px', borderLeft: '3px solid var(--primary)', fontSize: '0.85rem', color: 'var(--text-secondary)', maxHeight: '100px', overflow: 'auto' }}>
                {waForwardMsg.content || '[Multimedia]'}
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0' }}>Selecciona la categoría y completa los datos:</p>

              {!waCategory ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {waCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setWaCategory(cat.id); setWaMessage(`${cat.template}\n\n--- Mensaje original ---\n${waForwardMsg.content || '[Multimedia]'}`) }}
                      style={{ padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', textAlign: 'left', borderLeft: `4px solid ${cat.color}`, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; e.currentTarget.style.transform = 'translateX(4px)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateX(0)' }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <button onClick={() => { setWaCategory(''); setWaMessage(''); setWaPhone('') }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', alignSelf: 'flex-start', fontSize: '0.8rem', padding: 0 }}>← Cambiar categoría</button>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Número de WhatsApp</label>
                    <input type="tel" className="form-input" placeholder="593967491847" value={waPhone} onChange={e => setWaPhone(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Mensaje</label>
                    <textarea className="form-input" rows={4} value={waMessage} onChange={e => setWaMessage(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
                  </div>
                  <button
                    onClick={async () => { await handleWaSend(); }}
                    disabled={waSending || !waPhone.trim() || !waMessage.trim()}
                    style={{ padding: '12px', background: waSending ? '#128C7E' : '#25D366', color: 'white', border: 'none', borderRadius: '10px', cursor: waSending ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!waPhone.trim() || !waMessage.trim()) ? 0.5 : 1 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {waSending ? 'Enviando...' : 'Enviar por WhatsApp'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Edit Modal */}
      {isEditingTeam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Gestionar Equipo</h3>
              <button onClick={() => setIsEditingTeam(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availableOperators.map((op: any) => {
                  const isSelected = selectedTeamIds.includes(op.id)
                  return (
                    <div 
                      key={op.id} 
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTeamIds(prev => prev.filter(id => id !== op.id))
                        } else {
                          setSelectedTeamIds(prev => [...prev, op.id])
                        }
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '12px', 
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {op.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? 'bold' : 'normal' }}>{op.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{op.phone || 'Sin teléfono'}</div>
                        </div>
                      </div>
                      <div style={{ 
                        width: '20px', height: '20px', borderRadius: '6px', 
                        border: '2px solid var(--primary)',
                        backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsEditingTeam(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveTeam}
                disabled={isSavingTeam}
                style={{ flex: 2 }}
              >
                {isSavingTeam ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {selectedPreviewImage && (() => {
        const getCleanType = (item: any) => {
          let mime = item.mimeType || item.type || 'application/octet-stream';
          
          // Handle Prisma Enum Types
          if (mime === 'IMAGE') return 'image/jpeg';
          if (mime === 'VIDEO') return 'video/mp4';
          if (mime === 'AUDIO') return 'audio/mpeg';
          if (mime === 'DOCUMENT') return 'application/pdf';

          if (mime === 'application/octet-stream' || !mime.includes('/')) {
            const urlPath = item.url ? item.url.split('?')[0] : '';
            const ext = urlPath.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg'].includes(ext || '')) return 'image/jpeg';
            if (['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext || '')) return 'video/mp4';
            if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) return 'audio/mpeg';
          }
          return mime.toLowerCase();
        };

        const cleanFilename = (name: string) => {
          if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
          return name;
        };

        const previewMime = getCleanType(selectedPreviewImage);
        const isImage = previewMime.startsWith('image/');
        const isVideo = previewMime.startsWith('video/');
        const isAudio = previewMime.startsWith('audio/');

        return (
          <div 
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
            onClick={() => setSelectedPreviewImage(null)}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedPreviewImage(null); }}
                style={{ 
                  position: 'absolute', 
                  top: isSmallScreen ? '10px' : '-40px', 
                  right: isSmallScreen ? '10px' : '0', 
                  background: isSmallScreen ? 'rgba(0,0,0,0.5)' : 'none', 
                  border: 'none', 
                  color: 'white', 
                  fontSize: '1.8rem', 
                  cursor: 'pointer', 
                  zIndex: 20,
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
              
              {isImage ? (
                <img 
                  src={selectedPreviewImage.url} 
                  alt={selectedPreviewImage.filename} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : isVideo ? (
                <video 
                  src={selectedPreviewImage.url}
                  controls 
                  autoPlay 
                  muted
                  playsInline
                  preload="auto"
                  style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', outline: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Tu navegador no soporta el video.
                </video>
              ) : isAudio ? (
                <div 
                  style={{ backgroundColor: 'var(--bg-card)', padding: '40px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{cleanFilename(selectedPreviewImage.filename)}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Audio / Grabación</p>
                  </div>
                  <audio src={selectedPreviewImage.url} controls autoPlay style={{ width: '100%' }} />
                  <button onClick={() => handleDownload(selectedPreviewImage.url, selectedPreviewImage.filename)} className="btn btn-ghost" style={{ width: '100%', border: '1px solid var(--border-color)', marginTop: '10px' }}>
                    {handleDownloadLoading === selectedPreviewImage.url ? 'Descargando...' : 'Descargar'}
                  </button>
                </div>
              ) : (
                <div 
                  style={{ backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px', width: '100%' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{cleanFilename(selectedPreviewImage.filename)}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{previewMime}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    <button onClick={() => window.open(selectedPreviewImage.url, '_blank')} className="btn btn-primary" style={{ width: '100%' }}>Abrir Documento</button>
                    <button onClick={() => handleDownload(selectedPreviewImage.url, selectedPreviewImage.filename)} className="btn btn-ghost" style={{ width: '100%', border: '1px solid var(--border-color)' }}>{handleDownloadLoading === selectedPreviewImage.url ? 'Descargando...' : 'Descargar'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODAL PARA EDITAR GASTOS (OPERADOR) */}
      {isExpenseModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '25px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Editar Gasto/Nota</h3>
            <form onSubmit={handleUpdateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" step="0.01" className="form-input" value={expenseFormFields.amount} onChange={e => setExpenseFormFields({...expenseFormFields, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input type="text" className="form-input" value={expenseFormFields.description} onChange={e => setExpenseFormFields({...expenseFormFields, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={expenseFormFields.date} onChange={e => setExpenseFormFields({...expenseFormFields, date: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="opIsNote" checked={expenseFormFields.isNote} onChange={e => setExpenseFormFields({...expenseFormFields, isNote: e.target.checked})} />
                <label htmlFor="opIsNote">¿Es solo una nota?</label>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSavingExpense}>
                  {isSavingExpense ? '...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Mobile Navigation Footer Removed to use Global Footer */}
    </>
  )
}
