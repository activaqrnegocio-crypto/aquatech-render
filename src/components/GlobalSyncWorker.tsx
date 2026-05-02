'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

// v261: Global throttle to prevent sync loops on component remounts (caused by router.refresh)
let lastSyncExecution = 0;

export default function GlobalSyncWorker() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncLock = useRef(false)
  const outboxLock = useRef(false) // v272: Separate lock — outbox sync must NEVER be blocked by bulk sync
  
  // v261: PWA Visibility Fallback (Critical for iOS/Safari)
  // When app returns to foreground, proactively wake up the Service Worker sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[Sync] App returned to focus. Triggering background sync fallback...');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            if ('sync' in reg) {
              // Consolidate to one registration to avoid duplicate SW wakeups
              // v273: Register specific tags as well for better reliability
              const sync = (reg as any).sync;
              sync.register('sync-outbox').catch(() => {});
              sync.register('sync-MESSAGE').catch(() => {});
              sync.register('sync-EXPENSE').catch(() => {});
              sync.register('sync-TASK').catch(() => {});
              sync.register('sync-PROJECT').catch(() => {});
            }
          });
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  // States for bulk cache sync (background)
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })

  // Automatic Trigger: Start sync when session is available and we are online
  useEffect(() => {
    if (session?.user?.id && navigator.onLine && !isBulkSyncing) {
      // v273: Significantly increased delay (5s) to allow navigation to be smooth first
      const timer = setTimeout(() => {
        // Use requestIdleCallback if available for ultra-smooth background start
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => startBulkSync());
        } else {
          startBulkSync();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session?.user?.id, isOnline]);

  const startBulkSync = async (initialProjects: any[] = [], passedUserRole?: string, force = false) => {
    if (syncLock.current) return;
    
    let projectsToProcess = [...initialProjects];
    
    setIsBulkSyncing(true)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsBulkSyncing(false);
      return;
    }

    const u = session?.user as any;
    const userRole = (passedUserRole || u?.role || 'OPERATOR').toUpperCase();
    const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole);
    
    const cacheKey = `projects_bulk_${u?.id || 'default'}`;
    
    if (!force) {
      const meta = await db.cacheMetadata.get(cacheKey);
      // v279: Restored a reasonable 15-minute window for everyone, tied to the USER, not global.
      const FRESHNESS_WINDOW = 15 * 60 * 1000;
      
      if (meta && (Date.now() - meta.lastSync) < FRESHNESS_WINDOW) {
        const minsLeft = Math.round((FRESHNESS_WINDOW - (Date.now() - meta.lastSync)) / 60000);
        console.log(`[Sync] Datos frescos para usuario ${u?.id}. Siguiente sync automático en ${minsLeft} min.`);
        setIsBulkSyncing(false);
        return;
      }
    }

    setBulkProgress({ current: 0, total: 0 })
    syncLock.current = true;
    
    try {
      const u = session?.user as any;
      const userRole = (u?.role || 'OPERATOR').toUpperCase();
      const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole);
      
      // v279: Update metadata with user-specific key
      await db.cacheMetadata.put({
        id: cacheKey,
        lastSync: Date.now(),
        count: 0,
        status: 'syncing'
      });

      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Iniciando sincronización optimizada (${userRole})...` }
      }))

      // 1. SYNC PROJECTS & CHATS (v274: Reduced from 100 to 50 for operators to maximize performance)
      const limit = isAdmin ? 300 : 50;
      const res = await fetch(`/api/projects/bulk-cache?limit=${limit}`, { priority: 'low' })
      if (res.ok) {
        const fetchedProjects = await res.json()
        projectsToProcess = fetchedProjects;
        const totalToSync = projectsToProcess.length
        const syncChannel = new BroadcastChannel('aquatech-sync');
        
        syncChannel.postMessage({ 
          type: 'DATA_SYNC_START', 
          total: totalToSync 
        });

        setBulkProgress({ current: 0, total: totalToSync })
        
        for (let i = 0; i < projectsToProcess.length; i++) {
          const p = projectsToProcess[i];
          const existing = await db.projectsCache.get(p.id);
          
          const mergedProject = {
            ...(existing || {}),
            ...p,
            isSkeleton: false,
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
          
          const syncChannel = new BroadcastChannel('aquatech-sync');
          syncChannel.postMessage({ 
            type: 'DATA_SYNC_PROGRESS', 
            current: i + 1, 
            total: totalToSync,
            projectName: p.title || p.id
          });
          syncChannel.close();

          window.dispatchEvent(new CustomEvent('bulk-cache-sync-progress', { 
            detail: { current: i + 1, total: totalToSync } 
          }));
          // Artificial Pacing (v273): Increased delay and frequency to keep the main thread free
          if (i % 3 === 0) {
            if ('requestIdleCallback' in window) {
              await new Promise(resolve => (window as any).requestIdleCallback(resolve, { timeout: 1000 }));
            } else {
              await new Promise(resolve => setTimeout(resolve, 150)); 
            }
          }
        }

        // v257: SAVE METADATA HERE (After data, before expensive pre-fetches)
        // This ensures that if the user closes the app during pre-fetching, 
        // we don't restart the whole process immediately next time.
        // v274: Removed premature metadata update. Now we only save at the very end.

        // v267: INTELLIGENT PRE-FETCHING — Sequential chunk-by-chunk, SW-aware
        if (true) {
          window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
            detail: { message: `Preparando entorno offline inteligente...` }
          }))

          // v267: Helper — waits up to 10s for the SW controller to be available
          // This is crucial on first load where the SW installs DURING the sync loop.
          const getController = async (): Promise<ServiceWorker | null> => {
            if (!('serviceWorker' in navigator)) return null;
            // If controller is already there, return it immediately
            if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
            // Wait for the SW to be ready (installed + activated)
            await navigator.serviceWorker.ready;
            // Poll for controller with timeout (handles the "installed but not yet controlling" case)
            for (let attempt = 0; attempt < 20; attempt++) {
              if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
              await new Promise(r => setTimeout(r, 500));
            }
            return navigator.serviceWorker.controller;
          };

          // v267: Sends a PRECACHE_URLS message and awaits SW confirmation via MessageChannel
          // This converts the fire-and-forget postMessage into a reliable awaitable call.
          const precacheAndWait = async (urlOrUrls: string | string[]): Promise<void> => {
            const controller = await getController();
            const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
            
            if (!controller) {
              // SW not available — fall back to direct fetch
              await Promise.all(urls.map(url => 
                fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } }).catch(() => {})
              ));
              return;
            }
            // Use MessageChannel so we can await the SW's reply
            await new Promise<void>((resolve) => {
              const { port1, port2 } = new MessageChannel();
              const timeout = setTimeout(() => resolve(), 30000); // v286: 30s timeout for full project bundle
              port1.onmessage = () => { clearTimeout(timeout); resolve(); };
              controller.postMessage({ type: 'PRECACHE_URLS', urls, replyPort: port2 }, [port2]);
            });
          };

          // 1. Shells — v282: Only pre-cache the shell relevant to the user's role
          const shell = isAdmin ? '/admin/proyectos/offline-shell' : '/admin/operador/proyecto/offline-shell';
          await Promise.all([
            precacheAndWait(shell),
            precacheAndWait(`${shell}?_rsc=1`)
          ]);

          // 2. Main Sections (Role-Aware) — v280: All parallel, no delays
          const sections = isAdmin 
            ? ['/admin', '/admin/proyectos', '/admin/calendario', '/admin/inventario', '/admin/cotizaciones']
            : ['/admin/operador', '/admin/inventario', '/admin/cotizaciones'];

          await Promise.all(sections.map(async (section) => {
            await precacheAndWait(section);
            const rscUrl = section.includes('?') ? `${section}&_rsc=prefetch` : `${section}?_rsc=prefetch`;
            fetch(rscUrl, { priority: 'low', headers: { 'RSC': '1', 'Next-Router-Prefetch': '1' } }).catch(() => {});
          }));

          // 3. Recent Projects — v281: Batched parallel (5 at a time), hard cap per role
          // Admin: 15 projects max. Operator: 8. Beyond that, they load on demand.
          // This prevents the 10-minute "infinite sync" on mobile devices.
          if (projectsToProcess.length === 0) {
            projectsToProcess = await db.projectsCache
              .orderBy('lastAccessedAt')
              .reverse()
              .limit(isAdmin ? 15 : 8)
              .toArray();
          }

          const limit = isAdmin ? 15 : 8;
          const topProjects = projectsToProcess.slice(0, limit);
          
          const syncChannelAssets = new BroadcastChannel('aquatech-sync');
          
          // v286: Strictly sequential caching to avoid server saturation and "Warm-cache failed"
          for (let i = 0; i < topProjects.length; i++) {
            const p = topProjects[i];
            const projectPath = isAdmin ? `/admin/proyectos/${p.id}` : `/admin/operador/proyecto/${p.id}`;
            const urls = [projectPath, `${projectPath}?view=chat`, `${projectPath}?_rsc=1`];

            const msg = `[Sync] Pre-cacheando: ${p.title || p.id}`;
            console.log(msg);
            window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', { detail: { message: msg } }));
            syncChannelAssets.postMessage({ type: 'ASSET_PRECACHE_PROGRESS', current: i + 1, total: topProjects.length });

            // Wait for all 3 variants of THIS project to be cached before moving to next
            await precacheAndWait(urls);
          }
          
          syncChannelAssets.postMessage({ type: 'ASSET_PRECACHE_FINISHED' });
          syncChannelAssets.close();
        }
      }

      // 3. SYNC USERS — v281: Removed artificial 500ms delay
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Sincronizando equipo de trabajo...` }
      }))
      // v264: Fetch all relevant roles for offline selection
      // v274: Fetch ALL users (no role filter) so they are all available offline for assignments
      const userRes = await fetch('/api/users', { priority: 'low' })
      if (userRes.ok) {
        const users = await userRes.json()
        if (Array.isArray(users)) {
           await db.usersCache.clear();
           await db.usersCache.bulkPut(users.map(u => ({
             id: u.id,
             name: u.name,
             role: u.role
           })));
        }
      }

      // 4. SYNC QUOTES
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
      const finalCount = projectsToProcess.length;
      
      const cacheKeyFinal = `projects_bulk_${u?.id || 'default'}`;
      await db.cacheMetadata.put({
        id: cacheKeyFinal,
        lastSync: now,
        count: finalCount,
        status: 'idle'
      })
      
      const syncChannelFinal = new BroadcastChannel('aquatech-sync');
      syncChannelFinal.postMessage({ type: 'DATA_SYNC_FINISHED', count: finalCount });
      syncChannelFinal.close();

      window.dispatchEvent(new CustomEvent('bulk-cache-sync-finished', { 
        detail: { count: finalCount } 
      }))

      // 5. SILENT GARBAGE COLLECTION (v278)
      // Keeps the local database small by removing stale projects if we exceed 60
      try {
        const MAX_KEPT_PROJECTS = 60;
        const allCachedProjects = await db.projectsCache.orderBy('lastAccessedAt').reverse().toArray();
        if (allCachedProjects.length > MAX_KEPT_PROJECTS) {
          const toDelete = allCachedProjects.slice(MAX_KEPT_PROJECTS).map(p => p.id);
          if (toDelete.length > 0) {
            await db.projectsCache.bulkDelete(toDelete);
            await db.chatCache.bulkDelete(toDelete);
            console.log(`[GarbageCollector] Limpiados ${toDelete.length} proyectos antiguos de la caché local.`);
          }
        }
      } catch (gcErr) {
        console.warn('Error en la barredora de caché:', gcErr);
      }
    } catch (err) {
      console.error('Skeleton sync error:', err)
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Error en sincronización: ${err instanceof Error ? err.message : 'Desconocido'}` }
      }))
    } finally {
      syncLock.current = false;
      setIsBulkSyncing(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id && navigator.onLine) {
      const u = session.user
      const authData = {
        userId: u.id,
        name: u.name || '',
        role: (u.role as any) || 'OPERATOR',
        username: (u as any).username || '',
        permissions: (u as any).permissions || null,
        lastLogin: Date.now()
      }
      
      db.auth.put({ ...authData, id: 'last_session' }).catch(console.error)
      db.authShadow.put({ ...authData, id: 'current' }).catch(console.error)
    }
  }, [session])
  
  const syncOutbox = async () => {
    if (typeof window === 'undefined' || !navigator.onLine || outboxLock.current) return
    
    // v272: Reset stuck 'syncing' items every cycle (not just on mount)
    try {
      const stuckItems = await db.outbox.where('status').equals('syncing').toArray();
      const now = Date.now();
      for (const item of stuckItems) {
        const stuckTime = now - (item.lastAttemptAt || item.timestamp || 0);
        if (stuckTime > 30000) { // Stuck for more than 30 seconds
          console.log(`[Sync] Reseteando elemento bloqueado ${item.id} (${item.type}) a 'pending'`);
          await db.outbox.update(item.id!, { status: 'pending' });
        }
      }
    } catch (e) { /* ignore */ }

    // Cross-tab and remount lock
    const now = Date.now()
    if (now - lastSyncExecution < 5000) {
      // v272: Reduced throttle from 10s to 5s for faster retry
      return
    }

    const lastSyncStart = localStorage.getItem('global_sync_lock')
    if (lastSyncStart && (now - Number(lastSyncStart)) < 30000) {
      // v272: Reduced cross-tab lock from 60s to 30s
      return
    }
    localStorage.setItem('global_sync_lock', String(now))
    lastSyncExecution = now;

    outboxLock.current = true
    try {
      const items = await db.outbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .toArray();
      
      if (items.length === 0) {
        localStorage.removeItem('global_sync_lock')
        return
      }

      console.log(`[Sync] Processing ${items.length} items from outbox...`);

      // v272: Sort chronologically (FIFO) — critical for dependency order
      // DAY_START must sync before EXPENSE/MESSAGE, PROJECT before PHASE_CREATE, etc.
      items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      let hasSyncedAnything = false
      const failedContexts = new Set<string>(); // v272: Track failed projects/contexts

      for (const item of items) {
        // v272: If a previous item for this project failed, skip dependents
        const ctx = item.projectId ? `proj-${item.projectId}` : (item.type === 'DAY_START' || item.type === 'DAY_END' ? 'day-record' : null);
        if (ctx && failedContexts.has(ctx)) {
          console.log(`[Sync] Skipping ${item.type} — earlier dependency for ${ctx} failed`);
          continue;
        }

        // Double check status hasn't changed by another process (sanity check)
        const currentItem = await db.outbox.get(item.id!)
        if (!currentItem || currentItem.status === 'syncing') continue

        // v261: Prevent infinite retries for items that failed too many times
        if ((currentItem.attempts || 0) >= 5) {
          console.warn(`[Sync] Skipping item ${item.id} after 5 failed attempts`);
          continue;
        }

        try {
          await db.outbox.update(item.id!, { status: 'syncing' })
          let endpoint = ''
          let method = 'POST'
          
          if (item.type === 'QUOTE') { endpoint = '/api/quotes' }
          else if (item.type === 'MATERIAL') { endpoint = '/api/materials' }
          else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD') { endpoint = `/api/projects/${item.projectId}/messages` }
          else if (item.type === 'EXPENSE') { 
            if (item.payload.id) {
              endpoint = `/api/projects/${item.projectId}/expenses/${item.payload.id}`;
              method = 'PATCH';
            } else {
              endpoint = `/api/projects/${item.projectId}/expenses`;
              method = 'POST';
            }
          }
          else if (item.type === 'EXPENSE_DELETE') {
            endpoint = `/api/projects/${item.projectId}/expenses/${item.payload.expenseId}`;
            method = 'DELETE';
          }
          else if (item.type === 'DAY_START') { endpoint = `/api/day-records` }
          else if (item.type === 'DAY_END') { endpoint = `/api/day-records`; method = 'PUT' }
          else if (item.type === 'PHASE_COMPLETE' || item.type === 'PHASE_UPDATE') { 
            endpoint = `/api/projects/${item.projectId}/phases/${item.payload.phaseId}`; 
            method = 'PATCH' 
          }
          else if (item.type === 'PHASE_CREATE') {
            endpoint = `/api/projects/${item.projectId}/phases`;
            method = 'POST'
          }
          else if (item.type === 'PROJECT') { endpoint = '/api/projects' }
          else if (item.type === 'PROJECT_UPDATE') { endpoint = `/api/projects/${item.projectId}`; method = 'PATCH' }
          else if (item.type === 'TEAM_UPDATE') { endpoint = `/api/projects/${item.projectId}/team`; method = 'PUT' }
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
          else if (item.type === 'GALLERY_DELETE') { endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.galleryId}`; method = 'DELETE' }
          else if (item.type === 'GALLERY_RENAME') { 
            endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.galleryId}`; 
            method = 'PATCH' 
          }
          
          let finalPayload = { ...item.payload }
          
          // --- NEW: UNIFIED MEDIA SYNC LOGIC ---
          const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
          
          // 1. Handle single media (MESSAGE, MEDIA_UPLOAD, EXPENSE, GALLERY_UPLOAD)
          const hasBase64 = finalPayload.media?.base64 || 
                           (item.type === 'GALLERY_UPLOAD' && finalPayload.url?.startsWith('data:')) ||
                           finalPayload.receiptPhoto?.startsWith('data:');
          const hasBlobUrl = (typeof finalPayload.media?.url === 'string' && finalPayload.media.url.startsWith('blob:')) ||
                            (typeof finalPayload.url === 'string' && finalPayload.url.startsWith('blob:')) ||
                            (typeof finalPayload.receiptPhoto === 'string' && finalPayload.receiptPhoto.startsWith('blob:'));
          const hasFileData = finalPayload.fileData?.buffer;
          const hasRawFile = finalPayload.file;

          if (hasBase64 || hasBlobUrl || hasFileData || hasRawFile) {
            try {
              let uploadFile: File | Blob;
              let finalFilename: string;

              if (hasBase64 || hasBlobUrl) {
                const b64Url = finalPayload.media?.base64 || finalPayload.media?.url || finalPayload.url || finalPayload.receiptPhoto;
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
                finalPayload.media = { 
                  ...finalPayload.media,
                  url: uploadResult.url, 
                  filename: finalFilename, 
                  mimeType: uploadResult.mimeType,
                  type: uploadResult.type // Use the detected type (IMAGE, VIDEO, AUDIO)
                };
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
                const isBase64 = typeof sourceData === 'string' && sourceData.startsWith('data:');
                const isBlobUrl = typeof sourceData === 'string' && sourceData.startsWith('blob:');
                const isRawFile = sourceData instanceof Blob;

                if (isBase64 || isBlobUrl || isRawFile) {
                  let blob: Blob;
                  if (isRawFile) {
                    blob = sourceData;
                  } else {
                    const res = await fetch(sourceData);
                    blob = await res.blob();
                  }
                  const uploadResult = await uploadToBunnyClientSide(blob, att.name, 'appointments');
                  uploadedFiles.push({ url: uploadResult.url, type: att.type, name: att.name });
                } else if (typeof sourceData === 'string' && sourceData.startsWith('http')) {
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
             // v260: Clean client-only fields from TASK payloads before sending
             if (item.type === 'TASK') {
               delete finalPayload.isNew
               delete finalPayload.mediaFiles
               delete finalPayload.previews
               // Clean isOffline markers from files array
               if (Array.isArray(finalPayload.files)) {
                 finalPayload.files = finalPayload.files.map((f: any) => {
                   const { isOffline, isNew: _n, ...clean } = f
                   return clean
                 })
               }
             }

             const res = await fetch(endpoint, {
                 method,
                 headers: { 
                   'Content-Type': 'application/json',
                   'x-sync-id': `sync-${item.id}-${item.timestamp}` 
                 },
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
               if (typeof window !== 'undefined') {
                 window.dispatchEvent(new CustomEvent('sync-success', { detail: { type: item.type, projectId: item.projectId } }))
               }
             } else {
               const status = res.status
               if (status === 401 || status === 429) {
                 // Unauthorized or rate limited -> keep pending and retry later
                 if (ctx) failedContexts.add(ctx); // v272: block dependents
                 await db.outbox.update(item.id!, { status: 'pending' })
               } else if (status >= 400 && status < 500) {
                 // Permanent client error (400, 403, 404) -> Drop it so it doesn't loop forever
                 console.warn(`[Sync] Descartando tarea inválida permanentemente: ${item.type} (Status ${status})`);
                 await db.outbox.delete(item.id!)
               } else {
                 // Server errors (500+) -> mark as failed and increment attempts
                 if (ctx) failedContexts.add(ctx); // v272: block dependents
                 await db.outbox.update(item.id!, { 
                   status: 'failed',
                   attempts: (item.attempts || 0) + 1,
                   lastAttemptAt: Date.now()
                 })
               }
             }
          }
          
          // v261: Pacing delay to prevent server saturation and race conditions
          await new Promise(r => setTimeout(r, 500));
       } catch (e) {
          // v272: Mark context as failed so dependents are skipped
          if (ctx) failedContexts.add(ctx);
          await db.outbox.update(item.id!, { 
            status: 'pending',
            attempts: (item.attempts || 0) + 1,
            lastAttemptAt: Date.now()
          })
       }
    }

    if (hasSyncedAnything) {
      router.refresh()
    }
    } finally {
      outboxLock.current = false
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

  // v261: Helper to delegate sync to Service Worker (works when app is minimized)
  const registerSwSync = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      // 1. Register one-shot background sync (fires when connectivity resumes)
      if ('sync' in reg) {
        await (reg as any).sync.register('sync-outbox');
        console.log('[Sync] Registered SW background sync: sync-outbox');
      }
      // 2. Also trigger immediately via postMessage (SW stays alive to process)
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
        // v273: Trigger specific sync types
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC', specificType: 'MESSAGE' });
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC', specificType: 'EXPENSE' });
        console.log('[Sync] Sent TRIGGER_SYNC types to SW via postMessage');
      }
    } catch (e) {
      console.warn('[Sync] SW sync registration failed:', e);
    }
  };

  // v261: Register periodic sync once on mount (Android/Chrome 80+)
  useEffect(() => {
    const registerPeriodicSync = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg) {
          const status = await navigator.permissions.query({ name: 'periodic-background-sync' as any });
          if (status.state === 'granted') {
            await (reg as any).periodicSync.register('sync-outbox-periodic', {
              minInterval: 15 * 60 * 1000 // 15 minutes minimum
            });
            console.log('[Sync] Periodic background sync registered (15 min interval)');
          }
        }
      } catch (e) {
        console.warn('[Sync] Periodic sync not available:', e);
      }
    };
    registerPeriodicSync();
  }, []);

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        console.log('[Sync] Back online, triggering sync...')
        syncOutbox()
        refreshCaches()
        // Also wake SW to sync anything it has
        registerSwSync()
      }
    }
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && typeof navigator !== 'undefined' && navigator.onLine) {
        // v272: Always call syncOutbox regardless of syncLock (uses its own outboxLock)
        console.log('[Sync] App visible and online, checking for fresh data...');
        syncOutbox()
        if (!syncLock.current) {
          startBulkSync()
        }
      } else if (document.visibilityState === 'hidden') {
        // v261: CRITICAL — App going to background!
        // Android suspends JS timers when the app is minimized.
        // We must delegate ALL pending sync work to the Service Worker NOW,
        // because our setInterval-based syncOutbox() will stop firing.
        console.log('[Sync] App going to BACKGROUND — delegating sync to SW');
        
        // Check if there are pending items
        try {
          const pendingCount = await db.outbox.where('status').anyOf(['pending', 'failed']).count();
          if (pendingCount > 0) {
            console.log(`[Sync] ${pendingCount} pending items — waking SW for background sync`);
            await registerSwSync();
          }
        } catch (e) {
          // Even if the check fails, still try to register
          await registerSwSync();
        }
      }
    }
    
    const handleManualSync = (e: any) => {
      console.log('[Sync] Manual sync triggered via event. Force:', e.detail?.force);
      startBulkSync([], undefined, e.detail?.force || false);
    };

    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('trigger-bulk-sync', handleManualSync)
    
    // Initial sync and cache refresh
    if (navigator.onLine) {
      // Delay the initial outbox sync to let the main UI hydrate and render smoothly
      setTimeout(() => {
        syncOutbox()
        refreshCaches()
      }, 5000); // 5s delay for immediate syncs

      // v274: Delayed start for bulk sync to avoid LCP/Hydration contention
      setTimeout(() => {
        if (!syncLock.current) startBulkSync()
      }, 25000) // Increased to 25s for the heavy bulk sync
    }
    
    // v261: Reduced from 60s to 15s — this is the PRIMARY sync path when app is visible.
    // When app goes to background, Android suspends this, but SW takes over.
    const interval = setInterval(() => {
        if (navigator.onLine) {
            syncOutbox()
        }
    }, 15000) // 15 seconds for outbox sync (faster while app is active)

    // v226: Periodic full refresh every 30 minutes
    const bulkInterval = setInterval(() => {
        if (navigator.onLine) {
            startBulkSync() 
        }
    }, 30 * 60 * 1000) // v259: 30 mins to match freshness window

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
      window.removeEventListener('trigger-bulk-sync', handleManualSync)
      clearInterval(interval)
      clearInterval(bulkInterval)
      clearInterval(keepAliveInterval)
    }
  }, [])

  return null // This acts purely as a background worker injected into the layout
}
