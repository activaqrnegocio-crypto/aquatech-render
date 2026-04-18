'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getLocalNow, formatForDateTimeInput, forceEcuadorTZ } from '@/lib/date-utils'
import { uploadToBunnyClientSide } from '@/lib/storage-client'

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
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<number[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [filteredProjects, setFilteredProjects] = useState<any[]>(projects)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    projectId: '',
    userId: userId > 0 ? userId.toString() : '',
    clientLocation: '',
    operatorLocation: '',
    mediaFiles: [] as File[],
    previews: [] as { url: string; type: string; name: string }[]
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
          mediaFiles: [],
          previews: []
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
          mediaFiles: [],
          previews: []
        })
      }
    } else {
      document.body.style.overflow = ''
      // Cleanup previews when closing
      formData.previews.forEach(p => URL.revokeObjectURL(p.url))
    }

    return () => {
      document.body.style.overflow = ''
      formData.previews.forEach(p => URL.revokeObjectURL(p.url))
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

  const getTargetUserIds = (): number[] => {
    return selectedOperatorIds
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const newPreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name
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
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width, height = img.height
          const MAX_WIDTH = 1200
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
          }, 'image/jpeg', 0.6)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
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
      const { realFiles, linkFiles } = await processFilesMixed(formData.mediaFiles)

      const payload = {
        ...formData,
        startTime: forceEcuadorTZ(formData.startTime),
        endTime: forceEcuadorTZ(formData.endTime),
        attachments: realFiles, // Estos se envían como archivos reales
        attachmentLinks: linkFiles, // Estos van como links en el mensaje
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
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Mantenimiento"
                  />
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
                    <label className="form-label-aquatech">📍 Cliente</label>
                    <input
                      className="form-input-aquatech"
                      type="text"
                      placeholder="Link..."
                      value={formData.clientLocation || ''}
                      onChange={e => setFormData({...formData, clientLocation: e.target.value})}
                    />
                  </div>
                  <div className="form-group-compact">
                    <label className="form-label-aquatech">👷 Operario</label>
                    <button 
                      type="button" 
                      className="btn-gps-aquatech" 
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(pos => {
                            const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
                            setFormData(prev => ({...prev, operatorLocation: link}));
                          });
                        }
                      }}
                    >
                      {formData.operatorLocation ? '✨ OK' : '📡 GPS'}
                    </button>
                  </div>
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
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group-compact">
                  <label className="form-label-aquatech">📸 Adjuntos (Max 5MB)</label>
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
                            name: file.name
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
                            name: file.name
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
                  {formData.previews.length > 0 && (
                    <div className="preview-gallery-aquatech" style={{ marginTop: '10px' }}>
                      {formData.previews.map((file, idx) => (
                        <div key={idx} className="preview-item-aquatech">
                          {file.type.startsWith('image/') ? (
                            <img src={file.url} alt="preview" />
                          ) : (
                            <div className="preview-icon-aquatech">
                              {file.type.startsWith('video/') ? '🎬' : 
                               file.type.startsWith('audio/') ? '🎙️' : '📄'}
                            </div>
                          )}
                          <button 
                            type="button"
                            className="remove-preview-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalles..."
                  />
                </div>
              </div>
            </div>
          </div>

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
    </div>,
    document.body
  );
}
