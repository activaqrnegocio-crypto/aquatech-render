'use client'

import React from 'react'
import Link from 'next/link'
import MarketingCalendar from '@/components/marketing/MarketingCalendar'

export default function MarketingPage() {
  return (
    <div className="marketing-page">
      <Link 
        href="/admin" 
        className="btn btn-outline-secondary mb-4"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', textDecoration: 'none', color: 'var(--text-color)', fontSize: '0.9rem' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Volver al Dashboard
      </Link>
      
      <div className="page-header">
        <div>
          <h1 className="page-title">Módulo de Marketing</h1>
          <p className="page-description">Gestiona tus campañas, leads y estrategias de marketing desde aquí.</p>
        </div>
      </div>

      <div className="marketing-content" style={{ marginTop: '2rem' }}>
        <div className="card text-center p-5 mt-4" style={{ 
          background: 'var(--card-bg)', 
          borderRadius: '16px', 
          border: '2px solid var(--primary-color)',
          boxShadow: '0 10px 25px -5px rgba(var(--primary-rgb), 0.1)'
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-color)' }}>
            <span style={{ fontSize: '2rem', marginRight: '10px' }}>🤖</span>
            Generador Automático de Contenido (Pipeline SEO)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto 2rem' }}>
            Transforma una idea en una estrategia completa. Crea el <strong>Artículo Pilar</strong>, subtemas <strong>Clusters</strong>, y la grilla de publicaciones para <strong>Facebook e Instagram</strong> utilizando Inteligencia Artificial entrenada con el ADN de Aquatech.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.href='/admin/marketing/content'}
            style={{ 
              padding: '0.8rem 2rem', 
              fontSize: '1.1rem', 
              fontWeight: '600', 
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            Ir al Generador
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>

        {/* CALENDARIO DE MARKETING - AHORA DIRECTAMENTE DEBAJO DEL GENERADOR */}
        <MarketingCalendar />
      </div>

      <style jsx>{`
        .marketing-page {
          padding: 2rem;
          max-width: 1300px;
          margin: 0 auto;
        }
        .page-header {
          margin-bottom: 2rem;
        }
        .page-title {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-color);
          margin-bottom: 0.5rem;
        }
        .page-description {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}

