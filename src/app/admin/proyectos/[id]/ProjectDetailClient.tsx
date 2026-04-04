'use client'

import { useState, useTransition } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'
import { formatToEcuador, ECUADOR_TIMEZONE, getLocalNow, formatDateEcuador, formatTimeEcuador } from '@/lib/date-utils'
import MediaCapture from '@/components/MediaCapture'
import { useSession } from 'next-auth/react'
import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'

export default function ProjectDetailClient({ project, availableOperators = [] }: any) {
  const router = useRouter()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'BITACORA' | 'GALLERY' | 'EXPENSES'>('BITACORA')
  
  // --- BITÁCORA STATE ---
  const [chatMessages, setChatMessages] = useState(project.chatMessages || [])
  const [message, setMessage] = useState('')
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [showMediaCapture, setShowMediaCapture] = useState<'audio' | 'video' | null>(null)

  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<number[]>(project.team.map((t: any) => t.user.id))
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  // Combine direct gallery uploads and chat media into a unified gallery
  const initialGallery = [
    ...(project.gallery || []),
    ...(project.chatMessages?.flatMap((m: any) => m.media || []).map((m: any) => ({
      ...m,
      isFromChat: true
    })) || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const [gallery, setGallery] = useState<any[]>(initialGallery)
  const [isUploading, setIsUploading] = useState(false)
  const [showAllGallery, setShowAllGallery] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState('ALL')
  const [currentStatus, setCurrentStatus] = useState(project.status)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const GALLERY_LIMIT = 12

  // --- EXPENSES STATE ---
  const [expenses, setExpenses] = useState(project.expenses || [])
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    isNote: false,
    date: new Date().toISOString().split('T')[0]
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [editBudget, setEditBudget] = useState(project.estimatedBudget || 0)

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

  // Form State for Ficha
  const [editTitle, setEditTitle] = useState(project.title)
  const [editType, setEditType] = useState(project.type)
  const [editSubtype, setEditSubtype] = useState(project.subtype || '')
  const [editCity, setEditCity] = useState(project.city || '')
  const [editAddress, setEditAddress] = useState(project.address || '')
  const [editStartDate, setEditStartDate] = useState(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '')
  const [editEndDate, setEditEndDate] = useState(project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '')
  const [editCategoryList, setEditCategoryList] = useState<string[]>(() => {
    try { return JSON.parse(project.categoryList || '[]') } catch { return [] }
  })
  const [editContractTypeList, setEditContractTypeList] = useState<string[]>(() => {
    try { return JSON.parse(project.contractTypeList || '[]') } catch { return [] }
  })
  const [editSpecsTranscription, setEditSpecsTranscription] = useState(project.specsTranscription || '')
  const [editTechnicalSpecs, setEditTechnicalSpecs] = useState(() => {
    try { 
      const parsed = JSON.parse(project.technicalSpecs || '{}')
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
    
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, {
        method: 'DELETE'
      })
      if (resp.ok) {
        setIsUpdatingStatus(false)
        startTransition(() => {
          router.refresh()
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
          router.refresh()
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
      const resp = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE'
      })

      if (resp.ok) {
        router.push('/admin/proyectos')
        startTransition(() => {
          router.refresh()
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
    try {
      const resp = await fetch(`/api/projects/${project.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(expenseForm.amount),
          description: expenseForm.description,
          date: expenseForm.date,
          isNote: expenseForm.isNote
        })
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
          router.refresh()
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
          router.refresh()
        })
      } else {
        alert('Error al actualizar el presupuesto')
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const handleUploadToGallery = async (file: ProjectFile) => {
    setIsUploading(true)
    try {
      const resp = await fetch(`/api/projects/${project.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      })
      if (resp.ok) {
        const newItem = await resp.json()
        setGallery(prev => [newItem, ...prev])
      }
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
      setIsEditingPhases(false)
      router.refresh()
    } catch (e) {
      console.error('Error saving phases:', e)
    } finally {
      setIsSavingPhases(false)
    }
  }

  const handleSaveTeam = async () => {
    setIsSavingTeam(true)
    try {
      await fetch(`/api/projects/${project.id}/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorIds: selectedTeam })
      })
      setIsEditingTeam(false)
      router.refresh()
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

  // --- MÉTRICAS ---
  const totalPhases = project.phases.length
  const completedPhases = project.phases.filter((p: any) => p.status === 'COMPLETADA').length
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0

  // Presupuesto vs Gastos (EstimatedBudget now includes 15% IVA)
  const grandTotal = Number(project.estimatedBudget) || 0
  const theoreticalBudget = grandTotal / 1.15
  const ivaAmount = grandTotal - theoreticalBudget
  const realExpenses = project.expenses
    .filter((exp: any) => !exp.isNote)
    .reduce((acc: number, exp: any) => acc + Number(exp.amount), 0)
  const expenseRatio = theoreticalBudget > 0 ? Math.min((realExpenses / theoreticalBudget) * 100, 100) : 0
  const isCostoExcedido = realExpenses > theoreticalBudget && theoreticalBudget > 0

  // Tiempo: Días Est. vs Reales
  const theoreticalDays = project.phases.reduce((acc: number, p: any) => acc + (p.estimatedDays || 0), 0)
  
  // Cálculo de Tiempo Real
  let realDays = 0
  if (project.startDate) {
    const start = new Date(project.startDate)
    const end = project.status === 'COMPLETADO' && project.endDate ? new Date(project.endDate) : new Date()
    const diffTime = Math.abs(end.getTime() - start.getTime())
    realDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }
  
  const timeRatio = theoreticalDays > 0 ? Math.min((realDays / theoreticalDays) * 100, 100) : 0
  const isTiempoExcedido = realDays > theoreticalDays && theoreticalDays > 0

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

  // --- BITACORA HANDLERS ---
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

      const res = await fetch(`/api/projects/${project.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const newMessage = await res.json()
        setChatMessages((prev: any) => [...prev, newMessage])
        setMessage('')
        setShowMediaCapture(null)
        router.refresh()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  // --- EXPENSE HANDLERS ---
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
          amount: Number(expenseForm.amount)
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
        router.refresh()
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
      const res = await fetch(`/api/projects/${project.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setExpenses((prev: any) => prev.filter((ex: any) => ex.id !== expenseId))
        router.refresh()
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

      // 2. BITÁCORA DE AVANCES (CHAT)
      doc.addPage()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Bitácora de Campo (Avances)', 20, 20)
      
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


      // 3. REGISTRO DE ASISTENCIA
      doc.addPage()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Registro de Asistencia (Horarios)', 20, 20)

      const attendanceData = project.dayRecords.map((rec: any) => [
        formatDate(rec.createdAt),
        rec.user.name,
        rec.startTime ? formatTimeEcuador(rec.startTime) : '---',
        rec.endTime ? formatTimeEcuador(rec.endTime) : 'Aún en labor',
        rec.endTime && rec.startTime ? 
          `${((new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)} hrs` : '---'
      ])

      autoTable(doc, {
        startY: 30,
        head: [['Fecha', 'Operador', 'Entrada', 'Salida', 'Total Horas']],
        body: attendanceData,
        styles: { fontSize: 9 }
      })

      // 4. DETALLE DE GASTOS
      doc.addPage()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Detalle de Gastos Reportados', 20, 20)

      const expenseData = project.expenses.filter((e: any) => !e.isNote).map((exp: any) => [
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
        foot: [['', '', 'TOTAL REAL:', `$ ${realExpenses.toFixed(2)}`]],
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
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
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
      y = (doc as any).lastAutoTable.finalY + 15

      // Fases
      doc.setTextColor(56, 189, 248)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('6. FASES DE TRABAJO', 20, y)
      y += 10

      const phaseData = fullProject.phases.map((p: any, i: number) => [
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


  return (
    <div className="p-6">
      {/* Header */}
      <div className="dashboard-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <Link href="/admin/proyectos" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              &larr; Volver
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={['COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(currentStatus) ? 'ARCHIVADO' : currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: currentStatus === 'LEAD' ? 'rgba(234, 179, 8, 0.15)' : currentStatus === 'ACTIVO' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                    color: currentStatus === 'LEAD' ? 'var(--warning)' : currentStatus === 'ACTIVO' ? 'var(--primary)' : 'var(--text-muted)',
                    border: '1px solid currentColor',
                    cursor: 'pointer', appearance: 'auto',
                    textTransform: 'uppercase'
                  }}
                >
                  <option value="LEAD">Negociando</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="ARCHIVADO">Archivado</option>
                </select>
              {project.creator && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Creado por: {project.creator.name}
                </span>
              )}
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>{project.title}</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px', fontSize: '1.1rem' }}>
            {translateType(project.type)} {project.subtype ? `— ${project.subtype}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Subtotal: $ {theoreticalBudget.toFixed(2)}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IVA 15%: $ {ivaAmount.toFixed(2)}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Total a Pagar</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            $ {grandTotal.toFixed(2)}
          </div>
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
                  onClick={() => handleDownload(`/api/projects/${project.id}/pdf`, `Ficha_${project.title.replace(/ /g, '_')}.pdf`)}
                  disabled={isDownloadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
                  {isDownloadingPdf ? 'Generando...' : 'Descargar Ficha Técnica'}
                </button>
                {(session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'SUBCONTRATISTA') && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleDownload(`/api/projects/${project.id}/report`, `Reporte_${project.title.replace(/ /g, '_')}.pdf`)}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
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
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{project.title}</span>
                    ) : (
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Tipo</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.type || 'N/A'}</span>
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
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.city || 'N/A'}</span>
                    ) : (
                      <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{project.address || 'N/A'}</span>
                    ) : (
                      <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Inicio</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project.startDate)}</span>
                    ) : (
                      <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Fin (Est.)</span>
                    {!isEditingFicha ? (
                      <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project.endDate)}</span>
                    ) : (
                      <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="form-input" style={{ width: '60%', padding: '4px 8px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Creado por</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '600' }}>{project.creator?.name || 'Admin'}</span>
                </div>

                {/* Categorías */}
                <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>Categorías</div>
                  {!isEditingFicha ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(() => {
                        try { return JSON.parse(project.categoryList || '[]').map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', fontWeight: '600' }}>{translateCategory(c)}</span>
                        )) } catch { return null }
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                        try { return JSON.parse(project.contractTypeList || '[]').map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', fontWeight: '600' }}>{translateType(c)}</span>
                        )) } catch { return null }
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección Fiscal</span>
                  {!isEditingFicha ? (
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{project.client?.address || 'N/A'}</span>
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
                  <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text)', lineHeight: '1.6', border: '1px solid var(--border-color)', minHeight: '100px', whiteSpace: 'pre-wrap' }}>
                    {(() => {
                      try { 
                        const specs = JSON.parse(project.technicalSpecs || '{}')
                        return specs.description || project.specsTranscription || 'Sin especificaciones detalladas.'
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
          <div style={{ marginTop: '25px', padding: '20px', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05), rgba(34, 197, 94, 0.05))', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Subtotal</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>$ {theoreticalBudget.toFixed(2)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>IVA 15%</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>$ {ivaAmount.toFixed(2)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Total a Pagar</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>$ {grandTotal.toFixed(2)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Gastado Real</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isCostoExcedido ? 'var(--danger)' : 'var(--success)' }}>$ {realExpenses.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '30px', alignItems: 'stretch' }}>
        {/* COMPARATIVA DE GASTOS */}
        <div className="card" style={{ minWidth: 0, borderLeft: `4px solid ${isCostoExcedido ? 'var(--danger)' : 'var(--success)'}`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <span style={{ color: 'var(--text-muted)' }}>Presupuesto (Teórico)</span>
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
                    <span style={{ fontWeight: 'bold' }}>$ {theoreticalBudget.toFixed(2)}</span>
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
                      setActiveTab('EXPENSES')
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
        <div className="card" style={{ minWidth: 0, borderLeft: `4px solid ${isTiempoExcedido ? 'var(--warning)' : 'var(--primary)'}`, padding: '24px' }}>
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

        {/* CLIENTE RAPID VIEW */}
        <div className="card" style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Información del Cliente
          </h3>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>{project.client?.name || 'Cliente sin nombre'}</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {project.client?.phone || 'Sin teléfono'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span style={{ wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {project.client?.email || 'Sin email'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>{project.address || project.client?.address || 'Sin dirección'}</span>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {/* Equipo */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Equipo Asignado
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

          {/* Actividad Reciente */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Actividad Reciente
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {project.chatMessages.slice(0, 5).map((msg: any) => (
                <div key={msg.id} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {msg.user.name.substring(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>{msg.user.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>
                    {msg.phase && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginBottom: '4px' }}>
                        Fase: {msg.phase.title}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', padding: '8px 12px', borderRadius: '0 8px 8px 8px', marginTop: '2px' }}>
                      {msg.type === 'IMAGE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            Foto de avance
                          </div>
                          {msg.media && msg.media.length > 0 && (
                            <img 
                              src={msg.media[0].url} 
                              alt="Avance de obra" 
                              style={{ width: '100%', borderRadius: '4px', objectFit: 'cover', maxHeight: '150px' }} 
                            />
                          )}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {project.chatMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '10px' }}>Sin actividad aún.</div>
              )}
            </div>
            
            {project.chatMessages.length > 5 && (
              <Link href={`/admin/proyectos/${project.id}/bitacora`} className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '15px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                Ver Bitácora Completa ({project.chatMessages.length - 5} más)
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN DE PESTAÑAS (TABS) */}
      <div style={{ marginTop: '40px', width: '100%' }}>
        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px', 
          paddingBottom: '10px', 
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          {[
            { id: 'BITACORA', label: 'Bitácora', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { id: 'GALLERY', label: 'Galería', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
            { id: 'EXPENSES', label: 'Gastos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '12px',
                backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? 'var(--bg-deep)' : 'var(--text)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card" style={{ padding: '25px', minHeight: '400px' }}>
          
          {/* 1. BITÁCORA INTERACTIVA */}
          {activeTab === 'BITACORA' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>Línea de Tiempo del Proyecto</h3>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '5px' }}>
                  <button 
                    onClick={() => setActivePhase(null)}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: activePhase === null ? 'var(--primary)' : 'transparent', color: activePhase === null ? 'var(--bg-deep)' : 'var(--text)' }}
                  >
                    General
                  </button>
                  {project.phases.map((p: any) => (
                    <button 
                      key={p.id}
                      onClick={() => setActivePhase(p.id)}
                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: activePhase === p.id ? 'var(--primary)' : 'transparent', color: activePhase === p.id ? 'var(--bg-deep)' : 'var(--text)', whiteSpace: 'nowrap' }}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px', marginBottom: '20px' }}>
                {chatMessages
                  .filter((m: any) => activePhase === null ? true : m.phaseId === activePhase)
                  .map((msg: any) => {
                    const isMe = msg.userId === Number(session?.user?.id)
                    const isAdminMsg = true // In this view, we style it corporately
                    
                    return (
                      <div key={msg.id} style={{ 
                        alignSelf: isMe ? 'flex-end' : 'flex-start', 
                        maxWidth: '85%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          justifyContent: isMe ? 'flex-end' : 'flex-start',
                          fontSize: '0.75rem',
                          color: isMe ? 'var(--primary)' : 'var(--text-muted)'
                        }}>
                          <span style={{ fontWeight: 'bold' }}>{msg.user?.name}</span>
                          <span style={{ opacity: 0.6 }}>{formatDateTime(msg.createdAt)}</span>
                        </div>

                        <div style={{ 
                          backgroundColor: isMe ? 'rgba(0, 112, 192, 0.15)' : 'var(--bg-surface)',
                          border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          padding: '12px 16px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          color: 'var(--text)',
                          fontSize: '0.9rem',
                          position: 'relative',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          {msg.type === 'AUDIO' && (
                            <div style={{ marginBottom: '8px' }}>
                              <audio src={msg.media?.[0]?.url} controls style={{ width: '200px', height: '35px' }} />
                            </div>
                          )}
                          {msg.type === 'VIDEO' && (
                            <div style={{ marginBottom: '8px', maxWidth: '300px', borderRadius: '8px', overflow: 'hidden' }}>
                              <video src={msg.media?.[0]?.url} controls style={{ width: '100%', display: 'block' }} />
                            </div>
                          )}
                          {msg.type === 'IMAGE' && msg.media?.[0] && (
                            <div style={{ marginBottom: '8px', maxWidth: '300px', borderRadius: '8px', overflow: 'hidden' }}>
                              <img src={msg.media[0].url} alt="Avance" style={{ width: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          {msg.type === 'NOTE' && (
                             <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>Nota Destacada</div>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        </div>
                      </div>
                    )
                  })}
                {chatMessages.length === 0 && (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>No hay registros en esta sección.</p>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div style={{ padding: '20px', backgroundColor: 'var(--bg-deep)', borderRadius: '15px' }}>
                {showMediaCapture ? (
                  <div style={{ marginBottom: '15px' }}>
                    <MediaCapture 
                      mode={showMediaCapture} 
                      onCapture={(blob, type, transcription) => handleSendMessage(undefined, { blob, type, transcription })} 
                    />
                    <button onClick={() => setShowMediaCapture(null)} className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }}>Cancelar</button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button type="button" onClick={() => setShowMediaCapture('audio')} title="Grabar Audio" className="btn btn-ghost btn-sm" style={{ padding: '8px', color: 'var(--primary)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                      </button>
                      <button type="button" onClick={() => setShowMediaCapture('video')} title="Grabar Video" className="btn btn-ghost btn-sm" style={{ padding: '8px', color: 'var(--primary)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                      </button>
                    </div>
                    <input 
                      className="form-input" 
                      placeholder="Escribe un mensaje al equipo..." 
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      style={{ flex: 1, backgroundColor: 'var(--bg-card)' }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={isSending || !message.trim()}>
                      {isSending ? '...' : 'Enviar'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* 2. GALERÍA UNIFICADA */}
          {activeTab === 'GALLERY' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Archivos del Proyecto
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gestiona planos, fotos y documentos técnicos.</p>
                </div>
                
                <ProjectUploader 
                  files={[]} 
                  onAddFile={handleUploadToGallery}
                  onRemoveFile={() => {}}
                  minimal={true}
                  showGrid={false}
                  onFilterChange={(f) => setGalleryFilter(f)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '20px' }}>
                {(showAllGallery 
                  ? (galleryFilter === 'ALL' ? gallery : gallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType.startsWith('image/'))))
                  : (galleryFilter === 'ALL' ? gallery : gallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType.startsWith('image/')))).slice(0, GALLERY_LIMIT)
                ).map((item: any) => (
                  <div key={item.id} className="group" style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                    {item.mimeType.startsWith('image/') ? (
                      <img src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                        <span style={{ fontSize: '0.7rem', color: 'var(--info)' }}>{item.filename}</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '0.3s' }} className="group-hover:opacity-100">
                      <button onClick={() => window.open(item.url, '_blank')} className="btn btn-primary btn-sm">Ver</button>
                      <button onClick={() => handleDeleteFromGallery(item.id)} className="btn btn-danger btn-sm" style={{ marginLeft: '5px' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              {gallery.length > GALLERY_LIMIT && (
                <button onClick={() => setShowAllGallery(!showAllGallery)} className="btn btn-ghost" style={{ width: '100%', marginTop: '20px' }}>
                  {showAllGallery ? 'Ver Menos' : 'Ver Todos'}
                </button>
              )}
            </div>
          )}

          {/* 3. GESTIÓN DE GASTOS */}
          {activeTab === 'EXPENSES' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Control de Gastos</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Historial detallado y auditoría de egresos.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingExpense(null)
                    setExpenseForm({ amount: '', description: '', isNote: false, date: new Date().toISOString().split('T')[0] })
                    setIsExpenseModalOpen(true)
                  }}
                  className="btn btn-primary"
                >
                  + Agregar Gasto/Nota
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Responsable</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Descripción</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Tipo</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((ex: any) => (
                      <tr key={ex.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px' }}>{formatDateEcuador(ex.date)}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                              {ex.user?.name.substring(0,2).toUpperCase()}
                            </div>
                            {ex.user?.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>{ex.description}</div>
                          {ex.lat && ex.lng && (
                            <a href={`https://www.google.com/maps?q=${ex.lat},${ex.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--info)' }}>📍 Ver Ubicación</a>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: ex.isNote ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 112, 192, 0.1)', color: ex.isNote ? 'var(--warning)' : 'var(--primary)', fontWeight: 'bold' }}>
                            {ex.isNote ? 'NOTA' : 'REAL'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>$ {Number(ex.amount).toFixed(2)}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                            {ex.receiptUrl && (
                              <button onClick={() => window.open(ex.receiptUrl, '_blank')} className="btn btn-ghost btn-sm" title="Ver Recibo">📎</button>
                            )}
                            <button 
                              onClick={() => {
                                setEditingExpense(ex)
                                setExpenseForm({
                                  amount: ex.amount.toString(),
                                  description: ex.description || '',
                                  isNote: ex.isNote,
                                  date: new Date(ex.date).toISOString().split('T')[0]
                                })
                                setIsExpenseModalOpen(true)
                              }}
                              className="btn btn-ghost btn-sm"
                            >
                              ✏️
                            </button>
                            <button onClick={() => handleDeleteExpense(ex.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  Estás a punto de borrar <strong>{project.title}</strong>.<br/> Todos los datos asociados se destruirán de forma inmediata e irreversible.
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
                  {project.title}
                </div>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Escribe el nombre aquí..."
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ width: '100%', padding: '15px', backgroundColor: 'var(--bg-deep)', border: `2px solid ${deleteConfirmText === project.title ? 'var(--success)' : 'var(--border-color)'}`, borderRadius: '10px', color: 'white', textAlign: 'center', fontSize: '1.1rem', marginBottom: '25px', outline: 'none' }}
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
                    disabled={isDeleting || deleteConfirmText !== project.title}
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', backgroundColor: deleteConfirmText === project.title ? 'var(--danger)' : 'rgba(239, 68, 68, 0.3)', border: 'none', color: 'white', fontWeight: 'bold', cursor: deleteConfirmText === project.title ? 'pointer' : 'not-allowed', opacity: deleteConfirmText === project.title ? 1 : 0.6 }}
                  >
                    {isDeleting ? 'Eliminando...' : 'BORRAR TODO'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
