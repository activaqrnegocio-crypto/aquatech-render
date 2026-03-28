'use client'

import { useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProjectUploader, { ProjectFile } from '@/components/ProjectUploader'

export default function ProjectDetailClient({ project, availableOperators = [] }: any) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<number[]>(project.team.map((t: any) => t.user.id))
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const [gallery, setGallery] = useState<any[]>(project.gallery || [])
  const [isUploading, setIsUploading] = useState(false)
  const [showAllGallery, setShowAllGallery] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState('ALL')
  const [currentStatus, setCurrentStatus] = useState(project.status)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const GALLERY_LIMIT = 12

  // --- NUEVO ESTADO PARA GASTOS ---
  const [isAddingExpense, setIsAddingExpense] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [isFichaOpen, setIsFichaOpen] = useState(false)
  
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
    if (!expenseAmount || !expenseDesc) return alert('Importe y descripción obligatorios')
    setIsSavingExpense(true)
    try {
      const resp = await fetch(`/api/projects/${project.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(expenseAmount),
          description: expenseDesc,
          date: new Date().toISOString()
        })
      })
      if (resp.ok) {
        setExpenseAmount('')
        setExpenseDesc('')
        setIsAddingExpense(false)
        router.refresh() // Recargar datos para ver el nuevo gasto en la tabla y barra
      } else {
        alert('Error al guardar gasto')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSavingExpense(false)
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
    return new Intl.DateTimeFormat('es-ES', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
  }

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('es-ES', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    }).format(d)
  }

  // --- MÉTRICAS ---
  const totalPhases = project.phases.length
  const completedPhases = project.phases.filter((p: any) => p.status === 'COMPLETADA').length
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0

  // Presupuesto vs Gastos
  const theoreticalBudget = Number(project.estimatedBudget) || 0
  const ivaAmount = theoreticalBudget * 0.15
  const grandTotal = theoreticalBudget + ivaAmount
  const realExpenses = project.expenses.reduce((acc: number, exp: any) => acc + Number(exp.amount), 0)
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
      doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 150, 35)

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
        rec.startTime ? new Date(rec.startTime).toLocaleTimeString() : '---',
        rec.endTime ? new Date(rec.endTime).toLocaleTimeString() : 'Aún en labor',
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

      const expenseData = project.expenses.map((exp: any) => [
        formatDate(exp.date),
        exp.description,
        exp.category || 'General',
        `$ ${Number(exp.amount).toFixed(2)}`
      ])

      autoTable(doc, {
        startY: 30,
        head: [['Fecha', 'Descripción', 'Categoría', 'Monto']],
        body: expenseData,
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
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-EC')}`, 150, 43)

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
        ['Tipo', fullProject.type || 'N/A'],
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
            ['Categorías', categories.join(', ') || 'N/A'],
            ['Tipos de Contrato', contracts.join(', ') || 'N/A'],
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
      const fullRealExpenses = (fullProject.expenses || []).reduce((acc: number, exp: any) => acc + Number(exp.amount), 0)

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
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isUpdatingStatus}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                  backgroundColor: currentStatus === 'LEAD' ? 'rgba(234, 179, 8, 0.15)' : currentStatus === 'ACTIVO' ? 'rgba(56, 189, 248, 0.15)' : currentStatus === 'COMPLETADO' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: currentStatus === 'LEAD' ? 'var(--warning)' : currentStatus === 'ACTIVO' ? 'var(--primary)' : currentStatus === 'COMPLETADO' ? 'var(--success)' : 'var(--danger)',
                  border: '1px solid currentColor',
                  cursor: 'pointer', appearance: 'auto',
                  textTransform: 'uppercase'
                }}
              >
                <option value="LEAD">Negociando</option>
                <option value="ACTIVO">Activo</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="COMPLETADO">Completado</option>
                <option value="CANCELADO">Cancelado</option>
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
            {project.type} {project.subtype ? `— ${project.subtype}` : ''}
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
            <button 
              className="btn btn-secondary" 
              onClick={() => handleDownload(`/api/projects/${project.id}/pdf`, `Ficha_${project.title.replace(/ /g, '_')}.pdf`)}
              disabled={isDownloadingPdf}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
              {isDownloadingPdf ? 'Generando...' : 'Descargar Ficha Técnica'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => handleDownload(`/api/projects/${project.id}/report`, `Reporte_${project.title.replace(/ /g, '_')}.pdf`)}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {isGenerating ? 'Generando...' : 'Generar Reporte de Obra'}
            </button>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Título</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{project.title}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Tipo</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.type || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Ciudad</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.city || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{project.address || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Inicio</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project.startDate)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Fecha Fin (Est.)</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{formatDate(project.endDate)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Creado por</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '600' }}>{project.creator?.name || 'Admin'}</span>
                </div>

                {/* Categorías */}
                {(() => {
                  let cats: string[] = []
                  try { cats = JSON.parse(project.categoryList || '[]') } catch {}
                  return cats.length > 0 ? (
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>Categorías</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {cats.map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', fontWeight: '600' }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}

                {/* Tipos de Contrato */}
                {(() => {
                  let cts: string[] = []
                  try { cts = JSON.parse(project.contractTypeList || '[]') } catch {}
                  return cts.length > 0 ? (
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>Tipos de Contrato</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {cts.map((c: string, i: number) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', fontWeight: '600' }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            </div>

            {/* Columna Derecha: Cliente + Especificaciones */}
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Cliente
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Nombre</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: '600' }}>{project.client?.name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>R.U.C.</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.ruc || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Teléfono</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.client?.phone || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Email</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{project.client?.email || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Dirección</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{project.client?.address || 'N/A'}</span>
                </div>
              </div>

              {/* Especificaciones Técnicas */}
              {(() => {
                let specs: any = {}
                try { specs = JSON.parse(project.technicalSpecs || '{}') } catch {}
                const desc = specs.description || project.specsTranscription || ''
                return desc ? (
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                      Especificaciones Técnicas
                    </h4>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text)', lineHeight: '1.6', border: '1px solid var(--border-color)' }}>
                      {desc}
                    </div>
                  </div>
                ) : null
              })()}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Presupuesto (Teórico)</span>
                <span style={{ fontWeight: 'bold' }}>$ {theoreticalBudget.toFixed(2)}</span>
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
                  {!isAddingExpense ? (
                    <button 
                      onClick={() => setIsAddingExpense(true)}
                      title="Registrar Gasto Directo"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Agregar Gasto
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monto/Motivo</span>
                  )}
                  <span style={{ fontWeight: 'bold', color: isCostoExcedido ? 'var(--danger)' : 'var(--success)' }}>$ {realExpenses.toFixed(2)}</span>
                </div>
              </div>

              {isAddingExpense && (
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--primary)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <input 
                    type="number" 
                    placeholder="$$" 
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    style={{ width: '80px', padding: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  />
                  <input 
                    type="text" 
                    placeholder="Descripción (ej: Pago a Pedro)" 
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    style={{ flex: 1, minWidth: '150px', padding: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  />
                  <div style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button onClick={() => setIsAddingExpense(false)} style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                    <button 
                      onClick={handleAddExpense} 
                      disabled={isSavingExpense}
                      style={{ padding: '4px 12px', fontSize: '0.75rem', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                    >
                      {isSavingExpense ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

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

          {project.expenses.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>Últimos 5 Gastos:</div>
              {project.expenses.slice(0, 5).map((exp: any) => (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{exp.description}</span>
                  <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>$ {Number(exp.amount).toFixed(2)}</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Fases */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>Fases de Trabajo</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', padding: '4px 10px', borderRadius: '12px' }}>
              {project.phases.length} Fases
            </span>
          </div>
          <div style={{ padding: '20px' }}>
            {project.phases.map((phase: any, idx: number) => (
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

      {/* Galería del Proyecto - Full Width at Bottom */}
      <div className="card" style={{ marginTop: '30px', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Galería del Proyecto
          </h3>
          
          <ProjectUploader 
            files={[]} 
            onAddFile={handleUploadToGallery}
            onRemoveFile={() => {}}
            minimal={true}
            showGrid={false}
            onFilterChange={(f) => setGalleryFilter(f)}
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '15px'
        }}>
          {(showAllGallery 
            ? (galleryFilter === 'ALL' ? gallery : gallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType.startsWith('image/'))))
            : (galleryFilter === 'ALL' ? gallery : gallery.filter((i: any) => i.type === galleryFilter || (galleryFilter === 'IMAGE' && i.mimeType.startsWith('image/')))).slice(0, GALLERY_LIMIT)
          ).map((item: any) => (
            <div key={item.id} className="group" style={{ 
              position: 'relative', 
              aspectRatio: '1/1', 
              borderRadius: '12px', 
              overflow: 'hidden', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              backgroundColor: 'var(--bg-surface)'
            }}>
              {/* Media Content */}
              {item.mimeType.startsWith('image/') ? (
                <img 
                  src={item.url} 
                  alt={item.filename} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
                  className="group-hover:scale-110"
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all', opacity: 0.8 }}>{item.filename}</span>
                </div>
              )}

              {/* Interaction Overlay */}
              <div style={{ 
                position: 'absolute', inset: 0, 
                backgroundColor: 'rgba(12, 26, 42, 0.7)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                opacity: 0, transition: 'opacity 0.3s ease',
                backdropFilter: 'blur(2px)',
                zIndex: 1
              }} className="group-hover:opacity-100">
                
                {/* View Button */}
                <button 
                  onClick={() => window.open(item.url, '_blank')}
                  title="Ver archivo"
                  style={{ 
                    width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'white', color: 'var(--bg-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>

                {/* Download Button */}
                <button 
                  onClick={() => handleDownload(item.url, item.filename)}
                  title="Descargar"
                  style={{ 
                    width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>

              {/* Delete Button (Keep separate but styled) */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteFromGallery(item.id); }}
                style={{ 
                  position: 'absolute', top: '8px', right: '8px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white', 
                  border: 'none', borderRadius: '6px', padding: '6px', 
                  cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s',
                  zIndex: 2
                }}
                className="group-hover:opacity-100 shadow-md"
                title="Eliminar de galería"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          
          {gallery.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem', padding: '40px', border: '2px dashed var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-surface)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '15px', opacity: 0.5 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <p>No hay imágenes en la galería aún.</p>
            </div>
          )}
        </div>

        {gallery.length > GALLERY_LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowAllGallery(!showAllGallery)}
              style={{ border: '1px solid var(--border-color)', padding: '10px 30px', borderRadius: '25px', color: 'var(--primary)' }}
            >
              {showAllGallery ? 'Ver menos' : `Ver todas las imágenes (${gallery.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
