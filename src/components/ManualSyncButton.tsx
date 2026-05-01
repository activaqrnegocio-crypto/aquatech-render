'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * ManualSyncButton — A standalone, zero-side-effect sync trigger.
 * 
 * It ONLY dispatches the 'trigger-bulk-sync' CustomEvent (already handled by GlobalSyncWorker)
 * and listens for progress/completion events. No direct DB, fetch, or router calls.
 */
export default function ManualSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [lastSyncLabel, setLastSyncLabel] = useState('')
  const [cooldown, setCooldown] = useState(false)

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
      setLastSyncLabel(new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }))
      // Cooldown: prevent spamming (30 seconds)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 30000)
    }

    const handleLog = (e: any) => {
      // If GlobalSyncWorker emits a log about starting, mark us as syncing
      const msg = e.detail?.message || ''
      if (msg.includes('Iniciando')) {
        setIsSyncing(true)
      }
    }

    window.addEventListener('bulk-cache-sync-progress', handleProgress)
    window.addEventListener('bulk-cache-sync-finished', handleFinished)
    window.addEventListener('bulk-cache-sync-log', handleLog)

    return () => {
      window.removeEventListener('bulk-cache-sync-progress', handleProgress)
      window.removeEventListener('bulk-cache-sync-finished', handleFinished)
      window.removeEventListener('bulk-cache-sync-log', handleLog)
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
        color: isSyncing ? 'var(--text-secondary, #888)' : 'var(--text-primary, #fff)',
        background: isSyncing 
          ? 'var(--bg-tertiary, rgba(255,255,255,0.05))' 
          : 'var(--bg-secondary, rgba(255,255,255,0.08))',
        border: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
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
