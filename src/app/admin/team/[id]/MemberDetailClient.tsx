'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { 
  Mail, Phone, Calendar, Briefcase, MessageSquare, Receipt, 
  Clock, ArrowLeft, MapPin, Image as ImageIcon, Activity
} from 'lucide-react'

type TabType = 'ACTIVIDAD' | 'GASTOS' | 'ASISTENCIA' | 'PROYECTOS'

export default function MemberDetailClient() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id
  
  const [member, setMember] = useState<any>(null)
  const [activityData, setActivityData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('PROYECTOS')
  const [monthFilter, setMonthFilter] = useState('ALL')

  useEffect(() => {
    fetchMemberData()
  }, [userId])

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
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}` // YYYY-MM
      months.add(key)
    })
    return Array.from(months).sort((a,b) => b.localeCompare(a)) // Descending
  }, [activityData])

  const filteredTimeline = useMemo(() => {
    if (!activityData?.timeline) return []
    
    let logs = activityData.timeline
    if (activeTab === 'ACTIVIDAD') logs = logs.filter((l: any) => l.type === 'CHAT_MESSAGE')
    if (activeTab === 'GASTOS') logs = logs.filter((l: any) => l.type === 'EXPENSE')
    if (activeTab === 'ASISTENCIA') logs = logs.filter((l: any) => l.type === 'ATTENDANCE')
    
    if (monthFilter !== 'ALL') {
      logs = logs.filter((l: any) => {
        const d = new Date(l.timestamp)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`
        return key === monthFilter
      })
    }

    const groups: { [key: string]: any[] } = {}
    logs.forEach((event: any) => {
      const dateKey = new Date(event.timestamp).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(event)
    })

    return Object.entries(groups).sort((a, b) => {
        return new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime()
    })
  }, [activityData, activeTab, monthFilter])

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}>
      <strong>Cargando Panel 360...</strong>
    </div>
  )

  if (error) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}><strong>{error}</strong></div>
  if (!member) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><strong>Operador no encontrado</strong></div>

  const isGlobalActivity = member.stats.totalMessages + member.stats.totalExpenses + member.stats.totalDayRecords

  return (
    <div className="admin-content" style={{ padding: 'var(--space-xl)', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* 1. TOP HEADER & NAVIGATION */}
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

      {/* 2. INTERACTIVE METRIC CARDS (KPI GRID) */}
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
          onClick={() => setActiveTab('ACTIVIDAD')}
          style={{ cursor: 'pointer', border: activeTab === 'ACTIVIDAD' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
            <MessageSquare size={22} />
          </div>
          <div className="kpi-value">{member.stats.totalMessages}</div>
          <div className="kpi-label">Reportes de Campo</div>
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
          onClick={() => setActiveTab('ASISTENCIA')}
          style={{ cursor: 'pointer', border: activeTab === 'ASISTENCIA' ? '1px solid var(--primary)' : undefined }}
        >
          <div className="kpi-icon" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-value">{member.stats.totalDayRecords}</div>
          <div className="kpi-label">Días Trabajados</div>
        </div>
      </div>

      {/* 3. DYNAMIC METRIC SECTION */}
      <div className="card" style={{ marginTop: 'var(--space-2xl)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>
               {activeTab === 'PROYECTOS' ? 'Historial de Proyectos Asignados' : `Registros Detallados: ${activeTab}`}
            </h2>
            
            {activeTab !== 'PROYECTOS' && availableMonths.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar por Mes:</label>
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

        {/* PROYECTOS VIEW */}
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
                        {new Date(proj.assignedAt).toLocaleDateString()}
                    </span>
                </div>
              </div>
            ))}
            {member.projects.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin proyectos asignados</div>
            )}
          </div>
        )}

        {/* TIMELINE VIEWS (ACTIVIDAD, GASTOS, ASISTENCIA) */}
        {activeTab !== 'PROYECTOS' && (
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
                        
                        {/* Event Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                                <Briefcase size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}/>
                                {event.projectTitle}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        {/* Event Body: CHAT MESSAGE */}
                        {event.type === 'CHAT_MESSAGE' && (
                          <div>
                            {event.data.content && (
                              <p style={{ fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 var(--space-md) 0' }} 
                                 dangerouslySetInnerHTML={{ __html: event.data.content.replace(/\n/g, '<br/>') }}></p>
                            )}
                            
                            {/* IMAGES */}
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

                        {/* Event Body: ATTENDANCE */}
                        {event.type === 'ATTENDANCE' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                            <div style={{ textAlign: 'center', backgroundColor: 'var(--success-bg)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>ENTRADA</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--text)' }}>{new Date(event.data.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                            </div>
                            <div style={{ textAlign: 'center', backgroundColor: 'var(--warning-bg)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 'bold' }}>SALIDA</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--text)' }}>{event.data.endTime ? new Date(event.data.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong>
                            </div>
                            <div style={{ textAlign: 'center', backgroundColor: 'var(--info-bg)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--info)', fontWeight: 'bold' }}>DURACIÓN</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--text)' }}>
                                    {event.data.endTime ? (
                                        (() => {
                                            const diff = new Date(event.data.endTime).getTime() - new Date(event.data.startTime).getTime();
                                            const h = Math.floor(diff / (1000 * 60 * 60));
                                            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                            return `${h}h ${m}m`;
                                        })()
                                    ) : (
                                        <span style={{ animation: 'pulse 1.5s infinite' }}>En Progreso</span>
                                    )}
                                </strong>
                            </div>
                          </div>
                        )}

                        {/* Event Body: EXPENSE */}
                        {(event.type === 'EXPENSE' || event.type === 'GASTOS') && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                             <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text)' }}>{event.data.description || 'Gasto no descrito'}</h4>
                                <span className="badge badge-neutral">{event.data.category}</span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success)' }}>
                                  ${Number(event.data.amount).toFixed(2)}
                                </span>
                                {event.data.receiptUrl && (
                                    <a href={event.data.receiptUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                                        Ver Recibo
                                    </a>
                                )}
                             </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ningún registro en esta categoría</div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
