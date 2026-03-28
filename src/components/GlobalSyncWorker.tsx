'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/db'

export default function GlobalSyncWorker() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const syncOutbox = async () => {
    if (!navigator.onLine) return
    const items = await db.outbox.where('status').equals('pending').toArray()
    
    // Only process QUOTE and MATERIAL in the global sync to avoid duplicating
    // the logic inside OperatorProjectClient for messaging and expenses
    const globalItems = items.filter(i => i.type === 'QUOTE' || i.type === 'MATERIAL')
    if (globalItems.length === 0) return

    for (const item of globalItems) {
       try {
         await db.outbox.update(item.id!, { status: 'syncing' })
         
          let endpoint = ''
          if (item.type === 'QUOTE') {
            endpoint = '/api/quotes'
          } else if (item.type === 'MATERIAL') {
            endpoint = '/api/materials'
          }
          
          if (endpoint) {
             const res = await fetch(endpoint, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(item.payload)
             })
             if (res.ok) {
                 await db.outbox.delete(item.id!)
             } else {
                 await db.outbox.update(item.id!, { status: 'failed' })
             }
          }
       } catch (e) {
          await db.outbox.update(item.id!, { status: 'pending' })
       }
    }
  }

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) syncOutbox()
    }
    
    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    
    // Auto-sync interval checking for orphaned quotes/materials
    const interval = setInterval(() => {
        if (navigator.onLine) syncOutbox()
    }, 20000)

    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      clearInterval(interval)
    }
  }, [])

  return null // This acts purely as a background worker injected into the layout
}
