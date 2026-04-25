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
        // HTML Caching
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        })

        // RSC Payload Caching
        urls.forEach(url => {
          fetch(url, { headers: { 'RSC': '1' } }).catch(() => {})
        })
      }

      // 3. DEEP DATA PREFETCH: Populate Dexie for projects and chats
      // Only run this if we are online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        urls.forEach(async (url) => {
          // Check if it's a project detail page: /admin/proyectos/[id] or /operador/proyectos/[id]
          const projectMatch = url.match(/\/(admin|operador)\/proyectos\/(\d+)/)
          if (projectMatch) {
            const projectId = projectMatch[2]
            
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
            } catch (err) {
              console.warn(`[Prefetch] Failed to cache data for project ${projectId}`, err)
            }
          }
        })
      }
    }, 3000)

    return () => {
      clearTimeout(timer)
      clearTimeout(dataTimer)
    }
  }, [urls, router])

  return null
}
