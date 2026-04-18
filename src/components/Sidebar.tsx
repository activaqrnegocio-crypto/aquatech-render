'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { hasModuleAccess } from '@/lib/rbac'

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

import { useLocalStorage } from '@/hooks/useLocalStorage'

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const chatView = searchParams.get('view') === 'chat' || pathname.includes('/proyecto/') && (pathname.endsWith('/chat') || searchParams.get('view') === 'chat')
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenus, setOpenMenus] = useLocalStorage<Record<string, boolean>>('sidebar_open_menus', {
    'Proyectos': true,
    'Mis Proyectos': true,
    'Proyecto Actual': true,
  })
  const [offlineUser, setOfflineUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any>({ totalUnread: 0, byProject: {} })

  // --- NOTIFICATION POLLING ---
  useEffect(() => {
    const fetchNotifications = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const resp = await fetch('/api/notifications/summary')
        if (resp.ok) {
          const data = await resp.json()
          setNotifications(data)
        }
      } catch (e) { console.warn('Notification fetch failed', e) }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000) // Every 10 seconds
    return () => clearInterval(interval)
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
      // Unsubscribe from push if active
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        } catch (e) {}
      }
      
      // Clear offline db immediately
      import('dexie').then((m) => {
        const Dexie = m.default;
        Dexie.delete('AquatechOfflineDB').catch(() => {})
      }).catch(() => {})
      
      localStorage.clear()
      sessionStorage.clear()

      // Flush Service Worker Caches
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const names = await caches.keys()
          for (const name of names) {
            await caches.delete(name)
          }
        } catch (e) {}
      }
      
      // Attempt NextAuth signout (will fail if fully offline, but that's fine)
      await signOut({ redirect: false })
    } catch (e) {
      console.warn('Offline logout fallback', e)
    }
    
    // Force hard reload to login page
    window.location.href = '/admin/login'
  }
  if (status === 'loading' && !offlineUser) {
    return (
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="Aquatech" className="sidebar-brand-logo" />
          <div className="sidebar-brand-text">A<span>Q</span>UATECH</div>
        </div>
        <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cargando...</div>
      </aside>
    )
  }

  const effectiveRole = String(session?.user?.role || offlineUser?.role || 'OPERATOR').toUpperCase()
  const effectiveName = session?.user?.name || offlineUser?.name || 'Usuario'
  const isAdmin = effectiveRole.includes('ADMIN') || effectiveRole === 'SUPERADMIN'
  const isSuperAdmin = effectiveRole === 'SUPERADMIN'
  const isSubcontratista = effectiveRole === 'SUBCONTRATISTA'
  const userPermissions = (session?.user as any)?.permissions || null

  const projectIdMatch = pathname.match(/\/admin\/(operador|subcontratista)\/proyecto\/(\d+)/)
  const projectId = projectIdMatch ? projectIdMatch[2] : null
  const panelBase = isSubcontratista ? '/admin/subcontratista' : '/admin/operador'

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
        ...(projectId ? [{
          label: 'Proyecto Actual',
          href: `${panelBase}/proyecto/${projectId}`,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            </svg>
          ),
          subItems: [
            { label: 'Registros', href: `${panelBase}/proyecto/${projectId}?view=records` },
            { label: 'Bitácora', href: `${panelBase}/proyecto/${projectId}?view=chat` },
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

  const filteredAdminNavItems = adminNavItems.map(section => ({
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
      
      if (slug === 'whatsapp' && effectiveRole !== 'SUPERADMIN') {
        return false
      }
      
      if (!hasModuleAccess(userPermissions, slug, effectiveRole)) {
        return false
      }

      return true
    })
  })).filter(section => section.items.length > 0)

  const additionalAdminItems = adminNavItems.flatMap(sec => sec.items).filter(item => {
    const moduleSlug = item.label.toLowerCase().replace(/\s+/g, '_')
    const slugMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'marketing': 'marketing',
      'blog': 'blog',
      'calendario_maestro': 'calendario',
      'proyectos': 'proyectos_admin'
    }
    const slug = slugMap[moduleSlug] || moduleSlug
    
    // Skip operator base modules
    if (['cotizaciones', 'inventario', 'recursos', 'conectar_telefono'].includes(slug)) return false;
    
    return hasModuleAccess(userPermissions, slug, effectiveRole)
  });

  const additionalAdminItemsReady = additionalAdminItems.map(item => {
    if (item.subItems) {
       const newSubs = item.subItems.filter(sub => {
         const l = sub.label.toLowerCase().replace(/\s+/g, '_')
         const sSlug = l === 'gestión_de_equipo' ? 'equipo' : l;
         return hasModuleAccess(userPermissions, sSlug, effectiveRole)
       })
       return { ...item, subItems: newSubs }
    }
    return item;
  }).filter(item => {
    if (item.label === 'Proyectos' && (!item.subItems || item.subItems.length === 0)) {
        // Operators have their own "Mis Proyectos", hide default admin "Proyectos" unless it has allowed subItems (like Reportes, Equipo)
        return false; 
    }
    return true;
  });

  const operatorWithExtras = [...dynamicOperatorNavItems];
  if (additionalAdminItemsReady.length > 0) {
    operatorWithExtras.push({
      section: 'MÓDULOS ADMINISTRATIVOS',
      items: additionalAdminItemsReady
    });
  }

  const filteredOperatorNavItems = operatorWithExtras.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (additionalAdminItemsReady.includes(item)) return true;

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

  const navItems = isAdmin ? filteredAdminNavItems : filteredOperatorNavItems as NavSection[]

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

  const userInitials = effectiveName
    ?.split(' ')
    .map((n: any) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AD'

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="mobile-header-menu" onClick={() => setMobileOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="mobile-header-title">
          A<span>Q</span>UATECH
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="Aquatech" className="sidebar-brand-logo" />
          <div>
            <div className="sidebar-brand-text">
              A<span>Q</span>UATECH
            </div>
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
                          {item.label === 'Proyectos' && notifications.totalUnread > 0 && (
                            <span className="notification-badge">{notifications.totalUnread}</span>
                          )}
                          {item.label === 'Mis Proyectos' && notifications.totalUnread > 0 && (
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
                              className={`sidebar-link ${isActive(subItem.href) ? 'active' : ''}`}
                              onClick={() => setMobileOpen(false)}
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                            >
                              {subItem.label}
                              {subItem.label === 'Bitácora' && projectId && notifications.byProject[projectId] > 0 && (
                                <span className="notification-badge small">{notifications.byProject[projectId]}</span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.icon}
                      {item.label}
                      {item.label === 'Mis Proyectos' && notifications.totalUnread > 0 && (
                        <span className="notification-badge">{notifications.totalUnread}</span>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

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

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        {isAdmin ? (
          <>
            {[
              { label: 'Dashboard', href: '/admin', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
              { label: 'Proyectos', href: '/admin/proyectos', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg> },
              { label: 'Inventario', href: '/admin/inventario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              ...(effectiveRole === 'SUPERADMIN' ? [
                { label: 'Marketing', href: '/admin/marketing', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg> },
              ] : []),
              { label: 'Cotizaciones', href: '/admin/cotizaciones', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button className="mobile-nav-item" onClick={handleLogout} style={{ background: 'none', border: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Salir
            </button>
          </>
        ) : isSubcontratista ? (
          <>
            {[
              { label: 'Mis Trabajos', href: '/admin/subcontratista', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button className="mobile-nav-item" onClick={handleLogout} style={{ background: 'none', border: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Salir
            </button>
          </>
        ) : (
          <>
            {[
              { label: 'Mis Proyectos', href: '/admin/operador', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
              { label: 'Inventario', href: '/admin/inventario', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              { label: 'Cotizaciones', href: '/admin/cotizaciones', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button className="mobile-nav-item" onClick={handleLogout} style={{ background: 'none', border: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Salir
            </button>
          </>
        )}
      </nav>
    </>
  )
}
