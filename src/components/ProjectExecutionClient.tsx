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
import { compressImage as optimizedCompress } from '@/lib/image-optimization'

import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import ProjectChatUnified from './chat/ProjectChatUnified'

export default function ProjectExecutionClient({ 
  project, 
  initialChat, 
  activeRecord, 
  expenses, 
  userId,
  clientName,
  projectAddress,
  projectCity,
  panelBase = '/admin/operador'
}: any) {
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const isFieldStaff = userRole === 'OPERADOR' || userRole === 'SUBCONTRATISTA'
  
  const hasActiveRecordInThisProject = activeRecord && Number(activeRecord.projectId) === Number(project.id);
  const hasActiveRecordInOtherProject = activeRecord && !hasActiveRecordInThisProject;
  
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'records' | 'chat'>(() => {
    const v = searchParams.get('view')
    if (v === 'records' || v === 'chat') return v
    return 'records'
  })
  const pathname = usePathname()
  const [handleDownloadLoading, setHandleDownloadLoading] = useState<string | null>(null)
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<any>(null)
  const [liveChat, setLiveChat] = useState<any[]>(initialChat || [])
  const liveChatInitialized = useRef(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])


  // --- FULL-SYNC FETCH: always gets ALL messages from server ---
  const fetchAllMessages = async (): Promise<any[]> => {
    try {
      const resp = await fetch(`/api/projects/${project.id}/messages?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!resp.ok) {
        console.error('[CHAT SYNC] API error:', resp.status, resp.statusText)
        return []
      }
      const allMsgs = await resp.json()
      return (allMsgs || []).map((m: any) => ({
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

  // --- REAL-TIME POLLING: Full sync every 5s ---
  useEffect(() => {
    const markAsSeen = async () => {
      try {
        await fetch('/api/notifications/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id })
        })
      } catch (e) { /* silent */ }
    }
    markAsSeen()

    // On first mount, do an immediate full fetch to ensure freshness
    if (!liveChatInitialized.current) {
      liveChatInitialized.current = true
      fetchAllMessages().then(msgs => {
        if (msgs.length > 0) {
          setLiveChat(msgs)
          markAsSeen()
        }
      })
    }

    const pollInterval = setInterval(async () => {
      if (!navigator.onLine) return
      const freshMsgs = await fetchAllMessages()
      if (freshMsgs.length > 0) {
        setLiveChat(prev => {
          // Only update if there's actually a difference
          if (prev.length !== freshMsgs.length || 
              (prev.length > 0 && freshMsgs.length > 0 && prev[prev.length - 1]?.id !== freshMsgs[freshMsgs.length - 1]?.id)) {
            return freshMsgs
          }
          return prev
        })
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [project.id])

  // Sync initialChat when server props update (RSC refresh)
  useEffect(() => {
    if (initialChat && initialChat.length > 0) {
      setLiveChat(prev => {
        // If server has MORE messages than local, use the server data
        if (initialChat.length > prev.length) {
          return initialChat
        }
        // Otherwise merge in case local has optimistic adds
        const serverIds = new Set(initialChat.map((m: any) => m.id))
        const localOnly = prev.filter((m: any) => typeof m.id === 'string' || !serverIds.has(m.id))
        if (localOnly.length === 0) return initialChat
        return [...initialChat, ...localOnly].sort((a: any, b: any) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    }
  }, [initialChat])

  const pendingItems = useLiveQuery(() => db.outbox.where('projectId').equals(project.id).toArray(), [project.id]) || []

  const [localExpenses, setLocalExpenses] = useState<any[]>(expenses || [])
  const expensesInitialized = useRef(false)

  // Polling for expenses to avoid "reverting to 0" on mobile state resets
  useEffect(() => {
    if (!mounted) return
    
    const fetchExpenses = async () => {
      if (!navigator.onLine) return
      try {
        const resp = await fetch(`/api/operator/projects/${project.id}/expenses?_t=${Date.now()}`, {
          cache: 'no-store'
        })
        if (resp.ok) {
          const fresh = await resp.json()
          if (Array.isArray(fresh) && fresh.length > 0) {
            setLocalExpenses(fresh)
          }
        }
      } catch (e) { /* silent fail */ }
    }

    const expInterval = setInterval(fetchExpenses, 20000)
    return () => clearInterval(expInterval)
  }, [mounted, project.id])

  // Aggregate ALL expenses (prop, local state, Outbox, and Chat messages)
  const allExpenses = useMemo(() => {
    // 1. Start with localExpenses (which includes server data)
    let list = [...localExpenses]

    // 2. Add pending expenses from Outbox
    pendingItems
      .filter((item: any) => item.type === 'EXPENSE')
      .forEach((item: any) => {
        list.push({
          id: `pending-${item.id}`,
          description: item.payload.description,
          amount: Number(item.payload.amount),
          date: new Date(item.timestamp).toISOString(),
          isNote: item.payload.isNote,
          isPending: true,
          userName: 'Yo (Pendiente)'
        })
      })

    // 3. Add EXPENSE_LOG messages from liveChat that didn't make it to expenses yet
    // To avoid duplicates, we only add if the ID or description doesn't exist in localExpenses
    liveChat
      .filter((msg: any) => msg.type === 'EXPENSE_LOG' || msg.type === 'EXPENSE')
      .forEach((msg: any) => {
        const amount = msg.extraData?.amount ?? msg.amount
        const isNote = msg.extraData?.isNote ?? msg.isNote
        const msgId = msg.id
        
        // Basic check to see if this expense is already in the main list
        // Chat expenses usually have "Gasto registrado desde chat" or similar as description in the DB
        const exists = list.some(le => le.chatMessageId === msgId || (le.description === msg.content && Math.abs(le.amount - amount) < 0.01))
        
        if (!exists) {
          list.push({
            id: `chat-exp-${msgId}`,
            chatMessageId: msgId,
            description: msg.content,
            amount: Number(amount),
            date: msg.createdAt,
            isNote: !!isNote,
            userName: msg.userName || 'Usuario'
          })
        }
      })

    return list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [localExpenses, pendingItems, liveChat])

  const myTotalSpent = useMemo(() => {
    return (allExpenses || [])
      .filter((e: any) => !e.isNote)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)
  }, [allExpenses])

  // --- EXPENSE EDIT/DELETE STATE ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseFormFields, setExpenseFormFields, removeExpenseDraft] = useLocalStorage(`project_${project.id}_expense_draft`, {
    amount: '',
    description: '',
    isNote: false,
    date: new Date().toISOString().split('T')[0]
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS'>('ALL')

  const filteredGallery = useMemo(() => {
    if (!project.gallery) return []
    if (galleryFilter === 'ALL') return project.gallery
    return project.gallery.filter((item: any) => {
      const mime = (item.mimeType || '').toLowerCase()
      if (galleryFilter === 'IMAGES') return mime.startsWith('image/')
      if (galleryFilter === 'VIDEOS') return mime.startsWith('video/')
      if (galleryFilter === 'AUDIOS') return mime.startsWith('audio/')
      if (galleryFilter === 'DOCS') return !mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/')
      return true
    })
  }, [project.gallery, galleryFilter])

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


  const setActiveTabWithUrl = (tab: 'records' | 'chat') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'records' || view === 'chat') {
      setActiveTab(view)
    }
  }, [searchParams])


  const [isOnline, setIsOnline] = useState(true)

  const syncOutbox = async () => {
    if (!navigator.onLine) return
    const items = await db.outbox.where('status').equals('pending').toArray()
    if (items.length === 0) return

    for (const item of items) {
       try {
         await db.outbox.update(item.id!, { status: 'syncing' })
         let endpoint = ''
         let method = 'POST'
         
          const isMedia = item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD'
          if (isMedia) {
            endpoint = `/api/projects/${project.id}/messages`
          } else if (item.type === 'EXPENSE') {
            endpoint = `/api/projects/${project.id}/expenses`
          } else if (item.type === 'DAY_START') {
            endpoint = `/api/day-records`
          } else if (item.type === 'DAY_END') {
            endpoint = `/api/day-records`
            method = 'PUT'
          } else if (item.type === 'PHASE_COMPLETE') {
            endpoint = `/api/projects/${project.id}/phases/${item.payload.phaseId}`
            method = 'PATCH'
          }
          
          if (endpoint) {
             const res = await fetch(endpoint, {
                 method,
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                   ...item.payload, 
                   lat: item.lat, 
                   lng: item.lng, 
                   createdAt: new Date(item.timestamp).toISOString(),
                   isOfflineSync: true 
                 })
             })
             if (res.ok) await db.outbox.delete(item.id!)
             else await db.outbox.update(item.id!, { status: 'failed' })
          }
       } catch (e) {
          await db.outbox.update(item.id!, { status: 'pending' })
       }
    }
    router.refresh()
  }

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) syncOutbox()
    }
    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    
    // Auto-sync outbox interval
    const interval = setInterval(() => {
        if (navigator.onLine) syncOutbox()
    }, 15000)

    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      clearInterval(interval)
    }
  }, [project.id])

  const [loading, setLoading] = useState(false)
  const [expenseForm, setExpenseForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [expensePhoto, setExpensePhoto] = useState<string | null>(null)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [chatFilter, setChatFilter] = useState<'all' | 'media' | 'notes' | 'text'>('all')
  const [waForwardMsg, setWaForwardMsg] = useState<any>(null)

  // WhatsApp State
  const [waCategory, setWaCategory] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSuccess, setWaSuccess] = useState(false)

  const waCategories = [
    { id: 'urgencia', label: '🚨 Urgencia', color: '#ef4444', template: `⚠️ URGENCIA - Proyecto: ${project.title}\n\nDescripción: ` },
    { id: 'material', label: '📦 Falta de Material', color: '#f59e0b', template: `📦 SOLICITUD DE MATERIAL - Proyecto: ${project.title}\n\nMaterial requerido: ` },
    { id: 'cotizacion', label: '💰 Cotización', color: '#3b82f6', template: `💰 SOLICITUD DE COTIZACIÓN - Proyecto: ${project.title}\n\nDetalle: ` },
    { id: 'reporte', label: '📋 Reporte', color: '#8b5cf6', template: `📋 REPORTE DE AVANCE - Proyecto: ${project.title}\n\nEstado: ` },
    { id: 'otro', label: '💬 Otro', color: '#06b6d4', template: `📌 NOTIFICACIÓN - Proyecto: ${project.title}\n\n` },
  ]

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
          projectId: project.id,
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

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)
    const checkScreen = () => setIsSmallScreen(window.innerWidth < 640)
    checkScreen()
    window.addEventListener('resize', checkScreen)
    return () => window.removeEventListener('resize', checkScreen)
  }, [])

  // Chat State
  // Instead of trying to find an active phase, default to null ("General")
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [message, setMessage, removeMessageDraft] = useLocalStorage(`project_${project.id}_chat_draft`, '')
  const [notePhase, setNotePhase] = useState<number | null>(activePhase)
  const [note, setNote, removeNoteDraft] = useLocalStorage(`project_${project.id}_note_draft`, '')
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
          router.refresh()
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
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }


  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
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

      if (!activeRecord && !pendingDayAction) {
        alert("⚠️ JORNADA NO INICIADA: Debes pulsar 'Iniciar Jornada' antes de registrar gastos.")
        setLoading(false)
        return
      }

      if (!location) {
        alert("⚠️ UBICACIÓN REQUERIDA: No podemos registrar el gasto sin coordenadas de GPS. Por favor activa la ubicación.")
        setLoading(false)
        return
      }

      let processedPhoto = expensePhoto
      if (processedPhoto && processedPhoto.startsWith('data:')) {
        try {
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          const resB64 = await fetch(processedPhoto)
          const blob = await resB64.blob()
          const uploadResult = await uploadToBunnyClientSide(blob, `expense_${Date.now()}.jpg`, `projects/${project.id}/expenses`)
          processedPhoto = uploadResult.url
        } catch (uploadError) {
          console.error('Failed to upload expense photo directly:', uploadError)
        }
      }

      const payload = { 
        amount: Number(amount), 
        description, 
        date: new Date().toISOString(),
        isNote,
        receiptPhoto: processedPhoto
      }

      if (!navigator.onLine) {
        // Prevent duplicate offline entries if they click very fast
        const alreadyExists = await db.outbox
          .where('type').equals('EXPENSE')
          .filter(i => i.projectId === project.id && i.payload.description === description && i.payload.amount === Number(amount))
          .first()
        
        if (alreadyExists && (Date.now() - alreadyExists.timestamp < 10000)) {
          console.log('Duplicate expense preventer triggered')
          setLoading(false)
          setExpenseForm(false)
          return
        }

        await db.outbox.add({
          type: 'EXPENSE',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
        alert("✅ Gasto guardado localmente. Se sincronizará automáticamente cuando tengas internet.")
        setExpenseForm(false)
        removeExpenseDraft()
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/projects/${project.id}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...payload,
            lat: location?.lat,
            lng: location?.lng
          })
        })
        if (!res.ok) throw new Error('Refetch')
        startTransition(() => {
          router.refresh()
        })
      } catch (err) {
        await db.outbox.add({
          type: 'EXPENSE',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
      }
      setExpenseForm(false)
      removeExpenseDraft()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePhase = async (phaseId: number) => {
    if (!confirm("¿Seguro que deseas marcar esta fase como terminada? Esto desbloqueará la siguiente.")) return
    setLoading(true)
    try {
      const payload = { status: 'COMPLETADA', phaseId }
      if (!navigator.onLine) {
        await db.outbox.add({
          type: 'PHASE_COMPLETE',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: undefined,
          lng: undefined,
          status: 'pending'
        })
        router.refresh()
        setLoading(false)
        return
      }

      await fetch(`/api/projects/${project.id}/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      startTransition(() => {
        router.refresh()
      })
    } catch (e) {
      alert("Error completando fase")
    } finally {
      setLoading(false)
    }
  }

  // --- MANUAL REFRESH: Full reset from server ---
  const [isSyncing, setIsSyncing] = useState(false)
  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      // 1. Full fetch of ALL messages — no incremental, no since
      const freshMsgs = await fetchAllMessages()
      if (freshMsgs.length > 0) {
        setLiveChat(freshMsgs) // Complete replacement
      }
      // 2. Also refresh server component props
      router.refresh()
    } catch (e) {
      console.error('[MANUAL SYNC] Error:', e)
    } finally {
      setTimeout(() => setIsSyncing(false), 800)
    }
  }

  const handleSendMessage = async (e: React.FormEvent, customMsg?: string, customPhase?: number, mediaFile?: File, extraData?: any, forcedType?: string) => {
    if (e) e.preventDefault()
    if (loading) return // Guard against double execution
    const msgToSend = customMsg || message
    const phaseIdToSend = customPhase !== undefined ? customPhase : activePhase
    
    if (!msgToSend.trim() && !mediaFile && !customMsg) return
    setLoading(true)
    try {
      let location: any = null
      if ('geolocation' in navigator) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 25000 }
          )
        })
      }

      if (customMsg === undefined && !activeRecord) {
        // Only require jornada for technical advances or specific actions, not general text/replies
        // Allow text messages without jornada if it's just a note or general chat
      }

      const isTechnicalAction = mediaFile || customPhase !== undefined
      if (isTechnicalAction && !activeRecord) {
        alert("⚠️ JORNADA NO INICIADA: Debes pulsar 'Iniciar Jornada' antes de registrar bitácora técnica o archivos.")
        setLoading(false)
        return
      }

      if (!location) {
        alert("⚠️ UBICACIÓN NO DETECTADA: Para bitácora de campo es obligatorio el GPS.")
        setLoading(false)
        return
      }

      let mediaData = null
      if (mediaFile) {
        try {
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          let uploadFile: File | Blob = mediaFile

          if (mediaFile.type.startsWith('image/')) {
            const compressedB64 = await optimizedCompress(mediaFile)
            const resB64 = await fetch(compressedB64)
            uploadFile = await resB64.blob()
          }

          const uploadResult = await uploadToBunnyClientSide(uploadFile, mediaFile.name, `projects/${project.id}/chat`)
          mediaData = {
            url: uploadResult.url,
            filename: uploadResult.filename,
            mimeType: uploadResult.mimeType
          }
        } catch (uploadError) {
          console.error('Failed to upload media directly:', uploadError)
          // Fallback to legacy base64 if direct upload fails and we are online?
          // Actually better to throw or let it fail gracefully.
        }
      }

      const payload = { 
        phaseId: phaseIdToSend, 
        content: msgToSend, 
        type: forcedType || (extraData?.amount ? 'EXPENSE_LOG' : (
          mediaFile ? (
            mediaFile.type.startsWith('image/') ? 'IMAGE' : 
            mediaFile.type.startsWith('audio/') ? 'AUDIO' : 
            mediaFile.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'
          ) : 'TEXT'
        )),
        media: mediaData,
        extraData: extraData
      }

      if (!navigator.onLine) {
         await db.outbox.add({
            type: 'MESSAGE',
            projectId: project.id,
            payload,
            timestamp: Date.now(),
            lat: location?.lat,
            lng: location?.lng,
            status: 'pending'
         })
         if (!customMsg) removeMessageDraft()
         else removeNoteDraft()
         setLoading(false)
         return
      }

      try {
        const res = await fetch(`/api/projects/${project.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, lat: location?.lat, lng: location?.lng })
        })
        if (!res.ok && res.status !== 401) throw new Error('Network error')
        
        if (res.ok) {
          const createdMsg = await res.json()
        
          // Update live chat and expenses in one go
          setLiveChat((prev: any[]) => [
            ...prev, 
            {
              ...createdMsg,
              isMe: true,
              userName: session?.user?.name || 'Yo',
              userBranch: (session?.user as any)?.branch || null
            }
          ])
          
          // If it was an expense, trigger a refresh to update total spent
          if (payload.type === 'EXPENSE_LOG') {
            router.refresh()
          }
        }

        if (!customMsg) removeMessageDraft()
        else removeNoteDraft()
        router.refresh()
      } catch (e) {
         await db.outbox.add({
            type: 'MESSAGE',
            projectId: project.id,
            payload,
            timestamp: Date.now(),
            lat: location?.lat,
            lng: location?.lng,
            status: 'pending'
         })
         if (!customMsg) removeMessageDraft()
         else removeNoteDraft()
      }
    } catch (e) {
      alert("Error procesando mensaje")
    } finally {
      setLoading(false)
    }
  }

  const handleUploadMedia = async (file: ProjectFile) => {
    setLoading(true)
    try {
      let location: any = null
      if ('geolocation' in navigator) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 25000 }
          )
        })
      }
      
      if (isFieldStaff && !activeRecord) {
        alert("⚠️ JORNADA NO INICIADA: Debes pulsar 'Iniciar Jornada' antes de subir archivos.")
        setLoading(false)
        return
      }

      if (!location) {
        alert("⚠️ UBICACIÓN NO DETECTADA: Para subir imágenes a la galería es obligatorio el GPS.")
        setLoading(false)
        return
      }

      const isOffline = !navigator.onLine
      const isBase64 = typeof file.url === 'string' && file.url.startsWith('data:')

      let processedBase64 = isBase64 ? file.url : null

      const payload = { 
        phaseId: activePhase, 
        content: '', 
        type: file.type,
        media: isBase64 ? {
          base64: processedBase64,
          filename: file.filename,
          mimeType: file.mimeType
        } : {
          url: file.url,
          filename: file.filename,
          mimeType: file.mimeType
        }
      }

      // Explicit offline check
      if (isOffline) {
        await db.outbox.add({
          type: 'MEDIA_UPLOAD',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/projects/${project.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...payload,
            lat: location?.lat,
            lng: location?.lng
          })
        })
        if (!res.ok) throw new Error('Refetch')
        router.refresh()
      } catch (err) {
        // Silent fallback to outbox
        await db.outbox.add({
          type: 'MEDIA_UPLOAD',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Extract all media files from the project chat messages
  // Extract all media files from the project gallery (which now includes chat media from server)
  const projectMediaFiles: ProjectFile[] = useMemo(() => {
    return (project.gallery || []).map((m: any) => ({
      url: m.url,
      filename: m.filename,
      mimeType: m.mimeType,
      type: m.mimeType?.startsWith('image/') ? 'IMAGE' : m.mimeType?.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'
    }))
  }, [project.gallery])

  const combinedChat = [
    ...liveChat,
    ...pendingItems
      .filter((item: any) => item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD')
      .map((item: any) => ({
        id: `pending-${item.id}`,
        projectId: item.projectId,
        userId: userId,
        userName: 'Yo (Pendiente)',
        content: item.payload.content || (item.type === 'MEDIA_UPLOAD' ? '[Archivo]' : ''),
        type: item.payload.type || item.type,
        createdAt: new Date(item.timestamp).toISOString(),
        isMe: true,
        isPending: true,
        status: item.status,
        lat: item.lat,
        lng: item.lng,
        phaseId: item.payload.phaseId, // FIX: crucial for filtering by phase
        media: item.payload.media ? [{ url: item.payload.media.url || item.payload.media.base64, filename: item.payload.media.filename, mimeType: item.payload.media.mimeType }] : []
      }))
  ].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const filteredChat = combinedChat.filter((msg: any) => {
    // ALIGNED WITH ADMIN: If on General (activePhase === null), show ALL messages. 
    // Otherwise filter by specific phase.
    if (activePhase !== null && msg.phaseId !== activePhase) return false
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
          body: JSON.stringify({ projectId: project.id })
        }).catch(() => {})
      }
    }
  }, [filteredChat.length, activeTab, project.id])


  
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

  const generateFichaPDF = () => {
    try {
      const doc = new jsPDF()
      
      // 1. Professional Header
      addAquatechHeader(doc, 'FICHA TÉCNICA DE PROYECTO', `PROYECTO: ${project.title}`);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`ID Seguimiento: #${project.id}`, 20, 42);
      doc.text(`Fecha de Impresión: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 145, 42);

      let y = 55
      doc.setTextColor(0, 112, 192); // Aquatech Blue
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DATOS GENERALES', 20, y)
      y += 8

      const infoRows = [
        ['Título del Proyecto', project.title],
        ['Estado Actual', project.status],
        ['Ciudad / Ubicación', projectCity || 'N/A'],
        ['Dirección Exacta', projectAddress || 'N/A'],
        ['Fecha Inicia Obra', formatDate(project.startDate)],
        ['Fecha Entrega Est.', formatDate(project.endDate)],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Detalle', 'Información']],
        body: infoRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 112, 192], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      })
      y = (doc as any).lastAutoTable.finalY + 12

      doc.setTextColor(0, 112, 192);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('2. INFORMACIÓN DEL CLIENTE', 20, y)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Concepto', 'Datos de Contacto']],
        body: [
          ['Nombre / Razón Social', clientName || 'N/A'],
          ['Localidad', projectCity || 'N/A'],
          ['Dirección Principal', projectAddress || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      })
      y = (doc as any).lastAutoTable.finalY + 12

      const phaseData = project.phases?.map((p: any, i: number) => [
        `${i + 1}`, 
        p.title, 
        p.description || '—', 
        `${p.estimatedDays || 0} d`, 
        p.status === 'COMPLETADA' ? '✓' : p.status === 'EN_PROGRESO' ? '...' : '-'
      ]) || []

      if (phaseData.length > 0) {
        doc.setTextColor(0, 112, 192);
        doc.setFontSize(12);
        doc.text('3. FASES Y CRONOGRAMA', 20, y)
        y += 8
        autoTable(doc, {
          startY: y,
          head: [['#', 'Fase de Trabajo', 'Descripción', 'Plazo', 'Estado']],
          body: phaseData,
          theme: 'grid',
          headStyles: { fillColor: [0, 112, 192], textColor: 255 },
          styles: { fontSize: 8 },
        })
      }

      doc.save(`Ficha_${project.id}_${project.title.replace(/\s+/g, '_')}.pdf`)
    } catch(err) {
      console.error(err)
      alert("Error al generar PDF")
    }
  }

  // Reporte de Obra removed for operators/subcontractors as per request

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este gasto?')) return
    try {
      const res = await fetch(`/api/projects/${project.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingExpense(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseFormFields,
          amount: Number(expenseFormFields.amount)
        })
      })
      if (res.ok) {
        setIsExpenseModalOpen(false)
        setEditingExpense(null)
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating expense:', error)
    } finally {
      setIsSavingExpense(false)
    }
  }

  return (
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '8px' }}>
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
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{clientName}</span>
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
              <div className="card" style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Registro de Jornada</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  Registra tu hora de entrada y salida para contabilizar tus horas en obra.
                </p>
                {hasActiveRecordInOtherProject && (
                  <div style={{ marginBottom: '15px', padding: '10px 15px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>Jornada activa en: <strong>{activeRecord.projectName}</strong>.</span>
                  </div>
                )}
                <button 
                  className={`btn btn-lg btn-full ${hasActiveRecordInThisProject || (pendingDayAction && pendingDayAction.type === 'DAY_START') ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={handleDayRecord}
                  disabled={loading || hasActiveRecordInOtherProject}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {loading ? 'Cargando...' : (hasActiveRecordInThisProject || (pendingDayAction && pendingDayAction.type === 'DAY_START')) ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                      {pendingDayAction?.type === 'DAY_START' ? 'Fichar Salida (Pendiente)' : 'Terminar Jornada'}
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Iniciar Jornada
                    </>
                  )}
                </button>
                {(activeRecord || pendingDayAction) && mounted && (
                  <p style={{ textAlign: 'center', color: 'var(--warning)', marginTop: '15px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {pendingDayAction ? (
                      `Acción offline: ${pendingDayAction.type === 'DAY_START' ? 'Inicio en cola' : 'Fin en cola'}`
                    ) : (
                      `Día en progreso desde las ${formatTimeEcuador(activeRecord.startTime)}`
                    )}
                  </p>
                )}
              </div>

               {/* Galería Principal (Planos/Fotos Admin) */}
               {project.gallery && project.gallery.length > 0 && (
                 <div className="card" style={{ minWidth: 0, marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Planos y Referencias
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{project.gallery.length} Archivos</span>
                    </div>
                    
                     <div style={{ paddingBottom: '15px', display: 'flex', gap: '8px', overflowX: 'auto' }} className="hide-scrollbar">
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
                              padding: '4px 12px', 
                              borderRadius: '20px', 
                              border: 'none', 
                              background: galleryFilter === f.id ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                              color: 'white',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                     </div>

                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                      gap: '12px'
                    }}>
                      {filteredGallery.map((item: any) => (
                        <div 
                          key={item.id} 
                          className="group"
                          style={{ 
                            position: 'relative', 
                            aspectRatio: '1/1', 
                            borderRadius: '12px', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-surface)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        >
                          {item.mimeType.startsWith('image/') ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                              <img 
                                src={item.url} 
                                alt={item.filename} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} 
                                className="group-hover:scale-110"
                              />
                               <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                                 {item.filename}
                               </div>
                            </div>
                          ) : item.mimeType.startsWith('video/') ? (
                            <div style={{ width: '100%', height: '100%', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-deep)', padding: '10px', position: 'relative' }}>
                              {item.mimeType.startsWith('audio/') ? (
                                <span style={{ fontSize: '2rem' }}>🎵</span>
                              ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.7 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                              )}
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.filename}</span>
                            </div>
                          )}

                          {/* Interaction Overlay */}
                          <div style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            backgroundColor: 'rgba(0,0,0,0.6)', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px',
                            opacity: 0,
                            padding: '10px',
                            transition: 'opacity 0.2s',
                            zIndex: 10
                          }} className="group-hover:opacity-100">
                             <button 
                              onClick={() => setSelectedPreviewImage(item)}
                              style={{ width: '100%', padding: '6px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '0.7rem', border: 'none', cursor: 'pointer' }}
                            > Ver </button>
                            <button 
                              onClick={() => handleDownload(item.url, item.filename)}
                              style={{ width: '100%', padding: '6px', backgroundColor: 'white', color: 'black', borderRadius: '8px', fontSize: '0.7rem', border: 'none', cursor: 'pointer' }}
                            > Bajar </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

               <div className="card" style={{ minWidth: 0 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Gastos Registrados</h3>
                    <div style={{ 
                      backgroundColor: 'rgba(0, 112, 192, 0.1)', 
                      padding: '4px 12px', 
                      borderRadius: '20px', 
                      border: '1px solid var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mi Gasto Total:</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)' }}>$ {myTotalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Expense Bar Visual */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '4px', marginBottom: '20px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.min(100, (myTotalSpent > 0 ? 100 : 0))}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, var(--primary), #38bdf8)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                   <button className="btn btn-primary btn-sm" onClick={() => setExpenseForm(!expenseForm)} disabled={loading || isPending}>
                     {expenseForm ? 'Cancelar' : '+ Registrar Gasto'}
                   </button>
                 </div>

                {expenseForm && (
                  <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', backgroundColor: 'var(--bg-deep)', borderRadius: '8px', marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Monto (L.)</label>
                      <input type="number" step="0.01" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción del gasto o detalle de la nota</label>
                      <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Ej: Pasajes, Alimentación, Viáticos recibidos" />
                    </div>
                    <div className="form-group-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
                      <input 
                        type="checkbox" 
                        id="isNote" 
                        checked={isNote} 
                        onChange={e => setIsNote(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="isNote" style={{ fontSize: '0.9rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}>
                        ¿Es una Nota Informativa? (No afecta el gasto real)
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Evidencia Fotográfica (Opcional)</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {!expensePhoto ? (
                          <label className="btn btn-ghost" style={{ flex: 1, border: '1px dashed var(--primary)', height: '80px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span style={{ fontSize: '0.7rem' }}>Tomar Foto</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              style={{ display: 'none' }} 
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  try {
                                    const compressed = await optimizedCompress(file)
                                    setExpensePhoto(compressed)
                                  } catch (err) {
                                    console.error('Compression error:', err)
                                    alert('Error al procesar la imagen. Intenta con una más pequeña.')
                                  }
                                }
                              }} 
                            />
                          </label>
                        ) : (
                          <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <img src={expensePhoto} alt="Recibo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button 
                              type="button" 
                              style={{ position: 'absolute', top: '5px', right: '5px', backgroundColor: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}
                              onClick={() => setExpensePhoto(null)}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>Guardar Gasto</button>
                  </form>
                )}

                {allExpenses.length === 0 && !expenseForm ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>No hay gastos o notas hoy.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* REAL EXPENSES SECTION */}
                    {allExpenses.filter(e => !e.isNote).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Gastos Realizados</h4>
                        {allExpenses.filter(e => !e.isNote).map((e: any) => (
                          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-deep)', borderRadius: '6px', borderLeft: e.isPending ? '3px solid var(--warning)' : 'none' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              {(e.receiptUrl || e.receiptPhoto) ? (
                                <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', flexShrink: 0, cursor: 'pointer' }} onClick={() => window.open(e.receiptUrl || e.receiptPhoto, '_blank')}>
                                  <img src={e.receiptUrl || e.receiptPhoto} alt="Recibo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                <div style={{ width: '36px', height: '36px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  {e.description}
                                  {e.isPending && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {e.isPending ? 'Pendiente' : (mounted ? formatDateEcuador(e.date) : '')} • {e.userName || 'Operador'}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 'bold', color: e.isPending ? 'var(--warning)' : 'var(--text)' }}>$ {Number(e.amount).toFixed(2)}</span>
                              {!e.isPending && (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button 
                                    onClick={() => {
                                      setEditingExpense(e)
                                      setExpenseFormFields({
                                        amount: e.amount.toString(),
                                        description: e.description || '',
                                        isNote: e.isNote,
                                        date: new Date(e.date).toISOString().split('T')[0]
                                      })
                                      setIsExpenseModalOpen(true)
                                    }}
                                    className="btn btn-ghost" 
                                    style={{ padding: '4px', color: 'var(--info)' }}
                                  >
                                    ✏️
                                  </button>
                                  <button onClick={() => handleDeleteExpense(e.id)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }}>✕</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* NOTES SECTION */}
                    {allExpenses.filter(e => e.isNote).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Notas / Montos Asignados</h4>
                        {allExpenses.filter(e => e.isNote).map((e: any) => (
                          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'rgba(0, 112, 192, 0.05)', borderRadius: '6px', borderLeft: '3px solid var(--primary)' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'rgba(0, 112, 192, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: '500' }}>{e.description}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {mounted ? formatDateEcuador(e.date) : ''} • {e.userName || 'Admin'}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>$ {Number(e.amount).toFixed(2)}</span>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button 
                                  onClick={() => {
                                    setEditingExpense(e)
                                    setExpenseFormFields({
                                      amount: e.amount.toString(),
                                      description: e.description || '',
                                      isNote: e.isNote,
                                      date: new Date(e.date).toISOString().split('T')[0]
                                    })
                                    setIsExpenseModalOpen(true)
                                  }}
                                  className="btn btn-ghost" 
                                  style={{ padding: '4px', color: 'var(--info)' }}
                                >
                                  ✏️
                                </button>
                                <button onClick={() => handleDeleteExpense(e.id)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }}>✕</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Legacy Phase Advances Removed - Now handled in Chat */}


            <div className="card" style={{ minWidth: 0 }}>
              <ProjectUploader 
                files={projectMediaFiles}
                onAddFile={handleUploadMedia}
                title="Registros Multimedia"
              />
            </div>
          </div>
        {/* End of REGISTROS */}
        {/* 2. BITÁCORA / CHAT UNIFICADO - MODAL APPROACH */}
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
                messages={liveChat} 
                userId={userId}
                isOperatorView={isFieldStaff}
                activeRecord={activeRecord}
                onDayAction={handleDayRecord}
                backUrl={panelBase} 
                onBack={() => setActiveTab('records')}
                onSendMessage={(content, type, extraData) => {
                  const isTechnicalAction = type === 'EXPENSE_LOG' || type === 'FILE' || type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO'
                  if (isFieldStaff && !activeRecord && isTechnicalAction) {
                    alert('⚠️ DEBES INICIAR JORNADA antes de realizar esta acción técnica.')
                    return
                  }

                  if (type === 'EXPENSE_LOG') {
                     handleSendMessage(null as any, content, activePhase || undefined, extraData?.file, extraData, 'EXPENSE_LOG');
                  } else if (type === 'FILE' || type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO') {
                     handleSendMessage(null as any, content || '', activePhase || undefined, extraData?.file, null, type);
                  } else {
                     handleSendMessage(null as any, content, activePhase || undefined, undefined, undefined, type);
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
      {/* Lightbox / Preview Modal */}
      {selectedPreviewImage && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              onClick={(e) => { e.stopPropagation(); setSelectedPreviewImage(null); }}
            >
              ✕
            </button>
            
            {selectedPreviewImage.mimeType.startsWith('image/') ? (
              <img 
                src={selectedPreviewImage.url} 
                alt={selectedPreviewImage.filename} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                style={{ backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px', width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedPreviewImage.filename}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedPreviewImage.mimeType}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button onClick={() => window.open(selectedPreviewImage.url, '_blank')} className="btn btn-primary" style={{ width: '100%' }}>Abrir Documento</button>
                  <button onClick={() => handleDownload(selectedPreviewImage.url, selectedPreviewImage.filename)} className="btn btn-ghost" style={{ width: '100%', border: '1px solid var(--border-color)' }}>{handleDownloadLoading === selectedPreviewImage.url ? 'Descargando...' : 'Descargar'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  )
}
