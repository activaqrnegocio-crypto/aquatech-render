'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

export default function BackButtonHandler() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    // Dynamic import to avoid errors during SSR (Next.js compilation)
    let activeListener: any = null

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        // If we are at the main screens (root /, login, admin dashboard), minimize the app
        if (pathname === '/' || pathname === '/login' || pathname === '/admin' || pathname === '/admin/dashboard' || !canGoBack) {
          App.minimizeApp()
        } else {
          // Otherwise, navigate back in history
          window.history.back()
        }
      }).then(listener => {
        activeListener = listener
      })
    })

    return () => {
      if (activeListener) {
        activeListener.remove()
      }
    }
  }, [pathname])

  return null
}
