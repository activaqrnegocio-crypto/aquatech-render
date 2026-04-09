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

import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'

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
  const [liveChat, setLiveChat] = useState(initialChat || [])
  // --- REAL-TIME POLLING (Optimized: ref avoids dependency loop) ---
  const liveChatRef = useRef(liveChat)
  liveChatRef.current = liveChat

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

    const pollInterval = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      try {
        const msgs = liveChatRef.current
        const lastMsg = msgs[msgs.length - 1]
        const since = lastMsg ? lastMsg.createdAt : project.createdAt
        const resp = await fetch(`/api/projects/${project.id}/messages?since=${encodeURIComponent(new Date(since).toISOString())}`)
        if (resp.ok) {
          const newMsgs = await resp.json()
          if (newMsgs?.length > 0) {
            const existingIds = new Set(msgs.map((m: any) => m.id))
            const uniqueNew = (newMsgs as any[]).filter((m: any) => !existingIds.has(m.id)).map((m: any) => ({
              ...m,
              isMe: String(m.userId) === String(session?.user?.id), // Robust comparison
              userName: m.user?.name || 'Usuario',
              userBranch: m.user?.branch || null
            }))
            
            if (uniqueNew.length > 0) {
              setLiveChat((prev: any) => [...prev, ...uniqueNew])
              markAsSeen()
            }
          }
        }
      } catch (err) { /* silent */ }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [project.id, session?.user?.id]) // Stable dependencies

  // Sync initialChat when props update (RSC refresh)
  useEffect(() => {
    if (initialChat) {
      setLiveChat((prev: any[]) => {
        const existingIds = new Set(prev.map((m: any) => m.id))
        const uniqueFromProps = initialChat.filter((m: any) => !existingIds.has(m.id))
        if (uniqueFromProps.length === 0) return prev
        return [...prev, ...uniqueFromProps].sort((a: any, b: any) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    }
  }, [initialChat])

  // Calculate my total real expenses (not notes)
  const myTotalSpent = useMemo(() => {
    return expenses
      .filter((e: any) => !e.isNote)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
  }, [expenses])

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

  const pendingItems = useLiveQuery(() => db.outbox.where('projectId').equals(project.id).toArray(), [project.id]) || []
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
  const [mounted, setMounted] = useState(false)
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
              { timeout: 10000, enableHighAccuracy: true }
            )
          }).catch(() => null)
        } catch(e) {}
      }

      if (!location) {
        alert("⚠️ UBICACIÓN OBLIGATORIA: Por favor activa el GPS y permite el acceso para continuar. Es necesario para la auditoría de campo.")
        setLoading(false)
        return
      }

      const isEnding = !!activeRecord
      const payload = isEnding 
        ? { recordId: activeRecord.id, projectId: project.id, location }
        : { projectId: project.id, location }
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
            { timeout: 8000, enableHighAccuracy: true }
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
      if (expensePhoto) {
        processedPhoto = await compressImage(expensePhoto)
      }

      const payload = { 
        amount: Number(amount), 
        description, 
        date: new Date().toISOString(),
        isNote,
        receiptPhoto: processedPhoto // Compressed Base64
      }

      if (!navigator.onLine) {
        await db.outbox.add({
          type: 'EXPENSE',
          projectId: project.id,
          payload,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng,
          status: 'pending'
        })
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

  const handleSendMessage = async (e: React.FormEvent, customMsg?: string, customPhase?: number, mediaFile?: File) => {
    if (e) e.preventDefault()
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
            { enableHighAccuracy: true, timeout: 5000 }
          )
        })
      }

      if (!activeRecord && !pendingDayAction) {
        alert("⚠️ JORNADA NO INICIADA: Debes pulsar 'Iniciar Jornada' antes de registrar avances o notas.")
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
        let base64: string = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(mediaFile)
        })

        if (mediaFile.type.startsWith('image/')) {
          base64 = await compressImage(base64)
        }

        mediaData = {
          base64,
          filename: mediaFile.name,
          mimeType: mediaFile.type
        }
      }

      const payload = { 
        phaseId: phaseIdToSend, 
        content: msgToSend, 
        type: mediaFile ? (mediaFile.type.startsWith('image') ? 'IMAGE' : 'VIDEO') : (customMsg ? 'NOTE' : 'TEXT'),
        media: mediaData
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
          setLiveChat((prev: any[]) => {
            const exists = prev.some((m: any) => m.id === createdMsg.id)
            if (exists) return prev
            return [...prev, {
              ...createdMsg,
              isMe: true,
              userName: session?.user?.name || 'Yo',
              userBranch: (session?.user as any)?.branch || null
            }].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          })
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
            { timeout: 8000 }
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
      if (isBase64 && file.mimeType?.startsWith('image/')) {
        processedBase64 = await compressImage(file.url)
      }

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
    // If message is for a specific phase, only show if we are on that phase.
    // If message phaseId is null, only show if we are on General.
    if (msg.phaseId !== activePhase) return false
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

  const pendingExpenses = pendingItems
    .filter((item: any) => item.type === 'EXPENSE')
    .map((item: any) => ({
      id: `pending-exp-${item.id}`,
      amount: item.payload.amount,
      description: item.payload.description,
      date: new Date(item.timestamp).toISOString(),
      isPending: true
    }))

  const allExpenses = [...expenses, ...pendingExpenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
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
    <div style={{ padding: isSmallScreen ? '5px 10px 0 10px' : '0', minHeight: isSmallScreen ? 'calc(100vh - 128px)' : 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Project Header */}
      <div style={{ padding: isSmallScreen ? '10px 10px 0 10px' : '0', marginBottom: isSmallScreen ? '10px' : '20px' }}>
        <Link href={panelBase} className="btn btn-ghost btn-sm" style={{ padding: 0, color: 'var(--primary)', marginBottom: isSmallScreen ? '5px' : '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: isSmallScreen ? '0.8rem' : '0.9rem' }}>
          &larr; {isSmallScreen ? 'Volver' : 'Volver a Mis Proyectos'}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1', minWidth: '150px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px', 
              alignSelf: 'flex-start', 
              fontSize: '0.7rem', 
              color: !mounted ? 'var(--text-muted)' : (isOnline ? 'var(--success)' : 'var(--warning)'), 
              backgroundColor: 'var(--bg-deep)', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              border: '1px solid currentColor', 
              whiteSpace: 'nowrap' 
            }}>
               <div style={{ 
                 width: '6px', 
                 height: '6px', 
                 borderRadius: '50%', 
                 backgroundColor: 'currentColor',
                 boxShadow: mounted && isOnline ? '0 0 8px var(--success)' : 'none'
               }}></div>
               {mounted ? (
                 <>
                   {isOnline ? 'EN LÍNEA' : 'MODO OFFLINE'}
                 </>
               ) : 'COMPROBANDO...'}
            </div>
            
            <h1 style={{ fontSize: isSmallScreen ? '1.4rem' : '1.8rem', margin: 0, color: 'var(--text)', fontWeight: 'bold', lineHeight: 1.2, wordBreak: 'break-word' }}>{project.title}</h1>
            
            {/* NEW: Collapsible Project Info Accordion */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', margin: '5px 0' }}>
              <details style={{ width: '100%' }}>
                <summary style={{ 
                  padding: '10px 15px', 
                  cursor: 'pointer', 
                  backgroundColor: 'var(--bg-deep)', 
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  listStyle: 'none'
                }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>📋 Ficha del Proyecto (Info)</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▼</span>
                </summary>
                <div style={{ padding: '15px', display: 'grid', gridTemplateColumns: isSmallScreen ? '1fr' : '1fr 1fr', gap: '15px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cliente</h4>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{clientName}</p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Dirección</h4>
                    <p style={{ margin: 0 }}>{projectAddress}, {projectCity}</p>
                  </div>
                  <div style={{ gridColumn: isSmallScreen ? 'auto' : '1 / -1' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Especificaciones</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {project.depth && <span style={{ backgroundColor: 'var(--bg-deep)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Prof: {project.depth}m</span>}
                      {project.diameter && <span style={{ backgroundColor: 'var(--bg-deep)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Diám: {project.diameter}"</span>}
                      {project.elevation && <span style={{ backgroundColor: 'var(--bg-deep)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Elev: {project.elevation}m</span>}
                    </div>
                  </div>
                  
                  {/* Download PDF Buttons in the info card */}
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => generateFichaPDF()}
                      className="btn btn-ghost" 
                      style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', flex: 1 }}
                    >
                      📄 Ficha del Proyecto
                    </button>
                  </div>
                </div>
              </details>
            </div>
          </div>
          <span className={`status-badge status-${project.status.toLowerCase()}`} style={{ fontSize: isSmallScreen ? '0.7rem' : '0.8rem', padding: isSmallScreen ? '2px 8px' : '4px 12px', flexShrink: 0 }}>
            {project.status === 'ACTIVO' ? 'Activo' : 'Pendiente'}
          </span>
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: isSmallScreen ? '8px' : '15px', 
          marginTop: isSmallScreen ? '8px' : '15px', 
          color: 'var(--text-muted)', 
          fontSize: isSmallScreen ? '0.75rem' : '0.9rem', 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '100%', overflow: 'hidden' }}>
            <svg width={isSmallScreen ? "12" : "14"} height={isSmallScreen ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</span>
          </div>
          {(projectAddress) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '100%', overflow: 'hidden' }}>
              <svg width={isSmallScreen ? "12" : "14"} height={isSmallScreen ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectAddress} {projectCity ? `, ${projectCity}` : ''}</span>
            </div>
          )}
          {isSmallScreen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '8px', borderLeft: '1px solid var(--border)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {project.team.length}
            </div>
          )}
        </div>
      </div>

      <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '15px', 
          padding: isSmallScreen ? '0 10px' : '0',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: '10px'
      }}>
        {[
          { id: 'records', label: 'Registros', activeColor: 'var(--primary)', bgColor: 'rgba(0, 112, 192, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, gradient: 'linear-gradient(135deg, #0070c0, #38bdf8)' },
          { id: 'chat', label: 'Bitácora', activeColor: 'var(--warning)', bgColor: 'rgba(245, 158, 11, 0.2)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabWithUrl(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              borderRadius: '16px',
              background: activeTab === tab.id ? tab.gradient : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.id ? '#000' : tab.activeColor,
              border: `1px solid ${activeTab === tab.id ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: '1.1rem',
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
        {/* 1. REGISTROS */}
        <div style={{ display: activeTab === 'records' ? 'grid' : 'none', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
              <div className="card" style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Registro de Jornada</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  Registra tu hora de entrada y salida para contabilizar tus horas en obra.
                </p>
                <button 
                  className={`btn btn-lg btn-full ${activeRecord || (pendingDayAction && pendingDayAction.type === 'DAY_START') ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={handleDayRecord}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {loading ? 'Cargando...' : (activeRecord || (pendingDayAction && pendingDayAction.type === 'DAY_START')) ? (
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
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                      gap: '12px'
                    }}>
                      {project.gallery.map((item: any) => (
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
                              {(item.filename.toLowerCase().includes('plano') || item.filename.toLowerCase().includes('diseño')) && (
                                <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 11 }}>
                                  PLANO
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-deep)', padding: '10px', position: 'relative' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.7 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.filename}</span>
                              {(item.filename.toLowerCase().includes('plano') || item.filename.toLowerCase().includes('diseño')) && (
                                <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 11 }}>
                                  PLANO
                                </div>
                              )}
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
                            gap: '12px',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            zIndex: 10
                          }} className="group-hover:opacity-100">
                            <button 
                              onClick={() => setSelectedPreviewImage(item)}
                              style={{ 
                                padding: '8px 16px', 
                                backgroundColor: 'var(--primary)', 
                                color: 'white', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              Visualizar
                            </button>
                            <button 
                              onClick={() => handleDownload(item.url, item.filename)}
                              style={{ 
                                padding: '8px 16px', 
                                backgroundColor: 'white', 
                                color: 'var(--primary)', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Descargar
                            </button>
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
                                  const reader = new FileReader()
                                  reader.onloadend = async () => {
                                    const compressed = await compressImage(reader.result as string)
                                    setExpensePhoto(compressed)
                                  }
                                  reader.readAsDataURL(file)
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

            <div className="card" style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Avances de Fase & Notas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Fase Actual</label>
                  <select 
                    className="form-input" 
                    value={notePhase ?? ''} 
                    onChange={e => setNotePhase(e.target.value === '' ? null : Number(e.target.value))}
                    style={{ maxWidth: '100%', textOverflow: 'ellipsis' }}
                  >
                    <option value="">General (Sin Fase)</option>
                    {project.phases.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nota de Trabajo</label>
                  <textarea 
                    className="form-input" 
                    rows={3} 
                    placeholder="Ej: Se terminó la cimentación..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleSendMessage(null as any, note, notePhase as number)}
                  disabled={loading || !note.trim()}
                >
                  Guardar Nota de Avance
                </button>
              </div>
            </div>

            <div className="card" style={{ minWidth: 0 }}>
              <ProjectUploader 
                files={projectMediaFiles}
                onAddFile={handleUploadMedia}
                title="Registros Multimedia"
              />
            </div>
          </div>
        </div>

        {/* 2. BITÁCORA / CHAT */}
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
          <div className="chat-container" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: isSmallScreen ? 'calc(100vh - 200px)' : '65vh', 
            backgroundColor: 'var(--bg-card)', 
            borderRadius: isSmallScreen ? '0' : '12px', 
            overflow: 'hidden', 
            border: isSmallScreen ? 'none' : '1px solid var(--border)',
            margin: isSmallScreen ? '0 -10px' : '0' 
          }}>
            {!isSmallScreen && (
              <div style={{ padding: '10px 15px', backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', marginLeft: '5px' }}>
                        {project.team.map((t: any, idx: number) => (
                            <div key={t.id} style={{ 
                                width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary)', 
                                color: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontSize: '0.65rem', fontWeight: 'bold', border: '2px solid var(--bg-deep)',
                                marginLeft: idx === 0 ? 0 : '-8px', zIndex: project.team.length - idx
                            }} title={t.name}>
                                {t.name.charAt(0)}
                            </div>
                        ))}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{project.team.length} participantes</span>
                 </div>
                 <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>EN LÍNEA</div>
              </div>
            )}

            <div style={{ 
              padding: isSmallScreen ? '8px' : '12px', 
              borderBottom: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-deep)', 
              overflowX: 'auto', 
              display: 'flex', 
              gap: '8px',
              scrollbarWidth: 'none'
            }}>
              <button 
                onClick={() => setActivePhase(null)}
                style={{ 
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: isSmallScreen ? '60px' : '90px',
                  padding: isSmallScreen ? '6px 4px' : '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activePhase === null ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: activePhase === null ? 'var(--bg-deep)' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: isSmallScreen ? '0.7rem' : '0.8rem', fontWeight: 'bold' }}>GENERAL</span>
              </button>

              {project.phases.map((phase: any, idx: number) => {
                const isPreviousCompleted = idx === 0 || project.phases[idx - 1].status === 'COMPLETADA'
                const isLocked = false; // fases siempre desbloqueadas
                const isActive = activePhase === phase.id
                const isCompleted = phase.status === 'COMPLETADA'
                
                return (
                  <button 
                    key={phase.id} 
                    onClick={() => setActivePhase(phase.id)}
                    style={{ 
                      whiteSpace: 'nowrap',
                      opacity: isLocked ? 0.4 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: isSmallScreen ? '60px' : '100px',
                      padding: isSmallScreen ? '6px 4px' : '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? 'var(--bg-deep)' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <span style={{ fontSize: isSmallScreen ? '0.7rem' : '0.8rem', fontWeight: 'bold' }}>FASE {idx + 1}</span>
                    {isCompleted && <div style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'var(--success)', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg></div>}
                  </button>
                )
              })}
            </div>

            <div style={{ padding: isSmallScreen ? '6px 10px' : '8px 15px', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                {(['all', 'media', 'notes', 'text'] as const).map(f => (
                  <button key={f} onClick={() => setChatFilter(f)} className={`btn btn-sm ${chatFilter === f ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: isSmallScreen ? '0.65rem' : '0.7rem', padding: isSmallScreen ? '4px 6px' : '4px 10px', whiteSpace: 'nowrap' }}>
                    {f === 'all' ? 'Todos' : f === 'media' ? (isSmallScreen ? '📷' : '📷 Multimedia') : f === 'notes' ? (isSmallScreen ? '📝' : '📝 Notas') : (isSmallScreen ? '💬' : '💬 Texto')}
                  </button>
                ))}
              </div>
              {activePhase !== null && (
                project.phases.find((p: any) => p.id === activePhase)?.status === 'COMPLETADA' ? (
                    <span style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        Fase Finalizada
                    </span>
                ) : (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--warning)', borderColor: 'var(--warning)', fontSize: '0.75rem' }} onClick={() => handleCompletePhase(activePhase as number)} disabled={loading}>Finalizar Fase √</button>
                )
              )}
            </div>

            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div 
                ref={chatContainerRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
                  if (isAtBottom) setHasNewMessages(false);
                }}
                style={{ flex: 1, overflowY: 'auto', padding: isSmallScreen ? '12px 12px 80px 12px' : '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}
              >
                {filteredChat.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginBottom: '10px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <p>No hay mensajes en esta fase.<br/>Envía el primer mensaje o evidencia.</p>
                </div>
              ) : (
                filteredChat.map((msg: any) => (
                  <div key={msg.id} className="chat-message" style={{ alignSelf: msg.isMe ? 'flex-end' : 'flex-start', maxWidth: isSmallScreen ? '92%' : '80%', display: 'flex', flexDirection: 'column' }}>
                    {!msg.isMe && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '4px', marginLeft: '12px' }}>{msg.userName}{msg.userBranch && <span style={{ fontWeight: '500', color: 'var(--info)', marginLeft: '6px', fontSize: '0.65rem' }}>📍{msg.userBranch}</span>}</span>}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.isMe ? 'row' : 'row-reverse' }}>
                      {msg.isMe && (
                        <button
                          onClick={() => setWaForwardMsg(msg)}
                          title="Reenviar por WhatsApp"
                          style={{ background: '#25D366', border: 'none', borderRadius: '50%', width: isSmallScreen ? '24px' : '28px', height: isSmallScreen ? '24px' : '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(37,211,102,0.3)', transition: 'transform 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <svg width={isSmallScreen ? "12" : "14"} height={isSmallScreen ? "12" : "14"} viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </button>
                      )}
                      <div style={{ backgroundColor: msg.type === 'NOTE' ? 'var(--bg-deep)' : (msg.isMe ? 'var(--primary)' : 'var(--bg-surface)'), color: msg.isMe && msg.type !== 'NOTE' ? 'var(--bg-deep)' : 'var(--text)', padding: isSmallScreen ? '8px 12px' : '10px 15px', borderRadius: '16px', fontSize: isSmallScreen ? '0.8rem' : '0.875rem', border: msg.type === 'NOTE' ? '1px solid var(--warning)' : 'none', borderBottomRightRadius: msg.isMe ? '4px' : '12px', borderBottomLeftRadius: msg.isMe ? '12px' : '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {msg.type === 'NOTE' && <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>Nota de Avance</div>}
                        {msg.media && msg.media.length > 0 && (
                            <div style={{ marginBottom: '8px', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {msg.media[0].mimeType.startsWith('image') ? (
                                  <div style={{ position: 'relative' }}>
                                    <img src={msg.media[0].url} alt="Evidencia" style={{ width: '100%', maxHeight: isSmallScreen ? '200px' : '400px', objectFit: 'contain', display: 'block' }} />
                                    <button 
                                      onClick={() => handleDownload(msg.media[0].url, msg.media[0].filename)}
                                      style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '6px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>
                                  </div>
                                ) : msg.media[0].mimeType.startsWith('video') ? (
                                  <video src={msg.media[0].url} controls style={{ width: '100%', maxHeight: isSmallScreen ? '200px' : '400px' }} />
                                ) : (
                                  <div style={{ padding: '15px', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.media[0].filename}</div>
                                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Documento {(msg.media[0].mimeType.split('/')[1] || 'FILE').toUpperCase()}</div>
                                    </div>
                                    <button 
                                      onClick={() => handleDownload(msg.media[0].url, msg.media[0].filename)}
                                      style={{ padding: '8px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>
                                  </div>
                                )}
                            </div>
                        )}
                        {msg.content}
                        {msg.isPending && (
                           <div style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic', color: msg.status === 'failed' ? '#ef4444' : 'inherit' }}>
                              {msg.status === 'syncing' ? (
                                <div style={{ width: '10px', height: '10px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              )}
                              {msg.status === 'syncing' ? 'Sincronizando...' : msg.status === 'failed' ? 'Error. Reintentando...' : 'Pendiente de sincronización'}
                           </div>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', alignSelf: msg.isMe ? 'flex-end' : 'flex-start', margin: '0 4px' }}>
                        {msg.isPending ? 'Ahora' : (mounted ? formatTimeEcuador(msg.createdAt) : '')}
                    </span>
                  </div>
                ))
              )}
              </div>
              
              {/* Floating New Messages Indicator */}
              {hasNewMessages && (
                <button
                  onClick={() => {
                    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
                    setHasNewMessages(false)
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 50,
                    animation: 'bounce 2s infinite'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  Nuevos Mensajes (Desliza)
                </button>
              )}
            </div>

            {/* Message Input */}
            <div style={isSmallScreen ? {
              padding: '12px 10px', 
              backgroundColor: 'var(--bg-deep)', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              position: 'fixed', 
              bottom: '64px',
              left: 0,
              right: 0,
              zIndex: 100,
              boxShadow: '0 -2px 10px rgba(0,0,0,0.2)'
            } : { 
              padding: '15px', 
              backgroundColor: 'var(--bg-deep)', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              position: 'sticky', 
              bottom: 0, 
              zIndex: 10 
            }}>
              <label className="btn btn-ghost" style={{ padding: '10px', color: 'var(--primary)', cursor: (isFieldStaff && !activeRecord) ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: (isFieldStaff && !activeRecord) ? 0.5 : 1 }} title="Tomar Foto/Video">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  capture="environment" 
                  style={{ display: 'none' }} 
                  disabled={isFieldStaff && !activeRecord}
                  onChange={(e) => { 
                    if (isFieldStaff && !activeRecord) {
                      alert('⚠️ DEBES INICIAR JORNADA antes de enviar archivos.')
                      return
                    }
                    const file = e.target.files?.[0]; 
                    if (file) handleSendMessage(null as any, '', activePhase as number, file) 
                  }} 
                />
              </label>
              <form onSubmit={(e) => {
                if (isFieldStaff && !activeRecord) {
                  e.preventDefault()
                  alert('⚠️ DEBES INICIAR JORNADA antes de enviar mensajes o notas.')
                  return
                }
                handleSendMessage(e)
              }} style={{ flex: 1, display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={isFieldStaff && !activeRecord ? "Inicia jornada para enviar..." : "Escribe un mensaje..."}
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  disabled={isFieldStaff && !activeRecord}
                  style={{ 
                    flex: 1, 
                    fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
                    opacity: (isFieldStaff && !activeRecord) ? 0.6 : 1
                  }} 
                />
                <button type="submit" className="btn btn-primary" disabled={loading || !message.trim() || activePhase === undefined || (isFieldStaff && !activeRecord)} style={{ flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
          </div>
        </div>
      </div>

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
