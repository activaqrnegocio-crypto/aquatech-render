'use client'

// v373: Header del Operador — Barra superior con estado de conexión y datos del proyecto
interface OperatorHeaderProps {
  project: any
  isOnline: boolean
  mounted: boolean
  localClientName: string
}

export default function OperatorHeader({ project, isOnline, mounted, localClientName }: OperatorHeaderProps) {
  return (
    <div style={{ 
      padding: '12px 16px', 
      borderBottom: '1px solid rgba(255,255,255,0.05)', 
      backgroundColor: 'rgba(0,0,0,0.4)', 
      backdropFilter: 'blur(20px)',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '0.7rem', 
            color: !mounted ? 'var(--text-muted)' : (isOnline ? 'var(--success)' : 'var(--warning)'), 
            backgroundColor: 'var(--bg-deep)', 
            padding: '2px 8px', 
            borderRadius: '12px', 
            border: '1px solid currentColor', 
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              backgroundColor: 'currentColor'
            }}></div>
            {mounted ? (isOnline ? 'EN LÍNEA' : 'MODO OFFLINE') : '...'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {project?.title || (mounted ? 'Proyecto sin nombre' : 'Cargando...')}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
            {project?.clientName || project?.client?.name || localClientName || 'Cliente no especificado'}
          </span>
        </div>
      </div>
    </div>
  )
}
