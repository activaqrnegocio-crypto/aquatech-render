'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * OfflinePrefetcher — pre-caches all given URLs so they work offline.
 * Uses both router.prefetch() (for RSC payloads) and SW message (for full pages).
 */
export default function OfflinePrefetcher({ urls }: { urls: string[] }) {
  const router = useRouter()

  useEffect(() => {
    if (!urls || urls.length === 0) return

    // 1. Use Next.js router.prefetch for RSC payload caching
    const timer = setTimeout(() => {
      urls.forEach(url => {
        try {
          router.prefetch(url)
        } catch (e) {
          // Silently ignore prefetch errors
        }
      })
    }, 1000) // Delay 1s to not block initial render

    // 2. Also tell the Service Worker to pre-cache these pages as full HTML
    const swTimer = setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        })
      }
    }, 3000) // Delay 3s to give SW time

    return () => {
      clearTimeout(timer)
      clearTimeout(swTimer)
    }
  }, [urls, router])

  return null
}
