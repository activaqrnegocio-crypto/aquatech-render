'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

/**
 * useProjectCache — Hook compartido Admin + Operador
 * 
 * Centraliza TODA la lógica de recuperación offline desde Dexie (IndexedDB).
 * Ambos componentes (ProjectDetailClient y ProjectExecutionClient) usaban
 * código casi idéntico para:
 *   - Extraer ID del proyecto desde la URL
 *   - Recuperar datos cacheados de Dexie (projectsCache, chatCache)
 *   - Polling de reintentos cuando los datos no están listos
 *   - Normalización de datos cacheados (estructuras viejas de IndexedDB)
 *   - Detección de modo offline
 *   - Deduplicación de mensajes
 *   - Background sync trigger
 */

interface UseProjectCacheOptions {
  /** Rol del usuario: 'admin' o 'operator' (determina el path de URL) */
  role: 'admin' | 'operator'
  /** Datos iniciales del proyecto desde el servidor (SSR props) */
  initialProject: any
  /** Mensajes de chat iniciales desde el servidor */
  initialChat?: any[]
  /** Gastos iniciales desde el servidor (solo operador) */
  initialExpenses?: any[]
}

export function useProjectCache({
  role,
  initialProject,
  initialChat,
  initialExpenses
}: UseProjectCacheOptions) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAdmin = role === 'admin'

  // ─── ID Extraction (Robust — handles shells, trailing slashes, mobile fallback) ───
  const idFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return isAdmin ? '' : 0
    const path = window.location.pathname

    // 1. Try URL params (operator)
    if (!isAdmin) {
      const params = new URLSearchParams(window.location.search)
      const qId = params.get('id')
      if (qId && /^\d+$/.test(qId)) return Number(qId)
    }

    // 2. Regex from path
    const match = path.match(/\/proyecto[s]?\/(\d+)/i)
    if (match) return isAdmin ? match[1] : Number(match[1])

    // 3. Last segment (numeric only)
    const segments = path.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && /^\d+$/.test(last)) return isAdmin ? last : Number(last)

    // 4. Mobile fallback from sessionStorage
    const isOp = path.includes('/operador/')
    const storageKey = isOp ? 'last_op_project_id' : 'last_admin_project_id'
    if (path.includes('offline-shell') && typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) return isAdmin ? stored : Number(stored)
    }

    return isAdmin ? '' : 0
  }, [pathname, searchParams, isAdmin])

  // ─── Persist ID for shell recovery ───
  useEffect(() => {
    if ((isAdmin && idFromUrl) || (!isAdmin && Number(idFromUrl) > 0)) {
      if (typeof window !== 'undefined') {
        const isOp = window.location.pathname.includes('/operador/')
        const storageKey = isOp ? 'last_op_project_id' : 'last_admin_project_id'
        sessionStorage.setItem(storageKey, idFromUrl.toString())
      }
    }
  }, [idFromUrl, isAdmin])

  // ─── Background Sync Helper ───
  const triggerBackgroundSync = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      if ('sync' in reg) {
        await (reg as any).sync.register('sync-outbox')
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
      }
    } catch (e) {
      console.warn('Background sync registration failed:', e)
    }
  }, [])

  // ─── State ───
  const [localProject, setLocalProject] = useState<any>(null)
  const [localChat, setLocalChat] = useState<any[]>([])
  const [cacheNotFound, setCacheNotFound] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)
  const hasRecoveredRef = useRef(false)

  // ─── Identity Check ───
  const isIdentityMismatch = initialProject && idFromUrl &&
    Number(initialProject.id) !== Number(idFromUrl)
  const project = isIdentityMismatch
    ? { ...initialProject, isSkeleton: true, title: 'Cargando...' }
    : (localProject || initialProject)

  // ─── Dexie Recovery Effect ───
  useEffect(() => {
    const numericId = Number(idFromUrl)
    if (!numericId || numericId <= 0) return

    // Already have the correct project (not a skeleton)
    if (project && Number(project.id) === numericId && !project.isSkeleton) {
      setIsSyncingOffline(false)
      hasRecoveredRef.current = true
      return
    }

    setIsSyncingOffline(true)
    let cancelled = false
    let pollInterval: NodeJS.Timeout | null = null

    const handleSyncDone = () => {
      if (!hasRecoveredRef.current && !cancelled) tryRecover()
    }

    async function tryRecover(): Promise<boolean> {
      try {
        // v375: If we are Online and have real server data, don't overwrite with cache
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine
        if (isOnline && initialProject && !initialProject.isSkeleton && Number(initialProject.id) === numericId) {
          hasRecoveredRef.current = true // v375: Mark as recovered to stop polling
          return true
        }

        const cached = await db.projectsCache.get(idFromUrl) ||
          (!isNaN(numericId) ? await db.projectsCache.get(numericId) : null)

        if (cached && !cancelled) {
          // Normalize: IndexedDB may store older structures without 'user' object
          const normalizedProject = {
            ...cached,
            team: (cached.team || []).map((m: any) => {
              const u = m.user || {};
              return {
                ...m,
                user: {
                  id: u.id || m.userId || m.id || 0,
                  name: u.name || m.name || 'Operador',
                  phone: u.phone || m.phone || ''
                }
              };
            })
          }
          setLocalProject(normalizedProject)

          const chat = await db.chatCache.get(idFromUrl) ||
            (!isNaN(numericId) ? await db.chatCache.get(numericId) : null)

          const rawMessages = chat?.messages || []
          const normalizedMessages = rawMessages.map((m: any) => ({
            ...m,
            userName: m.userName || m.user?.name || 'Usuario',
          }))
          setLocalChat(normalizedMessages)
          setIsSyncingOffline(false)
          setCacheNotFound(false)
          hasRecoveredRef.current = true
          return true
        }
      } catch (err) {
        console.warn('[Recovery] Dexie error:', err)
      }
      return false
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    setIsOfflineMode(isOffline)

    let retries = 0
    const MAX_RETRIES = 10

    // Immediate attempt
    tryRecover()

    pollInterval = setInterval(async () => {
      if (cancelled || hasRecoveredRef.current) {
        if (pollInterval) clearInterval(pollInterval)
        return
      }
      retries++
      const found = await tryRecover()
      if (found || retries >= MAX_RETRIES) {
        if (pollInterval) clearInterval(pollInterval)
        if (!found && !cancelled) {
          setIsSyncingOffline(false)
          setCacheNotFound(true)
        }
      }
    }, 1000)

    window.addEventListener('bulk-cache-sync-finished', handleSyncDone)

    // If server data arrived correctly, update local state and refresh cache
    if (initialProject && !initialProject.isSkeleton && !isIdentityMismatch) {
      setLocalProject(initialProject)
      setLocalChat(initialProject.chatMessages || [])
      db.projectsCache.put({ ...initialProject, lastAccessedAt: Date.now() }).catch(() => {})
      if (initialProject?.chatMessages?.length > 0) {
        db.chatCache.put({
          projectId: initialProject.id,
          messages: initialProject.chatMessages
        }).catch(() => {})
      }
    }

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
      window.removeEventListener('bulk-cache-sync-finished', handleSyncDone)
    }
  }, [idFromUrl, initialProject?.id, initialProject?.isSkeleton])

  // ─── Pending Items from Outbox ───
  const pendingItems = useLiveQuery(async () => {
    const all = await db.outbox.toArray()
    // String comparison to avoid type mismatch (Number vs String)
    return all.filter(item => String(item.projectId) === String(idFromUrl))
  }, [idFromUrl]) || []

  // ─── Message Deduplication ───
  const deduplicateMessages = useCallback((messages: any[]) => {
    const seenIds = new Set()
    const result: any[] = []

    // Prioritize real numeric IDs over temp/pending strings
    const sorted = [...messages].sort((a, b) => {
      const aIsTemp = typeof a.id === 'string' && (a.id.startsWith('temp-') || a.id.startsWith('pending-'))
      const bIsTemp = typeof b.id === 'string' && (b.id.startsWith('temp-') || b.id.startsWith('pending-'))
      if (aIsTemp && !bIsTemp) return 1
      if (!aIsTemp && bIsTemp) return -1
      return 0
    })

    for (const msg of sorted) {
      if (typeof msg.id === 'number') {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id)
          result.push(msg)
        }
      } else {
        const isDuplicate = result.some(rm =>
          rm.content === msg.content &&
          rm.type === msg.type &&
          Math.abs(new Date(rm.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 45000
        )
        if (!isDuplicate && !seenIds.has(msg.id)) {
          seenIds.add(msg.id)
          result.push(msg)
        }
      }
    }
    return result.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [])

  // ─── Return ───
  return {
    // Core
    idFromUrl,
    project,
    localProject,
    localChat,
    setLocalProject,
    setLocalChat,

    // Status
    isOfflineMode,
    isSyncingOffline,
    cacheNotFound,
    isIdentityMismatch,

    // Helpers
    triggerBackgroundSync,
    deduplicateMessages,
    pendingItems,
    isAdmin,

    // Raw access
    pathname,
  }
}
