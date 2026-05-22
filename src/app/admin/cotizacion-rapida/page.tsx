import React from 'react';

export default function CotizacionRapidaPage() {
  return (
    <div className="p-6">
      <div className="dashboard-header mb-6">
        <div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>Cotización Simple</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px', fontSize: '1.1rem' }}>
            Generación rápida de cotizaciones sin proyecto asociado
          </p>
        </div>
      </div>

      <div className="card">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <div className="empty-state-title">En Construcción</div>
          <div className="empty-state-text">Esta vista ha sido reservada para la plantilla de cotización simple que se integrará próximamente. Aquí podrás seleccionar materiales libremente y generar un PDF al instante.</div>
        </div>
      </div>
    </div>
  );
}
