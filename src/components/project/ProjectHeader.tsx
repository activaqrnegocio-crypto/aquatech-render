'use client'

import { translateType } from '@/lib/constants'

// v373: Componente compartido — Admin y Operador usan el mismo header
interface ProjectHeaderProps {
  project: any
  currentStatus: string
  isUpdatingStatus: boolean
  isOfflineMode: boolean
  onStatusChange: (newStatus: string) => void
  session: any
}

export default function ProjectHeader({
  project,
  currentStatus,
  isUpdatingStatus,
  isOfflineMode,
  onStatusChange,
  session,
}: ProjectHeaderProps) {

  return (
    <div className="dashboard-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={['COMPLETADO', 'CANCELADO', 'PENDIENTE'].includes(currentStatus) ? 'ARCHIVADO' : currentStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={isUpdatingStatus}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                backgroundColor: currentStatus === 'LEAD' ? 'rgba(234, 179, 8, 0.15)' : currentStatus === 'ACTIVO' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                color: currentStatus === 'LEAD' ? '#fbbf24' : currentStatus === 'ACTIVO' ? '#38bdf8' : '#9ca3af',
                border: '1px solid currentColor',
                cursor: 'pointer', appearance: 'auto',
                textTransform: 'uppercase',
                outline: 'none'
              }}
            >
              <option value="LEAD" style={{ backgroundColor: '#0f172a', color: '#fbbf24' }}>Negociando</option>
              <option value="ACTIVO" style={{ backgroundColor: '#0f172a', color: '#38bdf8' }}>Activo</option>
              <option value="ARCHIVADO" style={{ backgroundColor: '#0f172a', color: '#9ca3af' }}>Archivado</option>
            </select>
            {project?.creator && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Creado por: {project?.creator?.name}
              </span>
            )}
          </div>
        </div>
        <h2 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {project?.title || 'Cargando...'}
          {isOfflineMode && (
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '10px', border: '1px solid #ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Offline
            </span>
          )}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '5px', fontSize: '1.1rem' }}>
          {translateType(project?.type)} {project?.subtype ? `— ${project?.subtype}` : ''}
        </p>
      </div>
      {/* Presupuesto rápido — oculto por defecto, visible si se necesita */}
      <div style={{ textAlign: 'right', display: 'none' }}>
        {session?.user?.role !== 'OPERADOR' && session?.user?.role !== 'OPERATOR' && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Subtotal: $ {(Number(project?.estimatedBudget || 0) / 1.15).toFixed(2)}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IVA 15%: $ {(Number(project?.estimatedBudget || 0) - Number(project?.estimatedBudget || 0) / 1.15).toFixed(2)}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Total a cobrar</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              $ {Number(project?.estimatedBudget || 0).toFixed(2)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
