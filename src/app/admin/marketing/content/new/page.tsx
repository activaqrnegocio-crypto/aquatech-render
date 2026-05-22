'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createContentPipelineAction } from '@/actions/marketing'
import MarketingCalendar from '@/components/marketing/MarketingCalendar'

const LOADING_PHRASES = [
  "Iniciando el motor de Inteligencia Artificial...",
  "Analizando la intención de búsqueda...",
  "Evaluando la competencia SEO...",
  "Generando propuestas de títulos irresistibles...",
  "Dando los toques finales a las opciones...",
]

export default function NewPipelinePage() {
  const router = useRouter()
  const [idea, setIdea] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_PHRASES.length - 1 ? prev + 1 : prev))
      }, 1500)
    } else {
      setLoadingStep(0)
    }
    return () => clearInterval(interval)
  }, [loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idea.trim()) return

    setLoading(true)
    setError('')

    const result = await createContentPipelineAction(idea, context)
    
    if (result.success && result.pipelineId) {
      router.push(`/admin/marketing/content/${result.pipelineId}`)
    } else {
      setError(result.error || 'Ocurrió un error inesperado al conectar con GROQ.')
      setLoading(false)
    }
  }

  return (
    <div className="new-pipeline-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>

      <div className="card shadow-sm p-4 p-md-5" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
        
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--border-color)' }}>
            <div style={{ height: '100%', background: 'var(--primary-color)', width: `${((loadingStep + 1) / LOADING_PHRASES.length) * 100}%`, transition: 'width 0.5s ease-out' }}></div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-5">
            <div style={{ display: 'inline-block', position: 'relative', width: '80px', height: '80px', marginBottom: '2rem' }}>
              <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" style={{ width: '100%', height: '100%' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
              Procesando tu idea
            </h2>
            <p style={{ color: 'var(--primary-color)', fontSize: '1.1rem', fontWeight: '500', animation: 'pulse 2s infinite' }}>
              {LOADING_PHRASES[loadingStep]}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Preparando la estrategia perfecta para posicionar a Aquatech.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
              Nueva Idea de Contenido
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Ingresa la temática general. La Inteligencia Artificial analizará la intención de búsqueda y te propondrá 5 opciones de títulos SEO ganadores para arrancar la maquinaria.
            </p>

            {error && (
              <div className="alert alert-danger mb-4" style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="idea" style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-color)' }}>
                  ¿De qué quieres hablar? (Tema Principal) *
                </label>
                <input 
                  type="text" 
                  id="idea" 
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Ej: Bombas de calor para piscinas en clima frío"
                  disabled={loading}
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--text-color)' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label htmlFor="context" style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-color)' }}>
                  Contexto Adicional (Opcional)
                </label>
                <textarea 
                  id="context" 
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Ej: Concéntrate en el ahorro de energía y el modelo SPIN. Útil para clientes de la sierra ecuatoriana."
                  disabled={loading}
                  rows={4}
                  className="form-control"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--text-color)', resize: 'vertical' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={!idea.trim()}
                className="btn btn-primary w-100"
                style={{ 
                  padding: '1rem', 
                  fontSize: '1.1rem', 
                  fontWeight: '600', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'transform 0.1s'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Generar Títulos Estratégicos (H1)
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-5" style={{ opacity: loading ? 0.3 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
        <MarketingCalendar />
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

