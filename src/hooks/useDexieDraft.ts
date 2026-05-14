'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db'

/**
 * Like useLocalStorage but backed by IndexedDB (Dexie).
 * CRITICAL: Unlike localStorage, IndexedDB uses structured clone — preserving File/Blob objects.
 * This fixes video files being corrupted when the page is refreshed or PWA reloads.
 */
export function useDexieDraft<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from Dexie on mount
  useEffect(() => {
    let cancelled = false
    db.drafts.get(key).then((entry) => {
      if (cancelled) return
      if (entry && entry.value !== undefined) {
        setStoredValue(entry.value as T)
      }
      setIsHydrated(true)
    }).catch(() => {
      if (!cancelled) setIsHydrated(true)
    })
    return () => { cancelled = true }
  }, [key])

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const nextValue = value instanceof Function ? value(prev) : value
      // Persist to IndexedDB (supports File objects via structured clone)
      db.drafts.put({ key, value: nextValue }).catch((err) => {
        console.warn(`[useDexieDraft] Failed to persist "${key}":`, err)
      })
      return nextValue
    })
  }, [key])

  const removeValue = useCallback(() => {
    setStoredValue(initialValue)
    db.drafts.delete(key).catch(() => {})
  }, [key, initialValue])

  return [storedValue, setValue, removeValue, isHydrated] as const
}
