'use client'

// v373: Badge flotante de sincronización — indica pendientes del outbox

interface OperatorSyncBadgeProps {
  globalPending: number
  isSyncingGlobal: boolean
  globalFailed: number
  isSmallScreen: boolean
}

export default function OperatorSyncBadge({ globalPending, isSyncingGlobal, globalFailed, isSmallScreen }: OperatorSyncBadgeProps) {
  if (globalPending <= 0 && !isSyncingGlobal && globalFailed <= 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: isSmallScreen ? '85px' : '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none'
    }}>
      <div style={{
        background: isSyncingGlobal ? 'var(--primary)' : ((globalFailed > 0 || globalPending > 0) ? '#f59e0b' : 'rgba(255,255,255,0.1)'),
        color: isSyncingGlobal ? '#000' : '#fff',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        animation: isSyncingGlobal && globalPending > 0 ? 'pulse 1.5s infinite' : 'none',
        pointerEvents: 'auto',
        opacity: isSyncingGlobal || globalPending > 0 || globalFailed > 0 ? 1 : 0,
        transition: 'all 0.3s ease'
      }}>
        {isSyncingGlobal ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Sincronizando...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
            {globalPending + globalFailed} pendientes de subir
          </>
        )}
      </div>
    </div>
  )
}
