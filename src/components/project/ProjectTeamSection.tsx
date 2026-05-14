'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { useRouter } from 'next/navigation'

// v406: Sección de Equipo Asignado Autónoma — Máxima velocidad y persistencia garantizada
interface ProjectTeamSectionProps {
  project: any
  operators: any[]
  setLocalProject?: (val: any) => void
}

export default function ProjectTeamSection({
  project,
  operators,
  setLocalProject
}: ProjectTeamSectionProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  
  // Sync local selection with project team when not editing
  useEffect(() => {
    if (!isEditing && project?.team) {
      setSelectedIds(project.team.map((t: any) => t.id || t.userId || t.user?.id))
    }
  }, [project?.team, isEditing])

  const handleToggleMember = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id])
  }

  const handleInternalSave = async () => {
    if (!project?.id || isSaving) return
    setIsSaving(true)

    try {
      // 1. CONSTRUIR EQUIPO OPTIMISTA
      const newTeam = operators
        .filter((op: any) => selectedIds.includes(op.id))
        .map((op: any) => ({
          id: op.id,
          userId: op.id,
          name: op.name || 'Operador',
          phone: op.phone,
          user: { id: op.id, name: op.name || 'Operador', phone: op.phone, role: op.role || 'OPERATOR' }
        }));

      // 2. ACTUALIZAR CACHÉ DEXIE AL INSTANTE (Para que al recargar siga ahí)
      const numericId = Number(project.id)
      if (!isNaN(numericId) && numericId > 0) {
        await db.projectsCache.update(numericId, { 
          team: newTeam, 
          _pendingTeamSync: true,
          lastAccessedAt: Date.now() 
        }).catch(() => {})
      }

      // 2.5 ACTUALIZAR ESTADO DEL PADRE (Para que se vea en vivo)
      if (setLocalProject) {
        setLocalProject((prev: any) => ({
          ...prev,
          team: newTeam,
          _pendingTeamSync: true
        }))
      }

      // 3. CERRAR EDICIÓN Y SOLTAR UI (VELOCIDAD RAYO)
      setIsEditing(false)
      setIsSaving(false)

      // 4. SINCRONIZACIÓN EN SEGUNDO PLANO (SILENCIOSA)
      const performSync = async () => {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine
        const payload = { operatorIds: selectedIds }

        if (!isOnline) {
          await db.outbox.add({
            projectId: numericId,
            type: 'TEAM_UPDATE',
            payload,
            status: 'pending',
            timestamp: Date.now()
          })
          return;
        }

        try {
          const res = await fetch(`/api/projects/${project.id}/team`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          if (res.ok) {
            // Refrescar caché con datos reales del servidor
            const freshRes = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' })
            if (freshRes.ok) {
              const fresh = await freshRes.json()
              if (fresh?.id && !isNaN(numericId)) {
                const updatedProject = { 
                  ...fresh, 
                  _pendingTeamSync: false 
                };
                await db.projectsCache.update(numericId, updatedProject).catch(() => {})
                
                // v408: Update parent state to clear 'Sincronizando' label immediately
                if (setLocalProject) {
                  setLocalProject(updatedProject);
                }
              }
            }
            router.refresh()
          } else {
            throw new Error('Sync failed')
          }
        } catch (e) {
          // Fallback a outbox si falla la red
          await db.outbox.add({
            projectId: numericId,
            type: 'TEAM_UPDATE',
            payload,
            status: 'pending',
            timestamp: Date.now()
          })
        }
      }

      performSync() // Sin await para no bloquear
    } catch (e) {
      console.error('[TeamSection] Save Error:', e)
      setIsSaving(false)
    }
  }

  return (
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
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--text-muted)' }} disabled={isSaving}>Cancelar</button>
            <button onClick={handleInternalSave} className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} disabled={isSaving}>{isSaving ? '...' : 'Guardar'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {!isEditing ? (
          <>
            {(project?.team || []).map((member: any) => {
              const name = member.user?.name || member.name || 'Operador';
              const phone = member.user?.phone || member.phone || 'Sin número';
              const initials = name.substring(0,2).toUpperCase();
              
              return (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{phone}</div>
                  </div>
                </div>
              );
            })}
            {(!project?.team || project.team.length === 0) && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '10px' }}>No hay operadores asignados.</div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {operators.map((op: any) => (
              <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(op.id)}
                  onChange={() => handleToggleMember(op.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontSize: '0.95rem' }}>{op.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{op.phone || 'Sin WhatsApp'}</div>
                </div>
              </label>
            ))}
            {operators.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay operadores registrados en el sistema.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
