'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState, useMemo, memo } from 'react'
import { hasModuleAccess } from '@/lib/rbac'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { formatToEcuador } from '@/lib/date-utils'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  subItems?: { label: string; href: string }[]
}

type NavSection = {
  section: string
  items: NavItem[]
}

const adminNavItems: NavSection[] = [
  {
    section: 'GENERAL',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        label: 'Marketing',
        href: '/admin/marketing',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        ),
      },
      {
        label: 'Blog',
        href: '/admin/blog',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            <path d="M8 7h6" />
            <path d="M8 11h8" />
          </svg>
        ),
      },
      {
        label: 'Calendario Maestro',
        href: '/admin/calendario',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
            <path d="M16 18h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'GESTIÓN',
    items: [
      {
        label: 'Proyectos',
        href: '/admin/proyectos',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          </svg>
        ),
        subItems: [
          { label: 'Proyectos', href: '/admin/proyectos' },
          { label: 'Gestión de Equipo', href: '/admin/team' },
          { label: 'Reportes', href: '/admin/reportes' },
        ]
      },
      {
        label: 'Cotizaciones',
        href: '/admin/cotizaciones',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        ),
      },
      {
        label: 'Inventario',
        href: '/admin/inventario',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        ),
      },
      {
        label: 'Recursos',
        href: '/admin/recursos',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'SISTEMA',
    items: [
      {
        label: 'Conectar Telefono',
        href: '/admin/whatsapp',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        ),
      },
    ],
  },
]

// Fase 7: memo() prevents re-renders from parent layout state changes
export default memo(function Sidebar() {
  const pathname = usePathname()
  // Fase 6: Removed unused useSearchParams() — was causing re-renders on every navigation
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenus, setOpenMenus] = useLocalStorage<Record<string, boolean>>('sidebar_open_menus', {
    'Proyectos': true,
    'Mis Proyectos': true,
    'Proyecto Actual': true,
  })
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // v400: Robust Navigation — Force hard navigation when switching between major modules
  // to prevent soft-navigation freezes caused by active Dexie listeners/SW Shell.
  const handleNav = (href: string, e: React.MouseEvent) => {
    // If we are in a project detail or any complex path, soft navigation is risky
    const isComplexPath = pathname.includes('/proyecto/') || pathname.includes('/nuevo') || pathname.includes('/shell');
    
    // Always force hard nav for these top-level modules to ensure clean state
    const isTopLevelModule = href.startsWith('/admin/calendario') || 
                             href.startsWith('/admin/inventario') || 
                             href.startsWith('/admin/cotizaciones') ||
                             href.startsWith('/admin/recursos');

    if (isComplexPath || isTopLevelModule) {
      e.preventDefault();
      setMobileOpen(false);
      window.location.href = href;
    } else {
      // Fallback to soft navigation for same-module items, handled by Link default
      setMobileOpen(false);
    }
  }

  const [offlineUser, setOfflineUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any>({ totalUnread: 0, byProject: {} })

  // v273: Enhanced Unified Sync Monitoring
  const syncMeta = useLiveQuery(() => db.cacheMetadata.get('projects_bulk'))
  const pendingOutboxCount = useLiveQuery(() => db.outbox.count()) || 0
  
  const [dataSync, setDataSync] = useState<{ current: number, total: number, active: boolean, label?: string, isManual?: boolean }>({ 
    current: 0, total: 0, active: false, isManual: false 
  });
  const [assetSync, setAssetSync] = useState<{ current: number, total: number, active: boolean, label?: string }>({ 
    current: 0, total: 0, active: false 
  })

  useEffect(() => {
    const channel = new BroadcastChannel('aquatech-sync');
    channel.onmessage = (event) => {
      const { type, current, total, projectName } = event.data;
      
      if (type === 'DATA_SYNC_START') {
        setDataSync({ current: 0, total, active: true, label: 'Sincronizando Proyectos...', isManual: !!event.data.isManual });
      } else if (type === 'DATA_SYNC_PROGRESS') {
        setDataSync(prev => ({ ...prev, current, total, active: true, label: projectName || 'Actualizando...' }));
      } else if (type === 'DATA_SYNC_FINISHED') {
        setDataSync(prev => ({ ...prev, active: false }));
      } else if (type === 'ASSET_PRECACHE_PROGRESS') {
        setAssetSync({ current, total, active: true, label: 'Optimizando Offline...' });
      } else if (type === 'ASSET_PRECACHE_FINISHED') {
        setAssetSync(prev => ({ ...prev, active: false }));
      }
    };

    // v302: Service Worker Heartbeat — Listen for real-time chunk download status
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ASSETS_CACHED') {
        const pendingCount = event.data.count || 0;
        if (pendingCount > 0) {
          setAssetSync(prev => ({ 
            ...prev, 
            active: true, 
            label: 'Optimizando...', 
            current: prev.total > 0 ? (prev.total - pendingCount) : 0,
            total: prev.total || pendingCount 
          }));
        } else {
          // If SW reports 0 pending, and we are not in a broadcast bulk-precache session
          setAssetSync(prev => ({ ...prev, active: false }));
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      channel.close();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);


  // v302: Silent Sync Logic — Only show "Sincronizando" (Blue) for heavy Asset Sync, 
  // Manual Sync (user-triggered), or when there are actual items pending in the outbox.
  // Regular background data refreshes (JSON) remain "Green" (Ready) to maintain a consistent system state.
  const isActuallySyncing = assetSync.active || (dataSync.active && (pendingOutboxCount > 0 || dataSync.isManual));

  // Hooks para datos de sesión y permisos (Siempre al principio)
  const effectiveRole = useMemo(() => {
    if (status === 'loading') {
      // v284: Only use localStorage if mounted to avoid hydration mismatch (#418)
      if (mounted && typeof window !== 'undefined') {
        const stored = localStorage.getItem('last_user_role');
        if (stored) return stored.toUpperCase();
      }
      return '';
    }
    
    const role = session?.user?.role || offlineUser?.role;
    const finalRole = String(role || 'OPERATOR').toUpperCase();
    
    if (mounted && typeof window !== 'undefined' && finalRole) {
      localStorage.setItem('last_user_role', finalRole);
    }
    
    return finalRole;
  }, [session, offlineUser, status, mounted])
  
  const effectiveName = useMemo(() => session?.user?.name || offlineUser?.name || (status === 'loading' ? '...' : 'Usuario'), [session, offlineUser, status])
  const isAdmin = useMemo(() => {
    if (effectiveRole === '') {
      // v284: Only use URL heuristic if mounted
      if (mounted && typeof window !== 'undefined') {
        const path = window.location.pathname;
        return path.startsWith('/admin') && !path.includes('/operador') && !path.includes('/subcontratista');
      }
      return false;
    }
    return (effectiveRole.includes('ADMIN') || effectiveRole === 'SUPERADMIN');
  }, [effectiveRole, mounted])
  const isSubcontratista = useMemo(() => effectiveRole === 'SUBCONTRATISTA', [effectiveRole])
  const userPermissions = useMemo(() => (session?.user as any)?.permissions || offlineUser?.permissions || null, [session, offlineUser])
  
  const userInitials = useMemo(() => effectiveName
    ?.split(' ')
    .map((n: any) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AD', [effectiveName])

  const projectIdMatch = pathname.match(/\/admin\/(operador|subcontratista)\/proyecto\/(\d+)/)
  const projectId = projectIdMatch ? projectIdMatch[2] : null

  const navItems = useMemo(() => {
    const panelBase = isSubcontratista ? '/admin/subcontratista' : '/admin/operador'
    const currentProjectId = projectId

    if (isAdmin) {
      return adminNavItems.map(section => ({
        ...section,
        items: section.items.filter(item => {
          const moduleSlug = item.label.toLowerCase().replace(/\s+/g, '_')
          const slugMap: Record<string, string> = {
            'dashboard': 'dashboard',
            'marketing': 'marketing',
            'blog': 'blog',
            'calendario_maestro': 'calendario',
            'proyectos': 'proyectos',
            'cotizaciones': 'cotizaciones',
            'inventario': 'inventario',
            'recursos': 'recursos',
            'conectar_telefono': 'whatsapp'
          }
          const slug = slugMap[moduleSlug] || moduleSlug
          if (slug === 'whatsapp' && effectiveRole !== 'SUPERADMIN') return false
          return hasModuleAccess(userPermissions, slug, effectiveRole)
        })
      })).filter(section => section.items.length > 0)
    }

    // Operator Logic
    const dynamicOperatorNavItems: NavSection[] = [
      {
        section: 'Workspace',
        items: [
          {
            label: 'Mis Proyectos',
            href: panelBase,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            ),
          },
          ...(currentProjectId ? [{
            label: 'Proyecto Actual',
            href: `${panelBase}/proyecto/${currentProjectId}`,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            ),
            subItems: [
              { label: 'Registros', href: `${panelBase}/proyecto/${currentProjectId}?view=records` },
              { label: 'Chat', href: `${panelBase}/proyecto/${currentProjectId}?view=chat` },
            ],
          }] : []),
        ],
      },
      ...(!isSubcontratista ? [{
        section: 'Herramientas y Recursos',
        items: [
          {
            label: 'Cotizaciones',
            href: '/admin/cotizaciones',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
            ),
          },
          {
            label: 'Inventario',
            href: '/admin/inventario',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            ),
          },
          {
            label: 'Recursos',
            href: '/admin/recursos',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            ),
          },
        ]
      }] : [])
    ]

    const additionalAdminItemsReady = adminNavItems.flatMap(sec => sec.items).filter(item => {
      const moduleSlug = item.label.toLowerCase().replace(/\s+/g, '_')
      const slugMap: Record<string, string> = {
        'dashboard': 'dashboard',
        'marketing': 'marketing',
        'blog': 'blog',
        'calendario_maestro': 'calendario',
        'proyectos': 'proyectos_admin'
      }
      const slug = slugMap[moduleSlug] || moduleSlug
      if (['cotizaciones', 'inventario', 'recursos', 'conectar_telefono'].includes(slug)) return false;
      return hasModuleAccess(userPermissions, slug, effectiveRole)
    }).map(item => {
      if (item.subItems) {
         const newSubs = item.subItems.filter(sub => {
           const l = sub.label.toLowerCase().replace(/\s+/g, '_')
           const sSlug = l === 'gestión_de_equipo' ? 'equipo' : l;
           return hasModuleAccess(userPermissions, sSlug, effectiveRole)
         })
         return { ...item, subItems: newSubs }
      }
      return item;
    }).filter(item => item.label !== 'Proyectos' || (item.subItems && item.subItems.length > 0));

    const finalOperatorNav = [...dynamicOperatorNavItems];
    if (additionalAdminItemsReady.length > 0) {
      finalOperatorNav.push({ section: 'MÓDULOS ADMINISTRATIVOS', items: additionalAdminItemsReady });
    }

    return finalOperatorNav.map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (additionalAdminItemsReady.some(a => a.label === item.label)) return true;
        const moduleSlug = item.label.toLowerCase().replace(/\s+/g, '_')
        const slugMap: Record<string, string> = {
          'mis_proyectos': 'proyectos',
          'proyecto_actual': 'proyectos',
          'cotizaciones': 'cotizaciones',
          'inventario': 'inventario',
          'recursos': 'recursos'
        }
        const slug = slugMap[moduleSlug] || moduleSlug
        return hasModuleAccess(userPermissions, slug, effectiveRole)
      })
    })).filter(section => section.items.length > 0)
  }, [session, offlineUser, pathname, effectiveRole, isSubcontratista, isAdmin, userPermissions, projectId])

  // Efectos (Después de useMemo)
  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      if (document.visibilityState !== 'visible' || (typeof navigator !== 'undefined' && !navigator.onLine)) return
      // v273: Small delay for the very first fetch to avoid congestion
      await new Promise(r => setTimeout(r, 3000));
      try {
        const resp = await fetch('/api/notifications/summary')
        if (resp.ok && isMounted) {
          const data = await resp.json()
          setNotifications(data)
        }
      } catch (e) { 
        if (navigator.onLine) console.warn('Notification fetch failed', e) 
      }
    }

    fetchNotifications()
    // v271: Removed aggressive setInterval to prevent 502 Server Exhaustion
    return () => { isMounted = false; }
  }, [status])
  
  useEffect(() => {
    if (status === 'unauthenticated' || (!session && status !== 'loading')) {
      import('@/lib/db').then(({ db }) => {
        db.auth.get('last_session').then(u => {
          if (u) setOfflineUser(u)
        })
      }).catch(() => {})
    }
  }, [session, status])

  const handleLogout = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      }
      import('dexie').then((m) => {
        const Dexie = m.default;
        Dexie.delete('AquatechOfflineDB').catch(() => {})
      }).catch(() => {})
      localStorage.clear()
      sessionStorage.clear()
      if (typeof window !== 'undefined' && 'caches' in window) {
        const names = await caches.keys()
        for (const name of names) {
          if (name !== 'aquatech-static' && name !== 'aquatech-fonts') await caches.delete(name)
        }
      }
      await signOut({ redirect: false })
    } catch (e) {
      console.warn('Offline logout fallback', e)
    }
    window.location.href = '/admin/login'
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isParentActive = (item: NavItem) => {
    if (pathname === item.href || pathname.startsWith(item.href + '/')) return true
    if (item.subItems?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'))) return true
    return false
  }

  const toggleMenu = (label: string, e: React.MouseEvent) => {
    e.preventDefault()
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      <div className="mobile-header">
        <button className="mobile-header-menu" onClick={() => setMobileOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="mobile-header-title">A<span>Q</span>UATECH</div>
      </div>

      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="Aquatech" className="sidebar-brand-logo" />
          <div>
            <div className="sidebar-brand-text">A<span>Q</span>UATECH</div>
            <span className="sidebar-brand-sub">innovación hidráulica</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => (
                <div key={item.href}>
                  {item.subItems ? (
                    <>
                      <button 
                        className={`sidebar-link ${isParentActive(item) ? 'active' : ''}`}
                        onClick={(e) => toggleMenu(item.label, e)}
                        style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.icon}
                          {item.label}
                          {item.label === 'Proyectos' && (notifications?.totalUnread || 0) > 0 && (
                            <span className="notification-badge">{notifications.totalUnread}</span>
                          )}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: openMenus[item.label] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      
                      {openMenus[item.label] && (
                        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '28px', marginTop: '4px', gap: '2px', borderLeft: '1px solid var(--border-color)', marginLeft: '12px' }}>
                          {item.subItems.map(subItem => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              prefetch={false}
                              className={`sidebar-link ${isActive(subItem.href) ? 'active' : ''}`}
                              onClick={(e) => handleNav(subItem.href, e)}
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      prefetch={false}
                      className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                      onClick={(e) => handleNav(item.href, e)}
                    >
                      {item.icon}
                      {item.label}
                      {item.label === 'Mis Proyectos' && (notifications?.totalUnread || 0) > 0 && (
                        <span className="notification-badge">{notifications.totalUnread}</span>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* v273: Unified Sync Status Indicator */}
        <div style={{ 
          padding: '12px 20px', 
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          backgroundColor: isActuallySyncing ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isActuallySyncing ? '#38bdf8' : '#10b981',
              boxShadow: isActuallySyncing ? '0 0 10px #38bdf8' : '0 0 10px #10b981',
              animation: isActuallySyncing ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ fontWeight: 600, color: isActuallySyncing ? 'var(--text)' : 'var(--text-muted)' }}>
              {isActuallySyncing ? 'Sincronizando...' : 'Sistema Listo (Offline)'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {pendingOutboxCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                <span>Subiendo cambios:</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{pendingOutboxCount}</span>
              </div>
            )}
            
            {dataSync.active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.65rem' }}>{dataSync.label}</span>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(dataSync.current / dataSync.total) * 100}%`, 
                    height: '100%', 
                    background: '#38bdf8',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {assetSync.active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                  <span style={{ fontSize: '0.65rem' }}>Archivos de Sistema</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(assetSync.current / assetSync.total) * 100}%`, 
                    height: '100%', 
                    background: '#10b981',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
            
            {!isActuallySyncing && syncMeta?.lastSync && (
              <div style={{ opacity: 0.5, fontSize: '0.6rem', marginTop: '2px' }}>
                Última sincronización: {formatToEcuador(syncMeta.lastSync, { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className={`sidebar-user ${isAdmin ? 'admin-no-profile' : ''}`} onClick={handleLogout}>
            {!isAdmin ? (
              <>
                <div className="sidebar-avatar">{userInitials}</div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{effectiveName}</div>
                  <div className="sidebar-user-role">
                    {effectiveRole === 'SUBCONTRATISTA' ? 'Subcontratista' : 'Operador'}
                  </div>
                </div>
              </>
            ) : (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">
                  {effectiveRole === 'SUPERADMIN' ? 'Super Admin' : effectiveRole === 'ADMIN' ? 'Administrador' : 'Administradora'} {effectiveName.split(' ')[0]}
                </div>
                <div className="sidebar-user-role" style={{ color: 'var(--danger)', marginTop: '2px' }}>
                  Cerrar Sesión
                </div>
              </div>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>
      </aside>

      {status !== 'loading' && (
      <nav className="mobile-nav">
        {isAdmin ? (
          <>
            {[
              { label: 'Dashboard', href: '/admin', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
              { label: 'Proyectos', href: '/admin/proyectos', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg> },
              { label: 'Calendario', href: '/admin/calendario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg> },
              { label: 'Inventario', href: '/admin/inventario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              { label: 'Cotizaciones', href: '/admin/cotizaciones', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
                onClick={(e) => handleNav(item.href, e)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </>
        ) : (
          <>
            {[
              { label: 'Mis Proyectos', href: '/admin/operador', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
              { label: 'Calendario', href: hasModuleAccess(userPermissions, 'calendario', effectiveRole) ? '/admin/calendario' : '/admin/operador?tab=calendario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg> },
              { label: 'Inventario', href: '/admin/inventario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              { label: 'Cotizaciones', href: '/admin/cotizaciones', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
                onClick={(e) => handleNav(item.href, e)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </>
        )}


        <button className="mobile-nav-item" onClick={handleLogout} style={{ background: 'none', border: 'none' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Salir
        </button>
      </nav>
      )}
    </>
  )
})
