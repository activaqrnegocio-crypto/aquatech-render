'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { NotificationOnboarding } from '@/components/NotificationOnboarding'
import { IosInstallBanner } from '@/components/IosInstallBanner'

interface DashboardProps {
  stats: {
    totalProjects: number
    activeProjects: number
    pendingProjects: number
    completedProjects: number
    leadProjects: number
    totalOperators: number
    totalBudget: number
    totalSpent: number
    totalHours7d: number
    totalMessages7d: number
    totalExpenses7d: number
  }
  recentExpenses: {
    id: number
    amount: number
    description: string | null
    date: string
    projectTitle: string
    userName: string
  }[]
  recentMessages: {
    id: number
    content: string | null
    type: string
    createdAt: string
    projectTitle: string
    userName: string
    phaseTitle: string | null
  }[]
  activeProjects: {
    id: number
    title: string
    type: string
    status: string
    clientName: string
    phasesTotal: number
    phasesCompleted: number
    teamMembers: string[]
    expenseCount: number
    estimatedBudget: number
    realCost: number
    estimatedDays: number
    startDate?: string
    phases: { id: number; title: string; status: string; estimatedDays: number }[]
  }[]
  teamList: {
    id: number
    name: string
    role: string
    phone: string | null
    projectCount: number
  }[]
}

const typeLabels: Record<string, string> = {
  PISCINA: '🏊 Piscina',
  RIEGO: '🌱 Riego',
  SPA: '💧 Spa',
  MANTENIMIENTO: '🔧 Mantenimiento',
  PILETA: '⛲ Pileta',
  TURCO: '♨️ Turco',
  POTABILIZACION: '💦 Potabilización',
  CONTRA_INCENDIOS: '🔥 Contra incendios',
  OTRO: '📋 Otro',
}

const statusBadge: Record<string, { className: string; label: string }> = {
  LEAD: { className: 'badge badge-info badge-dot', label: 'Lead' },
  ACTIVO: { className: 'badge badge-success badge-dot', label: 'Activo' },
  PENDIENTE: { className: 'badge badge-warning badge-dot', label: 'Pendiente' },
  COMPLETADO: { className: 'badge badge-neutral badge-dot', label: 'Completado' },
  CANCELADO: { className: 'badge badge-danger badge-dot', label: 'Cancelado' },
  ARCHIVADO: { className: 'badge badge-neutral badge-dot', label: 'Archivado' },
}

const msgTypeIcons: Record<string, string> = {
  TEXT: '💬',
  IMAGE: '📷',
  VIDEO: '🎥',
  AUDIO: '🎙️',
  NOTE: '📝',
  EXPENSE_LOG: '💰',
  DAY_START: '🌅',
  DAY_END: '🌙',
  PHASE_COMPLETE: '✅',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

export default function DashboardClient({ stats, recentExpenses, recentMessages, activeProjects, teamList }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(activeProjects[0]?.id || 0)
  const [mounted, setMounted] = useState(false)
  const [pushDismissed, setPushDismissed] = useState(true)
  const { 
    status: pushStatus, 
    subscribe: pushSubscribe, 
    isSubscribing,
    showOnboarding,
    setShowOnboarding 
  } = usePushNotifications()

  useEffect(() => {
    setMounted(true)
    const dismissed = localStorage.getItem('push_dismissed')
    if (dismissed) {
      const dismissedAt = Number(dismissed)
      // Show again after 7 days
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        setPushDismissed(false)
      }
    } else {
      setPushDismissed(false)
    }
  }, [])

  const budgetPercent = stats.totalBudget > 0 ? Math.min((stats.totalSpent / stats.totalBudget) * 100, 100) : 0

  const selectedProject = activeProjects.find(p => p.id === activeTab) || activeProjects[0]

  // Calculate days for selected project
  let realDays = 0
  if (selectedProject?.startDate) {
    const start = new Date(selectedProject.startDate)
    const now = new Date()
    realDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const budgetProgress = selectedProject?.estimatedBudget > 0 
    ? (selectedProject.realCost / selectedProject.estimatedBudget) * 100 
    : 0
  
  const daysProgress = selectedProject?.estimatedDays > 0
    ? (realDays / selectedProject.estimatedDays) * 100
    : 0

  const getBarColor = (percent: number) => {
    if (percent > 100) return 'danger'
    if (percent > 85) return 'warning'
    return 'success'
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Resumen general de Aquatech</p>
      </div>

      {/* iOS Install Guide (Only if needed) */}
      <IosInstallBanner />

      {/* Notification Onboarding Modal */}
      {showOnboarding && (
        <NotificationOnboarding onDone={() => setShowOnboarding(false)} />
      )}

      {/* Push Notification Banner for Admins */}
      {pushStatus !== 'subscribed' && pushStatus !== 'unsupported' && pushStatus !== 'denied' && pushStatus !== 'loading' && !pushDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, #0070c0, #38bdf8)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          flexWrap: 'wrap',
          margin: '0 0 25px 0',
          boxShadow: '0 4px 20px rgba(0, 112, 192, 0.3)',
          animation: 'fade-in 0.5s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '1.8rem' }}>🔔</span>
            <div>
              <p style={{ margin: 0, color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Activa las Notificaciones de Administrador</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>Recibe alertas en tiempo real de nuevos proyectos, mensajes y gastos</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={async () => {
                const ok = await pushSubscribe()
                if (ok) setPushDismissed(true)
              }}
              disabled={isSubscribing}
              style={{
                backgroundColor: 'white',
                color: '#0070c0',
                fontWeight: 'bold',
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {isSubscribing ? 'Activando...' : '✓ Activar'}
            </button>
            <button
              onClick={() => {
                localStorage.setItem('push_dismissed', String(Date.now()))
                setPushDismissed(true)
              }}
              style={{
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Luego
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-color': 'var(--primary)', '--kpi-bg': 'var(--info-bg)' } as React.CSSProperties}>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
          </div>
          <div className="kpi-value">{stats.activeProjects}</div>
          <div className="kpi-label">Proyectos Activos</div>
          <div className="kpi-trend up">de {stats.totalProjects} totales</div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)', '--kpi-bg': 'var(--warning-bg)' } as React.CSSProperties}>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="kpi-value">{stats.leadProjects}</div>
          <div className="kpi-label">Leads / Prospectos</div>
          <div className="kpi-trend up">{stats.pendingProjects} pendientes</div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': 'var(--success)', '--kpi-bg': 'var(--success-bg)' } as React.CSSProperties}>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="kpi-value">{stats.totalOperators}</div>
          <div className="kpi-label">Operarios Activos</div>
        </div>
      </div>

      {/* Weekly Intelligence (New Section) */}
      <h3 style={{ marginBottom: '15px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        📈 Desempeño Semanal (Últimos 7 días)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
        <div className="card-sub" style={{ padding: '15px', background: 'var(--bg-surface)', border: '1px solid var(--primary-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ fontSize: '1.5rem' }}>⏱️</div>
           <div>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Horas Totales del Equipo</div>
             <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.totalHours7d} hrs</div>
           </div>
        </div>
        <div className="card-sub" style={{ padding: '15px', background: 'var(--bg-surface)', border: '1px solid var(--info)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ fontSize: '1.5rem' }}>📸</div>
           <div>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reportes en Chat</div>
             <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.totalMessages7d}</div>
           </div>
        </div>
        <div className="card-sub" style={{ padding: '15px', background: 'var(--bg-surface)', border: '1px solid var(--danger-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ fontSize: '1.5rem' }}>💸</div>
           <div>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gasto Semanal (Viáticos)</div>
             <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(stats.totalExpenses7d)}</div>
           </div>
        </div>
      </div>


      {/* Comparison Tabs */}
      {activeProjects.length > 0 && (
        <div className="card mb-lg" style={{ border: '1px solid var(--primary-glow)' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Estado de Proyectos Activos (Top 5)</div>
              <div className="card-subtitle">Comparativa Real vs Teórica en Tiempo y Gastos</div>
            </div>
          </div>

          {/* Project Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '25px', 
            overflowX: 'auto', 
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border)' 
          }}>
            {activeProjects.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`btn ${activeTab === p.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ 
                  whiteSpace: 'nowrap', 
                  fontSize: '0.85rem',
                  padding: '8px 16px',
                  opacity: activeTab === p.id ? 1 : 0.6
                }}
              >
                {p.title.length > 15 ? p.title.substring(0, 15) + '...' : p.title}
              </button>
            ))}
          </div>

          {selectedProject && (
            <div className="animate-fade-in" key={selectedProject.id}>
              {/* Twin Bars Layout */}
              <div className="grid-responsive" style={{ gap: '20px' }}>
                
                {/* 1. Comparison Budget */}
                <div className="comparison-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>📊 Comparativa de Presupuesto</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{budgetProgress.toFixed(0)}% Utilizado</span>
                  </div>
                  
                  <div className="twin-bars-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Bar Real */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Gasto Real</span>
                        <span style={{ fontWeight: 'bold' }}>{formatCurrency(selectedProject.realCost)}</span>
                      </div>
                      <div className="progress-bar" style={{ height: '24px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <div 
                          className={`progress-fill ${getBarColor(budgetProgress)}`} 
                          style={{ width: `${Math.min(budgetProgress, 100)}%`, transition: 'width 1s ease-out' }} 
                        />
                      </div>
                    </div>
                    
                    {/* Bar Teórica */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Prespuesto Teórico (Referencial)</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{formatCurrency(selectedProject.estimatedBudget)}</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px', opacity: 0.3 }}>
                        <div className="progress-fill" style={{ width: '100%', backgroundColor: 'var(--primary)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Comparison Time */}
                <div className="comparison-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>⏱️ Comparativa de Tiempo</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{daysProgress.toFixed(0)}% del Plazo</span>
                  </div>

                  <div className="twin-bars-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Bar Real */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Días Transcurridos</span>
                        <span style={{ fontWeight: 'bold' }}>{realDays} días</span>
                      </div>
                      <div className="progress-bar" style={{ height: '24px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <div 
                          className={`progress-fill ${getBarColor(daysProgress)}`} 
                          style={{ width: `${Math.min(daysProgress, 100)}%`, transition: 'width 1s ease-out' }} 
                        />
                      </div>
                    </div>

                    {/* Bar Teórica */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Plazo Estimado (Contrato)</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{selectedProject.estimatedDays} días</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px', opacity: 0.3 }}>
                        <div className="progress-fill" style={{ width: '100%', backgroundColor: 'var(--success)' }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Warnings */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                 {budgetProgress > 100 && (
                   <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '10px 15px', borderRadius: '8px', flex: 1, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--danger)' }}>
                     <strong>⚠️ Alerta Presupuesto:</strong> El gasto real ha superado el presupuesto teórico por {formatCurrency(selectedProject.realCost - selectedProject.estimatedBudget)}.
                   </div>
                 )}
                 {daysProgress > 100 && (
                   <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', padding: '10px 15px', borderRadius: '8px', flex: 1, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                     <strong>🕒 Alerta Cronograma:</strong> El proyecto ha superado el tiempo estimado inicial.
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Section */}
      <div className="card mb-lg">
        <div className="card-header">
          <div>
            <div className="card-title">Equipo de Trabajo</div>
            <div className="card-subtitle">Administradores y Operadores activos</div>
          </div>
          <Link href="/admin/team" className="btn btn-ghost btn-sm">Gestionar Equipo →</Link>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: 'var(--space-md)',
          marginTop: 'var(--space-md)' 
        }}>
          {teamList.map(u => (
            <div key={u.id} className="card-sub" style={{ 
              padding: '15px', 
              background: 'var(--bg-surface)', 
              borderRadius: '12px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 800, 
                  padding: '2px 8px', 
                  borderRadius: '6px',
                  background: u.role === 'ADMIN' ? 'var(--success-bg)' : 'var(--primary-bg)',
                  color: u.role === 'ADMIN' ? 'var(--success)' : 'var(--primary)',
                  letterSpacing: '1px'
                }}>
                  {u.role}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {u.projectCount} proyectos
                </span>
              </div>
              
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                {u.name}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {u.phone || 'Sin teléfono'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Projects + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }} className="dashboard-grid">
        {/* Active Projects */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Proyectos Recientes</div>
            <Link href="/admin/proyectos" className="btn btn-ghost btn-sm">Ver todos →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {activeProjects.map((p) => {
              const progress = p.phasesTotal > 0 ? (p.phasesCompleted / p.phasesTotal) * 100 : 0
              return (
                <Link key={p.id} href={`/admin/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: 'var(--space-md)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', transition: 'all var(--transition-fast)', cursor: 'pointer', border: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
                  >
                    <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{p.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{typeLabels[p.type] || p.type} · {p.clientName}</div>
                      </div>
                      <span className={statusBadge[p.status]?.className}>{statusBadge[p.status]?.label}</span>
                    </div>
                    {p.phasesTotal > 0 && (
                      <div>
                        <div className="flex justify-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>Fases: {p.phasesCompleted}/{p.phasesTotal}</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {p.teamMembers.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {p.teamMembers.map((name, i) => (
                          <span key={i} style={{ fontSize: '0.65rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                            {name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
            {activeProjects.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">No hay proyectos activos</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Actividad Reciente</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Messages */}
            {recentMessages.map((msg) => (
              <div key={`msg-${msg.id}`} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-sm" style={{ marginBottom: '2px' }}>
                  <span>{msgTypeIcons[msg.type] || '💬'}</span>
                  <strong style={{ color: 'var(--text)' }}>{msg.userName}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {mounted ? timeAgo(msg.createdAt) : '...'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', paddingLeft: '26px', fontSize: '0.78rem' }}>
                  {msg.content?.slice(0, 80)}{(msg.content?.length || 0) > 80 ? '...' : ''}
                </div>
                <div style={{ paddingLeft: '26px', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {msg.projectTitle}{msg.phaseTitle ? ` · ${msg.phaseTitle}` : ''}
                </div>
              </div>
            ))}

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
              <>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '12px 12px 4px', marginTop: '8px' }}>
                  Gastos Recientes
                </div>
                {recentExpenses.slice(0, 3).map((exp) => (
                  <div key={`exp-${exp.id}`} style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ color: 'var(--text)' }}>{exp.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{exp.projectTitle} · {exp.userName}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {recentMessages.length === 0 && recentExpenses.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">Sin actividad reciente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
