'use client'

import { useState } from 'react'
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
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)

  // 1. Guardar Metadatos del Proyecto
  const handleSaveProject = async (updatedData: any) => {
    if (!project?.id) return
    setIsSavingProject(true)
    try {
      const syncId = generateSyncId()
      const payload = { ...updatedData, syncId }

      // Optimistic Update
      setLocalProject((prev: any) => ({ ...prev, ...updatedData }))

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('Failed to save project')
      } else {
        // Offline
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

      // Optimistic Update UI (Normalized format for ProjectTeamSection)
      const newTeam = availableOperators
        .filter((op: any) => operatorIds.includes(op.id))
        .map((op: any) => ({ 
          id: op.id, 
          name: op.name || 'Operador', 
          role: op.role || 'OPERATOR',
          phone: op.phone 
        }))
      
      setLocalProject((prev: any) => ({ ...prev, team: newTeam }))

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/projects/${project.id}/team`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('Failed to update team')
      } else {
        // Offline
        await db.outbox.add({
          type: 'TEAM_UPDATE',
          projectId: project.id,
          payload: payload,
          timestamp: Date.now(),
          status: 'pending'
        })
        triggerBackgroundSync()
      }

      if (onSuccess) onSuccess('TEAM_UPDATE')
      return true
    } catch (e) {
      console.error('[Actions] Save Team Error:', e)
      alert('Error al actualizar el equipo')
      return false
    } finally {
      setIsSavingTeam(false)
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
