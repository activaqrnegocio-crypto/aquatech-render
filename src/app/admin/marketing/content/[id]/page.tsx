import React from 'react'
import { prisma as db } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import HeadlineSelector from '@/components/marketing/HeadlineSelector'
import MarketingCalendar from '@/components/marketing/MarketingCalendar'
// ULTIMATE LOCAL RESOLUTION
import { UltraLocalEditor } from './ArticleEditorView'

export default async function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const pipelineId = parseInt(resolvedParams.id)
  
  if (isNaN(pipelineId)) {
    notFound()
  }

  const pipeline = await db.contentPipeline.findUnique({
    where: { id: pipelineId },
    include: {
      headlineOptions: true,
      articles: true,
      socialPosts: true,
    }
  })

  if (!pipeline) {
    notFound()
  }

  // Calculamos en qué paso estamos
  const status = pipeline.status

  return (
    <div className="pipeline-detail-page" style={{ maxWidth: '100vw', margin: '0 2rem', padding: '2rem' }}>
      
      <Link 
        href="/admin/marketing/content" 
        className="btn btn-outline-secondary mb-4"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', textDecoration: 'none', color: 'var(--text-color)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Volver a la Lista
      </Link>

      {/* Header */}
      <div className="card shadow-sm p-4 mb-4" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="badge mb-2" style={{ background: 'var(--primary-color)', color: 'white', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>
              PIPELINE ACTIVO
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
              Idea: {pipeline.idea}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              {pipeline.ideaContext ? `Contexto: ${pipeline.ideaContext}` : 'Sin contexto adicional proporcionado.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Estado Actual:</div>
            <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', background: 'rgba(8, 145, 178, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              {status}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper (Simplified) */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        {[
          { label: '1. Títulos', active: status === 'IDEA' || status === 'HEADLINES' },
          { label: '2. Pilar', active: status === 'WRITING' },
          { label: '3. Clusters', active: status === 'REVIEWING_ARTICLES' },
          { label: '4. Imágenes', active: status === 'GENERATING_IMAGES' },
          { label: '5. Social RRSS', active: status === 'SOCIAL_DRAFTING' || status === 'SOCIAL_IMAGES' },
        ].map((step, i) => (
          <div key={i} style={{ 
            padding: '0.8rem 1.5rem', 
            background: step.active ? 'var(--primary-color)' : 'var(--card-bg)', 
            color: step.active ? 'white' : 'var(--text-muted)', 
            borderRadius: '8px', 
            border: step.active ? 'none' : '1px solid var(--border-color)',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            {step.label}
          </div>
        ))}
      </div>

      {/* Main Content Area based on Status */}
      <div className="pipeline-workspace">
        {(status === 'IDEA' || status === 'HEADLINES') && (
          <HeadlineSelector pipeline={pipeline} />
        )}

        {status === 'WRITING' && (
          <div className="card shadow-sm p-5 text-center" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h2 style={{ color: 'var(--text-color)' }}>Redactando Artículo Pilar...</h2>
            <p style={{ color: 'var(--text-muted)' }}>La IA de Groq está trabajando en el Markdown de ~1200-1500 palabras.</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>Si esto demora más de 2 minutos, intenta refrescar la página.</p>
          </div>
        )}

        {status === 'REVIEWING_ARTICLES' && (() => {
          const pillarArticle = pipeline.articles?.find((a: any) => a.type === 'PILLAR')
          return (
            <UltraLocalEditor 
              article={pillarArticle} 
              pipelineId={pipeline.id} 
            />
          )
        })()}

        {/* We will add more status handlers in next phases */}
      </div>

      <div className="mt-5">
        <MarketingCalendar />
      </div>
      
    </div>
  )
}
