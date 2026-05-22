'use client'

import { useState, useEffect } from 'react'
import { getLocalNow, formatToEcuador, toEcuadorISODate } from '@/lib/date-utils'

export default function ReportesClient({ initialProjects }: { initialProjects: any[] }) {
  const [projectId, setProjectId] = useState<string>('ALL')
  const [timeframe, setTimeframe] = useState<'diario'|'semanal'|'mensual'>('diario')
  // We'll use a simple reference date. For 'diario' it's that day. 
  // For 'semanal', it's the week containing that day. For 'mensual', the month.
  const [selectedDate, setSelectedDate] = useState<string>('')
  
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Initialize date on client only to avoid hydration mismatch
  useEffect(() => {
    setSelectedDate(toEcuadorISODate(getLocalNow()))
  }, [])

  const fetchReports = async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      let start = new Date(selectedDate)
      let end = new Date(selectedDate)

      if (timeframe === 'semanal') {
        // Find Monday of this week
        const day = start.getDay() || 7; 
        if(day !== 1) start.setHours(-24 * (day - 1));
        
        end = new Date(start)
        end.setDate(end.getDate() + 6)
      } else if (timeframe === 'mensual') {
        start = new Date(start.getFullYear(), start.getMonth(), 1)
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      }

      const res = await fetch(`/api/reports?startDate=${start.toISOString()}&endDate=${end.toISOString()}&projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [timeframe, selectedDate, projectId])

  const getDateDisplay = () => {
    if (!selectedDate) return ''
    const d = new Date(selectedDate)
    if (isNaN(d.getTime())) return ''

    if (timeframe === 'diario') {
      return formatToEcuador(d, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } else if (timeframe === 'semanal') {
      const day = d.getDay() || 7; 
      const start = new Date(d); start.setHours(-24 * (day - 1));
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return `Semana: ${formatToEcuador(start, { day: '2-digit', month: '2-digit', year: 'numeric' })} al ${formatToEcuador(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    } else {
      return formatToEcuador(d, { month: 'long', year: 'numeric' })
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="card mb-lg" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Proyecto</label>
            <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="ALL">Todos los Proyectos Activos (Con Movimiento)</option>
              {initialProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tipo de Reporte</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                className={`btn btn-sm ${timeframe === 'diario' ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={() => setTimeframe('diario')}
              >Diario</button>
              <button 
                className={`btn btn-sm ${timeframe === 'semanal' ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={() => setTimeframe('semanal')}
              >Semanal</button>
              <button 
                className={`btn btn-sm ${timeframe === 'mensual' ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={() => setTimeframe('mensual')}
              >Mensual</button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fecha de Referencia</label>
            <input 
              type="date" 
              className="form-input" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px', color: 'var(--primary)', fontWeight: 'bold' }}>
        Resumen {timeframe} / <span style={{ textTransform: 'capitalize' }}>{getDateDisplay()}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando estadísticas...</div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📉</div>
          <h3 style={{ color: 'var(--text-muted)' }}>No hay actividad registrada en este periodo</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Intenta cambiar las fechas o revisar otro proyecto.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {reports.map((report) => (
            <div key={report.project.id} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>{report.project.title}</h3>
                <span className={`badge badge-${report.project.status === 'ACTIVO' ? 'primary' : 'neutral'}`}>
                  {report.project.status}
                </span>
              </div>

              {/* KPIS */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '10px 15px', borderRadius: '8px', minWidth: '120px' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Horas Trabajadas</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{report.stats.totalHours} hrs</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '10px 15px', borderRadius: '8px', minWidth: '120px' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actualizaciones</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{report.stats.totalMessages} </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '10px 15px', borderRadius: '8px', minWidth: '120px' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fotos Evidencia</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{report.stats.totalImages} </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '10px 15px', borderRadius: '8px', minWidth: '120px' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Viáticos Aprobados</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)' }}>$ {report.stats.totalExpenses.toFixed(2)}</div>
                </div>
              </div>

              {/* Data Table */}
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-muted)' }}>👤 Aportación por Operario</h4>
              <div className="table-wrapper" style={{ marginBottom: '20px' }}>
                <table className="table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Operario</th>
                      <th style={{ textAlign: 'center' }}>Horas Trabajadas</th>
                      <th style={{ textAlign: 'center' }}>Mensajes Reportados</th>
                      <th style={{ textAlign: 'center' }}>Fotos Subidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stats.users.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin operarios reportando en este rango.</td></tr>
                    ) : report.stats.users.map((u: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                        <td style={{ textAlign: 'center', color: u.hoursWorked > 0 ? 'var(--primary)' : 'inherit' }}>{u.hoursWorked} hrs</td>
                        <td style={{ textAlign: 'center' }}>{u.msgCount}</td>
                        <td style={{ textAlign: 'center' }}>{u.photoCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent Notes Abstract */}
              {report.recentNotes.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-muted)' }}>📝 Hitos Destacados y Notas Relevantes</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {report.recentNotes.map((note: any) => (
                      <div key={note.id} style={{ padding: '10px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <strong style={{ color: 'var(--primary)' }}>{note.user}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '5px' }}>
                          ({formatToEcuador(note.date, { hour: '2-digit', minute: '2-digit' })})
                        </span>: {note.content}
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
