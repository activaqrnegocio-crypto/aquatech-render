'use client'

// v373: Badge flotante de sincronización — indica pendientes del outbox

interface OperatorSyncBadgeProps {
  globalPending: number
  isSyncingGlobal: boolean
  globalFailed: number
  isSmallScreen: boolean
  lastError?: string
  onSync?: () => void
}

export default function OperatorSyncBadge({ globalPending, isSyncingGlobal, globalFailed, isSmallScreen, lastError, onSync }: OperatorSyncBadgeProps) {
  // v400: Always show badge if there are failed items or pending ones, allowing manual retry
  if (globalPending <= 0 && !isSyncingGlobal && globalFailed <= 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: isSmallScreen ? '95px' : '30px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '10px',
    }}>
      {/* Detail Label (Floating above button) */}
      {(globalPending > 0 || globalFailed > 0 || isSyncingGlobal) && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(10px)',
          padding: '6px 12px',
          borderRadius: '12px',
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px'
        }}>
          {globalPending > 0 && <span>{globalPending} archivos pendientes</span>}
          {globalFailed > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{globalFailed} fallidos</span>
              {lastError && (
                <span style={{ 
                  color: '#fca5a5', 
                  fontSize: '0.6rem', 
                  maxWidth: '150px', 
                  textAlign: 'right',
                  marginTop: '2px',
                  lineHeight: '1.2'
                }}>
                  {lastError}
                </span>
              )}
            </div>
          )}
          {isSyncingGlobal && <span style={{ color: 'var(--primary)', fontSize: '0.65rem' }}>Subiendo ahora...</span>}
        </div>
      )}

      {/* Main Interactive Button */}
      <button
        onClick={() => onSync?.()}
        disabled={isSyncingGlobal}
        className="group"
        style={{
          background: isSyncingGlobal ? 'var(--primary)' : (globalFailed > 0 ? '#ef4444' : (globalPending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)')),
          color: isSyncingGlobal || globalFailed > 0 || globalPending > 0 ? '#fff' : 'rgba(255,255,255,0.6)',
          padding: '12px 20px',
          borderRadius: '24px',
          fontSize: '0.85rem',
          fontWeight: '900',
          boxShadow: isSyncingGlobal ? '0 0 20px var(--primary-half)' : '0 10px 25px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '1px solid rgba(255,255,255,0.2)',
          cursor: isSyncingGlobal ? 'default' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: 'scale(1)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {isSyncingGlobal ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Sincronizando...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            {globalFailed > 0 ? 'Reintentar' : 'Sincronizar'}
          </>
        )}
      </button>

      <style>{`
        @keyframes pulse-sync {
          0% { transform: scale(1); box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 10px 35px var(--primary-half); }
          100% { transform: scale(1); box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
