'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

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
    section: 'General',
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
    ],
  },
  {
    section: 'Gestión',
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
]

const operatorNavItems: NavSection[] = [
  {
    section: 'Workspace',
    items: [
      {
        label: 'Mis Proyectos',
        href: '/admin/operador',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'Proyectos': true,
    'Mis Proyectos': true,
    'Proyecto Actual': true,
  })

  if (status === 'loading') {
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

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'ADMINISTRADORA'
  const projectIdMatch = pathname.match(/\/admin\/operador\/proyecto\/(\d+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : null

  const dynamicOperatorNavItems: NavSection[] = [
    {
      section: 'Workspace',
      items: [
        {
          label: 'Mis Proyectos',
          href: '/admin/operador',
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
          href: `/admin/operador/proyecto/${projectId}`,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            </svg>
          ),
          subItems: [
            { label: 'Registros', href: `/admin/operador/proyecto/${projectId}?view=records` },
            { label: 'Bitácora', href: `/admin/operador/proyecto/${projectId}?view=chat` },
          ],
        }] : []),
      ],
    },
    {
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
    }
  ]

  const navItems = isAdmin ? adminNavItems : dynamicOperatorNavItems

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href
  }

  const isParentActive = (item: NavItem) => {
    if (pathname === item.href) return true
    if (item.subItems?.some(sub => pathname === sub.href)) return true
    return false
  }

  const toggleMenu = (label: string, e: React.MouseEvent) => {
    e.preventDefault()
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const userInitials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
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
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => signOut({ callbackUrl: '/admin/login' })}>
            <div className="sidebar-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{session?.user?.name || 'Admin'}</div>
              <div className="sidebar-user-role">
                {session?.user?.role === 'ADMIN' ? 'Administrador' : 
                 session?.user?.role === 'ADMINISTRADORA' ? 'Administradora' : 'Operador'}
              </div>
            </div>
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
              { label: 'Cotizaciones', href: '/admin/cotizaciones', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button className="mobile-nav-item" onClick={() => signOut({ callbackUrl: '/admin/login' })} style={{ background: 'none', border: 'none' }}>
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
                className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button className="mobile-nav-item" onClick={() => signOut({ callbackUrl: '/admin/login' })} style={{ background: 'none', border: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Salir
            </button>
          </>
        )}
      </nav>
    </>
  )
}
