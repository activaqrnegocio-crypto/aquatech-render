'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { db } from '@/lib/db'

export default function GlobalSyncWorker() {
  const { data: session } = useSession()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Cache session info for offline role detection
  useEffect(() => {
    if (session?.user?.id && navigator.onLine) {
      const u = session.user
      db.auth.put({
        id: 'last_session',
        userId: u.id,
        name: u.name || '',
        role: (u.role as any) || 'OPERATOR',
        username: (u as any).username || '',
        lastLogin: Date.now()
      }).catch(console.error)
    }
  }, [session])

  const syncOutbox = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    const items = await db.outbox.where('status').equals('pending').toArray()
    if (items.length === 0) return

    for (const item of items) {
       try {
         await db.outbox.update(item.id!, { status: 'syncing' })
          let endpoint = ''
          let method = 'POST'
          
          if (item.type === 'QUOTE') { endpoint = '/api/quotes' }
          else if (item.type === 'MATERIAL') { endpoint = '/api/materials' }
          else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') { endpoint = `/api/projects/${item.projectId}/messages` }
          else if (item.type === 'EXPENSE') { endpoint = `/api/projects/${item.projectId}/expenses` }
          else if (item.type === 'DAY_START') { endpoint = `/api/day-records` }
          else if (item.type === 'DAY_END') { endpoint = `/api/day-records`; method = 'PUT' }
          else if (item.type === 'PHASE_COMPLETE') { endpoint = `/api/projects/${item.projectId}/phases/${item.payload.phaseId}`; method = 'PATCH' }
          else if (item.type === 'PROJECT') { endpoint = '/api/projects' }
          else if (item.type === 'TASK') { endpoint = '/api/appointments' }
          else if (item.type === 'TASK_STATUS_TOGGLE') { endpoint = `/api/appointments/${item.payload.appointmentId}`; method = 'PATCH' }
          else if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }
          
          let finalPayload = { ...item.payload }
          
          // Handle media upload: reconstruct File from stored ArrayBuffer
          const hasFileData = item.payload.fileData?.buffer;
          const hasRawFile = item.payload.file;
          
          if ((hasFileData || hasRawFile) && (item.type === 'MESSAGE' || item.type === 'EXPENSE' || item.type === 'MEDIA_UPLOAD')) {
            try {
              const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
              
              let uploadFile: File | Blob;
              let finalFilename: string;
              
              if (hasFileData) {
                // Reconstruct File from stored ArrayBuffer (new format — survives IDB)
                const blob = new Blob([item.payload.fileData.buffer], { type: item.payload.fileData.type });
                uploadFile = new File([blob], item.payload.fileData.name, { type: item.payload.fileData.type });
                finalFilename = item.payload.fileData.name;
              } else {
                // Legacy: raw File object (may work if app wasn't restarted)
                uploadFile = item.payload.file;
                finalFilename = item.payload.file.name || `sync_upload_${Date.now()}`;
              }
              
              const uploadResult = await uploadToBunnyClientSide(uploadFile, finalFilename, `projects/${item.projectId}/chat`)
              finalPayload.media = {
                url: uploadResult.url,
                filename: uploadResult.filename,
                mimeType: uploadResult.mimeType
              }
              // Clean up file data from payload before sending to API
              delete finalPayload.file
              delete finalPayload.fileData
              delete finalPayload.previewBase64
            } catch (uploadError) {
              console.error('Failed to upload media during sync:', uploadError)
              await db.outbox.update(item.id!, { status: 'pending' })
              continue // Try next item
            }
          }
          
          // Clean up any remaining file data
          delete finalPayload.fileData
          delete finalPayload.previewBase64
          delete finalPayload.file
          
          if (endpoint) {
             const res = await fetch(endpoint, {
                 method,
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                   ...finalPayload, 
                   lat: item.lat, 
                   lng: item.lng, 
                   createdAt: item.timestamp ? new Date(item.timestamp).toISOString() : undefined,
                   isOfflineSync: true 
                 })
             })
             if (res.ok) await db.outbox.delete(item.id!)
             else await db.outbox.update(item.id!, { status: 'failed' })
          }
       } catch (e) {
          await db.outbox.update(item.id!, { status: 'pending' })
       }
    }
  }

  const refreshCaches = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    try {
      // 1. Refresh Materials
      const matRes = await fetch('/api/materials')
      if (matRes.ok) {
        const materials = await matRes.json()
        await db.materialsCache.clear()
        await db.materialsCache.bulkPut(materials.map((m: any) => ({
          ...m,
          unitPrice: Number(m.unitPrice)
        })))
      }

      // 2. Refresh Clients
      const cliRes = await fetch('/api/clients')
      if (cliRes.ok) {
        const clients = await cliRes.json()
        await db.clientsCache.clear()
        await db.clientsCache.bulkPut(clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          ruc: c.ruc || '',
          address: c.address || '',
          phone: c.phone || ''
        })))
      }
      console.log('[Offline] Caches refreshed successfully')
    } catch (e) {
      console.error('[Offline] Error refreshing caches:', e)
    }
  }

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        syncOutbox()
        refreshCaches()
      }
    }
    
    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    
    // Initial sync and cache refresh
    if (navigator.onLine) {
      syncOutbox()
      refreshCaches()
    }
    
    const interval = setInterval(() => {
        if (navigator.onLine) {
            syncOutbox()
            refreshCaches() // Refresh caches every 5 mins or so to stay updated
        }
    }, 1000 * 60 * 5) // 5 minutes

    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      clearInterval(interval)
    }
  }, [])

  return null // This acts purely as a background worker injected into the layout
}
