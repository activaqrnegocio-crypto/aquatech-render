'use client'

import './admin.css'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import StorageInitializer from '@/components/StorageInitializer'
import NotificationPrompt from '@/components/NotificationPrompt'
import NativePluginsPrefetcher from '@/components/NativePluginsPrefetcher'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

import { useSession } from 'next-auth/react'
import OfflineErrorBoundary from '@/components/OfflineErrorBoundary'

// Fase 2: Dynamic import — these are invisible background workers (51KB + 1KB)
// They don't affect visual render, so they load AFTER the UI paints
const GlobalSyncWorker = dynamic(() => import('@/components/GlobalSyncWorker'), { ssr: false })
const OfflinePrefetcher = dynamic(() => import('@/components/OfflinePrefetcher'), { ssr: false })
const SyncToast = dynamic(() => import('@/components/SyncToast'), { ssr: false })
import { useState, useEffect, useRef } from 'react'
import { getAndClearPendingNav, checkPendingNav, parseProjectChatUrl, initPushRouteListener, clearPendingNavFile, clearPendingNavAfterUse } from '@/lib/pending-nav'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  // v621: force_logout_pending ya no se usa (centralizado en force-logout page)
  // Mantenemos la verificación por compatibilidad con versiones anteriores
  useEffect(() => {
    const forceLogout = localStorage.getItem('force_logout_pending')
    if (forceLogout === '1') {
      console.log('[AdminLayout] Force logout legacy detectado, redirigiendo...')
      localStorage.removeItem('force_logout_pending')
      window.location.replace('/admin/force-logout')
    }
  }, [])

  // v622: Redirect inmediato cuando la sesión es inválida en páginas protegidas
  // Esto elimina el efecto "parece logueado" al reabrir la app después del logout.
  // Sin esto, la UI autenticada se muestra durante ~2s mientras NextAuth verifica.
  useEffect(() => {
    if (status === 'unauthenticated') {
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/force-logout')) {
        console.log('[AdminLayout] Sesión inválida, redirigiendo a login...')
        window.location.replace('/admin/login?expired=1')
      }
    }
  }, [status])

  // v423: USAR REF para evitar race conditions
  const pendingNavRef = useRef(false);
  
  // Función para procesar navegación pendiente  // v621: Delay reducido para cold start (2s en lugar de 8s)
  // Se salta si no hay sesión activa (login/logout no necesitan pending nav)
  async function processPendingNav(retries = 12, delayMs = 1000) {
    // v621: NO procesar si estamos en login o force-logout
    const currentPath = window.location.pathname
    if (currentPath.includes('/login') || currentPath.includes('/force-logout')) {
      console.log('[PendingNav] En página de auth, omitiendo pending nav');
      return;
    }

    // v600: VERIFICAR SI HAY DATOS PENDIENTES antes de procesar
    // Esto evita ejecuciones innecesarias cuando no hay nada que procesar
    const hasPending = await checkPendingNav();
    if (!hasPending) {
      console.log('[PendingNav] No hay datos pendientes, salir');
      return;
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      // v456: Si ya procesamos, salir del bucle
      if (pendingNavRef.current) {
        console.log('[PendingNav] Ya procesado, saliendo del bucle');
        return;
      }
      
      // v500: Tambien verificar flag global
      if ((window as any).__pendingNavDone) {
        console.log('[PendingNav] __pendingNavDone=true, salir');
        return;
      }
      
      console.log('[PendingNav] Intento', attempt, 'de', retries);
      
      // v621: Delay para cold start - reducido de 8s -> 2s pero con espera de sesión
      if (attempt === 1) {
        console.log('[PendingNav] Esperando inicialización cold start (2s)...');
        await new Promise(r => setTimeout(r, 2000));
        
        // v621: Verificar si nos redirigieron a auth page DURANTE el delay
        const pathNow = window.location.pathname
        if (pathNow.includes('/login') || pathNow.includes('/force-logout')) {
          console.log('[PendingNav] Redirigido a auth page durante delay, cancelando');
          return;
        }
        
        // v621: Si no hay sesión, esperar hasta 6s más (notificaciones en cold start lento)
        if (!session) {
          console.log('[PendingNav] Sin sesión, esperando hasta 6s para cold start...');
          for (let wait = 0; wait < 6; wait++) {
            await new Promise(r => setTimeout(r, 1000));
            const pathCheck = window.location.pathname
            if (pathCheck.includes('/login') || pathCheck.includes('/force-logout')) {
              console.log('[PendingNav] Redirigido a auth page en espera, cancelando');
              return;
            }
            if (session) break; // sesión cargó!
          }
          // Si después de 8s totales sigue sin sesión, cancelar
          if (!session) {
            console.log('[PendingNav] Sin sesión tras 8s, cancelando pending nav');
            return;
          }
        }
      }
      
      const pending = await getAndClearPendingNav();
      if (!pending?.url) {
        // Reintentar con delay (no en primer intento ya tuvo delay)
        if (attempt < retries) {
          console.log('[PendingNav] Reintentando en', delayMs, 'ms...');
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        console.log('[PendingNav] No hay pending navigation despues de', retries, 'intentos');
        return;
      }

      // MARCAR INMEDIATAMENTE (v456 - evitar reintentos que sobrescriben)
      (window as any).__pendingNavDone = true;
      pendingNavRef.current = true; // v456: Marcar ref también
      
      // v624: Si la URL es absoluta (ej: http://192.168.100.43:3443/admin/...), extraer solo el pathname
      // Esto evita que Capacitor/Android intente abrirla en Chrome como una URL externa.
      let rawUrl = pending.url;
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        try {
          const parsedUrl = new URL(rawUrl);
          rawUrl = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
          console.log('[PendingNav] URL absoluta convertida a relativa:', rawUrl);
        } catch (e) {
          console.error('[PendingNav] Error parsing absolute URL:', e);
        }
      }
      
      console.log('[PendingNav] URL recibida:', rawUrl);

      // Extraer projectId
      let projectId = '';
      if (rawUrl.includes('URL_PROJECT_CHAT:')) {
        projectId = rawUrl.replace('URL_PROJECT_CHAT:', '').split(':')[0];
      } else if (rawUrl.includes('URL_PROJECT:')) {
        projectId = rawUrl.replace('URL_PROJECT:', '');
      }
      
      // OBTENER ROL DEL USUARIO para navegar correctamente
      // Primero intentar de session, luego de localStorage
      let userRole = 'ADMIN';
      try {
        if (session?.user?.role) {
          userRole = session.user.role as string;
          // También guardar en localStorage para frío start
          localStorage.setItem('last_user_role', userRole);
        } else {
          userRole = localStorage.getItem('last_user_role') || 'ADMIN';
        }
      } catch (e) {}
      console.log('[PendingNav] User role:', userRole);
      
      // v457: Detectar si es cold start (app iniciada desde cero vs minimizada)
      // En cold start, router.replace() puede no funcionar correctamente
      const isColdStart = !pathname || pathname === '/' || pathname === '';
      
      // Navegar según el rol del usuario
      // v457: Usar window.location.href en cold start, router.replace() en app ya abierta
      if (projectId) {
        const targetPath = userRole === 'OPERATOR' || userRole === 'OPERADOR' || userRole === 'SUBCONTRATISTA'
          ? `/admin/operador/proyecto/${projectId}?view=CHAT`
          : `/admin/proyectos/${projectId}?view=CHAT`;
        
        console.log('[PendingNav] Navegando a:', targetPath, '(coldStart:', isColdStart, ')');
        
        // v456: MARCAR como hecho ANTES de navegar (evita reintentos que sobrescriben)
        pendingNavRef.current = true;
        
        // v457: Navigation diferente según tipo de inicio
        if (isColdStart) {
          // Cold start: usar window.location.href para garantizar navegación
          window.location.href = targetPath;
        } else {
          // App ya abierta: usar router.replace() (más suave)
          router.replace(targetPath);
        }
        
        // v456: Limpiar después de navegación
        setTimeout(() => {
          clearPendingNavAfterUse();
          console.log('[PendingNav] Limpieza post-navegación');
        }, 500);
      } else {
        // Sin projectId - ir a dashboard
        pendingNavRef.current = true;
        if (isColdStart) {
          window.location.href = '/admin';
        } else {
          router.push('/admin');
        }
        setTimeout(() => {
          clearPendingNavAfterUse();
        }, 500);
      }
      
      return;
    }
  }
  
  useEffect(() => {
    // v436: Guardar el rol del usuario cuando la sesión está disponible
    if (session?.user?.role) {
      const userRole = session.user.role as string;
      localStorage.setItem('last_user_role', userRole);
      console.log('[AdminLayout] Rol guardado desde sesión:', userRole);
    }
    
    // v429: Inicializar listener para pushRoute desde Android nativo
    initPushRouteListener();
    
    console.log('[AdminLayout] Ejecutando handlePendingNav');
    processPendingNav();
    
    // APP ABIERTA EN FOREGROUND: escuchar eventos pushRoute directamente
    const handlePushRoute = (event: Event) => {
      console.log('[PendingNav] pushRoute evento recibido (app abierta):', (event as CustomEvent).detail);
      // v600: Ya no reseteamos flag - checkPendingNav verificará si hay datos
      // (window as any).__pendingNavDone = false;
      // Procesar la nueva ruta
      processPendingNav();
    };
    
    window.addEventListener('pushRoute', handlePushRoute as EventListener);
    
    return () => {
      window.removeEventListener('pushRoute', handlePushRoute as EventListener);
    };
  }, [session]); // Incluir session para guardar el rol
  
  // useEffect PARA APP MINIMIZADA - detectar cuando vuelve del background
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[PendingNav] App visible (volviendo de minimize)');
        // v600: Ya no reseteamos flag - checkPendingNav verificará si hay datos
        // (window as any).__pendingNavDone = false;
        // Delay para dar tiempo al nativo de escribir pending route
        await new Promise(r => setTimeout(r, 1500));
        // Procesar cualquier ruta pendiente
        await processPendingNav();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Show progress bar on path change
    setIsNavigating(true)
    const timer = setTimeout(() => setIsNavigating(false), 1000)
    return () => clearTimeout(timer)
  }, [pathname])

  const isLoginPage = pathname === '/admin/login'
  const isDashboard = 
    pathname === '/admin' || pathname === '/admin/' || 
    pathname === '/admin/operador' || pathname === '/admin/operador/' ||
    pathname === '/admin/subcontratista' || pathname === '/admin/subcontratista/' ||
    pathname === '/admin/proyectos' || pathname === '/admin/proyectos/'

  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine pages to pre-cache for offline availability
  const getPagesToPrefetch = () => {
    if (!session?.user) return []
    const role = (session.user as any).role
    const isOp = role === 'OPERATOR' || role === 'OPERADOR' || role === 'SUBCONTRATISTA'
    
    if (isOp) {
      const base = role === 'SUBCONTRATISTA' ? '/admin/subcontratista' : '/admin/operador'
      return [base, `${base}/nuevo`, `${base}/proyecto/offline-shell`, '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
    }
    return ['/admin', '/admin/proyectos', '/admin/proyectos/offline-shell', '/admin/proyectos/nuevo', '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
  }

  const pagesToPrefetch = getPagesToPrefetch()

  const [showSync, setShowSync] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  
  useEffect(() => {
    // v273: Delay heavy background workers to let the main page load first
    const timer = setTimeout(() => setShowSync(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Popup de advertencia de primera carga online
  useEffect(() => {
    if (status === 'authenticated' && typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem('aquatech_welcome_sync_v1')
      if (!hasSeen) {
        setShowWelcomeModal(true)
      }
    }
  }, [status])

  const handleCloseWelcomeModal = () => {
    localStorage.setItem('aquatech_welcome_sync_v1', 'true')
    setShowWelcomeModal(false)
  }


  if (isLoginPage) {
    return <main>{children}</main>
  }

  // v625: Evitar desmontar Sidebar/Layout durante la navegación suave.
  // Solo mostramos el spinner de pantalla completa en la carga inicial de la aplicación.
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    if (status !== 'loading') {
      setInitialLoadDone(true)
    }
  }, [status])

  const isAuthOrForceLogout = isLoginPage || pathname === '/admin/force-logout'
  const shouldShowLoader = !isAuthOrForceLogout && (!initialLoadDone && (status === 'loading' || status === 'unauthenticated'))

  if (shouldShowLoader) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-deep)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <ServiceWorkerRegistration />
      <StorageInitializer />
      <NotificationPrompt />
      {showSync && (
        <>
          <GlobalSyncWorker />
          <NativePluginsPrefetcher />
          <OfflinePrefetcher urls={pagesToPrefetch} />
          <SyncToast />
        </>
      )}

      {/* ── POPUP DE PRIMERA SINCRONIZACIÓN — solo una vez ── */}
      {showWelcomeModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.4); } 50% { box-shadow: 0 0 0 12px rgba(56,189,248,0); } }
          `}</style>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}>
            {/* Icono */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'pulse-ring 2.5s ease-in-out infinite'
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <circle cx="12" cy="20" r="1" fill="white"/>
              </svg>
            </div>

            {/* Título */}
            <h2 style={{
              margin: '0 0 8px', fontSize: '1.4rem', fontWeight: '700',
              color: '#f1f5f9', letterSpacing: '-0.02em'
            }}>
              ¡Bienvenido a Aquatech!
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5' }}>
              Para usar la app sin internet, sigue estos pasos <strong style={{ color: '#38bdf8' }}>una sola vez</strong>:
            </p>

            {/* Pasos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', textAlign: 'left' }}>
              {[
                { num: '1', icon: '📶', text: 'Abre la app estando conectado a internet' },
                { num: '2', icon: '🔄', text: 'Navega por los proyectos y espera que aparezca el indicador verde (Sincronizado)' },
                { num: '3', icon: '✅', text: '¡Listo! Ya puedes usar la app sin internet' },
              ].map(step => (
                <div key={step.num} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px', padding: '12px 14px'
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: '800', color: 'white',
                    flexShrink: 0, marginTop: '1px'
                  }}>{step.num}</span>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                    {step.icon} {step.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Indicador de referencia */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '20px', padding: '6px 14px', marginBottom: '24px',
              fontSize: '0.8rem', color: '#4ade80'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Así se ve el indicador verde de sincronizado
            </div>

            {/* Botón */}
            <button
              onClick={handleCloseWelcomeModal}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                border: 'none', borderRadius: '12px',
                color: 'white', fontSize: '0.95rem', fontWeight: '700',
                cursor: 'pointer', letterSpacing: '0.01em',
                boxShadow: '0 4px 20px rgba(14,165,233,0.35)',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              ¡Entendido, voy a sincronizar! 🚀
            </button>
          </div>
        </div>
      )}
      {/* ── FIN POPUP ── */}
      <Sidebar />
      {isNavigating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '3px',
          background: 'linear-gradient(90deg, var(--primary) 0%, #38bdf8 50%, var(--primary) 100%)',
          zIndex: 9999,
          width: '100%',
          animation: 'shimmer 2s infinite linear'
        }}>
          <style jsx>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}
      <main className="admin-content">
        {!isOnline && (
          <div style={{
            background: '#f59e0b', color: 'white', padding: '10px 20px', 
            textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem',
            position: 'sticky', top: 0, zIndex: 50,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            📡 Modo Offline — Los cambios se guardarán y sincronizarán automáticamente
          </div>
        )}
        <OfflineErrorBoundary>
          {!isDashboard && (
            <div style={{ padding: '10px 20px 0 20px', marginBottom: '-10px' }}>
              <button 
                onClick={() => {
                  // v400: Use hard navigation (window.location.href) to prevent
                  // soft-navigation freeze caused by Service Worker shell + Dexie listeners
                  // staying active and blocking Next.js router transitions.
                  if (pathname.includes('/operador/proyecto')) {
                    window.location.href = '/admin/operador';
                  } else if (pathname.includes('/subcontratista/proyecto')) {
                    window.location.href = '/admin/subcontratista';
                  } else if (pathname.includes('/admin/proyectos/')) {
                    window.location.href = '/admin/proyectos';
                  } else if (pathname.includes('/admin/cotizaciones/')) {
                    window.location.href = '/admin/cotizaciones';
                  } else if (pathname.includes('/offline-shell')) {
                    const isOp = pathname.includes('/operador') || pathname.includes('/subcontratista');
                    window.location.href = isOp 
                      ? (pathname.includes('/subcontratista') ? '/admin/subcontratista' : '/admin/operador') 
                      : '/admin/proyectos';
                  } else {
                    // Fallback: explicit hard navigation based on current path
                    if (pathname.startsWith('/admin/operador')) window.location.href = '/admin/operador';
                    else if (pathname.startsWith('/admin/subcontratista')) window.location.href = '/admin/subcontratista';
                    else if (pathname.startsWith('/admin/proyectos')) window.location.href = '/admin/proyectos';
                    else if (pathname.startsWith('/admin/cotizaciones')) window.location.href = '/admin/cotizaciones';
                    else if (pathname.startsWith('/admin/calendario')) window.location.href = '/admin/calendario';
                    else if (pathname.startsWith('/admin/inventario')) window.location.href = '/admin/inventario';
                    else window.location.href = '/admin';
                  }
                }}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span>Volver</span>
              </button>
            </div>
          )}
          {/* Fase 1: Suspense boundary — Sidebar/Header/Footer render INSTANTLY,
              page content shows skeleton while loading */}
          <Suspense fallback={
            <div style={{ padding: '24px' }}>
              <div style={{ height: '28px', width: '220px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: '180px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
            </div>
          }>
            {children}
          </Suspense>
        </OfflineErrorBoundary>
      </main>
    </div>
  )
}
