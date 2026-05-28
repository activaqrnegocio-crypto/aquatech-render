'use client'

import { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
// Fase 4: Removed unused jsPDF + autoTable + pdf-generator static imports (~400KB dead weight)
// If PDF generation is needed in the future, use: const { jsPDF } = await import('jspdf')
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

import OperatorHeader from './operator/OperatorHeader'
import OperatorFicha from './operator/OperatorFicha'
import OperatorGalleryGrid from './operator/OperatorGalleryGrid'
import ProjectEditModal from './project/ProjectEditModal'
import ProjectTeamSection from './project/ProjectTeamSection'
import OperatorWhatsAppModal from './operator/OperatorWhatsAppModal'
import OperatorExpenseModal from './operator/OperatorExpenseModal'
import LightboxPreview from './project/LightboxPreview'
import { useProjectCache } from '@/hooks/useProjectCache'
import { useProjectActions } from '@/hooks/useProjectActions'


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
  // 1. Logic Hooks (Shared with Admin)
  const {
    idFromUrl,
    project,
    localProject,
    localChat,
    setLocalProject,
    setLocalChat,
    isOfflineMode,
    isSyncingOffline,
    cacheNotFound,
    triggerBackgroundSync,
    deduplicateMessages,
    pendingItems,
  } = useProjectCache({ role: 'operator', initialProject, initialChat })

  const {
    handleSaveProject,
    handleDeleteGalleryItem,
    isSavingProject,
  } = useProjectActions({ 
    project, 
    setLocalProject, 
    triggerBackgroundSync,
    onSuccess: (type) => {
      if (type === 'PROJECT_UPDATE') setIsEditingProject(false)
    }
  })

  // 2. UI State
  const [mounted, setMounted] = useState(false)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'records' | 'chat'>('records')
  const [isFichaOpen, setIsFichaOpen] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [localExpenses, setLocalExpenses] = useState<any[]>(expenses || [])
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<any>(null)
  const [handleDownloadLoading, setHandleDownloadLoading] = useState<string | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [recentlySyncedItems, setRecentlySyncedItems] = useState<any[]>([]) // v400: Bridge for disappearing items
  const [optimisticUploads, setOptimisticUploads] = useState<any[]>([]) // v401: Optimistic UI for online uploads

  // v402: Cache availableOperators for offline (mirrors admin pattern)
  const cachedOperators = useLiveQuery(() => db.usersCache.toArray()) || [];
  const resolvedOperators = useMemo(() => {
    if (availableOperators && availableOperators.length > 0) return availableOperators;
    return cachedOperators;
  }, [availableOperators, cachedOperators]);

  // Sync operators to cache when online
  useEffect(() => {
    if (availableOperators && availableOperators.length > 0) {
      db.usersCache.bulkPut(availableOperators.map((u: any) => ({
        id: u.id,
        name: u.name,
        role: u.role || 'OPERATOR'
      }))).catch(() => {});
    }
  }, [availableOperators]);

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const { pending: globalPending, failed: globalFailed, syncing: isSyncingGlobal, lastError: globalLastError } = useOutboxStatus()

  // 3. Refs & Helpers
  const localChatInitialized = useRef(false)
  const localChatRef = useRef<any[]>([])
  useEffect(() => { localChatRef.current = localChat }, [localChat])

  const fetchMessages = useCallback(async (since?: string) => {
    try {
      const url = `/api/projects/${idFromUrl}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch (e) { console.error('Fetch msgs error:', e) }
    return []
  }, [idFromUrl])

  // v480: Refresh entire project data from API and update localState + Dexie Cache (syncs team, phases, budget, gallery)
  const refreshProject = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      const res = await fetch(`/api/projects/${idFromUrl}?_t=${Date.now()}`)
      if (res.ok) {
        const fresh = await res.json()
        if (fresh && !fresh.error) {
          setLocalProject((prev: any) => {
            if (!prev) return fresh
            const updated = { ...prev, ...fresh }
            db.projectsCache.put({ ...updated, lastAccessedAt: Date.now() }).catch(() => {})
            return updated
          })
        }
      }
    } catch (e) {
      console.warn('[Operator Project Sync] Failed to refresh project:', e)
    }
  }, [idFromUrl, setLocalProject])

  const refreshGallery = useCallback(async () => {
    await refreshProject()
  }, [refreshProject])

  const handleDownload = async (url: string, filename: string) => {
    setHandleDownloadLoading(filename)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      console.error('Download error:', e)
      alert('Error al descargar el archivo')
    } finally {
      setHandleDownloadLoading(null)
    }
  }

  const saveLockRef = useRef(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 4. Lifecycle Effects
  useEffect(() => {
    setMounted(true)
    const checkSize = () => setIsSmallScreen(window.innerWidth < 768)
    checkSize()
    window.addEventListener('resize', checkSize)
    
    const handleSyncSuccess = (e: any) => {
      const { type, projectId: syncProjectId, payload, result } = e.detail;
      if (syncProjectId === idFromUrl) {
        // vXXX: Optimistic UI — immediately add synced item to localProject.gallery
        // so it appears instantly without waiting for refreshGallery() API response.
        if (type === 'MEDIA_UPLOAD' || type === 'GALLERY_UPLOAD') {
          const syncedItem = {
            id: result?.id || `synced-${Date.now()}-${Math.random()}`,
            url: result?.url || payload?.url || payload?.previewBase64 || '',
            filename: result?.filename || payload?.filename || 'Archivo',
            mimeType: result?.mimeType || payload?.mimeType || 'image/jpeg',
            category: result?.category || payload?.category || 'MASTER',
            createdAt: new Date().toISOString()
          };
          
          // Limpiar optimistic items con el mismo filename (evita duplicado visual offline)
          setOptimisticUploads(prev => prev.filter(i => 
            i.filename !== syncedItem.filename && i.filename !== (payload?.filename || '')
          ));
          
          // Step 1: Optimistic add to localProject — appears instantly
          setLocalProject((prev: any) => {
            if (!prev) return prev;
            const existingGallery = prev.gallery || [];
            // Avoid duplicates
            const alreadyThere = existingGallery.some((g: any) => 
              g.url === syncedItem.url || g.filename === syncedItem.filename
            );
            if (alreadyThere) return prev;
            return { ...prev, gallery: [syncedItem, ...existingGallery] };
          });
          
          // Step 2: Also add to recentlySyncedItems bridge (fallback)
          setRecentlySyncedItems(prev => [...prev, { ...syncedItem, isSynced: true, timestamp: Date.now() }]);
          setTimeout(() => {
             setRecentlySyncedItems(prev => prev.filter(i => i.id !== syncedItem.id));
          }, 30000);
          
          // Step 3: Background refresh to get canonical data from server
          refreshGallery();
        } else if (['TEAM_UPDATE', 'PROJECT_UPDATE', 'PHASE_UPDATE', 'EXPENSE', 'EXPENSE_LOG', 'GALLERY_DELETE'].includes(type)) {
          refreshGallery();
        }
        if (type === 'MESSAGE') {
          fetchMessages();
        }
      }
    }

    window.addEventListener('sync-success', handleSyncSuccess)
    
    // v480: Focus listener to pull latest database changes automatically
    const handleWindowFocus = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        refreshGallery();
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    
    // Deep Link
    const view = searchParams?.get('view')
    if (view === 'chat') setActiveTab('chat')
    else if (view === 'gallery' || view === 'team' || view === 'expenses' || view === 'records') setActiveTab('records')

    return () => {
      window.removeEventListener('resize', checkSize)
      window.removeEventListener('sync-success', handleSyncSuccess)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [idFromUrl])

  // v480: Periodic background refresh to sync complete project details every 30s
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => {
      refreshGallery()
    }, 30000) // Every 30s catch-all project refresh
    return () => clearInterval(interval)
  }, [isOnline, refreshGallery])

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

    if (!localChatInitialized.current) {
      localChatInitialized.current = true
      fetchMessages().then(msgs => {
        if (msgs && msgs.length > 0) {
          setLocalChat(msgs)
          markAsSeen()
        }
      })
    }

        // v365: Counter for periodic full refresh to catch offline-synced messages
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      if (typeof document !== 'undefined' && document.hidden) return
      pollCount++;
      try {
        // v365: Every 6th poll (~30s), do a FULL fetch to catch offline messages
        // that were synced with older timestamps (skipped by incremental 'since')
        if (pollCount % 6 === 0) {
          const allMsgs = await fetchMessages()
          if (allMsgs && allMsgs.length > 0) {
            setLocalChat((prev: any[]) => deduplicateMessages([...prev, ...allMsgs]))
          }
          return;
        }
        // Normal incremental poll
        const currentChat = localChatRef.current
        const lastMsg = currentChat[currentChat.length - 1]
        const since = lastMsg?.createdAt
        const freshMsgs = await fetchMessages(since)
        if (freshMsgs && freshMsgs.length > 0) {
          setLocalChat((prev: any[]) => deduplicateMessages([...prev, ...freshMsgs]))
        }
      } catch (err) { console.error(err) }
    }, 5000) // Reverted to 5s per user request for immediate chat feedback
    
    const handleFocus = () => fetchMessages().then(msgs => {
      if (msgs && msgs.length > 0) {
        setLocalChat((prev: any[]) => deduplicateMessages([...prev, ...msgs]))
      }
    })

    if (typeof window !== 'undefined') window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(pollInterval)
      if (typeof window !== 'undefined') window.removeEventListener('focus', handleFocus)
    }
  }, [idFromUrl, fetchMessages, deduplicateMessages])

  // v412: Escuchar evento de sincronización exitosa para limpiar el estado de "Sincronizando..."
  useEffect(() => {
    const handleSyncSuccess = (event: any) => {
      const { type, projectId } = event.detail || {};
      
      // v413: Comparación robusta de IDs (soporta strings, números y prefijos 'pending-')
      const idStr = String(idFromUrl);
      const eventIdStr = String(projectId);
      const matchesId = idStr === eventIdStr || 
                        Number(idFromUrl) === Number(projectId) ||
                        idStr.includes(eventIdStr) || 
                        eventIdStr.includes(idStr);

      if (type === 'TEAM_UPDATE' && matchesId) {
        console.log('[ProjectExecutionClient] Team sync success detected, clearing badge...');
        // Limpiar el flag en el estado local inmediatamente
        if (setLocalProject) {
          setLocalProject((prev: any) => prev ? { ...prev, _pendingTeamSync: false } : prev);
        }
        // Opcional: refrescar datos completos del proyecto
        if (refreshProject) refreshProject();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-success', handleSyncSuccess);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('sync-success', handleSyncSuccess);
      }
    };
  }, [idFromUrl, refreshProject, setLocalProject])

  useEffect(() => {
    if (localChat && localChat.length > 0) {
      setLocalChat(prev => deduplicateMessages([...localChat, ...prev]))
    }
  }, [localChat, deduplicateMessages])

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
    const expInterval = setInterval(fetchExpenses, 30000)

    // v400: Listen for background sync successes to refresh UI state
    const handleSyncSuccess = (e: any) => {
      const { type, projectId: syncProjectId } = e.detail;
      if (Number(syncProjectId) === Number(idFromUrl)) {
        if (type === 'TEAM_UPDATE' || type === 'PROJECT_UPDATE') {
          // Re-fetch or at least clear skeleton flags if any
          if (navigator.onLine) {
            fetch(`/api/projects/${idFromUrl}`)
              .then(r => r.json())
              .then(data => {
                if (data && !data.error) {
                  setLocalProject(data);
                  // Update cache too
                  db.projectsCache.put({ ...data, lastAccessedAt: Date.now() }).catch(() => {});
                }
              }).catch(() => {});
          }
        }
      }
    };

    window.addEventListener('sync-success' as any, handleSyncSuccess);
    return () => {
      clearInterval(expInterval)
      window.removeEventListener('sync-success' as any, handleSyncSuccess);
    }
  }, [mounted, idFromUrl, setLocalProject])

  // v440: On mount, immediately read from Dexie cache to show files synced while user was away.
  // The Worker already updates db.projectsCache when it syncs a GALLERY_UPLOAD.
  // Without this, the component waits 500ms then fetches from API (which can be stale).
  useEffect(() => {
    if (!mounted || !idFromUrl) return;

    const applyDexieCache = async () => {
      try {
        const cached = await db.projectsCache.get(Number(idFromUrl));
        if (cached?.gallery && cached.gallery.length > 0) {
          setLocalProject((prev: any) => {
            if (!prev) return prev;
            const existingIds = new Set((prev.gallery || []).map((g: any) => String(g.id)));
            const newItems = cached.gallery.filter((g: any) => !existingIds.has(String(g.id)));
            if (newItems.length > 0) {
              console.log(`[Gallery] 🗃 Merged ${newItems.length} synced item(s) from Dexie cache on mount`);
              return { ...prev, gallery: [...newItems, ...(prev.gallery || [])] };
            }
            return prev;
          });
        }
      } catch (e) {}
    };
    applyDexieCache();

    // Listen for force-gallery-refresh from SyncToast click
    const handleForceRefresh = (e: any) => {
      const { projectId: evtProjectId } = e.detail || {};
      if (!evtProjectId || String(evtProjectId) === String(idFromUrl)) {
        refreshGallery();
      }
    };
    window.addEventListener('force-gallery-refresh', handleForceRefresh);

    // First API fetch after 500ms (for post-recovery)
    const initialTimer = setTimeout(refreshGallery, 500);
    
    // v373: Periodic refresh every 45s — skip when outbox is actively syncing
    const periodicInterval = setInterval(() => {
      if (navigator.onLine && !isSyncingGlobal) refreshGallery();
    }, 45000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicInterval);
      window.removeEventListener('force-gallery-refresh', handleForceRefresh);
    };
  }, [mounted, idFromUrl, refreshGallery]);

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
    localChat.filter((msg: any) => msg.type === 'EXPENSE_LOG' || msg.type === 'EXPENSE').forEach((msg: any) => {
      const parsedExtra = typeof msg.extraData === 'string' ? JSON.parse(msg.extraData) : (msg.extraData || {})
      const amount = parsedExtra.amount ?? msg.amount
      const isNote = parsedExtra.isNote ?? msg.isNote
      const exists = list.some(le => le.chatMessageId === msg.id || (le.description === msg.content && Math.abs(le.amount - amount) < 0.01))
      if (!exists) {
        list.push({
          id: `chat-exp-${msg.id}`, chatMessageId: msg.id, description: msg.content, amount: Number(amount),
          date: msg.createdAt, isNote: !!isNote, userName: msg.userName || 'Usuario'
        })
      }
    })
    return list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [localExpenses, pendingItems, localChat])

  const myTotalSpent = useMemo(() => {
    return (allExpenses || []).filter((e: any) => !e.isNote && !e.isPending).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)
  }, [allExpenses])

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseFormFields, setExpenseFormFields, removeExpenseDraft] = useLocalStorage(`project_${idFromUrl}_expense_draft`, {
    amount: '', description: '', isNote: false, date: new Date().toISOString().split('T')[0]
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS' | 'EXPENSES'>('ALL')

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
      const cat = (item.payload?.category || '').toUpperCase()
      // v329: Only show in Planos if it strictly belongs here. Don't steal from Finales.
      return cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO';
    })
    // vXXX: Excluir items que ya están en optimisticUploads (evita duplicado visual)
    .filter((item: any) => {
      const filename = item.payload?.filename;
      return !optimisticUploads.some((o: any) => o.isPending && o.filename === filename);
    })
    .map((item: any) => {
      // v441: CRITICAL FIX — Detect raw File object for preview
      let objUrl = '';
      const p = item.payload || {};
      
      // v441: Priority 1 — Raw File object (from structured clone in IndexedDB)
      const rawFile = p.file;
      const hasRawFile = !!(rawFile && typeof rawFile === 'object' && 
        typeof rawFile.size === 'number' && rawFile.size > 0 &&
        typeof rawFile.slice === 'function');

      if (hasRawFile) {
        try {
          objUrl = URL.createObjectURL(rawFile as Blob);
        } catch(e) { console.warn('[Gallery] Failed to create objectURL from File:', e); }
      } else if (p.url && !p.url.startsWith('blob:')) {
        objUrl = p.url;
      } else if (p.base64 && typeof p.base64 === 'string' && p.base64.startsWith('data:')) {
        objUrl = p.base64;
      } else if (p.fileData) {
        try {
          const data = p.fileData.buffer || p.fileData;
          const dataSize = data?.byteLength || data?.length || 0;
          if (dataSize > 5 * 1024 * 1024) {
            objUrl = '';
          } else {
            const blob = new Blob([data], { type: p.mimeType || 'image/jpeg' });
            objUrl = URL.createObjectURL(blob);
          }
        } catch(e) { console.warn("Failed to create preview blob", e); }
      }

      // v335: Si no hay URL válida y es imagen, usar placeholder
      if (!objUrl && (p.mimeType || '').startsWith('image/')) {
        objUrl = '/placeholder-image.png';
      }

      // v372: Pass actual sync status for proper UI feedback
      const syncStatus = item.status || 'pending';
      
      return {
        id: `pending-${item.id}`, 
        url: objUrl || '/placeholder-image.png',
        filename: p.filename || 'Pendiente...', 
        mimeType: p.mimeType || 'image/jpeg',
        category: p.category || 'MASTER', 
        isPending: syncStatus === 'pending',
        isSyncing: syncStatus === 'syncing',
        isFailed: syncStatus === 'failed',
        syncStatus,
        createdAt: new Date(item.timestamp || Date.now()).toISOString()
      }
    })
    
    // v400: Include recently synced items that might not be in project.gallery yet
    // v402: No longer mark as isRecentlySynced — show as normal gallery items
    const syncedGallery = recentlySyncedItems.filter(i => {
       const cat = (i.category || 'MASTER').toUpperCase();
       return (cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO') && 
              !(project?.gallery || []).some((g: any) => g.url === i.url || g.filename === i.filename);
    });

    const optimisticMaster = optimisticUploads.filter((item: any) => {
      const cat = (item.category || '').toUpperCase()
      return cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO'
    });

    // v403: Optimistic uploads go FIRST to match server order (createdAt DESC = newest first)
    const list = [...optimisticMaster, ...syncedGallery, ...pendingGallery, ...baseFiles, ...expenseFiles]
    return list.filter((item: any) => {
      const url = (item.url || '').toLowerCase();
      const mime = (item.mimeType || '').toLowerCase();
      const isImage = mime.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|heic|svg)$/);
      const isVideo = mime.startsWith('video/') || url.match(/\.(mp4|mov|avi|webm|mkv|3gp|m4v)$/);
      const isAudio = mime.startsWith('audio/') || url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
      if (galleryFilter === 'IMAGES') return isImage;
      if (galleryFilter === 'VIDEOS') return isVideo;
      if (galleryFilter === 'AUDIOS') return isAudio;
      if (galleryFilter === 'DOCS') return !isImage && !isVideo && !isAudio && !item.isExpense;
      if (galleryFilter === 'EXPENSES') return !!item.isExpense;
      return true;
    }).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.date || a.timestamp || 0).getTime()
      const dateB = new Date(b.createdAt || b.date || b.timestamp || 0).getTime()
      return dateB - dateA
    })
  }, [project?.gallery, galleryFilter, localExpenses, pendingItems, optimisticUploads, recentlySyncedItems])

  const chatGallery = useMemo(() => {
    const pendingDeletions = (pendingItems || []).filter((i: any) => i.type === 'GALLERY_DELETE').map((i: any) => i.payload.galleryId);

    const fromChat = localChat.filter((msg: any) => msg.media && msg.media.length > 0).flatMap((msg: any) => msg.media.map((m: any) => ({
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
          // v373: Skip blob URL for large files (>5MB) to prevent OOM
          const dataSize = data?.byteLength || data?.length || 0;
          if (dataSize <= 5 * 1024 * 1024) {
            const blob = new Blob([data], { type: m.mimeType || 'image/jpeg' });
            objUrl = URL.createObjectURL(blob);
          }
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
  }, [localChat, pendingItems])

  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS' | 'EXPENSES'>('ALL')
  const evidenceGallery = useMemo(() => {
    // v372: Don't return [] immediately if gallery is undefined — pending items should still show
    const existingGallery = project?.gallery || [];
    const pendingDeletions = (pendingItems || []).filter((i: any) => i.type === 'GALLERY_DELETE').map((i: any) => i.payload.galleryId);
    
    const list = [...existingGallery.filter((item: any) => {
      const cat = (item.category || '').toUpperCase();
      // v332: Support more tags for final delivery gallery
      return !item.isFromChat && (cat === 'EVIDENCE' || cat === 'FINALES' || cat === 'ENTREGA' || cat === 'ENTREGA_FINAL' || cat === 'ADJUNTO' || cat === 'MASTER_FINAL');
    })].map((item: any) => {
      if (pendingDeletions.some((pdId: any) => String(pdId) === String(item.id))) return { ...item, isPendingDelete: true };
      return item;
    })

    const pendingEvidence = (pendingItems || []).filter((item: any) => {
      const isGalleryType = item.type === 'GALLERY_UPLOAD' || item.type === 'MEDIA_UPLOAD'
      const cat = (item.payload?.category || '').toUpperCase()
      // v332: Better matching logic to ensure visibility
      return isGalleryType && (cat === 'EVIDENCE' || cat === 'FINALES' || cat === 'ENTREGA' || cat === 'ENTREGA_FINAL' || cat === 'ADJUNTO' || cat === 'MASTER_FINAL');
    })
    // vXXX: Excluir items que ya están en optimisticUploads (evita duplicado visual)
    .filter((item: any) => {
      const filename = item.payload?.filename;
      return !optimisticUploads.some((o: any) => o.isPending && o.filename === filename);
    })
    .map((item: any) => {
      const p = item.payload || {};
      let objUrl = '';
      
      // v441: Priority 1 — Raw File object (from structured clone in IndexedDB)
      const rawFile = p.file;
      const hasRawFile = !!(rawFile && typeof rawFile === 'object' && 
        typeof rawFile.size === 'number' && rawFile.size > 0 &&
        typeof rawFile.slice === 'function');

      if (hasRawFile) {
        try {
          objUrl = URL.createObjectURL(rawFile as Blob);
        } catch(e) { console.warn('[Gallery] Failed to create objectURL from File:', e); }
      } else if (p.url && !p.url.startsWith('blob:')) {
        objUrl = p.url;
      } else if (p.base64 && typeof p.base64 === 'string' && p.base64.startsWith('data:')) {
        objUrl = p.base64;
      } else if (p.fileData) {
        try {
          const rawData = p.fileData.buffer || p.fileData;
          const dataSize = rawData?.byteLength || rawData?.length || 0;
          if (dataSize > 5 * 1024 * 1024) {
            objUrl = '';
          } else {
            const blob = new Blob([rawData], { type: p.mimeType || 'image/jpeg' });
            objUrl = URL.createObjectURL(blob);
          }
        } catch(e) {
          console.error("[UI] Failed to recreate blob preview:", e);
        }
      }

      // v335: Si no hay URL válida y es del tipo imagen, usar placeholder con icono de carga
      if (!objUrl && (p.mimeType || '').startsWith('image/')) {
        objUrl = '/placeholder-image.png';
      }

      // v372: Pass the actual outbox status for proper UI indicators
      const syncStatus = item.status || 'pending';

      return {
        id: `pending-ev-${item.id}`, 
        outboxId: item.id, // v373: Keep real outbox ID for discard action
        url: objUrl || '/placeholder-image.png',
        filename: p.filename || 'Pendiente...', 
        mimeType: p.mimeType || 'image/jpeg',
        category: p.category || 'EVIDENCE', 
        isPending: syncStatus === 'pending',
        isSyncing: syncStatus === 'syncing',
        isFailed: syncStatus === 'failed',
        failReason: (item as any).failReason || null, // v373: Why it failed
        syncStatus,
        createdAt: new Date(item.timestamp || Date.now()).toISOString()
      }
    })

    // v400: Include recently synced items for Evidence
    // v402: No longer mark as isRecentlySynced — show as normal gallery items
    const syncedEvidence = recentlySyncedItems.filter(i => {
       const cat = (i.category || 'EVIDENCE').toUpperCase();
       return (cat === 'EVIDENCE' || cat === 'FINALES' || cat === 'ENTREGA' || cat === 'ENTREGA_FINAL' || cat === 'ADJUNTO' || cat === 'MASTER_FINAL') &&
              !(project?.gallery || []).some((g: any) => g.url === i.url || g.filename === i.filename);
    });

    const optimisticEvidence = optimisticUploads.filter((item: any) => {
      const cat = (item.category || '').toUpperCase()
      return cat === 'EVIDENCE' || cat === 'FINALES' || cat === 'ENTREGA' || cat === 'ENTREGA_FINAL' || cat === 'ADJUNTO' || cat === 'MASTER_FINAL'
    });

    // v403: Optimistic uploads go FIRST to match server order (createdAt DESC = newest first)
    const combinedList = [...optimisticEvidence, ...syncedEvidence, ...pendingEvidence, ...list]

    const sortedUniqueList = combinedList.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.date || a.timestamp || 0).getTime()
      const dateB = new Date(b.createdAt || b.date || b.timestamp || 0).getTime()
      return dateB - dateA
    });

    if (evidenceFilter === 'ALL') return sortedUniqueList
    return sortedUniqueList.filter((item: any) => {
      const url = (item.url || '').toLowerCase();
      const mime = (item.mimeType || '').toLowerCase();
      const isImage = mime.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|heic|svg)$/);
      const isVideo = mime.startsWith('video/') || url.match(/\.(mp4|mov|avi|webm|mkv|3gp|m4v)$/);
      const isAudio = mime.startsWith('audio/') || url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
      if (evidenceFilter === 'IMAGES') return isImage;
      if (evidenceFilter === 'VIDEOS') return isVideo;
      if (evidenceFilter === 'AUDIOS') return isAudio;
      if (evidenceFilter === 'DOCS') return !isImage && !isVideo && !isAudio && !item.isExpense;
      if (evidenceFilter === 'EXPENSES') return !!item.isExpense;
      return true;
    })
  }, [project?.gallery, evidenceFilter, pendingItems, optimisticUploads, recentlySyncedItems])

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

  // v373: Centralized metrics calculation for ProjectSummary (Parity with Admin)
  const { 
    totalPhases, completedPhases, progressPercent, theoreticalDays, realDays, timeRatio, isTiempoExcedido 
  } = useMemo(() => {
    const phases = project?.phases || []
    const total = phases.length
    const completed = phases.filter((p: any) => p.status === 'COMPLETADA').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    const tDays = phases.reduce((acc: number, phase: any) => acc + (phase.estimatedDays || 0), 0)
    let rDays = 0
    if (project?.startDate) {
      const start = new Date(project.startDate)
      const end = (project.status === 'COMPLETADA' || project.status === 'FINALIZADO') && project.endDate 
        ? new Date(project.endDate) : new Date()
      const diff = end.getTime() - start.getTime()
      rDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }
    const tRatio = tDays > 0 ? Math.min((rDays / tDays) * 100, 100) : 0
    const timeExceeded = rDays > tDays && tDays > 0
    return {
      totalPhases: total, completedPhases: completed, progressPercent: progress,
      theoreticalDays: tDays, realDays: rDays, timeRatio: tRatio, isTiempoExcedido: timeExceeded
    }
  }, [project?.phases, project?.startDate, project?.endDate, project?.status])


  const setActiveTabWithUrl = (tab: 'records' | 'chat') => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'chat') {
      setActiveTab('chat')
    } else if (view === 'records' || view === 'gallery' || view === 'team' || view === 'expenses') {
      setActiveTab('records')
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
      // v408: Geolocation removed as per user request to make the page lighter
      let location: any = null;

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
          lat: undefined,
          lng: undefined,
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
        // v373: Removed revalidateRoute — day record state updated locally
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
    }
  }

  const handleSendMessage = (e: React.FormEvent, customMsg?: string, customPhase?: number, mediaFile?: File, extraData?: any, forcedType?: string) => {
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

    const currentSeq = Math.max(...localChat.map(m => m.sequence || 0), 0) + 1;

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

    setLocalChat((prev: any[]) => [...prev, optimisticMessage]);

    // ESPERAR a que React renderice Y el browser pinte antes de procesar
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
      try {
        // v408: Geolocation removed to avoid browser prompts on every message
        let location: any = null
        if (extraData?.lat && extraData?.lng) {
          location = { lat: extraData.lat, lng: extraData.lng }
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

          const uploadResult = await uploadToBunnyClientSide(processedMedia!, finalFilename, `Proyectos/${project.id}/Chat`)
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
              lat: extraData?.lat ?? location?.lat,
              lng: extraData?.lng ?? location?.lng,
              status: 'pending',
              syncId
           })
         });
         
         setLocalChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'pending_sync' } : m))
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
            body: JSON.stringify({ ...payload, lat: extraData?.lat ?? location?.lat, lng: extraData?.lng ?? location?.lng })
        })
        
        if (res.ok) {
          const createdMsg = await res.json()
          setLocalChat(prev => prev.map(m => m.id === tempId ? {
            ...createdMsg,
            isMe: true,
            status: 'sent',
            userName: session?.user?.name || 'Yo',
            userBranch: (session?.user as any)?.branch || null
          } : m))
          
          if (payload.type === 'EXPENSE_LOG') {
            // v373: Removed revalidateRoute — expense state already synced locally
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
              lat: extraData?.lat ?? location?.lat,
              lng: extraData?.lng ?? location?.lng,
              status: 'pending',
              syncId
           })
         });
         
         setLocalChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'pending_sync' } : m))
         triggerBackgroundSync()
      }
      } catch (outerError) {
        console.error("Critical chat error:", outerError);
        setLocalChat(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m))
      }
    });
    });
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
        // v373: Removed revalidateRoute — gallery state updated locally
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
        // v373: Removed revalidateRoute — gallery state updated locally
      }
    } catch (e) {
      console.error('Error deleting from gallery:', e)
    } finally {
      setLoading(false)
    }
  }

  // v430: File queue with category support — prevents mixing MASTER and EVIDENCE items
  const uploadQueue = useRef<{file: ProjectFile, category?: string}[]>([]);
  const processNextInQueue = useCallback(async () => {
    if (uploadQueue.current.length === 0 || saveLockRef.current) return;
    saveLockRef.current = true;
    const { file: nextFile, category } = uploadQueue.current.shift()!;
    try {
      await processSingleUpload(nextFile, category);
    } finally {
      saveLockRef.current = false;
      // Procesar siguiente si hay más en cola
      if (uploadQueue.current.length > 0) {
        processNextInQueue();
      }
    }
  }, []);

  const handleUploadMedia = (file: ProjectFile, category?: string) => {
    // v430: Queue the file with its specific category (MASTER/EVIDENCE)
    uploadQueue.current.push({ file, category });
    if (!saveLockRef.current) {
      processNextInQueue();
    }
  }

  // Guard: prevenir que el mismo archivo se procese 2 veces
  const processingFilenames = useRef<Set<string>>(new Set());

  const processSingleUpload = async (file: ProjectFile, category?: string) => {
    // v470: Use filename + size + timestamp as key to avoid false dedup on same-named files
    const fileKey = `${file.filename || (file as any).file?.name || ''}_${(file as any).size || Date.now()}`;
    if (processingFilenames.current.has(fileKey)) {
      console.log('[Gallery] Skipping duplicate:', fileKey);
      return;
    }
    processingFilenames.current.add(fileKey);

    setLoading(true)

    try {
      // v408: Geolocation removed for faster uploads
      let location: any = null;
      
      const isOffline = !navigator.onLine
      const syncId = `gallery-${project.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      let galleryPayload: any = {
        filename: file.filename,
        mimeType: file.mimeType,
        // v430: Priority: Param category > File category > Default EVIDENCE
        category: category || file.category || 'EVIDENCE',
        phaseId: undefined,
        url: ''
      };

      if (isOffline) {
        try {
          // v441: CRITICAL FIX — increased limit + duck-typing for File detection
          const OFFLINE_MAX_SIZE = 600 * 1024 * 1024; // 600MB (v441)
          const fileSize = (file as any).size || (file as any).file?.size || 0;
          
          if (fileSize > OFFLINE_MAX_SIZE) {
            alert(`El archivo "${file.filename}" (${(fileSize / (1024*1024)).toFixed(0)} MB) es demasiado grande para guardar offline. \n\nLímite Offline: 600MB. \n\nPor favor conéctate a internet para subir archivos más pesados.`);
            setLoading(false);
            return;
          }

          // v441: CRITICAL FIX — Use duck-typing instead of instanceof File.
          // In some mobile WebViews, instanceof File fails for File objects
          // passed between components. Duck-typing (.size + .slice + .name) is reliable.
          let fileToPrepare: File;
          const anyFile = file as any;
          const rawFile = anyFile.file;
          const hasRawFile = !!(rawFile && typeof rawFile === 'object' && 
            typeof rawFile.size === 'number' && rawFile.size > 0 &&
            typeof rawFile.slice === 'function');

          if (hasRawFile) {
            // v441: Use the raw File object DIRECTLY — no fetch, no arrayBuffer, no RAM spike!
            fileToPrepare = rawFile;
            console.log(`[Gallery] Using raw File object: ${rawFile.name || file.filename} (${(rawFile.size/1024/1024).toFixed(1)}MB)`);
          } else if (file.url && file.url.startsWith('blob:')) {
            // Fallback: fetch blob URL (only for small files or when raw File is unavailable)
            try {
              const res = await fetch(file.url);
              const blob = await res.blob();
              fileToPrepare = new File([blob], file.filename, { type: file.mimeType });
            } catch(e) {
              console.warn("Failed to fetch blob URL", e);
              fileToPrepare = new File([], file.filename, { type: file.mimeType });
            }
          } else if (file.url && file.url.startsWith('data:')) {
            try {
              const res = await fetch(file.url);
              const blob = await res.blob();
              fileToPrepare = new File([blob], file.filename, { type: file.mimeType });
            } catch(e) {
              fileToPrepare = new File([], file.filename, { type: file.mimeType });
            }
          } else {
            fileToPrepare = new File([], file.filename, { type: file.mimeType });
          }

          // vXXX: CARBON COPY of Admin's approach (ProjectDetailBase.tsx line 1165-1210)
          // Store raw File/Blob + ArrayBuffer in IndexedDB via structured clone.
          // NO Cache API dependency — Cache API is unreliable for large video files.
          // This is the EXACT same pattern that works for Admin gallery uploads.
          const SMALL_FILE_LIMIT = 20 * 1024 * 1024; // 20MB
          const rawSize = fileToPrepare.size || 0;
          const rawType = (fileToPrepare as any).type || file.mimeType || 'application/octet-stream';
          const rawName = (fileToPrepare as any).name || file.filename || 'media';
          
          // For small files (≤20MB): store ArrayBuffer as backup
          let fileData: { buffer: ArrayBuffer | null; type: string; name: string; size: number } | null = null;
          if (rawSize > 0 && rawSize <= SMALL_FILE_LIMIT) {
            fileData = { buffer: null, type: rawType, name: rawName, size: rawSize };
            try {
              fileData.buffer = await fileToPrepare.arrayBuffer();
              console.log(`[Gallery] ✅ Small file ArrayBuffer saved: ${rawName} (${(rawSize/1024/1024).toFixed(1)}MB)`);
            } catch (e) {
              console.warn(`[Gallery] arrayBuffer() failed, keeping raw File only:`, e);
            }
          }

          if (rawSize > SMALL_FILE_LIMIT) {
            console.log(`[Gallery] ✅ Large file (${(rawSize/1024/1024).toFixed(0)}MB): using raw File via structured clone (same as Admin)`);
          }

          // Build payload — SAME structure as Admin version (ProjectDetailBase.tsx line 1195)
          galleryPayload.filename = rawName;
          galleryPayload.mimeType = rawType;
          galleryPayload.url = ''; // Will be set by sync worker after Bunny upload
          // Structured clone: raw File/Blob goes into IndexedDB directly
          // Duck-typing check (not instanceof) for mobile WebView compatibility
          const isFileOrBlob = !!(fileToPrepare && typeof fileToPrepare === 'object' &&
            typeof fileToPrepare.size === 'number' && fileToPrepare.size > 0);
          galleryPayload.file = isFileOrBlob ? fileToPrepare : null;
          galleryPayload.fileData = fileData;
          // NO cacheKey — Cache API is unreliable for large video files
          delete galleryPayload.cacheKey;
          delete galleryPayload.storageType;

          console.log(`[Gallery] Outbox ready: ${rawName} | file=${!!(galleryPayload.file)} | fileData=${!!(fileData?.buffer)} | size=${(rawSize/1024/1024).toFixed(1)}MB`);
        } catch (e: any) {
          console.warn('[Gallery] Offline preparation failed:', e);
          if (e?.message?.includes('ARCHIVO_MUY_GRANDE')) {
            alert(e.message);
            setLoading(false);
            return;
          }
          // Last resort: save whatever URL we have (might be a blob URL that expires)
          galleryPayload.url = (file as any).url || '';
          galleryPayload.file = null;
          galleryPayload.fileData = null;
          delete galleryPayload.cacheKey;
          delete galleryPayload.storageType;
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
          console.log('[Outbox] Guardado offline:', galleryPayload.filename);
        })
        setLoading(false)
        triggerBackgroundSync()
        return
      }

      // v430: Online path — upload DIRECTLY to BunnyCDN (no base64 conversion!)
      // CRITICAL FIX: Previously converted File→base64→JSON body which used 3x RAM.
      // Now we stream the binary directly to Bunny, then just POST the URL to the gallery API.
      const anyFileRef = file as any;
      let uploadFile: File | Blob | null = null;
      let alreadyUploaded = false;
      
      // v430: Check if ProjectUploader already uploaded to Bunny (online mode)
      // In that case file.url is already an https:// CDN URL — no need to re-upload!
      if (file.url && file.url.startsWith('http')) {
        galleryPayload.url = file.url;
        galleryPayload.mimeType = file.mimeType;
        alreadyUploaded = true;
      } else if (anyFileRef.file instanceof File || anyFileRef.file instanceof Blob) {
        uploadFile = anyFileRef.file;
      } else if (file.url && file.url.startsWith('blob:')) {
        try {
          const blobResp = await fetch(file.url);
          uploadFile = await blobResp.blob();
        } catch { /* fallback below */ }
      } else if (file.url && file.url.startsWith('data:')) {
        try {
          const dataResp = await fetch(file.url);
          uploadFile = await dataResp.blob();
        } catch { /* fallback below */ }
      }

      // --- OPTIMISTIC UI UPDATE ---
      const optimisticId = `temp-${syncId}`;
      const previewUrl = (anyFileRef.file instanceof File)
        ? URL.createObjectURL(anyFileRef.file)
        : (file.url || '');
      const optimisticItem = {
        id: optimisticId,
        url: previewUrl,
        filename: galleryPayload.filename || file.filename || 'Archivo Multimedia',
        mimeType: galleryPayload.mimeType || file.mimeType,
        category: galleryPayload.category,
        isPending: true
      };
      setOptimisticUploads(prev => {
        // Prevenir duplicados por ID (cada subida tiene syncId único)
        if (prev.some(i => i.id === optimisticId)) return prev;
        return [...prev, optimisticItem];
      });

      try {
        // DEBUG: Log qué está pasando con la subida
        console.log(`[GALLERY DEBUG] alreadyUploaded=${alreadyUploaded}, category="${galleryPayload?.category}", file.url starts with http=${file?.url?.startsWith('http')}`);

        // v430: If already uploaded by ProjectUploader, skip Bunny upload
        if (!alreadyUploaded) {
          if (!uploadFile) throw new Error('No file data available');

          // v430: Direct binary upload to Bunny CDN — zero base64, zero RAM explosion
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client');
          // Determinar subcarpeta según categoría de la galería
          // MASTER/PLANOS → Planos | TODO lo demás (EVIDENCE, FINALES, ENTREGA, etc) → Finales
          const galleryCat = (galleryPayload?.category || 'MASTER').toUpperCase();
          const catFolder = (galleryCat === 'MASTER' || galleryCat === 'PLANOS') ? 'Planos' : 'Finales';
          const folder = `Proyectos/${project.id}/${catFolder}`;
          const uploadResult = await uploadToBunnyClientSide(uploadFile, file.filename || 'upload', folder);
          
          // Release file reference immediately
          uploadFile = null;
          
          // Set the CDN URL for the gallery API
          galleryPayload.url = uploadResult.url;
          galleryPayload.mimeType = uploadResult.mimeType;
        }
        
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
        });
        if (!res.ok) throw new Error('Gallery API failed');
        
        setOptimisticUploads(prev => prev.filter(i => i.id !== optimisticId));
        const serverData = await res.json().catch(() => null);
        const bridgeItem = {
          id: serverData?.id || optimisticItem.id,
          url: serverData?.url || galleryPayload.url,
          filename: serverData?.filename || optimisticItem.filename,
          mimeType: serverData?.mimeType || galleryPayload.mimeType,
          category: optimisticItem.category,
          isPending: false
        };
        setRecentlySyncedItems(prev => [...prev, bridgeItem]);

        // v410: Persist to Dexie cache so the item survives navigation without full reload
        try {
          const numericId = Number(project.id);
          if (!isNaN(numericId)) {
            const cached = await db.projectsCache.get(numericId);
            if (cached) {
              const existingGallery: any[] = cached.gallery || [];
              const alreadyIn = existingGallery.some((g: any) =>
                (serverData?.id && g.id === serverData.id) ||
                g.url === bridgeItem.url
              );
              if (!alreadyIn) {
                const newGallery = [bridgeItem, ...existingGallery];
                await db.projectsCache.update(numericId, { gallery: newGallery });
              }
            }
          }
        } catch (cacheErr) {
          console.warn('[Gallery] Failed to update local cache:', cacheErr);
        }

        refreshGallery();
      } catch (err) {
        console.warn('[Gallery] Direct upload failed, queueing for offline sync:', err);
        setOptimisticUploads(prev => prev.filter(i => i.id !== optimisticId));
        // vXXX: If direct upload fails, queue for offline sync — SAME PATTERN as Admin (ProjectDetailBase)
        // Use duck-typing (not instanceof) for mobile WebView compat + ArrayBuffer for small files
        let fallbackPayload = { ...galleryPayload };
        const rawFallback = anyFileRef.file;
        const hasFallbackFile = !!(rawFallback && typeof rawFallback === 'object' &&
          typeof rawFallback.size === 'number' && rawFallback.size > 0);
        
        if (hasFallbackFile) {
          const SMALL_FILE_LIMIT = 20 * 1024 * 1024; // 20MB
          const fbSize = rawFallback.size;
          const fbType = rawFallback.type || file.mimeType || 'application/octet-stream';
          const fbName = rawFallback.name || file.filename || 'media';
          
          fallbackPayload.file = rawFallback; // Structured clone
          fallbackPayload.url = '';
          fallbackPayload.fileData = null;
          delete fallbackPayload.cacheKey;
          delete fallbackPayload.storageType;
          
          // ArrayBuffer backup for small files
          if (fbSize > 0 && fbSize <= SMALL_FILE_LIMIT) {
            try {
              const buf = await rawFallback.arrayBuffer();
              fallbackPayload.fileData = { buffer: buf, type: fbType, name: fbName, size: fbSize };
              console.log(`[Gallery] Fallback: ArrayBuffer saved for ${fbName} (${(fbSize/1024/1024).toFixed(1)}MB)`);
            } catch (e) {
              console.warn('[Gallery] Fallback: arrayBuffer() failed, keeping raw File only:', e);
            }
          }
        }
        await db.transaction('rw', db.outbox, async () => {
          await db.outbox.add({
            type: 'GALLERY_UPLOAD',
            projectId: project.id,
            payload: fallbackPayload,
            timestamp: Date.now(),
            lat: location?.lat,
            lng: location?.lng,
            status: 'pending',
            syncId
          })
        })
        triggerBackgroundSync();
      }
    } catch (e) {
      console.error(e)
    } finally {
      processingFilenames.current.delete(fileKey);
      setLoading(false)
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
    const cleanlocalChat = localChat.filter((m: any) => {
      const type = (m.type || 'TEXT').toUpperCase();
      // Exclude specific gallery/media types that might be in the stream but belong elsewhere
      if (type === 'GALLERY_UPLOAD' || type === 'MEDIA_UPLOAD') return false;
      return true;
    });

    // Build a set of already-synced messages (from server, numeric IDs) to avoid
    // showing pendingItems entries that were already synced but the outbox entry wasn't cleaned up.
    // Match by content + type + close timestamp (same logic as deduplicateMessages).
    const syncedMessages = cleanlocalChat.filter((m: any) => typeof m.id === 'number' && m.id > 0);

    const list = [
      ...cleanlocalChat.filter((m: any) => !pendingItems.some((p: any) => `temp-${p.syncId}` === m.id)),
      ...pendingItems
        .filter((item: any) => {
          // Explicitly ONLY include chat-related types
          const isChatType = item.type === 'MESSAGE' || item.type === 'EXPENSE';
          const isNotGallery = item.type !== 'GALLERY_UPLOAD' && item.type !== 'MEDIA_UPLOAD';
          if (!isChatType || !isNotGallery) return false;
          // Skip if this pending item was already synced (already in localChat with numeric ID, same content+type+time)
          const alreadySynced = syncedMessages.some((sm: any) =>
            sm.content === (item.payload?.content || '') &&
            sm.type === (item.payload?.type || '') &&
            Math.abs(new Date(sm.createdAt).getTime() - (item.timestamp || 0)) < 45000
          );
          if (alreadySynced) return false;
          return true;
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
  }, [localChat, pendingItems, userId])

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
          const link = findGpsLink(typeof fullProject.technicalSpecs === 'string' ? fullProject.technicalSpecs : fullProject.technicalSpecs?.locationLink) || findGpsLink(fullProject.specsTranscription) || findGpsLink(fullProject.address);
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

  const tabs = [
    { id: 'records', label: 'Registros', activeColor: 'var(--primary)', bgColor: 'rgba(0, 112, 192, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, gradient: 'linear-gradient(135deg, #0070c0, #004a80)' },
    { id: 'chat', label: 'Chat', activeColor: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, gradient: 'linear-gradient(135deg, #22c55e, #15803d)' }
  ]

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

        {(!isSmallScreen || activeTab !== 'chat') && (
          <>
            <OperatorHeader project={project} isOnline={isOnline} mounted={mounted} localClientName={clientName} />

            <OperatorFicha 
              project={project} 
              localClientName={clientName} 
              localProjectAddress={projectAddress} 
              localProjectCity={projectCity} 
              onEdit={() => setIsEditingProject(true)}
            />

            <div className="tabs-container" style={{ 
                display: 'flex', 
                overflowX: 'auto', 
                gap: '12px', 
                padding: isSmallScreen ? '12px' : '20px', 
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                flexShrink: 0,
                position: isSmallScreen ? 'sticky' : 'static',
                top: isSmallScreen ? '0' : 'auto',
                zIndex: 10
            }}>
              {/* vXXX: OperatorSyncBadge removed — showed inaccurate upload status */}

              {tabs.map(tab => (
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
                    color: activeTab === tab.id ? '#fff' : tab.activeColor,
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
          </>
        )}

        <div className="tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ 
            flex: 1, 
            padding: activeTab === 'chat' ? '0' : '20px', 
            overflowY: activeTab === 'chat' ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 1. CHAT */}
            {activeTab === 'chat' && (
              <div style={isSmallScreen ? {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1000,
                backgroundColor: 'var(--bg-deep)',
                display: 'flex',
                flexDirection: 'column'
              } : {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <ProjectChatUnified
                  project={project}
                  messages={combinedChat} 
                  userId={Number(session?.user?.id) || 0}
                  isSending={isSendingMessage}
                  isOperatorView={true}
                  onBack={() => {
                    if (isSmallScreen) setActiveTabWithUrl('records')
                  }} 
                  onSendMessage={(content, type, extraData) => {
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
            )}

            {/* 2. REGISTROS (Planos, Finales, Equipo) */}
            {activeTab === 'records' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', paddingBottom: '40px' }}>
                
                {/* PLANOS PRIMERO */}
                <div style={{ borderTop: 'none', paddingTop: '0' }}>
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', marginBottom: '20px' }}>
                    Planos y registros fotográficos maestros.
                  </div>
                  <OperatorGalleryGrid 
                    title="Planos y Registros"
                    count={masterGallery.length}
                    items={masterGallery}
                    filter={galleryFilter}
                    setFilter={setGalleryFilter}
                    onAddFile={handleUploadMedia}
                    onPreview={setSelectedPreviewImage}
                    onDelete={handleDeleteGalleryItem}
                    onDownload={handleDownload}
                    uploaderTitle="🔼 SUBIR ARCHIVOS A: PLANOS"
                    defaultCategory="MASTER"
                    galleryLabel="Planos y Registros"
                    projectId={project?.id}
                  />
                </div>

                {/* FINALES SEGUNDO */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', marginBottom: '20px' }}>
                    Archivos finales de entrega y evidencias de obra.
                  </div>
                  <OperatorGalleryGrid 
                    title="Archivos Finales"
                    count={evidenceGallery.length}
                    items={evidenceGallery}
                    filter={evidenceFilter}
                    setFilter={setEvidenceFilter}
                    onAddFile={handleUploadMedia}
                    onPreview={setSelectedPreviewImage}
                    onDelete={handleDeleteGalleryItem}
                    onDownload={handleDownload}
                    uploaderTitle="🔼 SUBIR A: FINALES"
                    defaultCategory="EVIDENCE"
                    galleryLabel="Finales"
                    projectId={project?.id}
                  />
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <ProjectTeamSection 
                    project={project}
                    operators={resolvedOperators}
                    setLocalProject={setLocalProject}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* MODALS SECTION */}
      {waForwardMsg && (
        <OperatorWhatsAppModal 
          forwardMsg={waForwardMsg} 
          projectTitle={project.title} 
          projectId={project.id} 
          onClose={() => setWaForwardMsg(null)} 
        />
      )}

      {selectedPreviewImage && (
        <LightboxPreview 
          item={selectedPreviewImage} 
          isSmallScreen={isSmallScreen} 
          onClose={() => setSelectedPreviewImage(null)} 
        />
      )}

      {isExpenseModalOpen && (
        <OperatorExpenseModal 
          editingExpense={editingExpense}
          expenseFormFields={expenseFormFields}
          isSavingExpense={isSavingExpense}
          onFieldChange={setExpenseFormFields}
          onSubmit={handleUpdateExpense}
          onClose={() => {
            setIsExpenseModalOpen(false)
            setEditingExpense(null)
          }}
        />
      )}

      <ProjectEditModal
        project={project}
        isOpen={isEditingProject}
        onClose={() => setIsEditingProject(false)}
        onSave={async (data) => { await handleSaveProject(data) }}
        isSaving={isSavingProject}
      />
      
      {/* Mobile Navigation Footer Removed to use Global Footer */}
    </>
  )
}
