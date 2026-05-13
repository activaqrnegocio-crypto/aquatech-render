'use client'

import { formatDate } from '@/lib/date-utils'

interface ProjectSummaryProps {
  project: any
  theoreticalDays: number
  realDays: number
  timeRatio: number
  isTiempoExcedido: boolean
  progressPercent: number
  completedPhases: number
  totalPhases: number
}

export default function ProjectSummary({
  project,
  theoreticalDays,
  realDays,
  timeRatio,
  isTiempoExcedido,
  progressPercent,
  completedPhases,
  totalPhases
}: ProjectSummaryProps) {
  return (
    <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--primary)', background: 'linear-gradient(135deg, rgba(56,189,248,0.05) 0%, rgba(56,189,248,0.01) 100%)' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        Resumen de Avance
      </h3>

      <div style={{ display: 'grid', gap: '25px' }}>
        {/* Barra Teórica */}
        <div style={{ opacity: 0.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Cronograma Estimado</span>
            <span style={{ fontWeight: '700', fontSize: '1rem' }}>{theoreticalDays} días</span>
          </div>
          <div className="progress-bar" style={{ height: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
            <div className="progress-fill" style={{ width: '100%', backgroundColor: 'var(--text-muted)', opacity: 0.3 }}></div>
          </div>
        </div>

        {/* Barra Real */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', alignItems: 'center' }}>
            <span style={{ color: isTiempoExcedido ? 'var(--warning)' : 'var(--text-muted)', fontWeight: '600' }}>
              Días Transcurridos
            </span>
            <span style={{ fontWeight: '800', fontSize: '1.2rem', color: isTiempoExcedido ? 'var(--warning)' : 'var(--primary)' }}>
              {realDays} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>días</span>
            </span>
          </div>
          <div className="progress-bar" style={{ height: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', padding: '3px' }}>
            <div className="progress-fill" style={{ 
              width: `${Math.min(timeRatio, 100)}%`, 
              height: '100%',
              backgroundColor: isTiempoExcedido ? 'var(--warning)' : 'var(--primary)',
              borderRadius: '7px',
              boxShadow: isTiempoExcedido ? '0 0 15px rgba(245, 158, 11, 0.4)' : '0 0 15px rgba(56, 189, 248, 0.3)',
              transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}></div>
          </div>
          {isTiempoExcedido && (
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ALERTA: Se ha superado el tiempo estimado original
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '25px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'center' }}>
               <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Fases</div>
               <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{completedPhases} / {totalPhases}</div>
            </div>
            <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-color)', margin: '0 10px' }}></div>
            <div>
               <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Estado</div>
               <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--primary)' }}>{project.status}</div>
            </div>
         </div>
         <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Avance Total</div>
            <div style={{ fontWeight: '900', fontSize: '1.4rem', color: 'var(--success)' }}>{progressPercent}%</div>
         </div>
      </div>

      <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Inicio del Proyecto: <span style={{ color: 'var(--text)', fontWeight: '600' }}>{formatDate(project.startDate)}</span>
      </div>
    </div>
  )
}
