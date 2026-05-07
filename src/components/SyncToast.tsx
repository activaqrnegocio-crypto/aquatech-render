'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ToastMessage {
  id: number
  label: string
  type: string
  success: boolean
  timestamp: number
}

let toastIdCounter = 0
const MAX_TOASTS = 3
const TOAST_DURATION = 4000

// v372: Iconos por tipo de sync
function getIcon(type: string): string {
  switch (type) {
    case 'GALLERY_UPLOAD':
    case 'GALLERY_DELETE':
    case 'GALLERY_RENAME':
      return '🖼️'
    case 'MESSAGE':
    case 'MEDIA_UPLOAD':
      return '💬'
    case 'PROJECT':
    case 'PROJECT_UPDATE':
      return '📋'
    case 'EXPENSE':
      return '💰'
    case 'TASK':
      return '📅'
    case 'DAY_START':
      return '▶️'
    case 'DAY_END':
      return '⏹️'
    case 'TEAM_UPDATE':
      return '👥'
    case 'PHASE_COMPLETE':
    case 'PHASE_CREATE':
      return '✅'
    default:
      return '🔄'
  }
}

function getColor(type: string): string {
  if (type === 'GALLERY_UPLOAD' || type === 'GALLERY_DELETE' || type === 'GALLERY_RENAME') return '#d946ef'
  if (type === 'MESSAGE' || type === 'MEDIA_UPLOAD') return '#3b82f6'
  if (type === 'PROJECT' || type === 'PROJECT_UPDATE') return '#10b981'
  if (type === 'EXPENSE') return '#f59e0b'
  if (type === 'TASK') return '#8b5cf6'
  if (type === 'DAY_START' || type === 'DAY_END') return '#06b6d4'
  if (type === 'PHASE_COMPLETE' || type === 'PHASE_CREATE') return '#22c55e'
  return '#6b7280'
}

export default function SyncToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((label: string, type: string, success: boolean) => {
    const id = ++toastIdCounter
    const toast: ToastMessage = { id, label, type, success, timestamp: Date.now() }
    
    setToasts(prev => {
      const next = [...prev, toast]
      // Keep only last MAX_TOASTS
      return next.slice(-MAX_TOASTS)
    })

    const timer = setTimeout(() => removeToast(id), TOAST_DURATION)
    timersRef.current.set(id, timer)
  }, [removeToast])

  // Listen for sync-success events from GlobalSyncWorker
  useEffect(() => {
    const handleSyncSuccess = (e: any) => {
      if (e.detail?.label) {
        addToast(e.detail.label, e.detail.type, true)
      }
    }
    window.addEventListener('sync-success', handleSyncSuccess)
    return () => window.removeEventListener('sync-success', handleSyncSuccess)
  }, [addToast])

  // Listen for SW messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETED' && event.data?.label) {
        addToast(event.data.label, event.data.itemType, event.data.success !== false)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage)
  }, [addToast])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '16px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const color = getColor(toast.type)
        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1px solid ${color}44`,
              borderLeft: `4px solid ${color}`,
              borderRadius: '12px',
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}22`,
              backdropFilter: 'blur(12px)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              pointerEvents: 'auto',
              animation: 'syncToastIn 0.3s ease-out',
              maxWidth: '320px',
              minWidth: '200px',
              transition: 'opacity 0.3s, transform 0.3s',
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getIcon(toast.type)}</span>
            <span style={{ flex: 1, lineHeight: 1.3 }}>{toast.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        )
      })}
      <style>{`
        @keyframes syncToastIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
