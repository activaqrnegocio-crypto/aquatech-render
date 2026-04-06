import React from 'react'
import Link from 'next/link'
import { prisma as db } from '@/lib/prisma'
import { formatDateEcuador } from '@/lib/date-utils'
import MarketingCalendar from '@/components/marketing/MarketingCalendar'

export const dynamic = 'force-dynamic'

export default async function ContentPipelinesPage() {
  const pipelines = await db.contentPipeline.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: true,
      articles: true,
    }
  })

  return (
    <div className="pipelines-page">
      <Link 
        href="/admin/marketing" 
        className="btn btn-outline-secondary mb-4"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', textDecoration: 'none', color: 'var(--text-color)', fontSize: '0.9rem' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Volver a Marketing
      </Link>

      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
            Content Pipelines
          </h1>
          <p className="page-description" style={{ color: 'var(--text-muted)' }}>
            Gestiona la estrategia automatizada de Artículos SEO y Redes Sociales.
          </p>
        </div>
        <div>
          <Link href="/admin/marketing/content/new" className="btn btn-primary" style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 10px rgba(8, 145, 178, 0.2)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Pipeline
          </Link>
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="empty-state text-center p-5" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <h3 style={{ color: 'var(--text-color)' }}>No hay pipelines creados aún</h3>
          <p style={{ color: 'var(--text-muted)' }}>Empieza generando contenido SEO estructurado e inteligente.</p>
        </div>
      ) : (
        <div className="pipelines-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pipelines.map(pipeline => (
            <Link href={`/admin/marketing/content/${pipeline.id}`} key={pipeline.id} style={{ textDecoration: 'none' }}>
              <div className="pipeline-card p-4" style={{
                background: 'var(--card-bg)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}>
                <div>
                  <h4 style={{ color: 'var(--text-color)', marginBottom: '0.25rem', fontWeight: '600' }}>
                    {pipeline.idea}
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span>Creado el {formatDateEcuador(pipeline.createdAt)}</span>
                    <span>Estado: <span className="badge" style={{ background: 'var(--primary-color)', color: 'white', borderRadius: '4px', padding: '0.2rem 0.5rem' }}>{pipeline.status}</span></span>
                    <span>Autor: {pipeline.createdBy?.name || 'Usuario'}</span>
                  </div>
                </div>
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-5 pt-5 pb-5" style={{ borderTop: '2px solid var(--border-color)', marginTop: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '1.5rem' }}>
          Calendario Editorial (Social Media)
        </h2>
        <MarketingCalendar />
      </div>
    </div>
  )
}
