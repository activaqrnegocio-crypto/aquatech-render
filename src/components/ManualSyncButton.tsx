'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db'

/**
 * ManualSyncButton — A standalone, zero-side-effect sync trigger.
 * 
 * Listens for bulk-cache-sync events from GlobalSyncWorker.
 * On mount, checks IndexedDB to determine if sync was already completed.
 */
export default function ManualSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [lastSyncLabel, setLastSyncLabel] = useState('')
  const [cooldown, setCooldown] = useState(false)
  const [syncFinished, setSyncFinished] = useState(false)

  // v338: On mount, check if sync was already completed
  useEffect(() => {
    (async () => {
      try {
        const meta = await db.cacheMetadata.toArray();
        const hasFinished = meta.some(m => m.status === 'idle' && m.lastSync && (Date.now() - m.lastSync) < 30 * 60 * 1000);
        if (hasFinished) {
          const lastMeta = meta.filter(m => m.status === 'idle').sort((a, b) => b.lastSync - a.lastSync)[0];
          if (lastMeta?.lastSync) {
            const label = new Date(lastMeta.lastSync).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
            setLastSyncLabel(label);
            setSyncFinished(true);
          }
        }
      } catch (e) {}
    })();
  }, []);

  // Listen for sync events from GlobalSyncWorker
  useEffect(() => {
    const handleProgress = (e: any) => {
      const { current, total } = e.detail || {}
      if (current != null && total != null) {
        setProgress({ current, total })
      }
    }

    const handleFinished = (e: any) => {
      setIsSyncing(false)
      setProgress({ current: 0, total: 0 })
      const label = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
      setLastSyncLabel(label)
      setSyncFinished(true)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 30000)
      // After 5 minutes, reset green state to normal
      setTimeout(() => setSyncFinished(false), 300000)
    }

    const handleLog = (e: any) => {
      const msg = e.detail?.message || ''
      if (msg.includes('Iniciando sincronización masiva')) {
        setIsSyncing(true)
        setSyncFinished(false)
      }
    }

    // v370: Cuando se crea un proyecto nuevo, se dispara trigger-bulk-sync.
    // Resetear el estado verde inmediatamente para no mentir al usuario.
    const handleForceSync = () => {
      setIsSyncing(true)
      setSyncFinished(false)
      setProgress({ current: 0, total: 0 })
    }

    window.addEventListener('bulk-cache-sync-progress', handleProgress)
    window.addEventListener('bulk-cache-sync-finished', handleFinished)
    window.addEventListener('bulk-cache-sync-log', handleLog)
    window.addEventListener('trigger-bulk-sync', handleForceSync)

    return () => {
      window.removeEventListener('bulk-cache-sync-progress', handleProgress)
      window.removeEventListener('bulk-cache-sync-finished', handleFinished)
      window.removeEventListener('bulk-cache-sync-log', handleLog)
      window.removeEventListener('trigger-bulk-sync', handleForceSync)
    }
  }, [])

  const handleSync = useCallback(() => {
    if (isSyncing || cooldown) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return // silently ignore when offline
    }
    setIsSyncing(true)
    setProgress({ current: 0, total: 0 })
    window.dispatchEvent(new CustomEvent('trigger-bulk-sync', {
      detail: { force: true }
    }))
  }, [isSyncing, cooldown])

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || cooldown}
      title={
        isSyncing 
          ? `Sincronizando... ${progress.total > 0 ? `${progress.current}/${progress.total}` : ''}`
          : cooldown 
            ? 'Espera unos segundos...'
            : lastSyncLabel 
              ? `Última sync: ${lastSyncLabel}` 
              : 'Sincronizar datos offline'
      }
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        fontSize: '0.82rem',
        fontWeight: 600,
        color: isSyncing ? 'var(--text-secondary, #888)' : syncFinished ? '#10b981' : 'var(--text-primary, #fff)',
        background: isSyncing 
          ? 'var(--bg-tertiary, rgba(255,255,255,0.05))' 
          : syncFinished
          ? 'rgba(16, 185, 129, 0.12)'
          : 'var(--bg-secondary, rgba(255,255,255,0.08))',
        border: syncFinished 
          ? '1px solid rgba(16, 185, 129, 0.3)' 
          : '1px solid var(--border-primary, rgba(255,255,255,0.1))',
        borderRadius: '10px',
        cursor: isSyncing || cooldown ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        opacity: cooldown && !isSyncing ? 0.5 : 1,
      }}
    >
      {/* Progress bar overlay */}
      {isSyncing && progress.total > 0 && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progressPercent}%`,
          background: 'rgba(0, 112, 192, 0.15)',
          transition: 'width 0.3s ease',
          borderRadius: '10px',
          pointerEvents: 'none',
        }} />
      )}

      {/* Icon */}
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: isSyncing ? 'spin 1s linear infinite' : 'none',
          flexShrink: 0,
        }}
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>

      {/* Label */}
      <span style={{ position: 'relative', zIndex: 1 }}>
        {isSyncing
          ? progress.total > 0
            ? `${progress.current}/${progress.total}`
            : 'Sincronizando...'
          : syncFinished
          ? `✓ ${lastSyncLabel}`
          : lastSyncLabel
          ? `Última: ${lastSyncLabel}`
          : 'Sincronizar'
        }
      </span>

      {/* Inline keyframe for the spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
