'use client'

// v373: Info del Cliente — compartido entre Admin y Operador
interface ProjectClientInfoProps {
  project: any
}

export default function ProjectClientInfo({ project }: ProjectClientInfoProps) {
  return (
    <div className="card" style={{ minWidth: 0, margin: 0 }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Información del Cliente
      </h3>
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>{project.client?.name || 'Cliente sin nombre'}</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {project?.client?.phone || 'Sin teléfono'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span style={{ wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project?.client?.email || 'Sin email'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {(() => {
            const findGpsLink = (text: string) => {
              if (!text) return null
              const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s"']+/i)
              return match ? match[0] : null
            }
            let locLink = project?.locationLink
            if (!locLink || locLink === 'N/A') {
              try { const specs = JSON.parse(project?.technicalSpecs || '{}'); locLink = specs.locationLink || findGpsLink(project?.address || '') || findGpsLink(project?.technicalSpecs || '') } catch { locLink = findGpsLink(project?.address || '') || findGpsLink(project?.technicalSpecs || '') }
            }
            if (locLink && (locLink.includes('google.com/maps') || locLink.includes('maps.app.goo.gl') || locLink.startsWith('http'))) {
              return <a href={locLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Ver en Mapa</a>
            }
            return <span>{project?.address || project?.client?.address || 'Sin dirección'}</span>
          })()}
        </div>
      </div>
    </div>
  )
}
