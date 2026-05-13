'use client'

import { useState } from 'react'

interface ProjectPhasesSectionProps {
  project: any
  isEditing: boolean
  isSaving: boolean
  editingPhases: any[]
  setEditingPhases: (phases: any[]) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  isOperatorView?: boolean
}

export default function ProjectPhasesSection({
  project,
  isEditing,
  isSaving,
  editingPhases,
  setEditingPhases,
  onEdit,
  onCancel,
  onSave,
  isOperatorView = false
}: ProjectPhasesSectionProps) {
  const phases = isEditing ? editingPhases : (project?.phases || [])

  const handleAddPhase = () => {
    setEditingPhases([...editingPhases, { 
      id: 'new_' + Date.now(), 
      title: '', 
      description: '', 
      estimatedDays: 0, 
      status: 'PENDIENTE', 
      isNew: true 
    }])
  }

  const handleUpdatePhase = (idx: number, field: string, value: any) => {
    const newPhases = [...editingPhases]
    newPhases[idx] = { ...newPhases[idx], [field]: value }
    setEditingPhases(newPhases)
  }

  const handleRemovePhase = (idx: number) => {
    setEditingPhases(editingPhases.filter((_, i) => i !== idx))
  }

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '16px' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(56, 189, 248, 0.02)' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Fases de Trabajo
        </h3>
        {!isEditing ? (
          <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            Editar Fases
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleAddPhase} className="btn btn-secondary btn-sm" disabled={isSaving}>+ Agregar</button>
            <button onClick={onCancel} className="btn btn-ghost btn-sm" disabled={isSaving}>Cancelar</button>
            <button onClick={onSave} className="btn btn-primary btn-sm" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
      
      <div style={{ padding: '25px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '41px', top: '35px', bottom: '35px', width: '2px', backgroundColor: 'var(--border-color)', zIndex: 0 }}></div>
        
        {phases.map((phase: any, idx: number) => (
          <div key={phase.id} style={{ display: 'flex', gap: '20px', marginBottom: idx === phases.length - 1 ? 0 : '30px', position: 'relative' }}>
            {idx !== phases.length - 1 && (
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

            <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', border: phase.status === 'EN_PROGRESO' || phase.status === 'ACTIVO' ? '1px solid var(--warning)' : '1px solid var(--border-color)' }}>
              {!isEditing ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: phase.status === 'COMPLETADA' ? 'var(--success)' : 'var(--text)' }}>
                      {phase.title || '(Sin título)'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {phase.status === 'COMPLETADA' ? 'Completada' : phase.status === 'EN_PROGRESO' || phase.status === 'ACTIVO' ? 'En Progreso' : 'Pendiente'}
                    </span>
                  </div>
                  {phase.description && <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{phase.description}</p>}
                  {phase.estimatedDays && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {phase.estimatedDays} días est.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      value={phase.title} 
                      onChange={e => handleUpdatePhase(idx, 'title', e.target.value)}
                      className="form-input"
                      style={{ flex: 1, fontSize: '0.9rem', backgroundColor: 'var(--bg-deep)' }}
                      placeholder="Título de la fase"
                    />
                    <select 
                      value={phase.status} 
                      onChange={e => handleUpdatePhase(idx, 'status', e.target.value)}
                      className="form-input"
                      style={{ width: '130px', fontSize: '0.85rem', backgroundColor: 'var(--bg-deep)' }}
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="EN_PROGRESO">En Progreso</option>
                      <option value="COMPLETADA">Completada</option>
                    </select>
                  </div>
                  <textarea 
                    value={phase.description || ''} 
                    onChange={e => handleUpdatePhase(idx, 'description', e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.85rem', minHeight: '60px', backgroundColor: 'var(--bg-deep)' }}
                    placeholder="Descripción de la fase..."
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Días Est.</label>
                    <input 
                      type="number" 
                      value={phase.estimatedDays || 0} 
                      onChange={e => handleUpdatePhase(idx, 'estimatedDays', Number(e.target.value))}
                      className="form-input"
                      style={{ width: '80px', fontSize: '0.85rem', backgroundColor: 'var(--bg-deep)' }}
                    />
                    {phase.isNew && (
                      <button 
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                        onClick={() => handleRemovePhase(idx)}
                      >
                        Eliminar
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
  )
}
