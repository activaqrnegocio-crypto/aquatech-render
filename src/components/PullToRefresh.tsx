'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Global Pull-to-Refresh for APK.
 * Mounted once in the root layout — works on every page.
 * On native platform only: swipe down from the very top triggers a full page reload.
 */
export default function PullToRefresh() {
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const isPulling = useRef(false)
  const THRESHOLD = 80

  useEffect(() => {
    // Only activate on native (APK)
    if (!Capacitor.isNativePlatform()) return

    const isAtTop = () => window.scrollY <= 0

    const onTouchStart = (e: TouchEvent) => {
      if (!isAtTop()) return
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return
      if (!isAtTop()) { isPulling.current = false; setPullY(0); return }

      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        // Rubber-band: resistance factor 0.4
        const clamped = Math.min(delta * 0.4, THRESHOLD + 30)
        setPullY(clamped)
      } else {
        isPulling.current = false
        setPullY(0)
      }
    }

    const onTouchEnd = () => {
      if (!isPulling.current) return
      isPulling.current = false

      setPullY(prev => {
        if (prev >= THRESHOLD && !isRefreshing) {
          setIsRefreshing(true)
          setTimeout(() => window.location.reload(), 500)
        } else {
          // Spring back
          setTimeout(() => setPullY(0), 10)
        }
        return prev
      })
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isRefreshing])

  // Don't render anything on PWA / web
  if (!Capacitor.isNativePlatform()) return null

  const progress = Math.min(pullY / THRESHOLD, 1)
  const ready = pullY >= THRESHOLD

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        height: `${pullY}px`,
        overflow: 'hidden',
        transition: isPulling.current ? 'none' : 'height 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
        paddingBottom: '6px',
      }}
    >
      {pullY > 8 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: 'opacity 0.1s',
          }}
        >
          {isRefreshing ? (
            /* Spinner while reloading */
            <div
              style={{
                width: '30px',
                height: '30px',
                border: '3px solid rgba(37,211,102,0.25)',
                borderTop: '3px solid #25d366',
                borderRadius: '50%',
                animation: 'ptr-spin 0.7s linear infinite',
              }}
            />
          ) : (
            /* Arrow — flips when threshold reached */
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#25d366"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: ready ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease',
                filter: 'drop-shadow(0 0 4px rgba(37,211,102,0.5))',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          <span
            style={{
              fontSize: '0.68rem',
              color: '#25d366',
              fontWeight: '700',
              letterSpacing: '0.02em',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            {isRefreshing
              ? 'Actualizando...'
              : ready
              ? '↑ Suelta para actualizar'
              : '↓ Jala para actualizar'}
          </span>
        </div>
      )}

      {/* Keyframe injected inline once */}
      <style>{`
        @keyframes ptr-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
