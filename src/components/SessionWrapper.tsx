'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// vSESSION: Persistir sesión JWT en APK/Capacitor para que no se cierre al reiniciar
const SESSION_KEY = 'nextauth_jwt_token'

async function restoreNativeSession() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return
  
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const stored = await Preferences.get({ key: SESSION_KEY })
    
    if (stored.value) {
      console.log('[SessionWrapper] ✓ Sesión nativa restaurada')
      document.cookie = `next-auth.session-token=${stored.value}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`
    }
  } catch (e) {
    console.warn('[SessionWrapper] Error restaurando sesión:', e)
  }
}

async function saveNativeSession(token: string) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return
  
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: SESSION_KEY, value: token })
  } catch (e) {
    console.warn('[SessionWrapper] Error guardando sesión:', e)
  }
}

// Componente que restaura sesión ANTES de que cargue el resto de la app
function SessionRestorer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      restoreNativeSession()
      
      // Guardar sesión cada vez que cambie la cookie
      const observer = new MutationObserver(() => {
        const cookies = document.cookie.split(';')
        const tokenCookie = cookies.find(c => c.trim().startsWith('next-auth.session-token='))
        if (tokenCookie) {
          const token = tokenCookie.split('=')[1]?.trim()
          if (token) saveNativeSession(token)
        }
      })
      
      observer.observe(document, { childList: true, subtree: true })
      return () => observer.disconnect()
    }
  }, [])
  
  return <>{children}</>
}

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionRestorer>
      <SessionProvider>
        {children}
      </SessionProvider>
    </SessionRestorer>
  )
}
