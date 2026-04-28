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
              console.log(`[GC] Limpiados ${toDeleteCount} proyectos antiguos para liberar espacio.`);
            }
          } catch (e) {
            console.error('[GC] Error en limpieza de caché:', e);
          }
        };

        const prefetchSequentially = async () => {
          await runGarbageCollector(); // Limpiar antes de empezar
          
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
            await new Promise(r => setTimeout(r, 1000))
            
            const matResp = await fetch('/api/materials')
            if (matResp.ok) {
              const materials = await matResp.json()
              if (Array.isArray(materials)) {
                await db.materialsCache.clear()
                await db.materialsCache.bulkPut(materials)
              }
            }
            await new Promise(r => setTimeout(r, 1000))

            await fetch('/api/users?roles=OPERATOR,SUBCONTRATISTA').catch(() => {})
            await new Promise(r => setTimeout(r, 1000))

          } catch (e) {
            console.warn('[Prefetch] Global data fetch failed', e)
          }

          // v223: Sincronización TOTAL sin límites de slice
          console.log(`[Prefetch] Iniciando sincronización de ${urls.length} proyectos...`);

          for (const url of urls) {
            const projectMatch = url.match(/\/admin\/proyectos\/(\d+)/) || 
                                 url.match(/\/admin\/operador\/proyecto\/(\d+)/) ||
                                 url.match(/\/operador\/proyecto\/(\d+)/)

            if (projectMatch) {
              const projectId = projectMatch[1]
              
              const existing = await db.projectsCache.get(Number(projectId))
              
              // Solo sincronizar si no existe o si se actualizó hace más de 1 hora en el servidor
              if (existing && Date.now() - new Date(existing.updatedAt || 0).getTime() < 3600000) {
                await db.projectsCache.update(Number(projectId), { lastAccessedAt: Date.now() });
                continue
              }

              try {
                // 1. Datos básicos y técnicos del proyecto
                const pResp = await fetch(`/api/projects/${projectId}`)
                if (pResp.ok) {
                  const projectData = await pResp.json()
                  await db.projectsCache.put({ ...projectData, lastAccessedAt: Date.now() })
                }
                await new Promise(r => setTimeout(r, 1500)) // 1.5s delay por seguridad

                // 2. Mensajes de chat (importante para historial offline)
                const cResp = await fetch(`/api/projects/${projectId}/messages`)
                if (cResp.ok) {
                  const messages = await cResp.json()
                  await db.chatCache.put({ projectId: Number(projectId), messages })
                }
                
                await new Promise(r => setTimeout(r, 1500)) // 1.5s delay entre proyectos
              } catch (err) {
                console.warn(`[Prefetch] Error al sincronizar proyecto ${projectId}`, err)
              }
            }
          }
          console.log('[Prefetch] Sincronización secuencial finalizada.');
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
