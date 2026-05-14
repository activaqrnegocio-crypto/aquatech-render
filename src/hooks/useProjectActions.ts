'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'
import { generateSyncId } from '@/lib/offline-utils'

/**
 * useProjectActions — Hook compartido para mutaciones (Guardar cambios)
 * 
 * Centraliza la lógica de guardado Online/Offline para:
 * - Metadatos del proyecto (Título, dirección, etc)
 * - Equipo asignado
 */
interface UseProjectActionsOptions {
  project: any
  setLocalProject: (proj: any) => void
  triggerBackgroundSync: () => Promise<void>
  onSuccess?: (type: string) => void
}

export function useProjectActions({
  project,
  setLocalProject,
  triggerBackgroundSync,
  onSuccess
}: UseProjectActionsOptions) {
  const router = useRouter()
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)

  // 1. Guardar Metadatos del Proyecto
  const handleSaveProject = async (updatedData: any) => {
    if (!project?.id) return
    setIsSavingProject(true)
    try {
      const syncId = generateSyncId()
      const payload = { ...updatedData, syncId }

      // Optimistic Update UI + Cache
      const idStr = String(project.id)
      const isPending = idStr.startsWith('pending-')
      const numericId = Number(project.id)

      if (!isPending && !isNaN(numericId) && numericId > 0) {
        // Persist to Dexie immediately using update (partial)
        db.projectsCache.update(numericId, { 
          ...updatedData, 
          lastAccessedAt: Date.now() 
        }).catch(() => {})
      }

      setLocalProject((prev: any) => {
        const base = prev || project || {};
        return { ...base, ...updatedData };
      })

      if (!isPending && typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('Failed to save project')
      } else if (isPending) {
        // v400: Update existing outbox item for pending project
        const outboxId = Number(idStr.replace('pending-', ''))
        const item = await db.outbox.get(outboxId)
        if (item) {
          await db.outbox.update(outboxId, {
            payload: { ...item.payload, ...updatedData }
          })
        }
      } else {
        // Offline regular project
        await db.outbox.add({
          type: 'PROJECT_UPDATE',
          projectId: project.id,
          payload: payload,
          timestamp: Date.now(),
          status: 'pending',
          syncId
        })
        triggerBackgroundSync()
      }
      
      if (onSuccess) onSuccess('PROJECT_UPDATE')
      return true
    } catch (e) {
      console.error('[Actions] Save Project Error:', e)
      alert('Error al guardar los cambios del proyecto')
      return false
    } finally {
      setIsSavingProject(false)
    }
  }

  // 2. Guardar Equipo Asignado
  const handleSaveTeam = async (operatorIds: number[], availableOperators: any[]) => {
    if (!project?.id) return
    setIsSavingTeam(true)
    try {
      const payload = { operatorIds }

      // Optimistic Update UI (Normalized format matching server structure)
      const newTeam = availableOperators
        .filter((op: any) => operatorIds.includes(op.id))
        .map((op: any) => ({ 
          id: op.id,
          userId: op.id,
          name: op.name || 'Operador', 
          role: op.role || 'OPERATOR',
          phone: op.phone,
          user: {
            id: op.id,
            name: op.name || 'Operador',
            phone: op.phone,
            role: op.role || 'OPERATOR'
          }
        }))
      
      // Optimistic Update UI + Cache (INSTANT)
      const idStr = String(project.id)
      const isPending = idStr.startsWith('pending-')
      const numericId = Number(project.id)

      if (!isPending && !isNaN(numericId) && numericId > 0) {
        // v404: Sync update to Dexie so it's guaranteed before UI closes
        await db.projectsCache.update(numericId, { 
          team: newTeam, 
          _pendingTeamSync: true,
          lastAccessedAt: Date.now() 
        }).catch(() => {})
      }

      setLocalProject((prev: any) => {
        const base = prev || project || {};
        return { ...base, team: newTeam, _pendingTeamSync: true };
      })

      // v405: UI is now CONSIDERED DONE. Reset loading state immediately.
      setIsSavingTeam(false)
      if (onSuccess) onSuccess('TEAM_UPDATE')

      // FIRE AND FORGET SERVER SYNC (Background)
      const performServerSync = async () => {
        if (isPending) {
          const outboxId = Number(idStr.replace('pending-', ''))
          const item = await db.outbox.get(outboxId)
          if (item) {
            await db.outbox.update(outboxId, {
              payload: { ...item.payload, team: operatorIds }
            })
          }
        } else if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await fetch(`/api/projects/${project.id}/team`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'x-sync-id': `team-update-${project.id}-${Date.now()}`
              },
              body: JSON.stringify(payload)
            })
            
            if (res.ok) {
              const freshRes = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' })
              if (freshRes.ok) {
                const freshProject = await freshRes.json()
                if (freshProject?.id) {
                  setLocalProject((prev: any) => ({ 
                    ...(prev || project), 
                    ...freshProject, 
                    _pendingTeamSync: false 
                  }))
                  if (!isNaN(numericId) && numericId > 0) {
                    db.projectsCache.update(numericId, { 
                      ...freshProject, 
                      _pendingTeamSync: false, 
                      lastAccessedAt: Date.now() 
                    }).catch(() => {})
                  }
                }
              }
              // Quiet refresh in background to update RSC state
              router.refresh();
            } else {
              throw new Error('Sync failed')
            }
          } catch (err) {
            await db.outbox.add({
              type: 'TEAM_UPDATE',
              projectId: project.id,
              payload: { operatorIds },
              timestamp: Date.now(),
              status: 'pending'
            });
            triggerBackgroundSync();
          }
        } else {
          await db.outbox.add({
            type: 'TEAM_UPDATE',
            projectId: project.id,
            payload: { operatorIds },
            timestamp: Date.now(),
            status: 'pending'
          });
          triggerBackgroundSync();
        }
      }

      // Start background sync without awaiting
      performServerSync()

      return true
    } catch (e) {
      console.error('[Actions] Save Team Error:', e)
      setIsSavingTeam(false)
      return false
    }
  }

  // 3. Eliminar Item de Galería
  const handleDeleteGalleryItem = async (itemId: number | string) => {
    if (!project?.id) return
    if (!window.confirm('¿Estás seguro de eliminar este archivo?')) return
    
    // PENDING ITEM (del outbox local)
    if (typeof itemId === 'string' && itemId.startsWith('pending-')) {
      try {
        const outboxId = Number(itemId.replace(/pending-ev-|pending-chat-|pending-/, ''))
        await db.outbox.delete(outboxId)
        return true
      } catch (e) {
        console.error('Error deleting pending item:', e)
      }
    }

    // Offline support para items del servidor
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await db.outbox.add({
          type: 'GALLERY_DELETE',
          projectId: project.id,
          payload: { galleryId: itemId },
          timestamp: Date.now(),
          status: 'pending'
        })
        triggerBackgroundSync()
        return true
      } catch (e) {
        console.error('Error saving offline deletion:', e)
      }
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/gallery/${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        if (onSuccess) onSuccess('GALLERY_DELETE')
        return true
      } else { 
        alert('Error eliminando archivo') 
        return false
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Error de conexión')
      return false
    }
  }

  return {
    handleSaveProject,
    handleSaveTeam,
    handleDeleteGalleryItem,
    isSavingProject,
    isSavingTeam
  }
}
