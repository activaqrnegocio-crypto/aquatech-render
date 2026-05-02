// v281: Instant loading skeleton so the user sees content immediately 
// while the server fetches project data (was blank screen for 10s before this).
export default function OperatorProjectLoading() {
  return (
    <div style={{ padding: '0', maxWidth: '100%' }}>
      {/* Back button skeleton */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="skeleton" style={{ height: '36px', width: '90px', borderRadius: '10px' }} />
        <div className="skeleton" style={{ height: '20px', width: '160px', borderRadius: '6px' }} />
      </div>

      {/* Header card skeleton */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div className="skeleton" style={{ height: '28px', width: '200px', borderRadius: '8px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '16px', width: '130px', borderRadius: '6px' }} />
            </div>
            <div className="skeleton" style={{ height: '32px', width: '90px', borderRadius: '20px' }} />
          </div>
          {/* Progress bar */}
          <div className="skeleton" style={{ height: '8px', width: '100%', borderRadius: '4px', marginTop: '12px' }} />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div style={{ padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['Chat', 'Tareas', 'Galería', 'Info'].map((tab) => (
            <div
              key={tab}
              className="skeleton"
              style={{ height: '38px', minWidth: '80px', borderRadius: '20px', flexShrink: 0 }}
            />
          ))}
        </div>
      </div>

      {/* Chat area skeleton */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Messages - alternating left/right */}
        {[
          { width: '65%', align: 'flex-start' },
          { width: '50%', align: 'flex-end' },
          { width: '75%', align: 'flex-start' },
          { width: '45%', align: 'flex-end' },
          { width: '60%', align: 'flex-start' },
        ].map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.align }}>
            <div
              className="skeleton"
              style={{
                height: '52px',
                width: msg.width,
                borderRadius: '14px',
              }}
            />
          </div>
        ))}
      </div>

      {/* Input area skeleton */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: '8px', alignItems: 'center'
      }}>
        <div className="skeleton" style={{ height: '48px', flex: 1, borderRadius: '14px' }} />
        <div className="skeleton" style={{ height: '48px', width: '48px', borderRadius: '14px', flexShrink: 0 }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.04) 25%, 
            rgba(255,255,255,0.08) 50%, 
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  )
}
