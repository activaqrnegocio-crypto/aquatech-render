'use client'

import { useState, useEffect } from 'react'
import { PROJECT_TYPES, translateType, PROJECT_CATEGORIES, translateCategory } from '@/lib/constants'

interface ProjectEditModalProps {
  project: any
  isOpen: boolean
  onClose: () => void
  onSave: (updatedData: any) => Promise<void>
  isSaving: boolean
}

export default function ProjectEditModal({ project, isOpen, onClose, onSave, isSaving }: ProjectEditModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    address: '',
    city: '',
    startDate: '',
    endDate: '',
    locationLink: ''
  })

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        title: project.title || '',
        type: project.type || 'INSTALLATION',
        address: project.address || '',
        city: project.city || '',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
        locationLink: project.locationLink || ''
      })
    }
  }, [project, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(10px)', padding: '20px'
    }}>
      <div className="modal-content animate-slide-up" style={{
        backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '24px',
        width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>Editar Detalles del Proyecto</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Título del Proyecto</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                required
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tipo de Proyecto</label>
              <select 
                className="form-input" 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
              >
                {Object.entries(PROJECT_TYPES).map(([val, label]: [string, any]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Fecha Inicio</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.startDate} 
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Fecha Fin (Est.)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.endDate} 
                  onChange={e => setFormData({...formData, endDate: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ciudad</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.city} 
                  onChange={e => setFormData({...formData, city: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ubicación (GPS Link)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.locationLink} 
                  onChange={e => setFormData({...formData, locationLink: e.target.value})}
                  placeholder="https://google.com/maps/..."
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white' }}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dirección</label>
              <textarea 
                className="form-input" 
                rows={2} 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)', color: 'white', resize: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn btn-ghost" 
              style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isSaving ? (
                <>
                  <div className="spinner-sm" /> Guardando...
                </>
              ) : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
