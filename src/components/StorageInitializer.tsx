'use client'

import { useEffect, useState } from 'react'
import { initStorage } from '@/lib/storage'
import { Capacitor } from '@capacitor/core'

export default function StorageInitializer({ children }: { children?: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize storage (SQLite for APK, Dexie for PWA)
        await initStorage()
        console.log('[StorageInitializer] Storage initialized')
        
        // FASE 3: Configurar Background Runner para sync offline
        if (Capacitor.isNativePlatform()) {
          try {
            const { configureBackgroundRunner, syncOutboxToKV, syncKVResultsToSQLite } = await import('@/lib/background-service')
            configureBackgroundRunner()
            // Sincronizar datos pendientes a KV y leer resultados del background runner
            await syncOutboxToKV()
            const syncedCount = await syncKVResultsToSQLite()
            if (syncedCount > 0) {
              console.log(`[StorageInitializer] ${syncedCount} items sincronizados desde background runner`)
            }
          } catch (bgErr) {
            console.warn('[StorageInitializer] Background runner config skipped:', bgErr)
          }
        }
        
        // NOTA: El registro FCM ahora solo se hace en NotificationPrompt.tsx
        // para evitar registros duplicados que causaban conflictos
        
        setInitialized(true)
      } catch (err) {
        console.warn('[StorageInitializer] Storage init failed:', err, 'Continue anyway with Dexie fallback')
        setInitialized(true)
      }
    }
    
    init()

    // ─── FASE 3: Sync periódico a CapacitorKV ─────────────────
    // Cada 30s exporta los items pendientes de SQLite a CapacitorKV
    // para que el Background Runner pueda procesarlos aunque la app
    // se minimice inmediatamente después de crear datos offline.
    let kvSyncInterval: ReturnType<typeof setInterval> | null = null
    if (Capacitor.isNativePlatform()) {
      kvSyncInterval = setInterval(async () => {
        try {
          const { syncOutboxToKV, syncKVResultsToSQLite } = await import('@/lib/background-service')
          await syncOutboxToKV()
          const syncedCount = await syncKVResultsToSQLite()
          if (syncedCount > 0) {
            console.log(`[StorageInitializer] ${syncedCount} items procesados desde background runner (periódico)`)
          }
        } catch {
          // Silencioso - no crítico
        }
      }, 30000) // Cada 30 segundos
    }

    return () => {
      if (kvSyncInterval) clearInterval(kvSyncInterval)
    }
  }, [])

  return <>{children}</>
}