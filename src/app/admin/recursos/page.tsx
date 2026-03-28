import React from 'react';

export default function RecursosPage() {
  const recursos = [
    {
      id: 1,
      title: 'Datos para Pagos',
      description: 'Cuentas bancarias y códigos QR para transferencias rápidas.',
      image: '/recursos/recurso-1.jpeg',
      type: 'Pagos'
    },
    {
      id: 2,
      title: '',
      description: '',
      image: '/recursos/recurso-2.jpeg',
      type: 'Documentación'
    },
    {
      id: 3,
      title: '',
      description: '',
      image: '/recursos/recurso-3.jpeg',
      type: 'Materiales'
    }
  ];

  return (
    <div className="p-6">
      <div className="dashboard-header mb-lg" style={{ animation: 'fadeIn 0.5s ease-out' }}>
        <div>
          <h2 className="page-title">Recursos</h2>
          <p className="page-subtitle">
            Material de apoyo, manuales y datos operativos de Aquatech
          </p>
        </div>
      </div>

      <div className="grid-responsive">
        {recursos.map((item) => (
          <div key={item.id} className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: 'var(--bg-deep)' }}>
              <img 
                src={item.image} 
                alt={item.title || 'Recurso'} 
                className="hover-scale"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover'
                }} 
              />
              <div style={{ 
                position: 'absolute', 
                top: '12px', 
                right: '12px',
                background: 'rgba(15, 29, 46, 0.8)',
                backdropFilter: 'blur(4px)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.7rem',
                fontWeight: '700',
                color: 'var(--primary)',
                border: '1px solid var(--border)'
              }}>
                {item.type}
              </div>
            </div>
            <div style={{ padding: '20px' }}>
              {item.title && (
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text)' }}>{item.title}</h3>
              )}
              {item.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
                  {item.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: (!item.title && !item.description) ? '0' : 'auto' }}>
                <a 
                  href={item.image} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  Ver en Pantalla Completa
                </a>
                <a 
                  href={item.image} 
                  download={`aquatech-${(item.title || item.type).toLowerCase().replace(/\s+/g, '-')}`}
                  className="btn btn-secondary btn-sm"
                  title="Descargar"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-lg" style={{ background: 'linear-gradient(135deg, var(--bg-card), var(--bg-deep))', border: '1px solid var(--primary-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: '16px', 
            background: 'var(--primary-glow)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '30px', height: '30px' }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.2rem' }}>¿Necesitas ayuda adicional?</h4>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              Contacta directamente con administración para soporte técnico o administrativo.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>
            Contactar Soporte
          </button>
        </div>
      </div>
    </div>
  );
}
