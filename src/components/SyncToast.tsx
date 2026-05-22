'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ToastMessage {
  id: number
  label: string
  type: string
  success: boolean
  timestamp: number
  projectId?: string | number  // v440: For gallery toasts — force refresh on click
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

  const addToast = useCallback((label: string, type: string, success: boolean, projectId?: string | number) => {
    const id = ++toastIdCounter
    const toast: ToastMessage = { id, label, type, success, timestamp: Date.now(), projectId }
    
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
        // v440: Pass projectId for gallery types so clicking the toast refreshes gallery
        addToast(e.detail.label, e.detail.type, true, e.detail.projectId)
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
    <div className="sync-toast-container" style={{
      position: 'fixed',
      bottom: '85px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const color = getColor(toast.type)
        const isGalleryType = toast.type === 'GALLERY_UPLOAD' || toast.type === 'MEDIA_UPLOAD';
        return (
          <div
            key={toast.id}
            onClick={() => {
              if (isGalleryType && toast.projectId) {
                // v440: Dispatch force-gallery-refresh so ProjectExecutionClient
                // shows the synced photo/video immediately without manual refresh
                window.dispatchEvent(new CustomEvent('force-gallery-refresh', {
                  detail: { projectId: toast.projectId }
                }));
              }
              removeToast(toast.id);
            }}
            className="sync-toast-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: 'rgba(15, 23, 42, 0.98)',
              border: `1px solid ${color}44`,
              borderLeft: `5px solid ${color}`,
              borderRadius: '16px',
              boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 20px ${color}22`,
              backdropFilter: 'blur(16px)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isGalleryType ? 'pointer' : 'default',
              pointerEvents: 'auto',
              maxWidth: '350px',
              minWidth: '220px',
              transition: 'opacity 0.3s, transform 0.3s',
            }}
          >
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{getIcon(toast.type)}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>
              {toast.label}
              {isGalleryType && (
                <span style={{ display: 'block', fontSize: '0.7rem', color: `${color}cc`, marginTop: '2px', fontWeight: 400 }}>
                  Toca para ver →
                </span>
              )}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                fontSize: '0.75rem',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px'
              }}
            >
              ✕
            </button>
          </div>
        )
      })}
      <style>{`
        .sync-toast-container {
          right: 20px;
          align-items: flex-end;
        }
        .sync-toast-item {
          animation: syncToastInDesktop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes syncToastInDesktop {
          from { opacity: 0; transform: translateX(50px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes syncToastInMobile {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 768px) {
          .sync-toast-container {
            left: 0 !important;
            right: 0 !important;
            bottom: 95px !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 16px;
            align-items: center;
            transform: none !important;
          }
          .sync-toast-item {
            width: 100%;
            max-width: 380px;
            animation: syncToastInMobile 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
        }
      `}</style>
    </div>
  )
}
