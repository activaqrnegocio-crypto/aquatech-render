'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

export default function GlobalSyncWorker() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncLock = useRef(false)
  
  // States for bulk cache sync (background)
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })

  // Automatic Trigger: Start sync when session is available and we are online
  useEffect(() => {
    if (session?.user?.id && navigator.onLine && !isBulkSyncing) {
      // Small delay to let the initial page load settle
      const timer = setTimeout(() => {
        startBulkSync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session?.user?.id, isOnline]);

  const startBulkSync = async () => {
    if (!navigator.onLine || isBulkSyncing) return
    
    setIsBulkSyncing(true)
    setBulkProgress({ current: 0, total: 0 })
    
    try {
      const u = session?.user as any;
      const userRole = (u?.role || 'OPERATOR').toUpperCase();
      const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN'].includes(userRole);

      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Iniciando sincronización optimizada (${userRole})...` }
      }))

      // 1. SYNC PROJECTS & CHATS (Smart Merge with Pacing)
      const res = await fetch('/api/projects/bulk-cache?limit=200', { priority: 'low' })
      if (res.ok) {
        const projects = await res.json()
        setBulkProgress({ current: 0, total: projects.length })
        
        for (let i = 0; i < projects.length; i++) {
          const p = projects[i];
          const existing = await db.projectsCache.get(p.id);
          
          const mergedProject = {
            ...(existing || {}),
            ...p,
            lastAccessedAt: Date.now()
          };
          
          await db.projectsCache.put(mergedProject);

          if (p.chatMessages && p.chatMessages.length > 0) {
            const existingChat = await db.chatCache.get(p.id);
            const existingMessages = existingChat?.messages || [];
            
            const messageMap = new Map();
            existingMessages.forEach((m: any) => messageMap.set(m.id, m));
            p.chatMessages.forEach((m: any) => messageMap.set(m.id, m));
            
            const finalMessages = Array.from(messageMap.values()).sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            await db.chatCache.put({ projectId: p.id, messages: finalMessages });
          }
          
          setBulkProgress(prev => ({ ...prev, current: i + 1 }));
          
          // Artificial Pacing: Small pause every few items to keep the UI snappy
          if (i % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 150)); 
          }
        }

        // v222: ROBUST SHELL PRE-WARMING (Low Priority)
        if (projects.length > 0) {
          const warmUpCount = Math.min(projects.length, 5);
          for (let i = 0; i < warmUpCount; i++) {
            const pid = projects[i].id;
            const shellUrl = isAdmin ? `/admin/proyectos/${pid}` : `/admin/operador/proyecto/${pid}`;
            fetch(shellUrl, { priority: 'low', headers: { 'Accept': 'text/html' } }).catch(() => {});
            fetch(`${shellUrl}?_rsc=warmup`, { 
              priority: 'low',
              headers: { 'RSC': '1' } 
            }).catch(() => {});
            
            await new Promise(resolve => setTimeout(resolve, 200)); // Pacing
          }

          if (isAdmin) {
            const calendarUrl = '/admin/calendario';
            fetch(calendarUrl, { priority: 'low', headers: { 'Accept': 'text/html' } }).catch(() => {});
            fetch(`${calendarUrl}?_rsc=warmup`, { priority: 'low', headers: { 'RSC': '1' } }).catch(() => {});
          }
        }
      }

      // 2. SYNC APPOINTMENTS (Calendar)
      await new Promise(resolve => setTimeout(resolve, 500)); // Breathing room
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Sincronizando agenda...` }
      }))
      const appRes = await fetch('/api/appointments', { priority: 'low' })
      if (appRes.ok) {
        const appointments = await appRes.json()
        await db.appointmentsCache.bulkPut(appointments);
      }

      // 3. SYNC QUOTES
      if (isAdmin) {
        await new Promise(resolve => setTimeout(resolve, 500));
        window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
          detail: { message: `Sincronizando cotizaciones...` }
        }))
        const quoteRes = await fetch('/api/quotes?limit=100', { priority: 'low' })
        if (quoteRes.ok) {
          const quotes = await quoteRes.json()
          await db.quotesCache.bulkPut(quotes);
        }
      }

      const now = Date.now()
      const finalCount = await db.projectsCache.count()
      await db.cacheMetadata.put({
        id: 'projects_bulk',
        lastSync: now,
        count: finalCount,
        status: 'idle'
      })
      
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-finished', { 
        detail: { count: finalCount } 
      }))

    } catch (err) {
      console.error('Skeleton sync error:', err)
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Error en sincronización: ${err instanceof Error ? err.message : 'Desconocido'}` }
      }))
    } finally {
      setIsBulkSyncing(false)
    }
  }

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
      
      db.auth.put({ ...authData, id: 'last_session' }).catch(console.error)
      db.authShadow.put({ ...authData, id: 'current' }).catch(console.error)
    }
  }, [session])

  const syncOutbox = async () => {
    if (typeof window === 'undefined' || !navigator.onLine || syncLock.current) return
    
    // 1. Cross-tab lock (prevent multiple tabs syncing at once)
    const now = Date.now()
    const lastSyncStart = localStorage.getItem('global_sync_lock')
    if (lastSyncStart && (now - Number(lastSyncStart)) < 60000) {
      // A sync is likely running in another tab (60s safety timeout)
      return
    }
    localStorage.setItem('global_sync_lock', String(now))

    syncLock.current = true
    try {
      const items = await db.outbox.where('status').anyOf(['pending', 'failed']).toArray()
      if (items.length === 0) {
        localStorage.removeItem('global_sync_lock')
        return
      }

      let hasSyncedAnything = false

      for (const item of items) {
        // Double check status hasn't changed by another process (sanity check)
        const currentItem = await db.outbox.get(item.id!)
        if (!currentItem || currentItem.status === 'syncing') continue

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
    } finally {
      syncLock.current = false
      localStorage.removeItem('global_sync_lock')
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

    // Keep-Alive Ping para base de datos (StackCP)
    const keepAliveInterval = setInterval(() => {
      if (navigator.onLine) {
        fetch('/api/health/ping').catch(() => {})
      }
    }, 240000) // 4 minutos
    
    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
      clearInterval(keepAliveInterval)
    }
  }, [])

  return null // This acts purely as a background worker injected into the layout
}
