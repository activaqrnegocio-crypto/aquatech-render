'use client'

import { useState, useEffect } from 'react'
import { getLocalNow, formatForDateTimeInput, forceEcuadorTZ } from '@/lib/date-utils'

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    projectId: '',
    userId: userId > 0 ? userId.toString() : '',
    status: 'PENDIENTE'
  })

  useEffect(() => {
    if (isOpen) {
      setLoading(false) // Force reset loading on open
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          startTime: formatForDateTimeInput(initialData.startTime),
          endTime: formatForDateTimeInput(initialData.endTime),
          projectId: initialData.projectId?.toString() || '',
          userId: initialData.userId?.toString() || (userId > 0 ? userId.toString() : ''),
          status: initialData.status || 'PENDIENTE'
        })
      } else {
        const now = getLocalNow()
        now.setMinutes(0)
        const inOneHour = new Date(now)
        inOneHour.setHours(now.getHours() + 1)

        setFormData({
          title: '',
          description: '',
          startTime: formatForDateTimeInput(now),
          endTime: formatForDateTimeInput(inOneHour),
          projectId: '',
          userId: userId > 0 ? userId.toString() : '',
          status: 'PENDIENTE'
        })
      }
    }
  }, [isOpen, initialData, userId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar que fin > inicio
    const start = new Date(formData.startTime)
    const end = new Date(formData.endTime)
    
    if (end <= start) {
      alert('Error: La fecha de fin debe ser posterior a la fecha de inicio.')
      return
    }

    setLoading(true)
    try {
      await onSave({
        ...formData,
        startTime: forceEcuadorTZ(formData.startTime),
        endTime: forceEcuadorTZ(formData.endTime),
        userId: Number(formData.userId),
        id: initialData?.id
      })
      onClose()
    } catch (error) {
      alert('Error al guardar el agendamiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-md)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-active)' }}>
        <div className="card-header">
          <h3 className="card-title">{initialData?.id ? 'Editar Agendamiento' : 'Nuevo Agendamiento'}</h3>
          <button className="btn btn-ghost" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* ... (form fields unchanged) ... */}
          <div className="form-group">
            <label className="form-label">Título de la Actividad</label>
            <input 
              className="form-input"
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Ej: Mantenimiento Preventivo"
            />
          </div>

          {isAdminView && (
            <div className="form-group">
              <label className="form-label">Asignar a Operador</label>
              <select 
                className="form-select"
                required
                value={formData.userId}
                onChange={e => setFormData({...formData, userId: e.target.value})}
              >
                <option value="" disabled>Seleccionar operador...</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Proyecto Relacionado (Opcional)</label>
            <select 
              className="form-select"
              value={formData.projectId}
              onChange={e => setFormData({...formData, projectId: e.target.value})}
            >
              <option value="">No vinculado a proyecto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.status === 'LEAD' ? 'Negociando' : p.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Inicio</label>
              <input 
                className="form-input"
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fin</label>
              <input 
                className="form-input"
                type="datetime-local"
                required
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estado</label>
            <select 
              className="form-select"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROGRESO">En Progreso</option>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Notas / Instrucciones</label>
            <textarea 
              className="form-textarea"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Detalles adicionales para el operador..."
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
            {initialData?.id && onDelete && (
              <button 
                type="button" 
                className="btn" 
                style={{ backgroundColor: 'var(--status-danger)', color: 'white', flex: 1 }} 
                onClick={async () => {
                  if (confirm('¿Estás seguro de eliminar esta tarea?')) {
                    setLoading(true);
                    try { 
                      // No esperamos al parent para cerrar, así la UI es instantánea
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
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Guardando...' : initialData?.id ? 'Actualizar' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
