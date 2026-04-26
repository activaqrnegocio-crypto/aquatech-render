'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { getLocalNow, formatForDateTimeInput, forceEcuadorTZ } from '@/lib/date-utils'
import { uploadToBunnyClientSide } from '@/lib/storage-client'
import { compressImage as optimizedCompress } from '@/lib/image-optimization'

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  onDelete?: (id: number) => Promise<void>
  initialData?: any
  userId: number
  projects: any[]
  operators?: any[]
  isAdminView?: boolean
}

type AssignMode = 'UNO' | 'VARIOS' | 'TODOS'

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  userId,
  projects,
  operators = [],
  isAdminView = false
}: AppointmentModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<number[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [filteredProjects, setFilteredProjects] = useState<any[]>(projects)
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    projectId: '',
    userId: userId > 0 ? userId.toString() : '',
    clientLocation: '',
    operatorLocation: '',
    clientName: '',
    clientPhone: '',
    status: 'PENDIENTE',
    mediaFiles: [] as File[],
    previews: [] as { url: string; type: string; name: string; isNew?: boolean }[]
  })

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setLoading(false)
      setIsDropdownOpen(false)
      if (initialData) {
        setSelectedOperatorIds(initialData.userId ? [initialData.userId] : [])
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          startTime: formatForDateTimeInput(initialData.startTime),
          endTime: formatForDateTimeInput(initialData.endTime),
          projectId: initialData.projectId?.toString() || '',
          userId: initialData.userId?.toString() || (userId > 0 ? userId.toString() : ''),
          clientLocation: initialData.clientLocation || '',
          operatorLocation: initialData.operatorLocation || '',
          clientName: initialData.clientName || '',
          clientPhone: initialData.clientPhone || '',
          status: initialData.status || 'PENDIENTE',
          mediaFiles: [],
          previews: initialData.files ? (typeof initialData.files === 'string' ? JSON.parse(initialData.files) : initialData.files).map((f: any) => ({
            url: f.url || f.data,
            type: f.type || 'document',
            name: f.name || 'Archivo',
            isNew: false
          })) : []
        })
      } else {
        const now = getLocalNow()
        now.setMinutes(0)
        const inOneHour = new Date(now)
        inOneHour.setHours(now.getHours() + 1)

        setSelectedOperatorIds([])
        setFormData({
          title: '',
          description: '',
          startTime: formatForDateTimeInput(now),
          endTime: formatForDateTimeInput(inOneHour),
          projectId: '',
          userId: userId > 0 ? userId.toString() : '',
          clientLocation: '',
          operatorLocation: '',
          clientName: '',
          clientPhone: '',
          status: 'PENDIENTE',
          mediaFiles: [],
          previews: []
        })
      }
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, initialData, userId])

  // Fetch projects filtered by selected operators
  useEffect(() => {
    const fetchFilteredProjects = async () => {
      let targetIds = selectedOperatorIds

      if (targetIds.length === 0) {
        setFilteredProjects(projects) // No filter, show all
        return
      }

      try {
        const res = await fetch(`/api/admin/calendar/projects-by-operators?operatorIds=${targetIds.join(',')}`)
        if (res.ok) {
          const data = await res.json()
          setFilteredProjects(data)
        } else {
          setFilteredProjects(projects)
        }
      } catch {
        setFilteredProjects(projects) // fallback
      }
    }

    if (isAdminView && isOpen) {
      fetchFilteredProjects()
    }
  }, [selectedOperatorIds, isAdminView, isOpen])

  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Cleanup recognition on unmount or modal close
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsRecording(false)
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const toggleOperator = (id: number) => {
    setSelectedOperatorIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAllOperators = () => {
    if (selectedOperatorIds.length === operators.length) {
      setSelectedOperatorIds([])
    } else {
      setSelectedOperatorIds(operators.map(op => op.id))
    }
  }

  const toggleSpeechToText = () => {
    // If already recording, stop
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsRecording(false)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta transcripción de voz.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsRecording(true)
    
    recognition.onend = () => {
      setIsRecording(false)
      recognitionRef.current = null
    }
    
    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      // 'no-speech' is common - just let it restart or stop gracefully
      if (event.error !== 'no-speech') {
        setIsRecording(false)
        recognitionRef.current = null
      }
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        setFormData(prev => ({
          ...prev,
          description: prev.description ? `${prev.description} ${finalTranscript}` : finalTranscript
        }))
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`
        setFormData(prev => ({ ...prev, operatorLocation: mapsLink }))
        setLoading(false)
      },
      (error) => {
        console.error('Error GPS:', error)
        alert('No se pudo obtener la ubicación. Asegúrate de dar permisos de GPS.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const getTargetUserIds = (): number[] => {
    return selectedOperatorIds
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const newPreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
      isNew: true
    }))
    setFormData(prev => ({
      ...prev, 
      mediaFiles: [...prev.mediaFiles, ...files],
      previews: [...prev.previews, ...newPreviews]
    }))
  }

  const removeFile = (idx: number) => {
    setFormData(prev => {
      URL.revokeObjectURL(prev.previews[idx].url)
      return {
        ...prev,
        mediaFiles: prev.mediaFiles.filter((_, i) => i !== idx),
        previews: prev.previews.filter((_, i) => i !== idx)
      }
    })
  }

  // Helper para comprimir imágenes (mantener para ahorro de espacio en WA real)
  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) return file
    try {
      const blob = await optimizedCompress(file)
      return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
    } catch (err) {
      console.warn('[AppointmentModal] Centralized compression failed, falling back to original file', err)
      return file
    }
  }

  // Helper para procesar archivos usando subida directa (Bypass Vercel Limit)
  const processFilesMixed = async (files: File[]) => {
    const realFiles: any[] = []
    const linkFiles: any[] = []
    
    for (const file of files) {
      // Detección mejorada basada en extensión si el mime es genérico
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext);
      const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
      const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac', 'amr', '3gp'].includes(ext);
      
      try {
        // Comprimir imagen si es necesario
        const fileToUpload = isImage ? await compressImage(file) : file
        
        // Subida directa a Bunny (Cliente -> Bunny)
        const result = await uploadToBunnyClientSide(fileToUpload, fileToUpload.name, 'appointments')
        
        if (isVideo) {
          // Los videos se envían como links para evitar que WhatsApp colapse
          linkFiles.push({ type: 'video', name: file.name, url: result.url })
        } else {
          // Imágenes, Audios y Docs se envían como "realFiles" (Evolution los enviará como archivo real desde el URL)
          let mediaType = 'document'
          if (isImage) mediaType = 'image'
          if (isAudio) mediaType = 'audio'
          
          realFiles.push({ 
            type: mediaType, 
            name: file.name, 
            data: result.url 
          })
        }
      } catch (err) {
        console.error('Error subiendo archivo:', file.name, err)
        alert(`Error al subir ${file.name}`)
      }
    }
    return { realFiles, linkFiles }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const start = new Date(formData.startTime)
    const end = new Date(formData.endTime)
    if (end <= start) { alert('Error: La fecha de fin debe ser posterior.'); return; }

    const targetUserIds = getTargetUserIds()
    if (targetUserIds.length === 0) { alert('Selecciona al menos un operador.'); return; }

    setLoading(true)
    try {
      let realFiles: any[] = []
      let linkFiles: any[] = []

      if (navigator.onLine) {
        const result = await processFilesMixed(formData.mediaFiles)
        realFiles = result.realFiles
        linkFiles = result.linkFiles
      } else {
        // Offline: Convert files to base64 for outbox
        for (const file of formData.mediaFiles) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
          
          const isVideo = file.type.startsWith('video/')
          if (isVideo) {
            linkFiles.push({ type: 'video', name: file.name, base64 })
          } else {
            let mediaType = 'document'
            if (file.type.startsWith('image/')) mediaType = 'image'
            if (file.type.startsWith('audio/')) mediaType = 'audio'
            realFiles.push({ type: mediaType, name: file.name, base64 })
          }
        }
      }

      // Combinar archivos existentes (no nuevos) con los recién subidos
      const existingFiles = formData.previews
        .filter(p => !p.isNew)
        .map(p => ({ url: p.url, type: p.type, name: p.name }));
      
      const newUploadedFiles = [
        ...realFiles.map(f => ({ url: f.data, type: f.type, name: f.name })),
        ...linkFiles.map(f => ({ url: f.url, type: f.type, name: f.name }))
      ];

      const allFiles = [...existingFiles, ...newUploadedFiles];

      const payload = {
        ...formData,
        startTime: forceEcuadorTZ(formData.startTime),
        endTime: forceEcuadorTZ(formData.endTime),
        attachments: realFiles, 
        attachmentLinks: linkFiles, 
        files: allFiles, // Guardar en DB
        userIds: targetUserIds,
        userId: targetUserIds[0]
      }

      if (initialData?.id) {
        await onSave({ ...payload, id: initialData.id })
      } else {
        await onSave(payload)
      }
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const isEditing = !!initialData?.id

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-container card">
        <div className="modal-header card-header" style={{ flexShrink: 0 }}>
          <h3 className="card-title">{isEditing ? 'Editar Agenda' : 'Agendar Tarea'}</h3>
          <button className="btn btn-ghost" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-scroll">
            <div className="modal-content-layout">
              {/* Columna Izquierda: Identidad y Ubicación */}
              <div className="modal-column">
                <div className="form-group-compact">
                  <label className="form-label-aquatech">Título de la Actividad</label>
                  <input 
                    className="form-input-aquatech"
                    type="text"
                    required
                    readOnly={!isAdminView}
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Mantenimiento"
                  />
                </div>
                
                <div className="form-group-compact">
                  <label className="form-label-aquatech">Estado de la Tarea (Semáforo)</label>
                  <select 
                    className="form-select-aquatech"
                    style={{ 
                      backgroundColor: formData.status === 'COMPLETADA' ? 'rgba(37, 211, 102, 0.1)' : 
                                       formData.status === 'ATRASADA' ? 'rgba(239, 68, 68, 0.1)' : 
                                       'rgba(245, 158, 11, 0.1)',
                      color: formData.status === 'COMPLETADA' ? '#25D366' : 
                             formData.status === 'ATRASADA' ? '#ef4444' : 
                             '#f59e0b',
                      fontWeight: 'bold'
                    }}
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="PENDIENTE">🟡 PENDIENTE (Amarillo)</option>
                    <option value="COMPLETADA">🟢 REALIZADA (Verde)</option>
                    <option value="ATRASADA">🔴 NO REALIZADA / ATRASADA (Rojo)</option>
                  </select>
                </div>

                {isAdminView && (
                  <div className="form-group-compact">
                    <label className="form-label-aquatech">Asignar Operadores</label>
                    <div className="operator-dropdown-wrapper">
                      <div className="operator-dropdown-trigger" onClick={() => !isEditing && setIsDropdownOpen(!isDropdownOpen)}>
                        {selectedOperatorIds.length === 0 ? 'Seleccionar operador...' : `${selectedOperatorIds.length} seleccionados`}
                      </div>
                      {isDropdownOpen && !isEditing && (
                        <div className="operator-dropdown-menu">
                          <label className="operator-item">
                            <input type="checkbox" checked={selectedOperatorIds.length === operators.length} onChange={toggleAllOperators} />
                            <span>TODOS</span>
                          </label>
                          {operators.map(op => (
                            <label key={op.id} className="operator-item">
                              <input type="checkbox" checked={selectedOperatorIds.includes(op.id)} onChange={() => toggleOperator(op.id)} />
                              <span>{op.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-group-compact">
                  <label className="form-label-aquatech">Proyecto Relacionado</label>
                  <select 
                    className="form-select-aquatech"
                    value={formData.projectId}
                    disabled={!isAdminView}
                    onChange={e => setFormData({...formData, projectId: e.target.value})}
                  >
                    <option value="">No vinculado</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="location-row-aquatech">
                  <div className="form-group-compact">
                    <div className="label-with-action-aquatech">
                      <label className="form-label-aquatech">👤 Cliente</label>
                      {formData.clientPhone && (
                        <a 
                          href={`https://wa.me/${formData.clientPhone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-voice-aquatech"
                          style={{ background: 'rgba(37, 211, 102, 0.1)', borderColor: 'rgba(37, 211, 102, 0.3)', color: '#25D366' }}
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                    <input
                      className="form-input-aquatech"
                      type="text"
                      readOnly={!isAdminView}
                      placeholder="Nombre del cliente"
                      value={formData.clientName || ''}
                      onChange={e => setFormData({...formData, clientName: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group-compact">
                    <label className="form-label-aquatech">📞 Contacto</label>
                    <input
                      className="form-input-aquatech"
                      type="text"
                      readOnly={!isAdminView}
                      placeholder="Número de teléfono"
                      value={formData.clientPhone || ''}
                      onChange={e => setFormData({...formData, clientPhone: e.target.value})}
                    />
                  </div>

                  <div className="form-group-compact" style={{ gridColumn: '1 / -1' }}>
                    <div className="label-with-action-aquatech">
                      <label className="form-label-aquatech">📍 Ubicación Cliente</label>
                      {formData.clientLocation && (
                        <a 
                          href={formData.clientLocation.startsWith('http') ? formData.clientLocation : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.clientLocation)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-voice-aquatech"
                        >
                          Abrir GPS
                        </a>
                      )}
                    </div>
                    <input
                      className="form-input-aquatech"
                      type="text"
                      readOnly={!isAdminView}
                      placeholder="Pega el link de Google Maps del cliente aquí..."
                      value={formData.clientLocation || ''}
                      onChange={e => setFormData({...formData, clientLocation: e.target.value})}
                    />
                  </div>

                  <div className="form-group-compact" style={{ gridColumn: '1 / -1' }}>
                    <div className="label-with-action-aquatech">
                      <label className="form-label-aquatech">📡 Ubicación Operario (GPS)</label>
                      {isAdminView && (
                        <button 
                          type="button"
                          className="btn-voice-aquatech"
                          style={{ background: 'rgba(88, 199, 255, 0.2)', borderColor: '#58c7ff' }}
                          onClick={handleGetGPS}
                        >
                          📍 Capturar mi GPS
                        </button>
                      )}
                    </div>
                    <input
                      className="form-input-aquatech"
                      type="text"
                      readOnly={!isAdminView}
                      placeholder="Link de ubicación del operario..."
                      value={formData.operatorLocation || ''}
                      onChange={e => setFormData({...formData, operatorLocation: e.target.value})}
                    />
                  </div>

                  {formData.projectId && (
                    <div className="form-group-compact" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                       <button 
                         type="button"
                         className="btn-attach-aquatech"
                         style={{ width: '100%', background: 'rgba(88, 199, 255, 0.15)', borderColor: '#58c7ff' }}
                         onClick={() => {
                           const path = isAdminView ? `/admin/proyectos/${formData.projectId}` : `/operador/ficha/${formData.projectId}`;
                           onClose();
                           router.push(path);
                         }}
                       >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                         Ver Detalles del Proyecto
                       </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Tiempo, Multimedia y Notas */}
              <div className="modal-column">
                <div className="time-row-aquatech">
                  <div className="form-group-compact">
                    <label className="form-label-aquatech">Horario Inicio</label>
                    <input 
                      className="form-input-aquatech"
                      type="datetime-local"
                      required
                      readOnly={!isAdminView}
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                    />
                  </div>
                  <div className="form-group-compact">
                    <label className="form-label-aquatech">Horario Fin</label>
                    <input 
                      className="form-input-aquatech"
                      type="datetime-local"
                      required
                      readOnly={!isAdminView}
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group-compact">
                  <label className="form-label-aquatech">📸 Adjuntos (Max 5MB)</label>
                  {isAdminView && (
                    <div className="attachment-actions-row">
                      <button 
                        type="button" 
                      className="btn-attach-aquatech"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.capture = 'environment' as any
                        input.onchange = (e: any) => {
                          const files = e.target.files ? Array.from(e.target.files) as File[] : []
                          const newPreviews = files.map((file: File) => ({
                            url: URL.createObjectURL(file),
                            type: file.type,
                            name: file.name,
                            isNew: true
                          }))
                          setFormData(prev => ({
                            ...prev,
                            mediaFiles: [...prev.mediaFiles, ...files],
                            previews: [...prev.previews, ...newPreviews]
                          }))
                        }
                        input.click()
                      }}
                    >
                      📷 Foto
                    </button>
                    <button 
                      type="button" 
                      className="btn-attach-aquatech"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'video/*'
                        input.capture = 'environment' as any
                        input.onchange = (e: any) => {
                          const files = e.target.files ? Array.from(e.target.files) as File[] : []
                          const newPreviews = files.map((file: File) => ({
                            url: URL.createObjectURL(file),
                            type: file.type,
                            name: file.name,
                            isNew: true
                          }))
                          setFormData(prev => ({
                            ...prev,
                            mediaFiles: [...prev.mediaFiles, ...files],
                            previews: [...prev.previews, ...newPreviews]
                          }))
                        }
                        input.click()
                      }}
                    >
                      🎬 Video
                    </button>
                    <button 
                      type="button" 
                      className="btn-attach-aquatech"
                      onClick={() => document.getElementById('file-input-gallery')?.click()}
                    >
                      📁 Archivos
                    </button>
                    <input
                      id="file-input-gallery"
                      type="file"
                      accept="image/*,video/*,audio/*,application/pdf"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </div>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.9rem' }}>📦</span>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>MULTIMEDIA CARGADA</strong>
                    </div>
                    
                    <div className="preview-gallery-aquatech" style={{ 
                      minHeight: '60px', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '10px', 
                      padding: '10px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      {formData.previews.length > 0 ? (
                        formData.previews.map((file, idx) => {
                          const isPdf = file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf');
                          const isImage = file.type?.includes('image');
                          const isVideo = file.type?.includes('video');
                          const isAudio = file.type?.includes('audio');

                          return (
                            <div 
                              key={idx} 
                              className="preview-item-aquatech"
                              style={{ 
                                cursor: 'pointer',
                                width: '90px',
                                height: '90px',
                                position: 'relative',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '2px solid rgba(88, 199, 255, 0.2)',
                                background: 'rgba(0,0,0,0.5)',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                              }}
                              onClick={() => setSelectedMedia(file)}
                            >
                              <div className="preview-content-aquatech" style={{ width: '100%', height: '100%' }}>
                                {isImage ? (
                                  <img 
                                    src={file.url} 
                                    alt="preview" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error+Carga';
                                    }}
                                  />
                                ) : isVideo ? (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--primary)"><path d="M8 5v14l11-7z"/></svg>
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '9px', background: 'var(--primary)', color: 'black', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>VIDEO</div>
                                  </div>
                                ) : isAudio ? (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                                  </div>
                                ) : isPdf ? (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '9px', background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>PDF</div>
                                  </div>
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                  </div>
                                )}
                              </div>
                              
                              {/* Botón de eliminar (solo si es admin o nuevo) */}
                              {isAdminView && (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData(prev => ({
                                      ...prev,
                                      previews: prev.previews.filter((_, i) => i !== idx),
                                      mediaFiles: prev.mediaFiles.filter((_, i) => i !== (idx - (prev.previews.length - prev.mediaFiles.length)))
                                    }))
                                  }}
                                  style={{
                                    position: 'absolute', top: '4px', right: '4px',
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', cursor: 'pointer', zIndex: 10
                                  }}
                                >✕</button>
                              )}
                              {/* Footer con nombre */}
                              <div style={{ 
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.7)', padding: '4px',
                                fontSize: '0.6rem', color: 'white', textAlign: 'center',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {file.name || 'Archivo'}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                          opacity: 0.6
                        }}>
                          <span>No hay archivos adjuntos</span>
                          <span style={{ fontSize: '0.7rem' }}>Usa los botones de arriba para añadir</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group-compact">
                  <div className="label-with-action-aquatech">
                    <label className="form-label-aquatech">📝 Notas / Instrucciones</label>
                    <button 
                      type="button" 
                      className={`btn-voice-aquatech ${isRecording ? 'recording' : ''}`}
                      onClick={toggleSpeechToText}
                      title={isRecording ? 'Detener dictado' : 'Dictar notas'}
                    >
                      {isRecording ? '🔴 Detener' : '🎤 Dictar'}
                    </button>
                  </div>
                  <textarea 
                    className="form-textarea-aquatech"
                    readOnly={!isAdminView}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalles..."
                  />
                </div>
              </div>
            </div>
          </div>

          {isAdminView && (
            <div className="modal-footer" style={{ flexShrink: 0 }}>
              {initialData?.id && onDelete && (
                <button 
                  type="button" 
                  className="btn modal-btn" 
                  style={{ backgroundColor: 'var(--status-danger)', color: 'white' }} 
                  onClick={async () => {
                    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
                      setLoading(true);
                      try { 
                        onDelete(initialData.id); 
                        onClose(); 
                      } catch (error) { 
                        alert('Error eliminando'); 
                        setLoading(false); 
                      }
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
              <button type="button" className="btn btn-secondary modal-btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary modal-btn" disabled={loading}>
                {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Agendar'}
              </button>
            </div>
          )}
        </form>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20000000;
        }

        .modal-container {
          width: 95vw;
          max-width: 1100px;
          height: 95dvh; /* Forzar altura relativa al viewport */
          background: #010816;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          overflow: hidden; /* Evitar que el contenedor crezca */
        }

        .modal-form {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          flex-shrink: 0;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-title {
          color: white;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .modal-scroll {
          padding: 24px;
          overflow-y: auto;
        }

        .modal-content-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .modal-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group-compact {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label-aquatech {
          color: #58c7ff; /* Celeste brillante exacto */
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .form-input-aquatech, .form-select-aquatech, .form-textarea-aquatech, .operator-dropdown-trigger {
          background: rgba(255,255,255,0.03); /* Fondo más suave como en el calendario */
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          padding: 10px 14px;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s;
          appearance: none; /* Eliminar estilo nativo para mayor control */
        }

        .form-select-aquatech {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 40px;
        }

        .form-select-aquatech option {
          background-color: #010816; /* Forzar fondo oscuro en las opciones */
          color: white;
        }

        .form-input-aquatech:focus, .form-select-aquatech:focus {
          border-color: #58c7ff;
          background: rgba(255,255,255,0.05);
        }

        .form-textarea-aquatech {
          height: 80px;
          resize: none;
          overflow-y: auto;
        }

        .label-with-action-aquatech {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .btn-voice-aquatech {
          background: rgba(88, 199, 255, 0.1);
          border: 1px solid rgba(88, 199, 255, 0.3);
          color: #58c7ff;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        }

        .btn-voice-aquatech.recording {
          background: rgba(255, 0, 0, 0.2);
          border-color: rgba(255, 0, 0, 0.5);
          color: #ff4d4d;
          animation: pulse-red 1.5s infinite;
        }

        @keyframes pulse-red {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        .location-row-aquatech {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background: rgba(255,255,255,0.02);
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
          width: 100%;
          box-sizing: border-box;
        }

        .btn-gps-aquatech {
          background: transparent;
          border: 1px solid #58c7ff;
          color: white;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          height: 100%;
          min-height: 45px;
        }

        .time-row-aquatech {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .upload-zone-aquatech {
          border: 1px dashed rgba(255,255,255,0.2);
          padding: 12px;
          border-radius: 10px;
          text-align: center;
          cursor: pointer;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .upload-zone-aquatech:hover { background: rgba(255,255,255,0.02); border-color: #58c7ff; }

        .attachment-actions-row {
          display: flex;
          gap: 10px;
        }

        .btn-attach-aquatech {
          flex: 1;
          background: rgba(88, 199, 255, 0.08);
          border: 1px solid rgba(88, 199, 255, 0.25);
          color: #58c7ff;
          padding: 12px 10px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-attach-aquatech:hover {
          background: rgba(88, 199, 255, 0.15);
          border-color: #58c7ff;
        }

        .preview-gallery-aquatech {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          width: 100%;
        }

        .preview-item-aquatech {
          width: 50px;
          height: 50px;
          border-radius: 6px;
          overflow: hidden;
          position: relative;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .preview-item-aquatech img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-icon-aquatech {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }

        .remove-preview-btn {
          position: absolute;
          top: 0; right: 0;
          background: rgba(255,0,0,0.8);
          color: white;
          border: none;
          width: 16px; height: 16px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .add-more-preview {
          width: 50px; height: 50px;
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          color: rgba(255,255,255,0.5);
        }

        .upload-info-compact {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .upload-info-compact span:first-child { font-size: 1.5rem; }
        .upload-info-compact span:last-child { font-size: 0.8rem; opacity: 0.6; }

        .operator-dropdown-wrapper { position: relative; }
        .operator-dropdown-trigger { cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .operator-dropdown-trigger::after { content: '▼'; font-size: 0.7rem; opacity: 0.5; }
        
        .operator-dropdown-menu {
          position: absolute;
          top: 100%; left: 0; right: 0;
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 100;
          max-height: 200px;
          overflow-y: auto;
          margin-top: 5px;
          border-radius: 8px;
        }
        .operator-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          cursor: pointer;
        }
        .operator-item:hover { background: rgba(255,255,255,0.05); }

        .modal-footer {
          padding: 20px 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-primary {
          background: #58c7ff;
          color: #000;
          font-weight: 700;
          border: none;
          padding: 12px 30px;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 12px 30px;
          border-radius: 8px;
        }

        @media (max-width: 768px) {
          .modal-overlay { background: #010816; overflow: hidden; }
          .modal-container { 
            width: 100vw; height: 100dvh; max-height: 100dvh; 
            border-radius: 0; border: none;
            background: #010816;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .modal-header { 
            padding: 12px 16px; 
            border-bottom: 1px solid rgba(255,255,255,0.05); 
          }
          .modal-scroll { 
            padding: 12px 16px; 
            overflow-y: auto;
            flex: 1;
          }
          .modal-content-layout { 
            display: flex;
            flex-direction: column;
            gap: 16px; 
            width: 100%;
          }
          .modal-column { 
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
          }
          .form-group-compact { gap: 4px; width: 100%; }
          .form-label-aquatech { font-size: 0.7rem; }
          .form-input-aquatech, .form-select-aquatech, .operator-dropdown-trigger { 
            padding: 10px 12px; 
            font-size: 0.9rem; 
            width: 100%;
          }
          .location-row-aquatech { 
            grid-template-columns: 1fr; /* Una sola columna para evitar cortes horizontales */
            gap: 12px; 
            padding: 12px; 
          }
          .btn-gps-aquatech { 
            width: 100%;
            min-height: 44px; 
            padding: 10px; 
            font-size: 0.9rem; 
          }
          .time-row-aquatech { 
            grid-template-columns: 1fr; 
            gap: 12px; 
          }
          .upload-zone-aquatech { 
            padding: 12px; 
            min-height: 100px;
          }
          .form-textarea-aquatech { min-height: 80px; }
          .modal-footer { 
            position: relative; 
            padding: 16px;
            background: #010816;
            border-top: 1px solid rgba(255,255,255,0.1);
            flex-direction: column-reverse; /* Botones apilados, Cancelar abajo */
            gap: 10px;
            flex-shrink: 0;
          }
          .modal-btn {
            width: 100%;
            margin: 0 !important;
            padding: 12px !important;
          }
        }
      `}</style>
    {/* Overlay de Previsualización Grande */}
    {selectedMedia && (
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(10px)'
        }}
        onClick={() => setSelectedMedia(null)}
      >
        <button 
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'white',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}
        >✕</button>

        <div 
          style={{ 
            maxWidth: '90%', 
            maxHeight: '80vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative'
          }}
          onClick={e => e.stopPropagation()}
        >
          {selectedMedia.type.includes('image') ? (
            <img 
              src={selectedMedia.url} 
              alt="large-preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }} 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/800x600?text=Error+al+Cargar+Imagen';
              }}
            />
          ) : selectedMedia.type.includes('video') ? (
            <div style={{ width: '100%', maxWidth: '800px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              <video 
                src={selectedMedia.url} 
                controls 
                autoPlay
                playsInline
                style={{ 
                  width: '100%',
                  maxHeight: '70vh',
                  display: 'block'
                }} 
              />
            </div>
          ) : selectedMedia.type.includes('audio') ? (
            <div style={{ background: '#111827', padding: '40px', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '400px' }}>
              <div style={{ marginBottom: '20px', fontSize: '4rem' }}>🎙️</div>
              <audio 
                src={selectedMedia.url} 
                controls 
                autoPlay
                style={{ width: '100%' }} 
              />
              <p style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>{selectedMedia.name}</p>
            </div>
          ) : (
            <div style={{ background: '#111827', padding: '60px', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '500px' }}>
              <div style={{ marginBottom: '20px', fontSize: '5rem' }}>{selectedMedia.type.includes('pdf') || selectedMedia.name?.toLowerCase().endsWith('.pdf') ? '📄' : '📁'}</div>
              <h3 style={{ marginBottom: '10px', color: 'white', fontSize: '1.2rem' }}>{selectedMedia.name}</h3>
              <p style={{ marginBottom: '30px', color: 'var(--text-muted)' }}>Vista previa no disponible para este formato.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  onClick={() => window.open(selectedMedia.url, '_blank')}
                  style={{
                    background: 'var(--primary)',
                    color: 'black',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Descargar / Abrir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer del preview */}
        <div style={{ marginTop: '20px', textAlign: 'center', color: 'white' }}>
          <p style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px' }}>{selectedMedia.name}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => window.open(selectedMedia.url, '_blank')}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Abrir Original
            </button>
          </div>
        </div>
      </div>
    )}

    </div>,
    document.body
  );
}
