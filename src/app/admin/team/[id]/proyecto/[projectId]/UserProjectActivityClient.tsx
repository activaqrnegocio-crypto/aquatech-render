'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatTimeEcuador, formatDateLongEcuador } from '@/lib/date-utils'

// Inline SVG icons to avoid lucide-react webpack bundling issues
const svgProps = (size: number, style?: React.CSSProperties, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', ...style }, className
})
const ArrowLeft = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
const MessageSquare = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const Receipt = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>
const Clock = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const MapPin = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
const Calendar = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
const Activity = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
const Briefcase = ({ size = 24, style, className }: any) => <svg {...svgProps(size, style, className)}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>

export default function UserProjectActivityClient() {
  const params = useParams()
  const userId = params.id
  const projectId = params.projectId
  
  const [activityData, setActivityData] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthFilter, setMonthFilter] = useState('ALL')

  useEffect(() => {
    fetchActivity()
  }, [userId, projectId])

  const fetchActivity = async () => {
    try {
      const [userRes, activityRes] = await Promise.all([
        fetch(`/api/users/${userId}`),
        fetch(`/api/users/${userId}/projects/${projectId}/activity`)
      ])

      if (!userRes.ok || !activityRes.ok) throw new Error('Error al cargar datos de actividad')
      
      const userData = await userRes.json()
      const logData = await activityRes.json()

      setMember(userData)
      setActivityData(logData)
      
      const proj = userData.projects.find((p: any) => p.id === Number(projectId))
      setProject(proj)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Group Chronological Sorting & Grouping by Date
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

  const groupedTimeline = useMemo(() => {
    if (!activityData?.timeline) return []
    
    let logs = activityData.timeline
    if (monthFilter !== 'ALL') {
      logs = logs.filter((event: any) => {
        const d = new Date(event.timestamp)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`
        return key === monthFilter
      })
    }

    const groups: { [key: string]: any[] } = {}
    
    logs.forEach((event: any) => {
      const dateKey = formatDateLongEcuador(event.timestamp)

      
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(event)
    })

    // Sort events within groups (latest first)
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    })
    
    // Convert to sorted array of groups (latest day first)
    return Object.entries(groups).sort((a, b) => {
        return new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime()
    })
  }, [activityData, monthFilter])

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}><strong>Sincronizando chat de campo...</strong></div>
  if (error) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}><strong>{error}</strong></div>
  if (!activityData) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><strong>Chat vacío</strong></div>

  const formatTime = (dateValue: string) => {
    return formatTimeEcuador(dateValue)
  }

  const getEventIconDetails = (type: string, dataParams: any) => {
    if (type === 'CHAT_MESSAGE') {
        if(dataParams?.type === 'DAY_START') return { icon: Clock, bg: 'var(--success-bg)', color: 'var(--success)' };
        if(dataParams?.type === 'DAY_END') return { icon: Clock, bg: 'var(--danger-bg)', color: 'var(--danger)' };
        return { icon: MessageSquare, bg: 'var(--info-bg)', color: 'var(--info)' };
    }
    if (type === 'EXPENSE') return { icon: Receipt, bg: 'var(--warning-bg)', color: 'var(--warning)' };
    if (type === 'ATTENDANCE') return { icon: Clock, bg: 'var(--primary-glow)', color: 'var(--primary)' };
    return { icon: Activity, bg: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' };
  }

  return (
    <div className="admin-content" style={{ padding: 'var(--space-xl)', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* HEADER SECTION */}
      <div className="page-header" style={{ marginBottom: 'var(--space-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href={`/admin/team/${userId}`} className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Ver Perfil de {member?.name}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <div className="kpi-icon" style={{ marginBottom: 0, backgroundColor: 'var(--info-bg)', color: 'var(--info)', width: '48px', height: '48px' }}>
                 <Briefcase size={24} />
             </div>
             <div>
                 <h1 className="page-title" style={{ marginBottom: '4px' }}>{project?.title || 'Expediente de Obra'}</h1>
                 <p className="page-subtitle">AUDITORÍA OPERATIVA INDIVIDUAL</p>
             </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right', paddingRight: '1rem', borderRight: '1px solid var(--border)' }}>
                <strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--info)' }}>{activityData.activityCount}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Eventos</span>
            </div>
            <div style={{ textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--text)' }}>1</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Proyectos</span>
            </div>
        </div>
      </div>

      {availableMonths.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-deep)', padding: '8px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <Calendar size={14} className="text-primary" />
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar Registro por Mes:</label>
                <select 
                  style={{ padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
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
          </div>
      )}

      {/* TIMELINE SECTION */}
      {groupedTimeline.length > 0 ? (
        <div style={{ position: 'relative', marginTop: 'var(--space-2xl)' }}>
          {/* Timeline continuous vertical line */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '20px', width: '2px', backgroundColor: 'var(--border)', zIndex: 0 }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
            {groupedTimeline.map(([dateLabel, events]: any) => (
              <div key={dateLabel} style={{ position: 'relative' }}>
                
                {/* Day Header */}
                <div style={{ position: 'relative', zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-deep)', padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', marginBottom: 'var(--space-md)', marginLeft: '6px' }}>
                   <Calendar size={14} style={{ color: 'var(--primary)' }} />
                   <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>{dateLabel}</span>
                   <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--border)', borderRadius: '50%' }}></span>
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{events.length} actualizaciones</span>
                </div>

                {/* Event Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  {events.map((event: any, idx: number) => {
                    const iconMeta = getEventIconDetails(event.type, event.data);
                    
                    return (
                      <div key={idx} style={{ position: 'relative', paddingLeft: '60px' }}>
                        
                        {/* Dot / Icon on the timeline */}
                        <div style={{ position: 'absolute', left: '0px', top: '10px', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: iconMeta.bg, border: `2px solid var(--bg-deep)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconMeta.color, zIndex: 10 }}>
                          <iconMeta.icon size={16} />
                        </div>

                        {/* Timestamp above card */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: '4px' }}>
                          {formatTime(event.timestamp)}
                        </div>

                        {/* Event Card */}
                        <div className="card" style={{ padding: 'var(--space-md)' }}>
                          
                          {event.type === 'CHAT_MESSAGE' && (
                            <div>
                              <div style={{ marginBottom: 'var(--space-sm)' }}>
                                  <span className={`badge ${event.data.type === 'DAY_START' ? 'badge-success' : event.data.type === 'DAY_END' ? 'badge-danger' : 'badge-info'}`}>
                                      {event.data.type === 'DAY_START' ? 'Inicio de Turno' : 
                                       event.data.type === 'DAY_END' ? 'Fin de Turno' : 
                                       event.data.type === 'EXPENSE_LOG' ? 'Registro de Gasto' : 
                                       event.data.type === 'PHASE_COMPLETE' ? 'Meta Alcanzada' : 'Comentario'}
                                  </span>
                              </div>
                              
                              {event.data.content && (
                                <p style={{ fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }} 
                                   dangerouslySetInnerHTML={{ __html: event.data.content.replace(/\n/g, '<br/>') }}></p>
                              )}
                              
                              {event.data.media && event.data.media.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                                  {event.data.media.map((m: any) => (
                                    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" 
                                       style={{ display: 'block', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                      <img src={m.url} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </a>
                                  ))}
                                </div>
                              )}

                              {event.data.lat !== undefined && event.data.lat !== null && (
                                <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      <MapPin size={12} style={{ color: 'var(--danger)' }} />
                                      {Number(event.data.lat).toFixed(4)}, {Number(event.data.lng).toFixed(4)}
                                  </span>
                                  <a href={`https://www.google.com/maps?q=${event.data.lat},${event.data.lng}`} 
                                     target="_blank" rel="noreferrer" className="badge badge-info">
                                      Ver en Mapa
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {event.type === 'EXPENSE' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <div className="kpi-icon" style={{ width: '40px', height: '40px', marginBottom: 0, backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                                      <Receipt size={20} />
                                  </div>
                                  <div>
                                      <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--success)', letterSpacing: '1px' }}>Reporte Financiero</span>
                                      <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text)' }}>{event.data.description || 'Gasto Operativo'}</strong>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.data.category}</span>
                                  </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--success)', fontWeight: 900 }}>-${Number(event.data.amount).toFixed(2)}</strong>
                                  {event.data.receiptUrl && (
                                      <a href={event.data.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline' }}>Recibo Digital</a>
                                  )}
                              </div>
                            </div>
                          )}

                          {event.type === 'ATTENDANCE' && (
                            <div>
                              <div style={{ marginBottom: 'var(--space-md)' }}>
                                  <span className="badge badge-info">Control Horario</span>
                              </div>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
                                <div style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-bg)', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CHECK IN</span>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>{formatTimeEcuador(event.data.startTime)}</strong>
                                </div>
                                <div style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--danger-bg)', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CHECK OUT</span>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                                        {event.data.endTime ? formatTimeEcuador(event.data.endTime) : '--:--'}
                                    </strong>
                                </div>
                                <div style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--info-bg)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--info)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>DURACIÓN</span>
                                  <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                                      {event.data.endTime ? (
                                          (() => {
                                              const diff = new Date(event.data.endTime).getTime() - new Date(event.data.startTime).getTime();
                                              const h = Math.floor(diff / (1000 * 60 * 60));
                                              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                              return `${h}h ${m}m`;
                                          })()
                                      ) : (
                                          <span style={{ animation: 'pulse 1.5s infinite', color: 'var(--info)' }}>Activo</span>
                                      )}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '4rem 0', textAlign: 'center', opacity: 0.5, border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <Activity size={48} style={{ margin: '0 auto var(--space-md) auto', color: 'var(--text-muted)' }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sin registros sincronizados</p>
        </div>
      )}
    </div>
  )
}
