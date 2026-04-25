'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import OfflinePrefetcher from '@/components/OfflinePrefetcher'

/**
 * AQUATECH_PROJECT_VIEW_V3
 * Refactorización con enfoque en alto contraste y robustez de UI.
 */

export default function ProyectosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  // Authorization check that handles both online (session) and offline (cached session)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkAuth() {
      // 1. Check online session first
      if (status === 'authenticated') {
        const role = (session?.user as any)?.role
        const permissions = (session?.user as any)?.permissions
        const authorized = role && (
          role === 'SUPERADMIN' || 
          role === 'ADMIN' || 
          role === 'ADMINISTRADORA' || 
          (permissions && permissions.includes('proyectos_admin'))
        )
        setIsAuthorized(!!authorized)
        if (!authorized) router.push('/admin')
      } 
      // 2. If offline, check cached session immediately
      else if (!navigator.onLine) {
        const cached = await db.auth.get('last_session')
        const authorized = cached && (
          cached.role === 'ADMIN' || 
          cached.role === 'SUPERADMIN' ||
          cached.role === 'ADMINISTRADORA'
        )
        setIsAuthorized(!!authorized)
        if (!authorized) router.push('/admin/login')
      }
      // 3. If unauthenticated and online
      else if (status === 'unauthenticated' && navigator.onLine) {
        router.push('/admin/login')
      }
    }
    checkAuth()
  }, [status, session, router])

  useEffect(() => {
    if (isAuthorized === true) {
      fetchProjects()
      
      const interval = setInterval(fetchProjects, 30000)
      const handleFocus = () => fetchProjects()
      window.addEventListener('focus', handleFocus)
      
      return () => {
        clearInterval(interval)
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [isAuthorized])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (Array.isArray(data)) {
        setProjects(data)
        
        // Cache to Dexie when online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          db.projectsCache.clear().then(() => {
            db.projectsCache.bulkPut(data).catch(err => console.error('Error caching projects:', err))
          })
        }
      }
    } catch (e) {
      console.error(e)
      // Load from cache if offline
      const cached = await db.projectsCache.toArray()
      if (cached.length > 0) setProjects(cached)
    } finally {
      setLoading(false)
    }
  }

  // --- OFFLINE SUPPORT ---
  const pendingProjects = useLiveQuery(
    () => db.outbox.where('type').equals('PROJECT').toArray(),
    []
  ) || []

  // Combine online projects with offline pending ones
  const allProjects = [
    ...pendingProjects.map(p => ({
      ...p.payload,
      id: `pending-${p.id}`,
      isPending: true,
      createdAt: new Date(p.timestamp).toISOString(),
      status: p.payload.status || 'LEAD'
    })),
    ...projects.filter(p => !pendingProjects.some(pp => pp.payload.title === p.title))
  ]

  const handleStatusChange = async (projectId: number, newStatus: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUpdatingId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Sin fecha'
    return new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(date))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVO': return '#0EA5E9' // Celeste brillante
      case 'LEAD': return '#F59E0B'   // Ámbar
      case 'ARCHIVADO': 
      case 'COMPLETADO': 
      case 'CANCELADO': 
        return '#94A3B8'              // Slate
      default: return '#94A3B8'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'LEAD': return 'Negociando'
      case 'ACTIVO': return 'Activo'
      case 'ARCHIVADO': return 'Archivado'
      case 'COMPLETADO': return 'Completado'
      case 'CANCELADO': return 'Cancelado'
      case 'PENDIENTE': return 'Pendiente'
      default: return status
    }
  }

  const TABS_CONFIG = [
    { id: 'LEAD', label: 'Negociando', color: '#F59E0B' },
    { id: 'ACTIVO', label: 'Activo', color: '#0EA5E9' },
    { id: 'ARCHIVADO', label: 'Archivados', color: '#94A3B8' }
  ]

  const SELECT_OPTIONS = [
    { value: 'LEAD', label: 'Negociando' },
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'ARCHIVADO', label: 'Archivado' }
  ]

  const filteredProjects = statusFilter === 'ALL' 
    ? allProjects 
    : allProjects.filter(p => {
        if (statusFilter === 'ARCHIVADO') {
            return ['ARCHIVADO', 'COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(p.status);
        }
        return p.status === statusFilter;
    })

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando proyectos...</div>

  return (
    <div className="p-6">
      <OfflinePrefetcher urls={projects.slice(0, 20).map(p => `/admin/proyectos/${p.id}`)} />
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Proyectos</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Vista unificada de obras y contratos vigentes.</p>
        </div>
        <Link href="/admin/proyectos/nuevo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nuevo Proyecto
        </Link>
      </div>

      {/* Tabs con Contraste Premium */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setStatusFilter('ALL')}
          style={{
            padding: '12px 28px', borderRadius: '40px', fontSize: '0.95rem', fontWeight: '800',
            border: 'none',
            backgroundColor: statusFilter === 'ALL' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
            color: statusFilter === 'ALL' ? '#0F172A' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer', transition: 'all 0.2s ease',
            boxShadow: statusFilter === 'ALL' ? '0 10px 20px -5px rgba(56, 189, 248, 0.4)' : 'none'
          }}
        >
          Todos
        </button>

        {TABS_CONFIG.map(opt => (
          <button
            key={opt.id}
            onClick={() => setStatusFilter(opt.id)}
            style={{
              padding: '12px 28px', borderRadius: '40px', fontSize: '0.95rem', fontWeight: '800',
              border: statusFilter === opt.id ? `2px solid ${opt.color}` : '2px solid transparent',
              backgroundColor: statusFilter === opt.id ? `${opt.color}25` : 'rgba(255,255,255,0.08)',
              color: statusFilter === opt.id ? opt.color : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: statusFilter === opt.id ? `0 10px 25px -5px ${opt.color}30` : 'none'
            }}
          >
            {opt.label} 
            <span style={{ marginLeft: '10px', opacity: 0.7 }}>
              ({
                opt.id === 'ARCHIVADO' 
                  ? allProjects.filter(p => ['ARCHIVADO', 'COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(p.status)).length
                  : allProjects.filter(p => p.status === opt.id).length
              })
            </span>
          </button>
        ))}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '24px',
        marginTop: '20px'
      }}>
        {filteredProjects.map(p => {
          const totalPhases = p.phases?.length || 0
          const completedPhases = (p.phases || []).filter((ph: any) => ph.status === 'COMPLETADA').length
          const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
          const statusColor = getStatusColor(p.status)

          return (
            <div key={p.id} style={{ position: 'relative', opacity: p.isPending ? 0.8 : 1 }}>
              <Link href={p.isPending ? '#' : `/admin/proyectos/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', cursor: p.isPending ? 'default' : 'pointer' }}>
                <div className="card h-full" style={{ 
                  padding: '24px', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '300px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--bg-card)'
                }}>
                  <div style={{ 
                      position: 'absolute', top: 0, right: 0, 
                      width: '80px', height: '80px', 
                      background: `linear-gradient(135deg, transparent 50%, ${statusColor}15 50%)`,
                      zIndex: 0
                  }}></div>

                  {p.isPending && (
                    <div style={{ 
                      position: 'absolute', top: '12px', left: '12px', 
                      backgroundColor: 'rgba(245, 158, 11, 0.9)', color: 'white', 
                      padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', 
                      fontWeight: 'bold', zIndex: 10, display: 'flex', alignItems: 'center', gap: '5px' 
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      PENDIENTE DE SINCRONIZACIÓN
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                      <div 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        style={{ position: 'relative' }}
                      >
                        <select
                          value={['COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(p.status) ? 'ARCHIVADO' : p.status}
                          disabled={updatingId === p.id}
                          onChange={(e) => {
                            const syntheticEvent = { preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent
                            handleStatusChange(p.id, e.target.value, syntheticEvent)
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: '24px', fontSize: '0.8rem', fontWeight: '900',
                            backgroundColor: '#FFFFFF', color: '#0B1623',
                            border: `2px solid ${statusColor}`, cursor: 'pointer',
                            appearance: 'none', WebkitAppearance: 'none',
                            paddingRight: '36px',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                          }}
                        >
                          {SELECT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} style={{ backgroundColor: '#FFFFFF', color: '#0B1623' }}>
                              {opt.label.toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B1623" strokeWidth="4" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>
                        {formatDate(p.createdAt)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px 0' }}>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', lineHeight: '1.3', color: '#FFFFFF' }}>{p.title}</h3>
                      {p.unreadCount > 0 && (
                        <span style={{
                          backgroundColor: '#EF4444',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: '900',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '22px',
                          boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                          animation: 'pulse-red 2s infinite'
                        }}>
                          {p.unreadCount}
                        </span>
                      )}
                    </div>

                    <style jsx>{`
                      @keyframes pulse-red {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                      }
                    `}</style>

                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
                      {p.client?.name || 'Cliente sin asignar'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '700' }}>
                            <span>Progreso de Obra</span>
                            <span>{progress}%</span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ 
                                width: `${progress}%`, 
                                height: '100%', 
                                backgroundColor: statusColor,
                                transition: 'width 1s ease-out'
                            }}></div>
                          </div>
                        </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>{p.team?.length || 0}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>{completedPhases}/{totalPhases}</span>
                      </div>

                  </div>
                </div>
              </Link>
            </div>
          )
        })}

        {filteredProjects.length === 0 && (
          <div style={{ 
            gridColumn: '1 / -1', 
            padding: '100px 20px', 
            textAlign: 'center', 
            backgroundColor: 'rgba(255,255,255,0.02)', 
            borderRadius: '24px',
            border: '2px dashed rgba(255,255,255,0.08)'
          }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" style={{ marginBottom: '20px' }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <h3 style={{ color: '#FFFFFF', marginBottom: '10px', fontSize: '1.5rem' }}>
              {statusFilter === 'ALL' ? 'Sin proyectos' : `No hay proyectos "${getStatusLabel(statusFilter)}"`}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
              Intenta cambiar el filtro o crear un nuevo registro.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
