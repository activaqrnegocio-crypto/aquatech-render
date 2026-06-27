'use client'

// v373: Header del Operador — Barra superior con estado de conexión y datos del proyecto
interface OperatorHeaderProps {
  project: any
  isOnline: boolean
  mounted: boolean
  localClientName: string
  onStatusChange?: (newStatus: string) => void
}

export default function OperatorHeader({ project, isOnline, mounted, localClientName, onStatusChange }: OperatorHeaderProps) {
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

        {/* Dropdown de Estado */}
        {mounted && project && onStatusChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={project.status === 'NEGOCIANDO' ? 'LEAD' : project.status}
              onChange={(e) => onStatusChange(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                padding: '4px 20px 4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                backgroundPosition: 'right 6px center',
                backgroundRepeat: 'no-repeat',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1L5 5L9 1' stroke='%23${
                  project.status === 'ACTIVO' ? '3b82f6' : (project.status === 'ARCHIVADO' ? '9ca3af' : 'f59e0b')
                }' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
                backgroundColor: project.status === 'ACTIVO' ? 'rgba(59, 130, 246, 0.15)' : (project.status === 'ARCHIVADO' ? 'rgba(156, 163, 175, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                color: project.status === 'ACTIVO' ? '#3b82f6' : (project.status === 'ARCHIVADO' ? '#9ca3af' : '#f59e0b'),
                outline: 'none'
              }}
            >
              <option value="LEAD" style={{ backgroundColor: '#0f172a', color: '#f59e0b' }}>NEGOCIANDO</option>
              <option value="ACTIVO" style={{ backgroundColor: '#0f172a', color: '#3b82f6' }}>ACTIVO</option>
              <option value="ARCHIVADO" style={{ backgroundColor: '#0f172a', color: '#9ca3af' }}>ARCHIVAR</option>
            </select>
          </div>
        )}
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
