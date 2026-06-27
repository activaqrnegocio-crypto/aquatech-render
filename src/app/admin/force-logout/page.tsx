'use client'

import { signOut } from 'next-auth/react'
import { useEffect } from 'react'

// Variable a nivel de MÓDULO — sobrevive remounts causados por React #418.
// useRef se resetea en cada remount; esta variable NO.
let forceLogoutExecuted = false

export default function ForceLogoutPage() {
  useEffect(() => {
    if (forceLogoutExecuted) {
      console.log('[ForceLogout] Ya ejecutado, ignorando remount duplicado')
      return
    }
    forceLogoutExecuted = true

    async function doLogout() {
      console.log('[ForceLogout] Ejecutando logout forzado...')
      
      // Leer userId ANTES de limpiar localStorage
      const userId = localStorage.getItem('logout_user_id') || undefined
      console.log('[ForceLogout] UserID:', userId)
      
      // 1. Invalidar sesión en servidor (incrementar sessionVersion)
      if (userId) {
        try {
          await fetch('/api/auth/force-logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          })
          console.log('[ForceLogout] Sesión invalidada en servidor')
        } catch (e) {
          console.log('[ForceLogout] API error (continuando):', e)
        }
      }

      // 2. Limpiar pending nav (evita navegación al proyecto anterior)
      try {
        const { clearPendingNavAfterUse } = await import('@/lib/pending-nav')
        await clearPendingNavAfterUse()
        console.log('[ForceLogout] Pending nav limpiado')
      } catch (e) {}
      
      // 3. Limpiar Capacitor Preferences
      try {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.clear()
        console.log('[ForceLogout] Capacitor Preferences cleared')
      } catch (e) {}

      // 4. Limpiar localStorage y sessionStorage
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {}

      // 5. Limpiar Dexie last_session
      try {
        const { db } = await import('@/lib/db')
        await db.auth.delete('last_session')
        console.log('[ForceLogout] Dexie last_session eliminado')
      } catch (e) {
        try {
          const { default: Dexie } = await import('dexie')
          await Dexie.delete('AquatechOfflineDB')
        } catch (e2) {}
      }

      // 6. Limpiar caches de auth del SW (no el shell de la app)
      try {
        if ('caches' in window) {
          const names = await caches.keys()
          const authCaches = names.filter(n => 
            n.includes('auth') || n.includes('user-data') || n.includes('session')
          )
          await Promise.all(authCaches.map(name => caches.delete(name)))
        }
      } catch (e) {}
      
      console.log('[ForceLogout] Cleanup completo. Cerrando sesión con redirect...')

      // 7. v622: CRÍTICO - usar signOut con redirect:true en lugar de redirect:false + window.location
      //
      // PROBLEMA: signOut({ redirect: false }) usa fetch(). En el WebView de Capacitor,
      // los Set-Cookie de respuestas fetch() NO se honran. El JWT cookie httpOnly quedaba
      // vivo. Entonces la login page veía al usuario autenticado, lo redirigía a /admin,
      // el servidor invalidaba la sesión (sessionVersion mismatch), redirigía a /admin/login
      // → LOOP INFINITO → React #418.
      //
      // SOLUCIÓN: signOut({ redirect: true }) hace un POST de formulario a /api/auth/signout.
      // La respuesta del servidor incluye Set-Cookie para borrar el JWT cookie.
      // El WebView SÍ honra Set-Cookie en navegaciones completas (no en fetch).
      // El JWT se borra limpiamente → no más loop de redirects → no más React #418.
      await signOut({
        redirect: true,
        callbackUrl: '/admin/login?loggedOut=1&t=' + Date.now()
      })
    }
    
    doLogout()

    return () => {
      // Cuando el componente se desmonta limpiamente (navegación a login),
      // resetear la bandera para que un futuro logout legítimo pueda correr.
      // Nota: si el desmonte fue por #418, React remontará y la bandera ya
      // está en true → se ignora el remount. Correcto.
      // Solo reseteamos si el logout completó (via signOut redirect).
    }
  }, [])
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cerrando sesión...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}