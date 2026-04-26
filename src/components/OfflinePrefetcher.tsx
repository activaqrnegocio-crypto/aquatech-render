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

    // 2. SW and Data Prefetch (Increased delay to 5s to let UI breathe)
    const dataTimer = setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // HTML Caching (SW now handles this with chunks and timeouts)
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        })
      }

      // 3. DEEP DATA PREFETCH: Populate Dexie for projects, chats and global entities
      // Only run this if we are online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const prefetchSequentially = async () => {
          // A. Global Entities (for forms and lists)
          try {
            // Clients
            const clientsResp = await fetch('/api/clients')
            if (clientsResp.ok) {
              const clients = await clientsResp.json()
              if (Array.isArray(clients)) {
                await db.clientsCache.clear()
                await db.clientsCache.bulkPut(clients)
              }
            }
            
            // Materials
            const matResp = await fetch('/api/materials')
            if (matResp.ok) {
              const materials = await matResp.json()
              if (Array.isArray(materials)) {
                await db.materialsCache.clear()
                await db.materialsCache.bulkPut(materials)
              }
            }

            // Team
            await fetch('/api/users?roles=OPERATOR,SUBCONTRATISTA').catch(() => {})

            console.log('[Prefetch] Global data cached in Dexie')
          } catch (e) {
            console.warn('[Prefetch] Global data fetch failed', e)
          }

          for (const url of urls) {
            // Check if it's a project detail page
            const projectMatch = url.match(/\/(admin|operador)\/proyectos\/(\d+)/) || url.match(/\/admin\/proyectos\/(\d+)/)
            if (projectMatch) {
              const projectId = projectMatch[2] || projectMatch[1]
              
              // Skip if already in cache and not forced
              const existing = await db.projectsCache.get(Number(projectId))
              if (existing && Date.now() - new Date(existing.updatedAt || 0).getTime() < 3600000) {
                continue // Skip if updated in the last hour
              }

              try {
                // A. Fetch Project Detail JSON
                const pResp = await fetch(`/api/projects/${projectId}`)
                if (pResp.ok) {
                  const projectData = await pResp.json()
                  await db.projectsCache.put(projectData)
                }

                // B. Fetch Chat Messages JSON
                const cResp = await fetch(`/api/projects/${projectId}/messages`)
                if (cResp.ok) {
                  const messages = await cResp.json()
                  await db.chatCache.put({ projectId: Number(projectId), messages })
                }
                
                console.log(`[Prefetch] Data cached for project ${projectId}`)
                // Small delay to avoid saturating the browser
                await new Promise(r => setTimeout(r, 500))
              } catch (err) {
                console.warn(`[Prefetch] Failed to cache data for project ${projectId}`, err)
              }
            }
          }
        }
        prefetchSequentially()
      }
    }, 5000)

    return () => {
      clearTimeout(timer)
      clearTimeout(dataTimer)
    }
  }, [urls, router])

  return null
}
