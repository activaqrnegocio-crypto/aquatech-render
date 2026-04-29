'use client'

import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import { formatToEcuador, ECUADOR_TIMEZONE, getLocalNow, formatDateEcuador, formatTimeEcuador } from '@/lib/date-utils'
import MediaCapture from '@/components/MediaCapture'
import { useSession } from 'next-auth/react'
import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'
import ProjectChatUnified from '@/components/chat/ProjectChatUnified'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { compressImage as optimizedCompress, isCompressibleImage, blobToBase64 } from '@/lib/image-optimization'

export default function ProjectDetailClient({ project: initialProject, availableOperators = [] }: any) {
  const router = useRouter()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [isSmallScreen, setIsSmallScreen] = useState(false)
  
  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [activeTab, setActiveTab] = useState<'CHAT' | 'GALLERY' | 'EVIDENCE'>('CHAT')

  const GALLERY_LABEL = 'Planos y Referencias'

  const setActiveTabWithUrl = (tab: 'CHAT' | 'GALLERY' | 'EVIDENCE') => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'CHAT' || view === 'GALLERY' || view === 'EVIDENCE' || view === 'EXPENSES') {
      setActiveTab(view === 'EXPENSES' ? 'EVIDENCE' : view as any)
    }
  }, [searchParams])

  // v227: Consistent ID derivation from URL (Primary Source of Truth)
  // v228: Robust ID extraction using regex to handle trailing slashes and Universal Shell
  // v231: Enhanced regex to capture digits even in complex paths
  const idFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const path = window.location.pathname;
    const match = path.match(/\/proyecto[s]?\/(\d+)/i);
    if (match) return Number(match[1]);
    
    // Ultimate fallback: check if the last segment is a number
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^\d+$/.test(last)) return Number(last);

    return 0;
  }, []);
  const [localProject, setLocalProject] = useState<any>(null);
  const project = localProject || initialProject;
  
  const [localChat, setLocalChat] = useState<any[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  useEffect(() => {
    async function initProject() {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setIsOfflineMode(isOffline);

      // Check if we need to recover from cache (either offline OR we got the wrong shell props)
      const needsCacheRecovery = (!project || Number(project?.id) !== idFromUrl) && idFromUrl > 0;

      if (needsCacheRecovery) {
        setIsSyncingOffline(true);
        console.log('[Offline] Universal Shell detected or Offline mode. Recovering ID:', idFromUrl);
        try {
          const cached = await db.projectsCache.get(idFromUrl);
          if (cached) {
            setLocalProject(cached);
            const chat = await db.chatCache.get(idFromUrl);
            setLocalChat(chat?.messages || []);
          } else {
            console.warn('[Offline] Project not found in local cache:', idFromUrl);
            // If we have props but IDs didn't match, at least show the props as a temporary fallback? 
            // No, better to keep null or show an error later if we want to be strict.
          }
        } catch (err) {
          console.error('[Offline] Recovery error:', err);
        } finally {
          setIsSyncingOffline(false);
        }
      } else {
        // Online and correct ID: Update local state and refresh cache
        setLocalProject(project);
        setLocalChat(project.chatMessages || []);
        db.projectsCache.put({ ...project, lastAccessedAt: Date.now() }).catch(() => {});
        if (project?.chatMessages?.length > 0) {
          db.chatCache.put({ projectId: project.id, messages: project.chatMessages }).catch(() => {});
        }
      }
    }
    initProject();
  }, [project, idFromUrl, pathname]);

  // --- CHAT STATE ---
  const [chatMessages, setChatMessages] = useState<any[]>([])
  
  // Keep chatMessages in sync with localChat (which comes from props or cache)
  useEffect(() => {
    setChatMessages(localChat)
  }, [localChat])
  const [liveChat, setLiveChat] = useState<any[]>([])

  useEffect(() => {
    setChatMessages(localChat)
  }, [localChat])

  // Sync all sub-states when localProject updates (e.g. from offline cache)
  useEffect(() => {
    if (localProject) {
      setGallery((localProject.gallery || []).sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ))
      setExpenses(localProject.expenses || [])
      setCurrentStatus(localProject.status || 'ACTIVO')
      setEditBudget(localProject.estimatedBudget || 0)
    }
  }, [localProject])
  
  // Pending items from Dexie Outbox (Safe ID check v224)
  const pendingItems = useLiveQuery(
    () => {
      const targetId = Number(project?.id || idFromUrl);
      if (!targetId) return [];
      return db.outbox.where('projectId').equals(targetId).toArray();
    },
    [project?.id, idFromUrl]
  ) || []

  const combinedChat = useMemo(() => {
    const base = chatMessages || [];
    const live = liveChat || [];
    return [
      ...base,
      ...live,
      ...pendingItems
      .filter((item: any) => item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD')
      .map((item: any) => {
        let mediaArr: any[] = [];
        if (item.payload.media) {
          mediaArr = [{ url: item.payload.media.url || item.payload.media.base64, filename: item.payload.media.filename, mimeType: item.payload.media.mimeType }];
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

        return {
          id: `pending-${item.id}`,
          projectId: item.projectId,
          userId: session?.user?.id,
          userName: `${session?.user?.name || 'Administrador'} (Pendiente)`,
          content: item.payload.content || (item.type === 'MEDIA_UPLOAD' ? '[Archivo pendiente]' : (item.payload.fileData ? `📎 ${item.payload.fileData.name}` : '')),
          type: item.payload.type || item.type,
          createdAt: new Date(item.timestamp).toISOString(),
          isMe: true,
          isPending: true,
          status: item.status,
          lat: item.lat,
          lng: item.lng,
          phaseId: item.payload.phaseId,
          media: mediaArr,
          extraData: item.payload.extraData
        };
      })
    ].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatMessages, liveChat, pendingItems, session?.user?.id, session?.user?.name]);

  const [message, setMessage] = useState('')
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [showMediaCapture, setShowMediaCapture] = useState<'audio' | 'video' | null>(null)

  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<number[]>(() => (project?.team || []).map((t: any) => t.user?.id))
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  
  const initialGallery = (project?.gallery || []).sort((a: any, b: any) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )

  const [gallery, setGallery] = useState<any[]>(initialGallery)
  
  // --- EXPENSES STATE ---
  const [expenses, setExpenses] = useState(project?.expenses || [])
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    isNote: false,
    date: typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [expenseImage, setExpenseImage] = useState<string | null>(null)
  const [expenseImagePreview, setExpenseImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const masterGallery = useMemo(() => {
    // Only MASTER, PLANOS, LEVANTAMIENTO categories
    const baseFiles = gallery.filter((item: any) => {
      const cat = (item.category || 'MASTER').toUpperCase()
      return (cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO') && !item.isFromChat
    })
    const expenseFiles = (expenses || []).map((exp: any) => ({
      id: `exp-${exp.id}`,
      url: exp.receiptUrl || '',
      filename: exp.description || 'Gasto',
      mimeType: exp.receiptUrl ? 'image/jpeg' : 'text/plain',
      type: 'EXPENSE',
      amount: exp.amount,
      date: exp.date,
      category: 'MASTER',
      isExpense: true
    })).filter((e: any) => e.url)

    // Add pending uploads from outbox, filtering out those already in baseFiles
    const pendingUploads = (pendingItems || [])
      .filter((item: any) => (item.type === 'MEDIA_UPLOAD' || item.type === 'GALLERY_UPLOAD'))
      .filter((item: any) => {
        const cat = (item.payload?.category || 'MASTER').toUpperCase()
        return cat === 'MASTER' || cat === 'PLANOS' || cat === 'LEVANTAMIENTO'
      })
      .map((item: any) => ({
        id: `pending-${item.id}`,
        url: item.payload?.url || item.payload?.base64 || '',
        filename: item.payload?.filename || 'Pendiente...',
        mimeType: item.payload?.mimeType || 'image/jpeg',
        category: 'MASTER',
        isPending: true
      }))
      .filter((pending: any) => !baseFiles.some((base: any) => base.url === pending.url || base.filename === pending.filename))

    return [...baseFiles, ...expenseFiles, ...pendingUploads]
  }, [gallery, expenses, pendingItems])

  const evidenceGallery = useMemo(() => {
    // Strictly ONLY EVIDENCE category (uploaded as finals)
    const base = gallery.filter((item: any) => (item.category || '').toUpperCase() === 'EVIDENCE' && !item.isFromChat)
    
    // Add pending evidence uploads, filtering out duplicates
    const pendingEvidence = (pendingItems || [])
      .filter((item: any) => (item.type === 'MEDIA_UPLOAD' || item.type === 'GALLERY_UPLOAD'))
      .filter((item: any) => (item.payload?.category || '').toUpperCase() === 'EVIDENCE')
      .map((item: any) => ({
        id: `pending-ev-${item.id}`,
        url: item.payload?.url || item.payload?.base64 || '',
        filename: item.payload?.filename || 'Pendiente...',
        mimeType: item.payload?.mimeType || 'image/jpeg',
        category: 'EVIDENCE',
        isPending: true
      }))
      .filter((pending: any) => !base.some((b: any) => b.url === pending.url || b.filename === pending.filename))

    return [...base, ...pendingEvidence]
  }, [gallery, pendingItems])

  const chatGallery = useMemo(() => {
    // Extract media from persistent chat messages
    const fromChat = chatMessages
      .filter((msg: any) => msg.media && msg.media.length > 0)
      .flatMap((msg: any) => msg.media.map((m: any) => ({
        ...m,
        isFromChat: true,
        userName: msg.userName,
        createdAt: msg.createdAt
      })))

    // Extract media from pending chat messages
    const pendingChat = (pendingItems || [])
      .filter((item: any) => item.type === 'MESSAGE' && item.payload?.media)
      .map((item: any) => ({
        id: `pending-chat-${item.id}`,
        url: item.payload.media.url || item.payload.media.base64 || '',
        filename: item.payload.media.filename || 'Enviando...',
        mimeType: item.payload.media.mimeType || 'image/jpeg',
        isFromChat: true,
        isPending: true,
        createdAt: new Date(item.timestamp).toISOString()
      }))

    // Sort by date (newest first)
    return [...fromChat, ...pendingChat].sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [chatMessages, pendingItems])

  // --- SAFETY GUARD (v231) ---
  if (!project && isMounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px', color: 'var(--text)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p>Cargando información del proyecto...</p>
        {isOfflineMode && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Buscando en almacenamiento local (ID: {idFromUrl})</p>}
        {!idFromUrl && <p style={{ color: 'var(--error)' }}>Error: No se pudo identificar el ID del proyecto.</p>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- METRICS CALCULATION (v230: Consolidated & Fixed) ---
  const { 
    totalPhases, 
    completedPhases, 
    progressPercent, 
    grandTotal, 
    theoreticalBudget, 
    ivaAmount, 
    realExpensesValue, 
    expenseRatio, 
    isCostoExcedido,
    theoreticalDays,
    realDays,
    timeRatio,
    isTiempoExcedido
  } = useMemo(() => {
    const phases = project?.phases || []
    const exps = project?.expenses || []
    
    const total = phases.length
    const completed = phases.filter((p: any) => p.status === 'COMPLETADA').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    const gTotal = Number(project?.estimatedBudget || 0)
    const tBudget = gTotal / 1.15
    const iva = gTotal - tBudget

    const realExp = exps
      .filter((e: any) => !e.isNote)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)

    const eRatio = tBudget > 0 ? Math.min((realExp / tBudget) * 100, 100) : 0
    const costExceeded = realExp > tBudget && tBudget > 0

    const tDays = phases.reduce((acc: number, phase: any) => acc + (phase.estimatedDays || 0), 0)
    
    let rDays = 0
    if (project?.startDate) {
      const start = new Date(project.startDate)
      const end = (project.status === 'COMPLETADA' || project.status === 'FINALIZADO') && project.endDate 
        ? new Date(project.endDate) 
        : new Date()
      const diff = end.getTime() - start.getTime()
      rDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    const tRatio = tDays > 0 ? Math.min((rDays / tDays) * 100, 100) : 0
    const timeExceeded = rDays > tDays && tDays > 0

    return {
      totalPhases: total,
      completedPhases: completed,
      progressPercent: progress,
      grandTotal: gTotal,
      theoreticalBudget: tBudget,
      ivaAmount: iva,
      realExpensesValue: realExp,
      expenseRatio: eRatio,
      isCostoExcedido: costExceeded,
      theoreticalDays: tDays,
      realDays: rDays,
      timeRatio: tRatio,
      isTiempoExcedido: timeExceeded
    }
  }, [project, project?.phases, project?.expenses, project?.estimatedBudget, project?.startDate, project?.endDate, project?.status])

  // Alias for backward compatibility if needed
  const realExpenses = realExpensesValue;


  const [isUploading, setIsUploading] = useState(false)
  const [showAllGallery, setShowAllGallery] = useState(false)
  const [showAllEvidence, setShowAllEvidence] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState('ALL')
  const [evidenceFilter, setEvidenceFilter] = useState('ALL')
  const [currentStatus, setCurrentStatus] = useState(project?.status || 'ACTIVO')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const GALLERY_LIMIT = 12

  
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [editBudget, setEditBudget] = useState(project?.estimatedBudget || 0)

  const [isFichaOpen, setIsFichaOpen] = useState(false)
  const [isEditingFicha, setIsEditingFicha] = useState(false)
  const [isSavingFicha, setIsSavingFicha] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingFilename, setEditingFilename] = useState('')
  const [isEditingPhases, setIsEditingPhases] = useState(false)
  const [editingPhases, setEditingPhases] = useState<any[]>([])
  const [isSavingPhases, setIsSavingPhases] = useState(false)
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<any>(null)
  
  // Project Deletion States
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Form State for Ficha (Safe access v228)
  const [editTitle, setEditTitle] = useState(project?.title || '')
  const [editType, setEditType] = useState(project?.type || 'CONSTRUCCION')
  const [editSubtype, setEditSubtype] = useState(project?.subtype || '')
  const [editCity, setEditCity] = useState(project?.city || '')
  const [editAddress, setEditAddress] = useState(project?.address || '')
  const [editStartDate, setEditStartDate] = useState(project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '')
  const [editEndDate, setEditEndDate] = useState(project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '')
  const [editCategoryList, setEditCategoryList] = useState<string[]>(() => {
    try { return JSON.parse(project?.categoryList || '[]') } catch { return [] }
  })
  const [editContractTypeList, setEditContractTypeList] = useState<string[]>(() => {
    try { return JSON.parse(project?.contractTypeList || '[]') } catch { return [] }
  })
  const [editSpecsTranscription, setEditSpecsTranscription] = useState(project?.specsTranscription || '')
  const [editTechnicalSpecs, setEditTechnicalSpecs] = useState(() => {
    try { 
      const parsed = JSON.parse(project?.technicalSpecs || '{}')
      return parsed.description || ''
    } catch { return '' }
  })

  // Client Form State
  const [editClientName, setEditClientName] = useState(project.client?.name || '')
  const [editClientRuc, setEditClientRuc] = useState(project.client?.ruc || '')
  const [editClientPhone, setEditClientPhone] = useState(project.client?.phone || '')
  const [editClientEmail, setEditClientEmail] = useState(project.client?.email || '')
  const [editClientCity, setEditClientCity] = useState(project.client?.city || '')
  const [editClientAddress, setEditClientAddress] = useState(project.client?.address || '')

  // --- INCREMENTAL FETCH: gets new messages from server ---
  const fetchMessages = async (since?: string): Promise<any[]> => {
    try {
      const url = since 
        ? `/api/projects/${project?.id}/messages?since=${since}&_t=${Date.now()}`
        : `/api/projects/${project?.id}/messages?_t=${Date.now()}`
        
      const resp = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!resp.ok) {
        console.error('[ADMIN CHAT SYNC] API error:', resp.status)
        return []
      }
      const allMsgs = await resp.json()
      const currentUserId = Number(session?.user?.id)
      return (allMsgs || []).map((m: any) => ({
        ...m,
        isMe: m.userId === currentUserId,
        userName: m.user?.name || 'Administrador'
      }))
    } catch (err) {
      console.error('[ADMIN CHAT SYNC] Network error:', err)
      return []
    }
  }

  const filteredChat = useMemo(() => {
    return chatMessages.filter((m: any) => activePhase === null ? true : m.phaseId === activePhase)
  }, [chatMessages, activePhase])

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)

  useEffect(() => {
    if (!project?.id || Number(project.id) === 0) return // v231: Prevent calls for ID 0
    if (activeTab === 'CHAT' && filteredChat.length > 0) {
      const container = chatContainerRef.current
      if (!container) return
      
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
      
      if (!isAtBottom) {
        setHasNewMessages(true)
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        setHasNewMessages(false)
        
        fetch('/api/notifications/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project?.id })
        }).catch(() => {})
      }
    }
  }, [filteredChat.length, activeTab, project?.id])

  // --- Ref to access latest chatMessages without causing re-renders ---
  const chatMessagesRef = useRef(chatMessages)
  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

  // --- REAL-TIME POLLING: Incremental sync every 1s ---
  useEffect(() => {
    if (!project?.id || Number(project.id) === 0) return // v231: Prevent calls for ID 0

    const markAsSeen = async () => {
      try {
        await fetch('/api/notifications/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project?.id })
        })
      } catch (e) { /* silent */ }
    }
    markAsSeen()

    // Immediate full fetch on mount
    fetchMessages().then(msgs => {
      if (msgs.length > 0) {
        setChatMessages(msgs)
        markAsSeen()
      }
    })

    const pollInterval = setInterval(async () => {
      if (document.hidden) return
      
      const current = chatMessagesRef.current
      const lastMsg = current[current.length - 1]
      const since = lastMsg?.createdAt
      const freshMsgs = await fetchMessages(since)
      
      if (freshMsgs.length > 0) {
        setChatMessages((prev: any[]) => {
          const existingIds = new Set(prev.map(m => m.id))
          const uniqueNew = freshMsgs.filter(m => !existingIds.has(m.id))
          if (uniqueNew.length === 0) return prev
          return [...prev, ...uniqueNew]
        })
      }
    }, 1000)

    const handleFocus = () => {
       if (typeof navigator !== 'undefined' && !navigator.onLine) return
       fetchMessages().then(msgs => { if (msgs.length > 0) setChatMessages(msgs) })
       router.refresh() // También refresca datos del servidor como fotos y gastos
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      clearInterval(pollInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [project?.id])

  const CATEGORIES = [
    { id: 'PISCINA', label: 'Piscina' },
    { id: 'JACUZZI', label: 'Jacuzzi' },
    { id: 'BOMBAS', label: 'Sistema de Bombeo' },
    { id: 'TRATAMIENTO', label: 'Tratamiento de Agua' },
    { id: 'RIEGO', label: 'Sistema de Riego' },
    { id: 'CALENTAMIENTO', label: 'Calentamiento' },
    { id: 'CONTRA_INCENDIOS', label: 'Contra Incendios' },
    { id: 'MANTENIMIENTO', label: 'Mantenimiento General' },
    { id: 'OTRO', label: 'Otros' }
  ]

  const CONTRACT_TYPES = [
    { id: 'INSTALLATION', label: 'Instalación Nueva' },
    { id: 'MAINTENANCE', label: 'Mantenimiento' },
    { id: 'REPAIR', label: 'Reparación' },
    { id: 'OTHER', label: 'Otro' }
  ]

  const handleDeleteGalleryItem = async (itemId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este archivo de la galería?')) return
    
    // Offline support
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await db.outbox.add({
          type: 'GALLERY_DELETE',
          projectId: project.id,
          payload: { itemId },
          timestamp: Date.now(),
          status: 'pending'
        })
        // Optimistic UI update
        setGallery((prev: any[]) => prev.filter((item: any) => item.id !== itemId))
        return
      } catch (e) {
        console.error('Error saving offline deletion:', e)
      }
    }

    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, {
        method: 'DELETE'
      })
      if (resp.ok) {
        setIsUpdatingStatus(false)
        startTransition(() => {
          setGallery((prev: any[]) => prev.filter((item: any) => item.id !== itemId))
        })
      } else {
        alert('Error al eliminar el archivo')
      }
    } catch (error) {
      console.error('Error deleting gallery item:', error)
      alert('Error de conexión al eliminar')
    }
  }

  const handleSaveFicha = async () => {
    setIsSavingFicha(true)
    try {
      const resp = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          type: editType,
          subtype: editSubtype,
          city: editCity,
          address: editAddress,
          startDate: editStartDate,
          endDate: editEndDate,
          categoryList: JSON.stringify(editCategoryList),
          contractTypeList: JSON.stringify(editContractTypeList),
          technicalSpecs: JSON.stringify({ description: editTechnicalSpecs }),
          specsTranscription: editSpecsTranscription,
          client: {
            name: editClientName,
            ruc: editClientRuc,
            phone: editClientPhone,
            email: editClientEmail,
            city: editClientCity,
            address: editClientAddress
          }
        })
      })

      if (resp.ok) {
        setIsEditingFicha(false)
        startTransition(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
        })
      } else {
        alert('Error al guardar los cambios')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    } finally {
      setIsSavingFicha(false)
    }
  }

  const handleDeleteProject = async () => {
    if (deleteConfirmText !== project.title) {
      alert('El nombre del proyecto no coincide.')
      return
    }

    setIsDeleting(true)
    try {
      const resp = await fetch(`/api/projects/${project?.id}`, {
        method: 'DELETE'
      })

      if (resp.ok) {
        router.push('/admin/proyectos')
        startTransition(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
        })
      } else {
        const data = await resp.json()
        alert(`Error: ${data.error || 'No se pudo eliminar el proyecto'}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Error de conexión al eliminar el proyecto')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = base64
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1000
        const MAX_HEIGHT = 1000
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
    })
  }
  
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (!response.ok) throw new Error('CORS or error')
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      // Fallback si falla el fetch (ej: CORS de servidores externos)
      console.warn('Descarga AJAX fallida (CORS), abriendo en pestaña nueva:', e)
      window.open(url, '_blank')
    }
  }

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return alert('Importe y descripción obligatorios')
    setIsSavingExpense(true)

    const expensePayload = {
      amount: Number(expenseForm.amount),
      description: expenseForm.description,
      date: expenseForm.date,
      isNote: expenseForm.isNote,
      category: 'OTRO'
    }

    // Offline support
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await db.outbox.add({
          type: 'EXPENSE',
          projectId: project?.id || 0,
          payload: expensePayload,
          timestamp: Date.now(),
          status: 'pending'
        })
        setExpenseForm({
          amount: '',
          description: '',
          isNote: false,
          date: new Date().toISOString().split('T')[0]
        })
        setIsExpenseModalOpen(false)
        return
      } catch (e) {
        console.error('Error saving offline expense:', e)
      } finally {
        setIsSavingExpense(false)
      }
    }

    try {
      const resp = await fetch(`/api/projects/${project.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expensePayload)
      })
      if (resp.ok) {
        setExpenseForm({
          amount: '',
          description: '',
          isNote: false,
          date: new Date().toISOString().split('T')[0]
        })
        setIsExpenseModalOpen(false)
        startTransition(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
          router.refresh()
        }
        })
      } else {
        const err = await resp.json()
        alert(`Error: ${err.error || 'No se pudo guardar el gasto'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSavingExpense(false)
    }
  }
 
  const handleSaveBudget = async () => {
    try {
      const resp = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedBudget: Number(editBudget) })
      })
      if (resp.ok) {
        setIsEditingBudget(false)
        startTransition(() => {
          // router.refresh() - removed
        })
      } else {
        alert('Error al actualizar el presupuesto')
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const handleUploadToGallery = async (file: ProjectFile, category: string = 'MASTER') => {
    setIsUploading(true)

    // Offline support
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
       try {
          let processedUrl = file.url;
          if (typeof file.url === 'string' && file.url.startsWith('blob:')) {
             try {
               const res = await fetch(file.url);
               const blob = await res.blob();
               processedUrl = await new Promise<string>((resolve) => {
                 const reader = new FileReader();
                 reader.onload = () => resolve(reader.result as string);
                 reader.readAsDataURL(blob);
               });
             } catch (e) {
               console.warn("Could not convert blob to base64", e);
             }
          }

          await db.outbox.add({
             type: 'GALLERY_UPLOAD',
             projectId: project.id,
             payload: { ...file, url: processedUrl, base64: processedUrl, category },
             timestamp: Date.now(),
             status: 'pending'
          })
          
          setIsUploading(false)
          return
       } catch (e) {
          console.error('Error saving offline gallery item:', e)
       }
    }

    try {
      // For online mode, we don't manually setGallery because the Service Worker 
      // or the list polling/refresh will handle the state update once the upload is synced.
      // This PREVENTS THE DOUBLE UPLOAD BUG (one local, one from synced fetch).
      await fetch(`/api/projects/${project.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...file, category })
      })
      
      // We don't call setGallery here anymore. 
      // Instead we rely on the router.refresh() that might happen elsewhere or 
      // the fact that the Service Worker is proxying these requests.
    } catch (e) {
      console.error('Error uploading to gallery:', e)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteFromGallery = async (itemId: number) => {
    if (!confirm('¿Eliminar esta imagen de la galería?')) return
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, {
        method: 'DELETE'
      })
      if (resp.ok) {
        setGallery(prev => prev.filter(item => item.id !== itemId))
      }
    } catch (e) {
      console.error('Error deleting from gallery:', e)
    }
  }

  const handleRenameGalleryItem = async (itemId: number) => {
    if (!editingFilename.trim()) return
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editingFilename })
      })
      if (resp.ok) {
        const updated = await resp.json()
        setGallery((prev: any[]) => prev.map(item => item.id === itemId ? updated : item))
        setEditingItemId(null)
      }
    } catch (e) {
      console.error('Error renaming gallery item:', e)
    }
  }

  const handleSavePhases = async () => {
    setIsSavingPhases(true)
    try {
      for (const phase of editingPhases) {
        if (phase.isNew) {
          const resp = await fetch(`/api/projects/${project.id}/phases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: phase.title,
              description: phase.description,
              estimatedDays: phase.estimatedDays,
              status: phase.status,
              displayOrder: editingPhases.indexOf(phase) + 1
            })
          })
          if (!resp.ok) console.error(`Error creating new phase ${phase.title}`)
        } else {
          const resp = await fetch(`/api/projects/${project.id}/phases/${phase.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: phase.title,
              description: phase.description,
              estimatedDays: phase.estimatedDays,
              status: phase.status
            })
          })
          if (!resp.ok) console.error(`Error updating phase ${phase.id}`)
        }
      }
      setIsEditingPhases(false)
    } catch (e) {
      console.error('Error saving phases:', e)
    } finally {
      setIsSavingPhases(false)
    }
  }

  const handleSaveTeam = async () => {
    setIsSavingTeam(true)
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await db.outbox.add({
          projectId: project.id,
          type: 'TEAM_UPDATE',
          payload: { operatorIds: selectedTeam },
          status: 'pending',
          timestamp: Date.now()
        })
        
        // --- LOCAL FEEDBACK ---
        // Update localProject state so the UI reflects the change immediately
        const newTeam = availableOperators
          .filter((op: any) => selectedTeam.includes(op.id))
          .map((op: any) => ({ user: op }));
        
        setLocalProject((prev: any) => ({
          ...prev,
          team: newTeam,
          _pendingTeamSync: true // Visual flag
        }));
        
        setIsEditingTeam(false)
        return
      }

      await fetch(`/api/projects/${project.id}/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorIds: selectedTeam })
      })
      
      // Update local state when online too for consistency before refresh
      const newTeam = availableOperators
        .filter((op: any) => selectedTeam.includes(op.id))
        .map((op: any) => ({ user: op }));
      
      setLocalProject((prev: any) => ({
        ...prev,
        team: newTeam,
        _pendingTeamSync: false
      }));
      
      setIsEditingTeam(false)
    } catch (e) {
      alert('Error guardando equipo')
    } finally {
      setIsSavingTeam(false)
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return formatToEcuador(d, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return formatToEcuador(d, { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    })
  }

  // --- FETCH FULL DATA FOR EXPORTS ---
  const fetchFullProjectData = async () => {
    try {
      const resp = await fetch(`/api/projects/${project.id}/export`)
      if (!resp.ok) throw new Error('Failed to fetch full data')
      return await resp.json()
    } catch (e) {
      console.error(e)
      alert('Error descargando datos completos para el reporte')
      return null
    }
  }

  // --- CHAT HANDLERS ---
  const handleSendMessage = async (e?: React.FormEvent, customMedia?: { blob: Blob, type: 'audio' | 'video', transcription: string }) => {
    if (e) e.preventDefault()
    if (!message.trim() && !customMedia) return
    setIsSending(true)

    try {
      let payload: any = {
        content: customMedia ? customMedia.transcription : message,
        phaseId: activePhase,
        type: customMedia ? (customMedia.type === 'video' ? 'VIDEO' : 'AUDIO') : 'TEXT',
      }

      if (customMedia) {
        // Convert blob to base64
        const reader = new FileReader()
        const base64: string = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(customMedia.blob)
        })
        payload.media = {
          base64,
          filename: `${customMedia.type}_${Date.now()}.webm`,
          mimeType: customMedia.type === 'video' ? 'video/webm' : 'audio/webm'
        }
      }

      // Offline support for general messages
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
         try {
            let offlinePayload = { ...payload }
            await db.outbox.add({
               type: 'MESSAGE',
               projectId: project.id,
               payload: offlinePayload,
               timestamp: Date.now(),
               status: 'pending'
            })
            setMessage('')
            setShowMediaCapture(null)
            return
         } catch (e) {
            console.error('Error saving offline message:', e)
         } finally {
            setIsSending(false)
         }
      }

      const res = await fetch(`/api/projects/${project.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const newMessage = await res.json()
        setChatMessages((prev: any) => {
          const exists = prev.some((m: any) => m.id === newMessage.id)
          if (exists) return prev
          return [...prev, {
            ...newMessage,
            isMe: true,
            userName: session?.user?.name || 'Administrador'
          }]
        })
        setMessage('')
        setShowMediaCapture(null)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  // Handler for ProjectChatUnified component
  const handleChatUnifiedSend = async (content: string, type: string, extraData?: any) => {
    setIsSending(true)
    console.log('Sending message:', { content, type, extraData }) // Debug log
    try {
      let payload: any = {
        content,
        phaseId: activePhase,
        type: ['EXPENSE_LOG', 'NOTE', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION'].includes(type) ? type : 'TEXT',
        extraData: extraData || {}
      }

      if (extraData?.file) {
        const file = extraData.file as File
        
        // Compress images (including HEIC/HEIF) before upload
        let processedFile: File | Blob = file;
        let processedName = file.name;
        let processedMime = file.type;
        if (isCompressibleImage(file)) {
          try {
            processedFile = await optimizedCompress(file);
            processedName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            processedMime = 'image/webp';
          } catch (err) {
            console.warn('[Admin Chat] Image compression failed, using original:', err);
          }
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Offline: convert to base64
          const base64 = await blobToBase64(processedFile);
          payload.media = {
            base64,
            filename: processedName,
            mimeType: processedMime
          }
        } else {
          // Online: upload to Bunny
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          const uploadResult = await uploadToBunnyClientSide(processedFile, processedName, `projects/${project.id}/chat`)
          payload.media = {
            url: uploadResult.url,
            filename: uploadResult.filename,
            mimeType: processedMime
          }
        }
        
        if (type === 'FILE') {
          payload.type = processedMime.startsWith('image/') ? 'IMAGE' : 
                         processedMime.startsWith('video/') ? 'VIDEO' : 
                         processedMime.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT';
        }
      }

      // Ensure phaseId from extraData (selected in chat) overrides the activePhase if present
      if (extraData?.phaseId) {
        payload.phaseId = extraData.phaseId;
      }
      
      // GPS coords - Automatic tracking for Admins too
      let location: any = null
      if (extraData?.lat && extraData?.lng) {
        location = { lat: extraData.lat, lng: extraData.lng }
      } else if ('geolocation' in navigator) {
        try {
          location = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 5000 }
            )
          })
        } catch (e) {
          console.warn('Geolocation failed for admin:', e)
        }
      }

      // --- OPTIMISTIC UI UPDATE ---
      const tempId = `temp-${Date.now()}-${Math.random()}`
      setLiveChat((prev: any[]) => [
        ...prev,
        {
          id: tempId,
          content: payload.content,
          type: payload.type,
          media: payload.media ? { url: payload.media.base64 || payload.media.url, mimeType: payload.media.mimeType } : null,
          extraData: Object.keys(payload.extraData || {}).length > 0 ? payload.extraData : null,
          createdAt: new Date().toISOString(),
          isMe: true,
          userName: session?.user?.name || 'Administrador',
          status: 'pending'
        }
      ])

      // Offline interceptor for Unified Chat
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
         try {
            await db.outbox.add({
               type: 'MESSAGE',
               projectId: project.id,
               payload,
               timestamp: Date.now(),
               lat: location?.lat,
               lng: location?.lng,
               status: 'pending'
            })
            setLiveChat(prev => prev.filter(m => m.id !== tempId))
            return
         } catch (e) {
            console.error('Error saving offline unified message:', e)
         } finally {
            setIsSending(false)
         }
      }

      const res = await fetch(`/api/projects/${project.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          lat: location?.lat,
          lng: location?.lng,
          extraData: payload.extraData ? (typeof payload.extraData === 'string' ? payload.extraData : JSON.stringify(payload.extraData)) : undefined
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }

      const newMessage = await res.json()
      setChatMessages((prev: any) => {
        const exists = prev.some((m: any) => m.id === newMessage.id)
        if (exists) return prev
        return [...prev, {
          ...newMessage,
          isMe: true,
          userName: session?.user?.name || 'Administrador'
        }]
      })
      setLiveChat(prev => prev.filter(m => m.id !== tempId))

      // 🔥 REAL-TIME EXPENSE SYNC: If message was an expense, update the expenses list locally
      if (payload.type === 'EXPENSE_LOG' && payload.extraData?.amount) {
         const newExp = {
           id: Math.random(), // Temp ID until next poll
           amount: payload.extraData.amount,
           description: payload.content || 'Gasto desde chat',
           date: payload.extraData.date || new Date().toISOString(),
           category: payload.extraData.category || 'OTRO',
           isNote: payload.extraData.isNote || false
         }
         setExpenses((prev: any) => [newExp, ...prev])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  // --- EXPENSE HANDLERS ---
  const handleExpenseImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setExpenseImagePreview(reader.result as string)
      setExpenseImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingExpense(true)
    try {
      const method = editingExpense ? 'PATCH' : 'POST'
      const url = editingExpense 
        ? `/api/projects/${project.id}/expenses/${editingExpense.id}`
        : `/api/projects/${project.id}/expenses`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          projectId: project?.id,
          amount: Number(expenseForm.amount),
          receiptPhoto: expenseImage
        })
      })

      if (res.ok) {
        const savedExpense = await res.json()
        if (editingExpense) {
          setExpenses((prev: any) => prev.map((ex: any) => ex.id === savedExpense.id ? savedExpense : ex))
        } else {
          setExpenses((prev: any) => [savedExpense, ...prev])
        }
        setIsExpenseModalOpen(false)
        setEditingExpense(null)
        setExpenseForm({ amount: '', description: '', isNote: false, date: new Date().toISOString().split('T')[0] })
        setExpenseImage(null)
        setExpenseImagePreview(null)
      }
    } catch (error) {
      console.error('Error saving expense:', error)
    } finally {
      setIsSavingExpense(false)
    }
  }

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este gasto?')) return
    try {
      const res = await fetch(`/api/projects/${project?.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setExpenses((prev: any) => prev.filter((ex: any) => ex.id !== expenseId))
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const formatDateTimeFull = (date: string) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('es-ES', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    }).format(new Date(date))
  }

  // --- GENERACIÓN DE PDF ---
  const generateReport = async () => {
    setIsGenerating(true)
    try {
      const fullProject = await fetchFullProjectData()
      if (!fullProject) return

      const doc = new jsPDF()
      const primaryColor = [56, 189, 248] // #38BDF8
      
      // Header
      doc.setFillColor(12, 26, 42) // bg-deep
      doc.rect(0, 0, 210, 45, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('AQUATECH - REPORTE DE PROYECTO', 20, 25)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`ID Proyecto: #${fullProject.id}`, 20, 35)
      doc.text(`Fecha de Reporte: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 150, 35)

      // 1. RESUMEN EJECUTIVO
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumen Ejecutivo', 20, 60)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Proyecto: ${fullProject.title}`, 20, 70)
      doc.text(`Estado: ${fullProject.status}`, 20, 77)
      doc.text(`Cliente: ${fullProject.client?.name || 'N/A'}`, 120, 70)
      doc.text(`Ubicación: ${fullProject.address || fullProject.client?.address || 'N/A'}`, 120, 77)

      // Tabla Comparativa
      autoTable(doc, {
        startY: 85,
        head: [['Métrica', 'Teórico (Planificado)', 'Real (Actual)', 'Estado']],
        body: [
          [
            'Presupuesto/Inversión', 
            `$ ${Number(fullProject.estimatedBudget || 0).toFixed(2)}`, 
            `$ ${Number(fullProject.expenses?.reduce((acc: any, e: any) => acc + Number(e.amount), 0) || 0).toFixed(2)}`, 
            isCostoExcedido ? 'EXCEDIDO' : 'DENTRO DE RANGO'
          ],
          [
            'Tiempo de Ejecución', 
            `${theoreticalDays} días`, 
            `${realDays} días`, 
            isTiempoExcedido ? 'DEMORADO' : 'A TIEMPO'
          ]
        ],
        theme: 'striped',
        headStyles: { fillColor: [56, 189, 248] }
      })

      // 2. CHAT DE AVANCES
      doc.addPage()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Chat de Campo (Avances)', 20, 20)
      
      const chatData = (fullProject.chatMessages || []).map((msg: any) => [
        formatDateTime(msg.createdAt),
        msg.user.name,
        msg.phase?.title || 'General',
        msg.lat && msg.lng ? `${msg.lat}, ${msg.lng}` : '-',
        msg.content || (msg.type === 'IMAGE' ? '[Imagen subida]' : '[Sin contenido]')
      ])

      autoTable(doc, {
        startY: 30,
        head: [['Fecha/Hora', 'Operador', 'Fase', 'Coordenadas', 'Descripción del Avance']],
        body: chatData,
        styles: { fontSize: 9 }
      })




      // 3. DETALLE DE NOTAS DE GASTOS
      doc.addPage()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Detalle de Notas de Gastos Reportadas', 20, 20)

      const expenseData = (project?.expenses || []).filter((e: any) => !e.isNote).map((exp: any) => [
        formatDate(exp.date),
        exp.description,
        exp.category || 'General',
        `$ ${Number(exp.amount).toFixed(2)}`
      ])

      autoTable(doc, {
        startY: 30,
        head: [['Fecha', 'Descripción', 'Categoría', 'Monto']],
        body: expenseData.length > 0 ? expenseData : [['—', 'Sin gastos', '', '']],
        styles: { fontSize: 9 },
        foot: [['', '', 'TOTAL NOTAS DE GASTOS:', `$ ${realExpensesValue.toFixed(2)}`]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      })

      // Footer en cada página (opcional, aquí solo una vez al final)
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('Este documento es un reporte generado automáticamente por el sistema Aquatech Field CRM.', 105, 285, { align: 'center' })

      doc.save(`Reporte_Proyecto_${project.id}_${project.title.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Error al generar el reporte PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  // --- PDF COMPLETO DEL PROYECTO ---
  const generateProjectPDF = async () => {
    setIsDownloadingPdf(true)
    try {
      const fullProject = await fetchFullProjectData()
      if (!fullProject) return

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
      doc.text('FICHA DE PROYECTO', 20, 33)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`#${fullProject.id} — ${fullProject.title}`, 20, 43)
      doc.text(`Fecha: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 150, 43)

      let y = 70

      // Datos Generales
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
        ['Estado', fullProject.status === 'LEAD' ? 'Negociando' : fullProject.status === 'ACTIVO' ? 'Activo' : fullProject.status],
        ['Tipo', translateType(fullProject.type)],
        ['Ciudad', fullProject.city || 'N/A'],
        ['Dirección', fullProject.address || 'N/A'],
        ['Ubicación GPS', (() => {
          const findGpsLink = (text: string) => {
            if (!text) return null
            const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
            return match ? match[0] : null
          }
          let link = fullProject.locationLink;
          if (!link || link === 'N/A') {
            try {
              const specs = JSON.parse(fullProject.technicalSpecs || '{}');
              link = specs.locationLink || findGpsLink(fullProject.address) || findGpsLink(fullProject.technicalSpecs);
            } catch (e) {
              link = findGpsLink(fullProject.address) || findGpsLink(fullProject.technicalSpecs);
            }
          }
          return link || 'N/A'
        })()],
        ['Fecha de Inicio', formatDate(fullProject.startDate)],
        ['Fecha Fin (Est.)', formatDate(fullProject.endDate)],
        ['Creado por', fullProject.creator?.name || 'Admin'],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Valor']],
        body: infoRows,
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const cellText = data.cell.text[0];
            if (cellText && (cellText.startsWith('http') || cellText.includes('maps'))) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: cellText });
            }
          }
        }
      })
      y = (doc as any).lastAutoTable.finalY + 15

      // Categorías y Tipo de Contrato
      let categories: string[] = []
      let contracts: string[] = []
      try { categories = JSON.parse(fullProject.categoryList || '[]') } catch {}
      try { contracts = JSON.parse(fullProject.contractTypeList || '[]') } catch {}

      if (categories.length > 0 || contracts.length > 0) {
        doc.setTextColor(56, 189, 248)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('2. CLASIFICACIÓN', 20, y)
        y += 10

        autoTable(doc, {
          startY: y,
          head: [['Campo', 'Valores']],
          body: [
            ['Categorías', categories.map(c => translateCategory(c)).join(', ') || 'N/A'],
            ['Tipos de Contrato', contracts.map(c => translateType(c)).join(', ') || 'N/A'],
          ],
          theme: 'grid',
          headStyles: { fillColor: [56, 189, 248], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
        })
        y = (doc as any).lastAutoTable.finalY + 15
      }

      // Especificaciones Técnicas
      let specs: any = {}
      try { specs = JSON.parse(fullProject.technicalSpecs || '{}') } catch {}
      if (specs.description || fullProject.specsTranscription) {
        doc.setTextColor(56, 189, 248)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('3. ESPECIFICACIONES TÉCNICAS', 20, y)
        y += 8
        doc.setTextColor(60, 60, 60)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const specText = specs.description || fullProject.specsTranscription || ''
        const wrapped = doc.splitTextToSize(specText, 170)
        doc.text(wrapped, 20, y)
        y += wrapped.length * 5 + 10
      }

      // ====== PAGE 2: CLIENTE ======
      doc.addPage()
      y = 20
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('4. INFORMACIÓN DEL CLIENTE', 20, y)
      y += 10

      autoTable(doc, {
        startY: y,
        head: [['Campo', 'Valor']],
        body: [
          ['Nombre', fullProject.client?.name || 'N/A'],
          ['R.U.C.', fullProject.client?.ruc || 'N/A'],
          ['Teléfono', fullProject.client?.phone || 'N/A'],
          ['Email', fullProject.client?.email || 'N/A'],
          ['Ciudad', fullProject.client?.city || 'N/A'],
          ['Dirección', fullProject.client?.address || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      })
      y = (doc as any).lastAutoTable.finalY + 15

      // Equipo Asignado
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('5. EQUIPO ASIGNADO', 20, y)
      y += 10

      const teamData = (fullProject.team || []).map((m: any, i: number) => [
        (i + 1).toString(), m.user?.name || 'N/A', m.user?.role || 'Operador', m.user?.phone || 'N/A'
      ])

      autoTable(doc, {
        startY: y,
        head: [['#', 'Nombre', 'Rol', 'Teléfono']],
        body: teamData.length > 0 ? teamData : [['—', 'Sin equipo asignado', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 9 }
      })
      y = (doc as any).lastAutoTable.finalY + 15

      // Fases
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('6. FASES DE TRABAJO', 20, y)
      y += 10

      const phaseData = (fullProject.phases || []).map((p: any, i: number) => [
        `${i + 1}`, p.title, p.description || '—', `${p.estimatedDays || 0} días`, p.status === 'COMPLETADA' ? 'Completada' : p.status === 'EN_PROGRESO' ? 'En Progreso' : 'Pendiente'
      ])

      autoTable(doc, {
        startY: y,
        head: [['#', 'Fase', 'Descripción', 'Días Est.', 'Estado']],
        body: phaseData.length > 0 ? phaseData : [['—', 'Sin fases definidas', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 8 },
        columnStyles: { 2: { cellWidth: 60 } }
      })

      // ====== PAGE 3: PRESUPUESTO ======
      doc.addPage()
      y = 20
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('7. PRESUPUESTO ESTIMADO', 20, y)
      y += 10

      const fullTheoreticalBudget = Number(fullProject.estimatedBudget) || 0
      const fullIvaAmount = fullTheoreticalBudget * 0.15
      const fullGrandTotal = fullTheoreticalBudget + fullIvaAmount
      const fullRealExpenses = (fullProject.expenses || [])
        .filter((e: any) => !e.isNote)
        .reduce((acc: number, exp: any) => acc + Number(exp.amount), 0)

      autoTable(doc, {
        startY: y,
        head: [['Métrica', 'Valor']],
        body: [
          ['Subtotal', `$ ${fullTheoreticalBudget.toFixed(2)}`],
          ['IVA 15%', `$ ${fullIvaAmount.toFixed(2)}`],
          ['TOTAL', `$ ${fullGrandTotal.toFixed(2)}`],
          ['Gastado (Real)', `$ ${fullRealExpenses.toFixed(2)}`],
          ['Disponible', `$ ${(fullTheoreticalBudget - fullRealExpenses).toFixed(2)}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 255 },
        styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text(`Aquatech CRM — Ficha de Proyecto #${fullProject.id}`, 20, 287)
        doc.text(`Página ${i} de ${pageCount}`, 175, 287)
      }

      doc.save(`Proyecto_${fullProject.id}_${fullProject.title.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Error generating project PDF:', err)
      alert('Error al generar el PDF del proyecto')
    } finally {
      setIsDownloadingPdf(false)
    }
  }


  // --- CAMBIO DE ESTADO ---
  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setCurrentStatus(newStatus)
      } else {
        alert('Error al actualizar el estado')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (!isMounted) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-deep)', color: 'white' }}>Cargando proyecto...</div>;

  // v228: Loading guard while project data is fetched from Dexie or API
  if ((!project || !project.title) && idFromUrl !== 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-deep)', color: 'white', padding: '20px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(56, 189, 248, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }}></div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Cargando datos del proyecto...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Buscando en memoria local (Dexie)...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="dashboard-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={['COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(currentStatus) ? 'ARCHIVADO' : currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: currentStatus === 'LEAD' ? 'rgba(234, 179, 8, 0.15)' : currentStatus === 'ACTIVO' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                    color: currentStatus === 'LEAD' ? '#fbbf24' : currentStatus === 'ACTIVO' ? '#38bdf8' : '#9ca3af',
                    border: '1px solid currentColor',
                    cursor: 'pointer', appearance: 'auto',
                    textTransform: 'uppercase',
                    outline: 'none'
                  }}
                >
                  <option value="LEAD" style={{ backgroundColor: '#0f172a', color: '#fbbf24' }}>Negociando</option>
                  <option value="ACTIVO" style={{ backgroundColor: '#0f172a', color: '#38bdf8' }}>Activo</option>
                  <option value="ARCHIVADO" style={{ backgroundColor: '#0f172a', color: '#9ca3af' }}>Archivado</option>
                </select>
              {project?.creator && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Creado por: {project?.creator?.name}
                </span>
              )}
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {project?.title || 'Cargando...'}
            {isOfflineMode && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '10px', border: '1px solid #ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Offline
              </span>
            )}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px', fontSize: '1.1rem' }}>
            {translateType(project?.type)} {project?.subtype ? `— ${project?.subtype}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'none' }}>
          {session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'OPERATOR' && (
            <>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Subtotal: $ {theoreticalBudget.toFixed(2)}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IVA 15%: $ {ivaAmount.toFixed(2)}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Total a cobrar</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                $ {grandTotal.toFixed(2)}
              </div>
            </>
          )}
        </div>
      </div>


      {/* ═══════ FICHA COMPLETA DEL PROYECTO ═══════ */}
      <div className="card" style={{ marginBottom: '30px', padding: '0', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
        {/* Header de la Ficha (Trigger) */}
        <div 
          onClick={() => setIsFichaOpen(!isFichaOpen)}
          style={{ 
            padding: '24px 30px', 
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05), rgba(12, 26, 42, 0.3))',
            borderBottom: isFichaOpen ? '1px solid var(--border-color)' : 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Ficha del Proyecto
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isFichaOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s', opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Haz clic para ver la información técnica y comercial.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            {!isEditingFicha ? (
              <>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setIsEditingFicha(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--primary)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar Información
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={generateProjectPDF}
                  disabled={isDownloadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
                  {isDownloadingPdf ? 'Generando...' : 'Descargar Ficha Técnica'}
                </button>
                {(session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'SUBCONTRATISTA') && (
                  <button 
                    className="btn btn-primary" 
                    onClick={generateReport}
                    disabled={isGenerating}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {isGenerating ? 'Generando...' : 'Generar Reporte de Obra'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setIsEditingFicha(false)}
                  disabled={isSavingFicha}
                  style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveFicha}
                  disabled={isSavingFicha}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                >
                  {isSavingFicha ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Contenido Colapsable */}
        <div style={{ 
          maxHeight: isFichaOpen ? '2500px' : '0', 
          overflow: 'hidden', 
          transition: 'max-height 0.4s ease-out, opacity 0.3s',
          opacity: isFichaOpen ? 1 : 0
        }}>
          <div style={{ padding: '30px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
            
            {/* Columna Izquierda: Datos del Proyecto */}
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Datos Generales
              </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Título</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{project?.title}</span>
                    ) : (
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Tipo</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project?.type || 'N/A'}</span>
                    ) : (
                      <select value={editType} onChange={e => setEditType(e.target.value as any)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }}>
                        <option value="PISCINA">Piscina</option>
                        <option value="JACUZZI">Jacuzzi</option>
                        <option value="BOMBAS">Bombas / Sistemas</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Ciudad</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project?.city || 'N/A'}</span>
                    ) : (
                      <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección / GPS</span>
                    {!isEditingFicha ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', maxWidth: '60%' }}>
                        {(() => {
                          const findGpsLink = (text: string) => {
                            if (!text) return null
                            const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
                            return match ? match[0] : null
                          }
                          const gpsLink = project?.locationLink || findGpsLink(project?.address) || findGpsLink(project?.technicalSpecs?.locationLink) || findGpsLink(project?.technicalSpecs)

                          if (gpsLink) {
                            return (
                              <a 
                                href={gpsLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(54, 162, 235, 0.2)' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Ver Ubicación GPS
                              </a>
                            )
                          }
                          return <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right' }}>{project?.address || 'N/A'}</span>
                        })()}
                      </div>
                    ) : (
                      <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Dirección o Link de Google Maps" className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Inicio</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project?.startDate)}</span>
                    ) : (
                      <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Fin (Est.)</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project?.endDate)}</span>
                    ) : (
                      <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Creado por</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '600' }}>{project?.creator?.name || 'Admin'}</span>
                </div>

                {/* Categorías */}
                <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>Categorías</div>
                  {!isEditingFicha ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(() => {
                        try { return JSON.parse(project?.categoryList || '[]').map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', fontWeight: '600' }}>{translateCategory(c)}</span>
                        )) } catch { return null }
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                      {CATEGORIES.map(cat => (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={editCategoryList.includes(cat.label)} 
                            onChange={e => {
                              if (e.target.checked) setEditCategoryList([...editCategoryList, cat.label])
                              else setEditCategoryList(editCategoryList.filter(c => c !== cat.label))
                            }}
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tipos de Contrato */}
                <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>Tipos de Contrato</div>
                  {!isEditingFicha ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(() => {
                        try { return JSON.parse(project?.contractTypeList || '[]').map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', fontWeight: '600' }}>{translateType(c)}</span>
                        )) } catch { return null }
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                      {CONTRACT_TYPES.map(cat => (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={editContractTypeList.includes(cat.label)} 
                            onChange={e => {
                              if (e.target.checked) setEditContractTypeList([...editContractTypeList, cat.label])
                              else setEditContractTypeList(editContractTypeList.filter(c => c !== cat.label))
                            }}
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Cliente + Especificaciones */}
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Cliente
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Nombre / Razón Social</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: '600', textAlign: 'right', maxWidth: '60%' }}>{project.client?.name || 'N/A'}</span>
                  ) : (
                    <input type="text" value={editClientName} onChange={e => setEditClientName(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>RUC / Cédula</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.ruc || 'N/A'}</span>
                  ) : (
                    <input type="text" value={editClientRuc} onChange={e => setEditClientRuc(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Teléfono</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.phone || 'N/A'}</span>
                  ) : (
                    <input type="text" value={editClientPhone} onChange={e => setEditClientPhone(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Email</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.email || 'N/A'}</span>
                  ) : (
                    <input type="email" value={editClientEmail} onChange={e => setEditClientEmail(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Ciudad Cliente</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.city || 'N/A'}</span>
                  ) : (
                    <input type="text" value={editClientCity} onChange={e => setEditClientCity(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Ubicación Proyecto</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '60%' }}>
                    {(() => {
                      let locLink = project?.locationLink;
                      try {
                        const specs = JSON.parse(project?.technicalSpecs || '{}');
                        if (specs.locationLink) locLink = specs.locationLink;
                      } catch {}

                      if (locLink && (locLink.includes('google.com/maps') || locLink.includes('maps.app.goo.gl') || locLink.startsWith('http'))) {
                        return (
                          <a 
                            href={locLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(56, 189, 248, 0.2)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            Abrir GPS Proyecto
                          </a>
                        );
                      }
                      return <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project?.address || 'N/A'}</span>;
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección Fiscal</span>
                  {!isEditingFicha ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '60%' }}>
                      {project.client?.address && (project.client.address.includes('google.com/maps') || project.client.address.includes('maps.app.goo.gl')) ? (
                        <a 
                          href={project.client.address.match(/https?:\/\/\S+/)?.[0] || project.client.address} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-warning btn-sm"
                          style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid var(--warning)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          Abrir Ubicación Cliente
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right' }}>{project.client?.address || 'N/A'}</span>
                      )}
                    </div>
                  ) : (
                    <input type="text" value={editClientAddress} onChange={e => setEditClientAddress(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                  )}
                </div>
              </div>

              {/* Especificaciones Técnicas */}
              <div style={{ marginTop: '25px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                  Especificaciones Técnicas
                </h4>
                {!isEditingFicha ? (
                  <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text)', lineHeight: '1.6', border: '1px solid var(--border-color)', minHeight: '100px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {(() => {
                      try { 
                        const specs = JSON.parse(project?.technicalSpecs || '{}')
                        return specs.description || project?.specsTranscription || 'Sin especificaciones detalladas.'
                      } catch { return project.specsTranscription || 'Sin especificaciones detalladas.' }
                    })()}
                  </div>
                ) : (
                  <textarea 
                    value={editTechnicalSpecs} 
                    onChange={e => setEditTechnicalSpecs(e.target.value)} 
                    className="form-input" 
                    style={{ width: '100%', minHeight: '150px', padding: '12px', fontSize: '0.9rem', lineHeight: '1.5' }}
                    placeholder="Describe los detalles técnicos del proyecto..."
                  />
                )}
              </div>
            </div>
          </div>

          {/* Resumen Financiero Rápido */}
          {session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'OPERATOR' && (
            <div style={{ marginTop: '25px', padding: '20px', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05), rgba(34, 197, 94, 0.05))', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'none', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Subtotal</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>$ {theoreticalBudget.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>IVA 15%</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>$ {ivaAmount.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Total a cobrar</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>$ {grandTotal.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Gastado Real</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isCostoExcedido ? 'var(--danger)' : 'var(--success)' }}>$ {realExpensesValue.toFixed(2)}</div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* SECCIÓN DE PESTAÑAS (TABS) */}
      <div style={{ marginBottom: '30px', width: '100%' }}>
        <div style={{ 
          display: 'flex', 
          gap: isSmallScreen ? '6px' : '10px', 
          marginBottom: '15px', 
          paddingBottom: '10px', 
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingLeft: isSmallScreen ? '4px' : '0',
          paddingRight: isSmallScreen ? '4px' : '0'
        }} className="hide-scrollbar">
          {[
            { id: 'CHAT', label: 'Chat', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>, activeColor: 'var(--primary)', bgColor: 'rgba(0, 112, 192, 0.1)', gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)' },
            { id: 'GALLERY', label: isSmallScreen ? 'Planos' : GALLERY_LABEL, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>, activeColor: 'var(--warning)', bgColor: 'rgba(245, 158, 11, 0.1)', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
            { id: 'EVIDENCE', label: isSmallScreen ? 'Finales' : 'Archivos Finales', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>, activeColor: '#d946ef', bgColor: 'rgba(217, 70, 239, 0.1)', gradient: 'linear-gradient(135deg, #a855f7, #d946ef)' }
          ].filter(tab => (session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'OPERATOR') || tab.id !== 'EVIDENCE').map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabWithUrl(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isSmallScreen ? '6px' : '10px',
                padding: isSmallScreen ? '10px 14px' : '12px 24px',
                borderRadius: '16px',
                background: activeTab === tab.id ? tab.gradient : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? '#fff' : tab.activeColor,
                border: `1px solid ${activeTab === tab.id ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer',
                fontWeight: '900',
                fontSize: isSmallScreen ? '0.75rem' : '0.95rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: activeTab === tab.id ? `0 8px 20px ${tab.bgColor}` : 'none',
                transform: activeTab === tab.id ? 'scale(1.03)' : 'scale(1)',
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

        {/* Tab Content - Optimized with visibility display to avoid slow mounting */}
        <div className="card tab-content-card" style={{ 
          padding: activeTab === 'CHAT' ? '0px' : '25px', 
          minHeight: '400px', 
          display: 'flex', 
          flexDirection: 'column',
          border: activeTab === 'CHAT' ? 'none' : undefined,
          borderRadius: activeTab === 'CHAT' ? '0px' : undefined,
          backgroundColor: activeTab === 'CHAT' ? 'transparent' : undefined
        }}>
          
          {/* 1. CHAT UNIFICADO WHATSAPP */}
          <div 
            className="chat-tab-content"
            style={{ 
              display: activeTab === 'CHAT' ? 'flex' : 'none', 
              flexDirection: 'column', 
              height: isSmallScreen ? 'calc(100vh - 180px)' : 'calc(100vh - 220px)', 
              minHeight: '400px', 
              overflow: 'hidden',
              borderRadius: '0 0 16px 16px'
            }}>
            <ProjectChatUnified
              project={project}
              messages={combinedChat.map((m: any) => ({
                ...m,
                userName: m.user?.name || m.userName || 'Usuario',
                userId: m.user?.id || m.userId
              }))}
              userId={Number(session?.user?.id)}
              isOperatorView={false}
              activeRecord={null}
              backUrl="/admin/proyectos"
              onSendMessage={handleChatUnifiedSend}
              hideBack={true}
            />
          </div>
          
          {/* 2. GALERÍA UNIFICADA */}
          <div style={{ display: activeTab === 'GALLERY' ? 'block' : 'none' }}>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    {GALLERY_LABEL}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Documentos maestros, planos y especificaciones técnicas oficiales.</p>
                </div>
                
                <ProjectUploader 
                  files={[]} 
                  onAddFile={handleUploadToGallery}
                  onRemoveFile={() => {}}
                  title="🔼 SUBIR A: PLANOS Y REFERENCIAS"
                  minimal={true}
                  showGrid={false}
                  onFilterChange={(f) => setGalleryFilter(f)}
                />
              </div>

              <div className="custom-scrollbar" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {(showAllGallery 
                  ? (galleryFilter === 'ALL' ? masterGallery : masterGallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType?.startsWith('image/')) || (galleryFilter === 'VIDEO' && i.mimeType?.startsWith('video/')) || (galleryFilter === 'DOCUMENT' && !i.mimeType?.startsWith('image/') && !i.mimeType?.startsWith('video/') && i.type !== 'EXPENSE')))
                  : (galleryFilter === 'ALL' ? masterGallery : masterGallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType?.startsWith('image/')) || (galleryFilter === 'VIDEO' && i.mimeType?.startsWith('video/')) || (galleryFilter === 'DOCUMENT' && !i.mimeType?.startsWith('image/') && !i.mimeType?.startsWith('video/') && i.type !== 'EXPENSE'))).slice(0, GALLERY_LIMIT)
                ).map((item: any) => (
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
                      cursor: 'pointer'
                    }}
                  >
                    {(() => {
                      const getCleanType = (mime: string, url: string) => {
                        if (mime === 'application/octet-stream' || !mime) {
                          const ext = url.split('.').pop()?.toLowerCase();
                          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg';
                          if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4';
                          if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg';
                        }
                        return mime;
                      };

                      const cleanFilename = (name: string) => {
                        if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
                        return name;
                      };

                      if (item.isExpense) {
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: '15px', position: 'relative' }}>
                            {item.url ? (
                              <img src={item.url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
                            ) : (
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5" style={{ opacity: 0.5 }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            )}
                            <div style={{ zIndex: 1, textAlign: 'center' }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>$ {item.amount}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanFilename(item.filename)}</div>
                            </div>
                            <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--success)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>GASTO</div>
                          </div>
                        );
                      }

                      const realMime = getCleanType(item.mimeType, item.url);
                      const fileName = cleanFilename(item.filename);

                      if (realMime.startsWith('image/')) {
                        return <img src={item.url} alt={fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                      } else if (realMime.startsWith('video/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                              {fileName}
                            </div>
                          </div>
                        );
                      } else if (realMime.startsWith('audio/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px' }}>
                            <audio src={item.url} controls style={{ width: '100%', height: '40px' }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--info)', textAlign: 'center', wordBreak: 'break-all' }}>{fileName}</span>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                            <span style={{ fontSize: '0.7rem', color: 'var(--info)', maxWidth: '90%', textAlign: 'center', wordWrap: 'break-word' }}>{fileName}</span>
                          </div>
                        );
                      }
                    })()}
                    {/* Persistent Action Buttons Overlay */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        inset: 0, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between', 
                        padding: '8px',
                        zIndex: 20,
                        pointerEvents: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }} 
                          style={{ 
                            width: '26px', 
                            height: '26px', 
                            borderRadius: '50%', 
                            backgroundColor: 'rgba(239, 68, 68, 0.9)', 
                            color: 'white', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            border: 'none', 
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px', pointerEvents: 'auto' }}>
                        <div 
                          onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                          style={{ 
                            backgroundColor: 'rgba(56, 189, 248, 0.95)', 
                            color: 'white', 
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          {item.isExpense ? 'Ver Recibo' : 'Ver'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {masterGallery.length > GALLERY_LIMIT && (
                <button onClick={() => setShowAllGallery(!showAllGallery)} className="btn btn-ghost" style={{ width: '100%', marginTop: '20px' }}>
                  {showAllGallery ? 'Ver Menos' : 'Ver Todos'}
                </button>
              )}
            </div>
          </div>
          
          {/* 3. FINALES - Galería de Evidencias */}
          <div style={{ display: activeTab === 'EVIDENCE' ? 'block' : 'none' }}>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#d946ef', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    Finales
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Evidencias de obra, fotos para publicidad y documentación visual del progreso.</p>
                </div>
                
                <ProjectUploader 
                  files={[]} 
                  onAddFile={(file) => handleUploadToGallery(file, 'EVIDENCE')}
                  onRemoveFile={() => {}}
                  title="🔼 SUBIR A: ARCHIVOS FINALES"
                  minimal={true}
                  showGrid={false}
                  onFilterChange={(f) => setEvidenceFilter(f)}
                />
              </div>

              <div className="custom-scrollbar" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {(showAllEvidence 
                  ? (evidenceFilter === 'ALL' ? evidenceGallery : evidenceGallery.filter((i: any) => i.type === evidenceFilter || (evidenceFilter === 'IMAGE' && i.mimeType?.startsWith('image/')) || (evidenceFilter === 'VIDEO' && i.mimeType?.startsWith('video/')) || (evidenceFilter === 'DOCUMENT' && !i.mimeType?.startsWith('image/') && !i.mimeType?.startsWith('video/'))))
                  : (evidenceFilter === 'ALL' ? evidenceGallery : evidenceGallery.filter((i: any) => i.type === evidenceFilter || (evidenceFilter === 'IMAGE' && i.mimeType?.startsWith('image/')) || (evidenceFilter === 'VIDEO' && i.mimeType?.startsWith('video/')) || (evidenceFilter === 'DOCUMENT' && !i.mimeType?.startsWith('image/') && !i.mimeType?.startsWith('video/')))).slice(0, GALLERY_LIMIT)
                ).map((item: any) => (
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
                      cursor: 'pointer'
                    }}
                  >
                    {(() => {
                      const getCleanType = (mime: string, url: string) => {
                        if (mime === 'application/octet-stream' || !mime) {
                          const ext = url.split('.').pop()?.toLowerCase();
                          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg';
                          if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4';
                          if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg';
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
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                              {fileName}
                            </div>
                          </div>
                        );
                      } else if (realMime.startsWith('audio/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px' }}>
                            <audio src={item.url} controls style={{ width: '100%', height: '40px' }} />
                            <span style={{ fontSize: '0.7rem', color: '#a855f7', textAlign: 'center', wordBreak: 'break-all' }}>{fileName}</span>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                            <span style={{ fontSize: '0.7rem', color: '#a855f7', maxWidth: '90%', textAlign: 'center', wordWrap: 'break-word' }}>{fileName}</span>
                          </div>
                        );
                      }
                    })()}
                    {/* Always-visible action badges */}
                    <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 20 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }} 
                        style={{ 
                          width: '28px', height: '28px', borderRadius: '50%', 
                          backgroundColor: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(4px)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                          transition: 'transform 0.2s, background-color 0.2s',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        title="Eliminar"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
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
              {evidenceGallery.length > GALLERY_LIMIT && (
                <button onClick={() => setShowAllEvidence(!showAllEvidence)} className="btn btn-ghost" style={{ width: '100%', marginTop: '20px' }}>
                  {showAllEvidence ? 'Ver Menos' : 'Ver Todos'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <>
      <div className="project-main-grid">

        <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'none' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>Fases de Trabajo</h3>
            {!isEditingPhases ? (
              <button 
                onClick={() => {
                  setIsEditingPhases(true)
                  setEditingPhases([...project.phases])
                }} 
                className="btn btn-ghost btn-sm"
              >
                Editar Fases
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setEditingPhases([...editingPhases, { id: 'new_' + Date.now(), title: '', description: '', estimatedDays: 0, status: 'PENDIENTE', isNew: true }])} 
                  className="btn btn-secondary btn-sm" 
                  disabled={isSavingPhases}
                >
                  + Agregar Fase
                </button>
                <button onClick={() => setIsEditingPhases(false)} className="btn btn-ghost btn-sm" disabled={isSavingPhases}>Cancelar</button>
                <button onClick={handleSavePhases} className="btn btn-primary btn-sm" disabled={isSavingPhases}>{isSavingPhases ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            )}
          </div>
          <div style={{ padding: '20px' }}>
            {(!isEditingPhases ? project.phases : editingPhases).map((phase: any, idx: number) => (
              <div key={phase.id} style={{ display: 'flex', gap: '20px', marginBottom: idx === project.phases.length - 1 ? 0 : '30px', position: 'relative' }}>
                {idx !== project.phases.length - 1 && (
                  <div style={{ position: 'absolute', left: '15px', top: '35px', bottom: '-35px', width: '2px', backgroundColor: phase.status === 'COMPLETADA' ? 'var(--success)' : 'var(--border-color)', zIndex: 0 }} />
                )}
                
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, zIndex: 1,
                  backgroundColor: phase.status === 'COMPLETADA' ? 'var(--success)' : (phase.status === 'EN_PROGRESO' || phase.status === 'ACTIVO' ? 'var(--warning)' : 'var(--bg-surface)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: phase.status === 'PENDIENTE' ? 'var(--text-muted)' : 'var(--bg-deep)'
                }}>
                  {phase.status === 'COMPLETADA' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{idx + 1}</span>
                  )}
                </div>

                <div style={{ flex: 1, backgroundColor: 'var(--bg-surface)', padding: '15px', borderRadius: '8px', border: phase.status === 'EN_PROGRESO' || phase.status === 'ACTIVO' ? '1px solid var(--warning)' : '1px solid var(--border-color)' }}>
                  {!isEditingPhases ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: phase.status === 'COMPLETADA' ? 'var(--success)' : 'var(--text)' }}>
                          {phase.title}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {phase.status === 'COMPLETADA' ? 'Completada' : phase.status === 'EN_PROGRESO' || phase.status === 'ACTIVO' ? 'En Progreso' : 'Pendiente'}
                        </span>
                      </div>
                      {phase.description && <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{phase.description}</p>}
                      {phase.estimatedDays && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {phase.estimatedDays} días est.
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          value={phase.title} 
                          onChange={e => {
                            const newPhases = [...editingPhases]
                            newPhases[idx].title = e.target.value
                            setEditingPhases(newPhases)
                          }}
                          className="form-input"
                          style={{ flex: 1, fontSize: '0.9rem' }}
                          placeholder="Título de la fase"
                        />
                        <select 
                          value={phase.status} 
                          onChange={e => {
                            const newPhases = [...editingPhases]
                            newPhases[idx].status = e.target.value
                            setEditingPhases(newPhases)
                          }}
                          className="form-input"
                          style={{ width: '130px', fontSize: '0.8rem' }}
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN_PROGRESO">En Progreso</option>
                          <option value="COMPLETADA">Completada</option>
                        </select>
                      </div>
                      <textarea 
                        value={phase.description || ''} 
                        onChange={e => {
                          const newPhases = [...editingPhases]
                          newPhases[idx].description = e.target.value
                          setEditingPhases(newPhases)
                        }}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.85rem', minHeight: '60px' }}
                        placeholder="Descripción de la fase..."
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Días Est.</label>
                        <input 
                          type="number" 
                          value={phase.estimatedDays || 0} 
                          onChange={e => {
                            const newPhases = [...editingPhases]
                            newPhases[idx].estimatedDays = Number(e.target.value)
                            setEditingPhases(newPhases)
                          }}
                          className="form-input"
                          style={{ width: '80px', fontSize: '0.8rem' }}
                        />
                        {phase.isNew && (
                          <button 
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                            onClick={() => setEditingPhases(editingPhases.filter((_, i) => i !== idx))}
                          >
                            Quitar Fase
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="grid-2" style={{ marginBottom: '30px', alignItems: 'stretch' }}>
        {/* COMPARATIVA DE GASTOS */}
        <div className="card" style={{ minWidth: 0, borderLeft: `4px solid ${isCostoExcedido ? 'var(--danger)' : 'var(--success)'}`, padding: '24px', display: 'none', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Inversión: Teórico vs Real
            </h3>
            {isCostoExcedido && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '12px' }}>EXCEDIDO</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Barra Teórica */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total a cobrar</span>
                {isEditingBudget ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                      type="number" 
                      value={editBudget} 
                      onChange={e => setEditBudget(e.target.value)} 
                      className="form-input" 
                      style={{ width: '90px', padding: '2px 6px', fontSize: '0.85rem' }} 
                    />
                    <button onClick={handleSaveBudget} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>✓</button>
                    <button onClick={() => { setIsEditingBudget(false); setEditBudget(project.estimatedBudget); }} className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>$ {grandTotal.toFixed(2)}</span>
                    <button 
                      onClick={() => setIsEditingBudget(true)}
                      title="Editar Presupuesto"
                      className="btn btn-ghost"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', minHeight: '0', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Editar
                    </button>
                  </div>
                )}
              </div>
              <div className="progress-bar" style={{ height: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '7px' }}>
                <div className="progress-fill" style={{ width: '100%', backgroundColor: 'var(--primary)', borderRadius: '7px', opacity: 0.7 }}></div>
              </div>
            </div>

            {/* Barra Real */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: isCostoExcedido ? 'var(--danger)' : 'var(--text-muted)' }}>Gastado (Real)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      setActiveTab('EVIDENCE')
                      setIsExpenseModalOpen(true)
                    }}
                    title="Registrar Gasto Directo"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar Gasto o Nota
                  </button>
                  <span style={{ fontWeight: 'bold', color: isCostoExcedido ? 'var(--danger)' : 'var(--success)' }}>$ {realExpenses.toFixed(2)}</span>
                </div>
              </div>

              <div className="progress-bar" style={{ height: '22px', backgroundColor: 'var(--bg-surface)', borderRadius: '11px' }}>
                <div className="progress-fill" style={{ 
                  width: `${expenseRatio}%`, 
                  backgroundColor: isCostoExcedido ? 'var(--danger)' : 'var(--success)',
                  borderRadius: '11px',
                  boxShadow: isCostoExcedido ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                }}></div>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
             {isCostoExcedido 
               ? `Exceso de $ ${(realExpenses - theoreticalBudget).toFixed(2)} sobre el presupuesto.`
               : `Restante: $ ${(theoreticalBudget - realExpenses).toFixed(2)} (${(100 - (realExpenses/theoreticalBudget*100)).toFixed(1)}%)`
             }
          </div>

          {project.expenses.filter((e: any) => !e.isNote).length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>Últimos Gastos:</div>
              {project.expenses.filter((e: any) => !e.isNote).slice(0, 5).map((exp: any) => (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {exp.receiptUrl && (
                      <div 
                        style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)', flexShrink: 0 }}
                        onClick={() => window.open(exp.receiptUrl, '_blank')}
                      >
                        <img src={exp.receiptUrl} alt="Recibo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', fontSize: '0.85rem' }}>
                      {exp.description}
                    </span>
                  </div>
                  <span style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.85rem' }}>$ {Number(exp.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {project.expenses.filter((e: any) => e.isNote).length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--primary)', fontSize: '0.8rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Notas / Asignaciones
              </div>
              {project.expenses.filter((e: any) => e.isNote).slice(0, 5).map((exp: any) => (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', fontSize: '0.85rem' }}>
                      <strong>[NOTA]</strong> {exp.description}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>$ {Number(exp.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMPARATIVA DE TIEMPO */}
        <div className="card" style={{ minWidth: 0, borderLeft: `4px solid ${isTiempoExcedido ? 'var(--warning)' : 'var(--primary)'}`, padding: '24px', display: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Tiempo: Teórico vs Real
            </h3>
            {isTiempoExcedido && <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: '12px' }}>DEMORADO</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Barra Teórica */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Días Estimados (Teórico)</span>
                <span style={{ fontWeight: 'bold' }}>{theoreticalDays} días</span>
              </div>
              <div className="progress-bar" style={{ height: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '7px' }}>
                <div className="progress-fill" style={{ width: '100%', backgroundColor: 'var(--text-muted)', borderRadius: '7px', opacity: 0.5 }}></div>
              </div>
            </div>

            {/* Barra Real */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: isTiempoExcedido ? 'var(--warning)' : 'var(--text-muted)' }}>Días Transcurridos (Real)</span>
                <span style={{ fontWeight: 'bold', color: isTiempoExcedido ? 'var(--warning)' : 'var(--primary)' }}>{realDays} días</span>
              </div>
              <div className="progress-bar" style={{ height: '22px', backgroundColor: 'var(--bg-surface)', borderRadius: '11px' }}>
                <div className="progress-fill" style={{ 
                  width: `${timeRatio}%`, 
                  backgroundColor: isTiempoExcedido ? 'var(--warning)' : 'var(--primary)',
                  borderRadius: '11px',
                  boxShadow: isTiempoExcedido ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none'
                }}></div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Inicio: {formatDate(project.startDate)}
             </span>
             <span>Progreso: {progressPercent}%</span>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
             <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Fases Completadas</div>
                <div style={{ fontWeight: 'bold' }}>{completedPhases} / {totalPhases}</div>
             </div>
             <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Estado Actual</div>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', textTransform: 'capitalize' }}>{project.status.toLowerCase()}</div>
             </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px', marginBottom: '30px' }}>
          {/* Equipo */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Equipo Asignado
                {project?._pendingTeamSync && (
                  <span style={{ fontSize: '0.65rem', padding: '1px 6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', animation: 'pulse 2s infinite' }}>
                    Sincronizando...
                  </span>
                )}
              </h3>
              {!isEditingTeam ? (
                <button onClick={() => setIsEditingTeam(true)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>Editar</button>
              ) : (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => setIsEditingTeam(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--text-muted)' }} disabled={isSavingTeam}>Cancelar</button>
                  <button onClick={handleSaveTeam} className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} disabled={isSavingTeam}>{isSavingTeam ? '...' : 'Guardar'}</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {!isEditingTeam ? (
                <>
                  {project.team.map((member: any) => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                        {member.user.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{member.user.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{member.user.phone || 'Sin número'}</div>
                      </div>
                    </div>
                  ))}
                  {project.team.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '10px' }}>No hay operadores asignados.</div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {availableOperators.map((op: any) => (
                    <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTeam.includes(op.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTeam([...selectedTeam, op.id])
                          else setSelectedTeam(selectedTeam.filter(id => id !== op.id))
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.95rem' }}>{op.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{op.phone || 'Sin WhatsApp'}</div>
                      </div>
                    </label>
                  ))}
                  {availableOperators.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay operadores registrados en el sistema.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CLIENTE RAPID VIEW */}
          <div className="card" style={{ minWidth: 0, margin: 0 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Información del Cliente
            </h3>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>{project.client?.name || 'Cliente sin nombre'}</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {project?.client?.phone || 'Sin teléfono'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span style={{ wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {project?.client?.email || 'Sin email'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {(() => {
                  const findGpsLink = (text: string) => {
                    if (!text) return null
                    const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
                    return match ? match[0] : null
                  }
                  
                  let locLink = project?.locationLink
                  if (!locLink || locLink === 'N/A') {
                    try {
                      const specs = JSON.parse(project?.technicalSpecs || '{}')
                      locLink = specs.locationLink || findGpsLink(project?.address || '') || findGpsLink(project?.technicalSpecs || '')
                    } catch {
                      locLink = findGpsLink(project?.address || '') || findGpsLink(project?.technicalSpecs || '')
                    }
                  }

                  if (locLink && (locLink.includes('google.com/maps') || locLink.includes('maps.app.goo.gl') || locLink.startsWith('http'))) {
                    return (
                      <a 
                        href={locLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Ver en Mapa
                      </a>
                    )
                  }
                  
                  const addr = project?.address || project?.client?.address || 'Sin dirección'
                  return <span>{addr}</span>
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══════ ZONA DE PELIGRO ═══════ */}
      <div style={{ marginTop: '50px', paddingTop: '30px', borderTop: '2px dashed rgba(239, 68, 68, 0.2)' }}>
        <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: 'var(--danger)', margin: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Zona de Peligro
              </h3>
              <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Al eliminar este proyecto, se perderán permanentemente todos los mensajes, fotos, gastos e historial. Esta acción no se puede deshacer.
              </p>
            </div>
            <button 
              onClick={() => {
                setShowDeleteModal(true)
                setDeleteStep(1)
                setDeleteConfirmText('')
              }}
              style={{ padding: '12px 24px', backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              Eliminar Proyecto
            </button>
          </div>
        </div>
      </div>
      </>

      {/* MODAL PARA GASTOS */}
      {isExpenseModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '30px' }}>
            <h3 style={{ marginBottom: '20px' }}>{editingExpense ? 'Editar Gasto/Nota' : 'Nuevo Registro de Gasto'}</h3>
            <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" step="0.01" className="form-input" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input type="text" className="form-input" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="modalIsNote" checked={expenseForm.isNote} onChange={e => setExpenseForm({...expenseForm, isNote: e.target.checked})} />
                <label htmlFor="modalIsNote">¿Es solo una nota informativa?</label>
              </div>

              <div className="form-group" style={{ marginTop: '5px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Comprobante / Foto (Opcional)
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    border: '2px dashed var(--border-color)', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-surface)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '100px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleExpenseImageChange} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />
                  {expenseImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '140px' }}>
                      <img src={expenseImagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpenseImage(null)
                          setExpenseImagePreview(null)
                        }}
                        style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Haz clic para subir una foto</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSavingExpense}>
                  {isSavingExpense ? 'Guardando...' : 'Guardar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Doble Verificación */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '40px', border: '1px solid rgba(239, 68, 68, 0.4)', textAlign: 'center' }}>
            {deleteStep === 1 ? (
              <>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto', color: 'var(--danger)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>¿Eliminar este proyecto?</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '30px' }}>
                  Estás a punto de borrar <strong>{project?.title}</strong>.<br/> Todos los datos asociados se destruirán de forma inmediata e irreversible.
                </p>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => setDeleteStep(2)} style={{ flex: 1, padding: '14px', borderRadius: '10px', backgroundColor: 'var(--danger)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Entiendo, continuar</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>Verificación Final</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
                  Para confirmar la eliminación permanente, por favor escribe el nombre del proyecto:
                </p>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '0.5px' }}>
                  {project?.title}
                </div>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Escribe el nombre aquí..."
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ width: '100%', padding: '15px', backgroundColor: 'var(--bg-deep)', border: `2px solid ${deleteConfirmText === project?.title ? 'var(--success)' : 'var(--border-color)'}`, borderRadius: '10px', color: 'white', textAlign: 'center', fontSize: '1.1rem', marginBottom: '25px', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button 
                    onClick={() => {
                      setDeleteStep(1)
                      setDeleteConfirmText('')
                    }} 
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'white', cursor: 'pointer' }}
                  >
                    Atrás
                  </button>
                  <button 
                    onClick={handleDeleteProject}
                    disabled={isDeleting || deleteConfirmText !== project?.title}
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', backgroundColor: deleteConfirmText === project?.title ? 'var(--danger)' : 'rgba(239, 68, 68, 0.3)', border: 'none', color: 'white', fontWeight: 'bold', cursor: deleteConfirmText === project?.title ? 'pointer' : 'not-allowed', opacity: deleteConfirmText === project?.title ? 1 : 0.6 }}
                  >
                    {isDeleting ? 'Eliminando...' : 'BORRAR TODO'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX PREVIEW MODAL */}
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
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg';
            if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4';
            if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg';
          }
          return mime.toLowerCase();
        };

        const cleanFilename = (name: string) => {
          if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
          return name;
        };

        const previewMime = getCleanType(selectedPreviewImage);
        const fileName = cleanFilename(selectedPreviewImage.filename);
        const isImage = previewMime.startsWith('image/');
        const isVideo = previewMime.startsWith('video/');
        const isAudio = previewMime.startsWith('audio/');

        return (
          <div 
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setSelectedPreviewImage(null)}
          >
            <div 
              style={{ maxWidth: '900px', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedPreviewImage(null)}
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
              
              <div style={{ 
                width: '100%', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                backgroundColor: '#000', 
                border: '1px solid rgba(255,255,255,0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: isSmallScreen ? '200px' : '300px',
                maxHeight: isSmallScreen ? '50vh' : '80vh'
              }}>
                {isImage ? (
                  <img 
                    src={selectedPreviewImage.url} 
                    alt={fileName} 
                    style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} 
                  />
                ) : isVideo ? (
                  <video 
                    src={selectedPreviewImage.url} 
                    controls 
                    autoPlay
                    style={{ maxWidth: '100%', maxHeight: '80vh' }} 
                  />
                ) : isAudio ? (
                  <div style={{ padding: '60px', textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎙️</div>
                    <audio src={selectedPreviewImage.url} controls autoPlay style={{ width: '100%' }} />
                  </div>
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center', width: '100%' }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ marginBottom: '20px' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    <h3 style={{ color: 'white', marginBottom: '10px' }}>{fileName}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Este tipo de archivo debe ser descargado para visualizarse.</p>
                  </div>
                )}
              </div>

              <div className="card" style={{ 
                padding: '15px 20px', 
                display: 'flex', 
                flexDirection: isSmallScreen ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isSmallScreen ? 'stretch' : 'center', 
                gap: '15px' 
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>{previewMime} • {selectedPreviewImage.isExpense ? 'Registro de Gasto' : 'Documento de Obra'}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => window.open(selectedPreviewImage.url, '_blank')} className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }}>Abrir Original</button>
                  <a 
                    href={selectedPreviewImage.url} 
                    download={fileName}
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: '0.85rem', textAlign: 'center' }}
                  >
                    Descargar
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}
