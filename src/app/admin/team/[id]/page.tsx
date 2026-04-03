'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import CalendarView from '@/components/Calendar/CalendarView'
import AppointmentModal from '@/components/Calendar/AppointmentModal'
import { formatToEcuador, getLocalNow, formatTimeEcuador, formatDateEcuador, formatDateLongEcuador } from '@/lib/date-utils'

// Inline SVG icons to avoid lucide-react webpack bundling issues
const svgProps = (size: number, style?: React.CSSProperties, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', ...style }, className
})

const Mail = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
const Phone = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
const Calendar = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
const Briefcase = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
const MessageSquare = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const Receipt = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>
const Clock = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const ArrowLeft = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
const MapPin = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
const Activity = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
const Shield = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
const Eye = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOff = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
const LogOut = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
const RefreshCw = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
const Plus = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M12 5v14M5 12h14"/></svg>

type TabType = 'RESUMEN' | 'BITACORA' | 'GASTOS' | 'ENTRADA_SALIDA' | 'PROYECTOS' | 'CALENDARIO'

export default function TeamMemberPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id
  
  const { data: session } = useSession()
  // Robust admin check consistent with Sidebar
  const effectiveRole = String((session?.user as any)?.role || 'OPERATOR').toUpperCase()
  const isAdmin = effectiveRole.includes('ADMIN') || Number((session?.user as any)?.id) === 1
  
  const [member, setMember] = useState<any>(null)
  const [activityData, setActivityData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('PROYECTOS')
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')

  // Security States
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityMsg, setSecurityMsg] = useState({ text: '', type: '' as 'success' | 'error' | '' })
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Calendar States
  const [appointments, setAppointments] = useState<any[]>([])
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)

  const togglePasswordVisibility = () => {
    if (!newPassword && member?.displayPassword && !showPassword) {
        setNewPassword(member.displayPassword)
    }
    setShowPassword(!showPassword)
  }

  useEffect(() => {
    if (passwordInputRef.current) {
        passwordInputRef.current.focus()
        const len = newPassword.length
        passwordInputRef.current.setSelectionRange(len, len)
    }
  }, [showPassword])

  useEffect(() => {
    if (userId) {
        fetchMemberData()
        fetchAppointments()
        fetchAllProjects()
    }
  }, [userId])

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`/api/appointments?userId=${userId}`)
      if (res.ok) setAppointments(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchAllProjects = async () => {
    try {
      const res = await fetch('/api/proyectos')
      if (res.ok) {
          const data = await res.json()
          setAllProjects(data.proyectos || [])
      }
    } catch (e) { console.error(e) }
  }

  const fetchMemberData = async () => {
    try {
      const [userRes, activityRes] = await Promise.all([
        fetch(`/api/users/${userId}`),
        fetch(`/api/users/${userId}/activity`)
      ])

      if (!userRes.ok || !activityRes.ok) throw new Error('Error al cargar datos del dashboard')
      
      const userData = await userRes.json()
      const logData = await activityRes.json()

      setMember(userData)
      setActivityData(logData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const availableMonths = useMemo(() => {
    if (!activityData?.timeline) return []
    const months = new Set<string>()
    activityData.timeline.forEach((event: any) => {
      const d = new Date(event.timestamp)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`
      months.add(key)
    })
    return Array.from(months).sort((a,b) => b.localeCompare(a))
  }, [activityData])
  
  const availableProjects = useMemo(() => {
    if (!activityData?.timeline) return []
    const projectsMap = new Map<string, string>()
    
    // First from current assigned projects
    if (member?.projects) {
      member.projects.forEach((p: any) => {
        projectsMap.set(String(p.id), p.title)
      })
    }
    
    // Then from historical timeline (captures past/deleted involvements)
    activityData.timeline.forEach((event: any) => {
      if (event.projectId) {
        projectsMap.set(String(event.projectId), event.projectTitle)
      }
    })
    
    return Array.from(projectsMap.entries()).map(([id, title]) => ({ id, title }))
  }, [activityData, member])

  const filteredTimeline = useMemo(() => {
    if (!activityData?.timeline) return []
    
    let logs = activityData.timeline
    if (activeTab === 'BITACORA') logs = logs.filter((l: any) => l.type === 'CHAT_MESSAGE' || l.type === 'PROJECT')
    if (activeTab === 'GASTOS') logs = logs.filter((l: any) => l.type === 'EXPENSE')
    if (activeTab === 'ENTRADA_SALIDA') logs = logs.filter((l: any) => l.type === 'ATTENDANCE')
    // RESUMEN shows everything (no type filter)

    if (monthFilter !== 'ALL') {
      logs = logs.filter((l: any) => {
        const d = new Date(l.timestamp)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`
        return key === monthFilter
      })
    }

    if (projectFilter !== 'ALL') {
      logs = logs.filter((l: any) => String(l.projectId) === projectFilter)
    }

    const groups: { [key: string]: any[] } = {}
    logs.forEach((event: any) => {
      const dateKey = formatDateLongEcuador(event.timestamp)
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(event)
    })

    return Object.entries(groups).sort((a, b) => {
        return new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime()
    })
  }, [activityData, activeTab, monthFilter, projectFilter])

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      setSecurityMsg({ text: 'Mínimo 4 caracteres', type: 'error' })
      return
    }
    
    if (!window.confirm(`¿Estás seguro de cambiar la contraseña de ${member.name}?`)) return

    setSecurityLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/security/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setSecurityMsg({ text: '¡Contraseña actualizada con éxito!', type: 'success' })
      setNewPassword('')
      setTimeout(() => setSecurityMsg({ text: '', type: '' }), 3000)
    } catch (err: any) {
      setSecurityMsg({ text: err.message, type: 'error' })
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleForceLogout = async () => {
    if (!window.confirm(`¿Deseas cerrar la sesión de ${member.name} en todos sus dispositivos de forma inmediata?`)) return
    
    setSecurityLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/security/logout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setSecurityMsg({ text: '¡Sesiones invalidadas globalmente!', type: 'success' })
      setTimeout(() => setSecurityMsg({ text: '', type: '' }), 5000)
    } catch (err: any) {
      setSecurityMsg({ text: err.message, type: 'error' })
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleSaveAppointment = async (data: any) => {
    const isNew = !data.id
    const url = isNew ? '/api/appointments' : `/api/appointments/${data.id}`
    const method = isNew ? 'POST' : 'PATCH'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (res.ok) {
      setIsModalOpen(false)
      fetchAppointments()
    } else {
      throw new Error('Failed to save')
    }
  }

  const handleDeleteAppointment = async (id: number) => {
    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setIsModalOpen(false)
      fetchAppointments()
    } else {
      throw new Error('Failed to delete')
    }
  }

  const handleOpenAddModal = (date: Date) => {
    setEditingEvent({ startTime: date })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (event: any) => {
    setEditingEvent(event)
    setIsModalOpen(true)
  }

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}>
      <strong>Cargando Panel 360...</strong>
    </div>
  )

  if (error) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}><strong>{error}</strong></div>
  if (!member) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><strong>Operador no encontrado</strong></div>

  return (
    <div className="admin-content" style={{ padding: 'var(--space-xl)', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div className="page-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <Link href="/admin/team" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)' }}>
          <ArrowLeft size={16} /> Volver al Equipo
        </Link>
        <h1 className="page-title">{member.name}</h1>
        <div className="page-subtitle" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{member.role === 'ADMIN' ? 'Administrador' : 'Operador Especialista'}</span>
          <span>@{member.username}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14}/> {member.email || 'correo.pendiente@aquatech.com'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14}/> {member.phone || 'Sin teléfono'}</span>
        </div>
      </div>

      <div className="kpi-grid">
        <div 
          className="kpi-card" 
          onClick={() => setActiveTab('PROYECTOS')}
          style={{ cursor: 'pointer', border: activeTab === 'PROYECTOS' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Briefcase size={22} />
          </div>
          <div className="kpi-value">{member.projects.length}</div>
          <div className="kpi-label">Proyectos Asignados</div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => setActiveTab('BITACORA')}
          style={{ cursor: 'pointer', border: activeTab === 'BITACORA' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
            <MessageSquare size={22} />
          </div>
          <div className="kpi-value">{member.stats.totalMessages}</div>
          <div className="kpi-label">Reportes (Bitácora)</div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => setActiveTab('GASTOS')}
          style={{ cursor: 'pointer', border: activeTab === 'GASTOS' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
            <Receipt size={22} />
          </div>
          <div className="kpi-value">{member.stats.totalExpenses}</div>
          <div className="kpi-label">Gastos Registrados</div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => setActiveTab('ENTRADA_SALIDA')}
          style={{ cursor: 'pointer', border: activeTab === 'ENTRADA_SALIDA' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-value">{member.stats.totalDayRecords}</div>
          <div className="kpi-label">Logística (Entrada/Salida)</div>
        </div>

        {isAdmin && (
          <div className="card" style={{ padding: 'var(--space-lg)', border: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%)', boxShadow: 'var(--shadow-md)', gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-md)', color: 'var(--primary)' }}>
                <Shield size={20}/>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Gestión de Seguridad (Super-Admin)</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Credenciales (Password)</label>
                    <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            {showPassword ? (
                                <input 
                                    ref={passwordInputRef}
                                    type="text"
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder={member?.displayPassword ? "Contraseña actual..." : "Ingresar nueva clave..."}
                                    autoComplete="off"
                                    style={{ paddingRight: '40px', fontSize: '0.9rem' }}
                                />
                            ) : (
                                <input 
                                    ref={passwordInputRef}
                                    type="password"
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder={member?.displayPassword ? "••••••••" : "Ingresar nueva clave..."}
                                    autoComplete="new-password"
                                    style={{ paddingRight: '40px', fontSize: '0.9rem' }}
                                />
                            )}
                            <button 
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={togglePasswordVisibility}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showPassword ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', zIndex: 10 }}
                            >
                                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
                        <button 
                            type="button"
                            className="btn btn-primary" 
                            disabled={securityLoading || !newPassword}
                            onClick={handlePasswordChange}
                        >
                           {securityLoading ? <RefreshCw size={16} className="spin"/> : 'Cambiar'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cierre de Sesión Global</label>
                    <button 
                        type="button"
                        className="btn"
                        onClick={handleForceLogout}
                        disabled={securityLoading}
                        style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            backgroundColor: 'rgba(255, 68, 68, 0.1)', 
                            color: 'var(--danger)',
                            border: '1px solid var(--danger)',
                            fontWeight: 'bold'
                        }}
                    >
                        <LogOut size={16}/>
                        Cerrar Sesión Remota
                    </button>
                </div>
            </div>

            {securityMsg.text && (
                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-sm)', backgroundColor: securityMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', color: securityMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {securityMsg.type === 'success' ? <Activity size={14}/> : <Shield size={14}/>}
                    {securityMsg.text}
                </div>
            )}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginTop: 'var(--space-2xl)', marginBottom: 'var(--space-lg)' }}>
        <button 
          className={`tab ${activeTab === 'PROYECTOS' ? 'active' : ''}`} 
          onClick={() => setActiveTab('PROYECTOS')}
        >
          Proyectos
        </button>
        <button 
          className={`tab ${activeTab === 'RESUMEN' ? 'active' : ''}`} 
          onClick={() => setActiveTab('RESUMEN')}
        >
          Resumen General
        </button>
        <button 
          className={`tab ${activeTab === 'BITACORA' ? 'active' : ''}`} 
          onClick={() => setActiveTab('BITACORA')}
        >
          Bitácora
        </button>
        <button 
          className={`tab ${activeTab === 'GASTOS' ? 'active' : ''}`} 
          onClick={() => setActiveTab('GASTOS')}
        >
          Gastos
        </button>
        <button 
          className={`tab ${activeTab === 'ENTRADA_SALIDA' ? 'active' : ''}`} 
          onClick={() => setActiveTab('ENTRADA_SALIDA')}
        >
          Entrada/Salida
        </button>
        <button 
          className={`tab ${activeTab === 'CALENDARIO' ? 'active' : ''}`} 
          onClick={() => setActiveTab('CALENDARIO')}
        >
          Calendario / Tareas
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>
               {activeTab === 'PROYECTOS' ? 'Historial de Proyectos Asignados' : 
                activeTab === 'RESUMEN' ? 'Resumen de Toda la Actividad' :
                activeTab === 'BITACORA' ? 'Bitácora de Reportes de Campo' :
                activeTab === 'GASTOS' ? 'Registro Detallado de Gastos' :
                activeTab === 'CALENDARIO' ? 'Agenda y Gestión de Tareas' :
                'Registros de Entrada y Salida'}
            </h2>
            
            {['RESUMEN', 'BITACORA', 'GASTOS', 'ENTRADA_SALIDA'].includes(activeTab) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {/* Project Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Proyecto:</label>
                  <select 
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', maxWidth: '200px' }}
                    value={projectFilter} 
                    onChange={e => setProjectFilter(e.target.value)}
                  >
                    <option value="ALL">Todos los Proyectos</option>
                    {availableProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                {availableMonths.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mes:</label>
                    <select 
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                      value={monthFilter} 
                      onChange={e => setMonthFilter(e.target.value)}
                    >
                      <option value="ALL">Todo el Historial</option>
                      {availableMonths.map(m => {
                        const [y, mo] = m.split('-')
                        const label = new Date(Number(y), Number(mo)-1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
                        return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}
        </div>

        {activeTab === 'PROYECTOS' && (
          <div className="grid-responsive">
            {member.projects.map((proj: any) => (
              <div key={proj.id} className="card" onClick={() => router.push(`/admin/team/${userId}/proyecto/${proj.id}`)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-md)' }}>
                    <div className="kpi-icon" style={{ marginBottom: 0, width: '36px', height: '36px' }}><Briefcase size={16}/></div>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>{proj.title}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
                    <span className={proj.status === 'ACTIVO' ? 'badge badge-success' : 'badge badge-neutral'}>
                        {proj.status}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> 
                        {formatDateEcuador(proj.assignedAt)}
                    </span>
                </div>
              </div>
            ))}
            {member.projects.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin proyectos asignados</div>
            )}
          </div>
        )}

        {['RESUMEN', 'BITACORA', 'GASTOS', 'ENTRADA_SALIDA'].includes(activeTab) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {filteredTimeline.length > 0 ? (
              filteredTimeline.map(([date, events]: any) => (
                <div key={date}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 'var(--space-md)' }}>
                     <span className="badge badge-info">{date}</span>
                     <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {events.map((event: any, idx: number) => (
                      <div key={idx} className="card" style={{ padding: 'var(--space-md)', backgroundColor: 'var(--bg-body)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                                <Briefcase size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}/>
                                {event.projectTitle}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {formatTimeEcuador(event.timestamp)}
                            </span>
                        </div>

                        {event.type === 'CHAT_MESSAGE' && (
                          <div>
                            {event.data.content && (
                              <p style={{ fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 var(--space-md) 0' }} 
                                 dangerouslySetInnerHTML={{ __html: event.data.content.replace(/\n/g, '<br/>') }}></p>
                            )}
                            
                            {event.data.media && event.data.media.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                                {event.data.media.map((m: any) => (
                                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <img src={m.url} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </a>
                                ))}
                              </div>
                            )}

                             {event.data.lat !== undefined && event.data.lat !== null && (
                                <a href={`https://www.google.com/maps?q=${event.data.lat},${event.data.lng}`} 
                                   target="_blank" rel="noreferrer" className="badge badge-info" style={{ marginTop: 'var(--space-md)' }}>
                                    <MapPin size={12} style={{ marginRight: '4px' }}/> Ver Ubicación GPS
                                </a>
                            )}
                          </div>
                        )}

                        {event.type === 'ATTENDANCE' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
                            <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, color: 'var(--success)' }}><Clock size={60} /></div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>LOGÍSTICA: ENTRADA / LLEGADA</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>{formatTimeEcuador(event.data.startTime)}</strong>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDateEcuador(event.data.startTime)}</div>
                                </div>
                                {event.data.startLat ? (
                                  <a href={`https://www.google.com/maps?q=${event.data.startLat},${event.data.startLng}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: '12px', width: '100%', justifyContent: 'center', border: '1px solid var(--success)', color: 'var(--success)' }}>
                                    <MapPin size={14} style={{ marginRight: '6px' }}/> Ubicación de Entrada
                                  </a>
                                ) : <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '8px' }}>⚠️ Sin metadatos GPS</div>}
                            </div>
                            
                            <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, color: 'var(--warning)' }}><Clock size={60} /></div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>LOGÍSTICA: SALIDA / RETIRO</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>{event.data.endTime ? formatTimeEcuador(event.data.endTime) : '--:--'}</strong>
                                    {event.data.endTime && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDateEcuador(event.data.endTime)}</div>}
                                </div>
                                {event.data.endLat ? (
                                  <a href={`https://www.google.com/maps?q=${event.data.endLat},${event.data.endLng}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: '12px', width: '100%', justifyContent: 'center', border: '1px solid var(--warning)', color: 'var(--warning)' }}>
                                    <MapPin size={14} style={{ marginRight: '6px' }}/> Ubicación de Salida
                                  </a>
                                ) : <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>{event.data.endTime ? '⚠️ GPS no registrado' : '⏳ Operación en curso...'}</div>}
                            </div>

                            <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--info-bg)', borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--info)', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>DURACIÓN TOTAL</span>
                                <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
                                    {event.data.endTime ? (() => {const d = new Date(event.data.endTime).getTime() - new Date(event.data.startTime).getTime(); return `${Math.floor(d/(1000*60*60))}h ${Math.floor((d%(1000*60*60))/(1000*60))}m`})() : 'En Progreso'}
                                </strong>
                            </div>
                          </div>
                        )}

                        {event.type === 'EXPENSE' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                             <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text)' }}>{event.data.description || 'Gasto no descrito'}</h4>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span className="badge badge-neutral">{event.data.category}</span>
                                  {event.data.lat && <a href={`https://www.google.com/maps?q=${event.data.lat},${event.data.lng}`} target="_blank" rel="noreferrer" className="badge badge-info">📍 Ver GPS</a>}
                                </div>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success)' }}>${Number(event.data.amount).toFixed(2)}</span>
                                {event.data.receiptUrl && <a href={event.data.receiptUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">Ver Recibo</a>}
                             </div>
                          </div>
                        )}

                        {event.type === 'PROJECT' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text)' }}>Nuevo Proyecto Creado</h4>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>El operador inició la gestión de este proyecto.</p>
                            </div>
                            <span className="badge badge-success">{event.data.status}</span>
                          </div>
                        )}

                        {event.type === 'QUOTE' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text)' }}>Presupuesto Generado</h4>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Totalización y envío de cotización profesional.</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--warning)' }}>${Number(event.data.totalAmount).toFixed(2)}</div>
                              <span className="badge badge-warning">{event.data.status}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ningún registro</div>}
          </div>
        )}

        {activeTab === 'CALENDARIO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: 'var(--space-md) 0' }}>
            <CalendarView 
                events={appointments}
                isAdmin={isAdmin}
                onAddEvent={handleOpenAddModal}
                onEditEvent={handleOpenEditModal}
                viewMode="MONTH"
            />

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                 <h3 style={{ margin: 0, color: 'var(--text)' }}>Listado de Tareas Asignadas</h3>
                 <button className="btn btn-ghost btn-sm" onClick={() => handleOpenAddModal(new Date())}>
                   <Plus size={16} /> Nueva Tarea
                 </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {appointments.length > 0 ? (
                  [...appointments].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(task => (
                    <div key={task.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--bg-body)' }}>
                      <div className="status-badge" style={{ backgroundColor: task.status === 'COMPLETADA' ? 'var(--success-bg)' : 'var(--warning-bg)', color: task.status === 'COMPLETADA' ? 'var(--success)' : 'var(--warning)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {task.status}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{task.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> {new Date(task.startTime).toLocaleString()}</span>
                          {task.project && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={12}/> {task.project.title}</span>}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditModal(task)}>Editar</button>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                    No hay tareas programadas para este operador.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        initialData={editingEvent}
        userId={Number(userId)}
        projects={allProjects}
      />
    </div>
  )
}
