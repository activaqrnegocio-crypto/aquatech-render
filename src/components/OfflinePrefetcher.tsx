'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

/**
 * OfflinePrefetcher — pre-caches all given URLs so they work offline.
 * Upgraded: Now also fetches JSON data for projects and chats to populate Dexie.
 * 
 * v373: WiFi-only mode — skips prefetch on mobile data to avoid consuming
 * the operator's cellular data plan. Only prefetches on WiFi/Ethernet.
 */
export default function OfflinePrefetcher({ urls }: { urls: string[] }) {
  useEffect(() => {
    if (!urls || urls.length === 0) return

    // v373: Check connection type — only skip on cellular/mobile data
    const connection = (navigator as any).connection
    if (connection) {
      const isCellular = connection.type === 'cellular' || connection.type === 'bluetooth'
      const isSaveData = connection.saveData === true
      
      if (isCellular || isSaveData) {
        console.log('[Prefetch] Skipped — on cellular data or data saver mode (' + 
          (connection.type || 'unknown') + ', saveData=' + isSaveData + ')')
        return
      }
    }
    // If navigator.connection is not available (Safari/Firefox), 
    // allow prefetch — better to cache than not

    // SW Data Prefetch (v279: Wait 12s to ensure navigation is fully finished)
    // We only ask the SW to cache the URLs (Offline Shells) using its throttled logic.
    // We explicitly AVOID router.prefetch here because calling it 30 times exhausts the Prisma DB Pool!
    const dataTimer = setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // v359: Cache BOTH HTML and RSC payloads for each URL
        // This ensures Link navigation works (RSC) and hard refresh works (HTML)
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls: urls
        })

        // v359: Specifically request RSC versions of the pages for instant navigation
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls: urls.map(u => u.includes('?') ? `${u}&_rsc=pre` : `${u}?_rsc=pre`),
          options: { isRsc: true }
        })
      }
    }, 12000)

    return () => {
      clearTimeout(dataTimer)
    }
  }, [urls])

  return null
}
