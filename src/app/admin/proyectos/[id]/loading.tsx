// v2: Skeleton inmediato mientras carga el proyecto (admin)
// Igual que el operador — evita pantalla blanca mientras se fetchean datos
export default function AdminProjectLoading() {
  return (
    <div style={{ padding: '16px 20px', maxWidth: '100%' }}>
      {/* Breadcrumb skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <div className="skeleton" style={{ height: '20px', width: '80px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ height: '20px', width: '20px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '20px', width: '160px', borderRadius: '6px' }} />
      </div>

      {/* Header card */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: '32px', width: '280px', borderRadius: '8px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '16px', width: '180px', borderRadius: '6px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ height: '36px', width: '120px', borderRadius: '10px' }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: '8px', width: '100%', borderRadius: '4px', marginTop: '16px' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['Vista General', 'Chat', 'Gastos', 'Galería', 'Ficha'].map((tab) => (
          <div key={tab} className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '10px' }} />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <div className="skeleton" style={{ height: '16px', width: `${60 + i * 10}%`, borderRadius: '6px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '12px', width: '85%', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
