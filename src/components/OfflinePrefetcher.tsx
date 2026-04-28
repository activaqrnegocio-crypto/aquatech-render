'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

/**
 * OfflinePrefetcher — pre-caches all given URLs so they work offline.
 * Upgraded: Now also fetches JSON data for projects and chats to populate Dexie.
 */
export default function OfflinePrefetcher({ urls }: { urls: string[] }) {
  const router = useRouter()

  useEffect(() => {
    if (!urls || urls.length === 0) return

    // 1. Standard Next.js Prefetch
    const timer = setTimeout(() => {
      urls.forEach(url => {
        try {
          router.prefetch(url)
        } catch (e) {}
      })
    }, 1000)

    // 2. SW and Data Prefetch
    const dataTimer = setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // HTML Caching - Enviar al SW (el SW ya está optimizado para ir uno a uno)
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        })
      }

      // 3. DEEP DATA PREFETCH & CLEANUP
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const dispatchStatus = (status: any) => {
          if (status.state === 'SYNCING' || status.state === 'STARTING') {
            window.dispatchEvent(new CustomEvent('bulk-cache-sync-progress', { 
              detail: { current: status.current, total: status.total } 
            }));
          } else if (status.state === 'COMPLETED') {
            window.dispatchEvent(new CustomEvent('bulk-cache-sync-finished', { 
              detail: { count: status.total } 
            }));
            // Save metadata for the green notice to persist
            db.cacheMetadata.put({ 
              id: 'projects_bulk', 
              lastSync: Date.now(), 
              count: status.total,
              status: 'idle'
            }).catch(() => {});
          }
        };

        const runGarbageCollector = async () => {
          try {
            const MAX_PROJECTS = 400; // v222: Increased for Admin scale
            const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();

            // 1. Borrar proyectos muy viejos (más de 30 días sin acceso)
            const oldProjects = await db.projectsCache
              .where('lastAccessedAt')
              .below(now - THIRTY_DAYS)
              .toArray();
            
            for (const p of oldProjects) {
              await db.projectsCache.delete(p.id);
              await db.chatCache.delete(p.id);
            }

            // 2. Si hay demasiados, borrar los más viejos hasta quedar bajo el límite
            const count = await db.projectsCache.count();
            if (count > MAX_PROJECTS) {
              const toDeleteCount = count - MAX_PROJECTS;
              const toDelete = await db.projectsCache
                .orderBy('lastAccessedAt')
                .limit(toDeleteCount)
                .toArray();
              
              for (const p of toDelete) {
                await db.projectsCache.delete(p.id);
                await db.chatCache.delete(p.id);
              }
            }
          } catch (e) {
            console.error('[GC] Error en limpieza de caché:', e);
          }
        };

        const prefetchSequentially = async () => {
          dispatchStatus({ state: 'STARTING', total: urls.length, current: 0 });
          await runGarbageCollector();
          
          try {
            // v223: Only fetch basic lists if online
            const clientsResp = await fetch('/api/clients')
            if (clientsResp.ok) {
              const clients = await clientsResp.json()
              if (Array.isArray(clients)) {
                await db.clientsCache.clear()
                await db.clientsCache.bulkPut(clients)
              }
            }
            
            const matResp = await fetch('/api/materials')
            if (matResp.ok) {
              const materials = await matResp.json()
              if (Array.isArray(materials)) {
                await db.materialsCache.clear()
                await db.materialsCache.bulkPut(materials)
              }
            }

            await fetch('/api/users?roles=OPERATOR,SUBCONTRATISTA').catch(() => {})
          } catch (e) {
            console.warn('[Prefetch] Global data fetch failed', e)
          }

          let completed = 0;
          for (const url of urls) {
            const projectMatch = url.match(/\/admin\/proyectos\/(\d+)/) || 
                                 url.match(/\/admin\/operador\/proyecto\/(\d+)/) ||
                                 url.match(/\/operador\/proyecto\/(\d+)/)

            if (projectMatch) {
              const projectId = projectMatch[1]
              dispatchStatus({ state: 'SYNCING', total: urls.length, current: completed + 1, projectId });
              
              const existing = await db.projectsCache.get(Number(projectId))
              
              // Solo sincronizar si no existe o si se actualizó hace más de 1 hora en el servidor
              if (existing && Date.now() - new Date(existing.updatedAt || 0).getTime() < 3600000) {
                await db.projectsCache.update(Number(projectId), { lastAccessedAt: Date.now() });
                completed++;
                continue
              }

              try {
                // 1. Datos básicos y técnicos del proyecto
                const pResp = await fetch(`/api/projects/${projectId}`)
                if (pResp.ok) {
                  const projectData = await pResp.json()
                  if (projectData && projectData.id) {
                    await db.projectsCache.put({ ...projectData, lastAccessedAt: Date.now() })
                    
                    // PREFETCH THUMBNAILS FOR GALLERY
                    if (projectData.gallery && projectData.gallery.length > 0) {
                      const thumbs = projectData.gallery
                        .filter((g: any) => g.url && g.mimeType?.startsWith('image/'))
                        .map((g: any) => g.url.includes('b-cdn.net') && !g.url.includes('?width=') ? `${g.url}?width=400` : g.url)
                        .slice(0, 15); // Solo las últimas 15 miniaturas para no saturar
                      
                      for (const tUrl of thumbs) {
                        fetch(tUrl, { mode: 'no-cors' }).catch(() => {});
                      }
                    }
                  }
                }
                await new Promise(r => setTimeout(r, 1200)) // Throttling

                // 2. Mensajes de chat
                const cResp = await fetch(`/api/projects/${projectId}/messages`)
                if (cResp.ok) {
                  const messages = await cResp.json()
                  await db.chatCache.put({ projectId: Number(projectId), messages: messages || [] })
                }
                
                await new Promise(r => setTimeout(r, 1200))
              } catch (err) {
                console.warn(`[Prefetch] Error al sincronizar proyecto ${projectId}`, err)
              }
            }
            completed++;
          }
          dispatchStatus({ state: 'COMPLETED', total: urls.length, current: completed });
        }
        prefetchSequentially()
      }
    }, 4000)

    return () => {
      clearTimeout(timer)
      clearTimeout(dataTimer)
    }
  }, [urls, router])

  return null
}
