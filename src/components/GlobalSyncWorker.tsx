'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

export default function GlobalSyncWorker() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Cache session info for offline role detection
  useEffect(() => {
    if (session?.user?.id && navigator.onLine) {
      const u = session.user
      const authData = {
        userId: u.id,
        name: u.name || '',
        role: (u.role as any) || 'OPERATOR',
        username: (u as any).username || '',
        lastLogin: Date.now()
      }
      
      // Para uso interno de la app (UI)
      db.auth.put({ ...authData, id: 'last_session' }).catch(console.error)
      
      // Para uso exclusivo del Service Worker (Shadow Auth Proxy)
      db.authShadow.put({ ...authData, id: 'current' }).catch(console.error)
    }
  }, [session])

  const syncOutbox = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    const items = await db.outbox.where('status').anyOf(['pending', 'failed']).toArray()
    if (items.length === 0) return

    let hasSyncedAnything = false

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
          else if (item.type === 'TASK') {
            if (!item.payload.isNew && (item.payload.id || item.payload._id)) {
              endpoint = `/api/appointments/${item.payload.id || item.payload._id}`
              method = 'PATCH'
            } else {
              endpoint = '/api/appointments'
            }
          }
          else if (item.type === 'TASK_STATUS_TOGGLE') { endpoint = `/api/appointments/${item.payload.appointmentId}`; method = 'PATCH' }
          else if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }
          
          let finalPayload = { ...item.payload }
          
          // --- NEW: UNIFIED MEDIA SYNC LOGIC ---
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          
          // 1. Handle single media (MESSAGE, MEDIA_UPLOAD, EXPENSE, GALLERY_UPLOAD)
          const hasBase64 = finalPayload.media?.base64 || 
                           (item.type === 'GALLERY_UPLOAD' && finalPayload.url?.startsWith('data:')) ||
                           finalPayload.receiptPhoto?.startsWith('data:');
          const hasFileData = finalPayload.fileData?.buffer;
          const hasRawFile = finalPayload.file;

          if (hasBase64 || hasFileData || hasRawFile) {
            try {
              let uploadFile: File | Blob;
              let finalFilename: string;

              if (hasBase64) {
                const b64Url = finalPayload.media?.base64 || finalPayload.url || finalPayload.receiptPhoto;
                const resB64 = await fetch(b64Url);
                uploadFile = await resB64.blob();
                finalFilename = finalPayload.media?.filename || finalPayload.filename || `sync_${Date.now()}.jpg`;
              } else if (hasFileData) {
                const blob = new Blob([finalPayload.fileData.buffer], { type: finalPayload.fileData.type });
                uploadFile = new File([blob], finalPayload.fileData.name, { type: finalPayload.fileData.type });
                finalFilename = finalPayload.fileData.name;
              } else {
                uploadFile = finalPayload.file;
                finalFilename = finalPayload.file.name || `sync_legacy_${Date.now()}`;
              }

              const folder = item.projectId ? `projects/${item.projectId}` : 'general';
              const uploadResult = await uploadToBunnyClientSide(uploadFile, finalFilename, folder);
              
              if (finalPayload.media) {
                finalPayload.media = { url: uploadResult.url, filename: finalFilename, mimeType: uploadResult.mimeType };
              }
              if (item.type === 'GALLERY_UPLOAD') finalPayload.url = uploadResult.url;
              if (finalPayload.receiptPhoto) finalPayload.receiptPhoto = uploadResult.url;

              delete finalPayload.file;
              delete finalPayload.fileData;
              delete finalPayload.previewBase64;
              if (finalPayload.media) delete finalPayload.media.base64;
            } catch (err) {
              console.error('Failed single media upload:', err);
              await db.outbox.update(item.id!, { status: 'pending' });
              continue;
            }
          }

          // 2. Handle multiple media (TASK / CALENDAR)
          if (item.type === 'TASK' && (finalPayload.attachments || finalPayload.attachmentLinks || finalPayload.files)) {
            try {
              const allAttachments = [
                ...(finalPayload.attachments || []), 
                ...(finalPayload.attachmentLinks || []),
                ...(finalPayload.files || [])
              ];
              const processedIds = new Set();
              const uploadedFiles = [];

              for (const att of allAttachments) {
                const identifier = att.name + (att.url || att.data || att.base64);
                if (processedIds.has(identifier)) continue;
                processedIds.add(identifier);

                const sourceData = att.base64 || att.url || att.data;
                const isBase64 = sourceData?.startsWith('data:');

                if (isBase64) {
                  const resB64 = await fetch(sourceData);
                  const blob = await resB64.blob();
                  const uploadResult = await uploadToBunnyClientSide(blob, att.name, 'appointments');
                  uploadedFiles.push({ url: uploadResult.url, type: att.type, name: att.name });
                } else if (sourceData?.startsWith('http')) {
                  // Already uploaded or existing link
                  uploadedFiles.push({ url: sourceData, type: att.type, name: att.name });
                }
              }

              // Update the task payload with final URLs
              finalPayload.files = uploadedFiles;
              finalPayload.attachments = uploadedFiles.filter(f => f.type !== 'video').map(f => ({ data: f.url, type: f.type, name: f.name }));
              finalPayload.attachmentLinks = uploadedFiles.filter(f => f.type === 'video').map(f => ({ url: f.url, type: f.type, name: f.name }));
            } catch (err) {
              console.error('Failed task attachments sync:', err);
              await db.outbox.update(item.id!, { status: 'pending' });
              continue;
            }
          }
          
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
             if (res.ok) {
               await db.outbox.delete(item.id!)
               hasSyncedAnything = true
             } else {
               const status = res.status
               // If unauthorized, go back to pending so it retries when user logs in
               if (status === 401) {
                 await db.outbox.update(item.id!, { status: 'pending' })
               } else {
                 await db.outbox.update(item.id!, { status: 'failed' })
               }
             }
          }
       } catch (e) {
          await db.outbox.update(item.id!, { status: 'pending' })
       }
    }

    if (hasSyncedAnything) {
      router.refresh()
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
        console.log('[Sync] Back online, triggering sync...')
        syncOutbox()
        refreshCaches()
      }
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[Sync] App visible, triggering sync...')
        syncOutbox()
      }
    }
    
    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Initial sync and cache refresh
    if (navigator.onLine) {
      syncOutbox()
      refreshCaches()
    }
    
    const interval = setInterval(() => {
        if (navigator.onLine) {
            syncOutbox()
            // We can keep refreshCaches slower to save battery, 
            // but syncOutbox should be fast
            if (Math.random() > 0.9) refreshCaches() 
        }
    }, 15000) // 15 seconds for more responsive background sync
    
    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  return null // This acts purely as a background worker injected into the layout
}
