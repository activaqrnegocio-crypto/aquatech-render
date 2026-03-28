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
    
    // Only process QUOTE and MATERIAL in the global sync
    const globalItems = items.filter(i => i.type === 'QUOTE' || i.type === 'MATERIAL')
    if (globalItems.length === 0) return

    for (const item of globalItems) {
       try {
         await db.outbox.update(item.id!, { status: 'syncing' })
          let endpoint = ''
          if (item.type === 'QUOTE') endpoint = '/api/quotes'
          else if (item.type === 'MATERIAL') endpoint = '/api/materials'
          
          if (endpoint) {
             const res = await fetch(endpoint, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(item.payload)
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
