'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function BitacoraClient({ project, isAdmin }: any) {
  const [filterPhase, setFilterPhase] = useState<string>('all')

  const formatDateTime = (date: string) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('es-ES', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    }).format(new Date(date))
  }

  // Filter messages
  const filteredMessages = project.chatMessages.filter((msg: any) => {
    if (filterPhase === 'all') return true
    return msg.phaseId?.toString() === filterPhase
  })

  const handleDownloadCsv = () => {
    // Generar CSV
    const headers = ['Fecha', 'Operador/Usuario', 'Fase', 'Tipo', 'Latitud', 'Longitud', 'Mensaje/Log']
    
    const rows = filteredMessages.map((msg: any) => {
      const date = formatDateTime(msg.createdAt)
      const user = msg.user?.name || 'Sistema'
      const phase = msg.phase?.title || 'General'
      const type = msg.type || 'TEXT'
      let content = msg.content || ''
      
      if (msg.type === 'IMAGE' || msg.type === 'VIDEO') {
        content = `[Archivo Adjunto] ${content}`
      }

      const lat = msg.lat || ''
      const lng = msg.lng || ''
      
      // Escape quotes and wrap in quotes to prevent CSV parsing issues
      const escapedContent = `"${content.replace(/"/g, '""')}"`
      return [date, user, phase, type, lat, lng, escapedContent]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(','))
    ].join('\n')

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Chat_Proyecto_${project.id}_${project.title.replace(/\s+/g, '_')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6">
      <div className="dashboard-header mb-6" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href={isAdmin ? `/admin/proyectos/${project.id}` : `/admin/operador/proyecto/${project.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              &larr; Volver al Proyecto
            </Link>
            <h2 style={{ fontSize: '1.8rem', margin: '10px 0 0 0' }}>Chat Completo</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{project.title}</p>
          </div>
          <button 
            onClick={handleDownloadCsv}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar Excel (CSV)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: 'bold' }}>Filtrar por Fase:</label>
          <select 
            className="form-input" 
            value={filterPhase} 
            onChange={(e) => setFilterPhase(e.target.value)}
            style={{ minWidth: '250px' }}
          >
            <option value="all">Todas las Fases</option>
            {project.phases.map((p: any) => (
              <option key={p.id} value={p.id.toString()}>
                {p.displayOrder}. {p.title}
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ({filteredMessages.length} registros encontrados)
          </span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredMessages.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginBottom: '10px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No hay mensajes en el chat para este filtro.</p>
          </div>
        ) : (
          filteredMessages.map((msg: any) => (
            <div key={msg.id} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                {msg.user?.name.substring(0,2).toUpperCase() || 'SYS'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text)' }}>{msg.user?.name || 'Sistema Auto'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDateTime(msg.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {msg.lat && msg.lng && (
                      <a href={`https://www.google.com/maps?q=${msg.lat},${msg.lng}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--info)', textDecoration: 'none', backgroundColor: 'var(--info-bg)', padding: '2px 6px', borderRadius: '8px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Ubicación
                      </a>
                    )}
                    {msg.phase && (
                      <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-deep)', padding: '2px 6px', borderRadius: '8px', color: 'var(--primary)' }}>
                        Fase {msg.phase.displayOrder}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: msg.type === 'NOTE' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface)', 
                  padding: '8px 12px', 
                  borderRadius: '0 8px 8px 8px', 
                  border: msg.type === 'NOTE' ? '1px solid var(--warning)' : 'none',
                  color: 'var(--text)',
                  fontSize: '0.85rem'
                }}>
                  {msg.type === 'NOTE' && <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>Nota Destacada</div>}
                  
                  {msg.media && msg.media.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      {msg.media[0].mimeType.startsWith('image') ? (
                        <a href={msg.media[0].url} target="_blank" rel="noreferrer">
                          <img src={msg.media[0].url} alt="Evidencia adjunta" style={{ width: '100%', maxWidth: '250px', borderRadius: '6px', cursor: 'zoom-in', display: 'block' }} />
                        </a>
                      ) : (
                        <video src={msg.media[0].url} controls style={{ width: '100%', maxWidth: '250px', borderRadius: '6px' }} />
                      )}
                    </div>
                  )}
                  
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.content}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
