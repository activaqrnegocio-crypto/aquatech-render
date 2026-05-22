'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { selectHeadlineAction } from '@/actions/marketing'

const LOADING_PHRASES = [
  "Iniciando el redactor IA experto...",
  "Estructurando el esquema del Artículo Pilar...",
  "Redactando los puntos clave...",
  "Investigando los detalles técnicos...",
  "Optimizando palabras clave SEO...",
  "Dando los toques finales al Markdown...",
]

export default function HeadlineSelector({ pipeline }: { pipeline: any }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')

  const options = pipeline.headlineOptions || []

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_PHRASES.length - 1 ? prev + 1 : prev))
      }, 5000) // Cambia cada 5s porque generar un artículo largo toma hasta 60s
    } else {
      setLoadingStep(0)
    }
    return () => clearInterval(interval)
  }, [loading])

  const handleConfirm = async () => {
    if (!selectedId) return

    setLoading(true)
    setError('')

    const res = await selectHeadlineAction(pipeline.id, selectedId)
    if (res.success) {
      router.refresh()
    } else {
      setError(res.error || 'Error al generar el artículo pilar.')
      setLoading(false)
    }
  }

  if (options.length === 0) {
    return (
      <div className="alert alert-warning">
        No se generaron opciones de título. Por favor, intenta crear una nueva idea.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card shadow-sm p-4 p-md-5 text-center" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--border-color)' }}>
          <div style={{ height: '100%', background: 'var(--primary-color)', width: `${((loadingStep + 1) / LOADING_PHRASES.length) * 100}%`, transition: 'width 2s ease-out' }}></div>
        </div>
        
        <div style={{ display: 'inline-block', position: 'relative', width: '80px', height: '80px', marginBottom: '2rem', marginTop: '2rem' }}>
          <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" style={{ width: '100%', height: '100%' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
          Redactando Artículo Pilar (~2000 palabras)
        </h2>
        <p style={{ color: 'var(--primary-color)', fontSize: '1.1rem', fontWeight: '500', animation: 'pulse 3s infinite' }}>
          {LOADING_PHRASES[loadingStep]}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
          Esto suele tardar alrededor de 1 minuto debido a la extensión y calidad analítica requerida.
        </p>
        
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="card shadow-sm p-4" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
        Selecciona el Título Principal (H1)
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        La IA ha generado las siguientes opciones optimizadas para SEO. El artículo pilar se redactará basándose en el título que elijas.
      </p>

      {error && (
        <div className="alert alert-danger mb-4" style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {options.map((opt: any) => (
          <label 
            key={opt.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '1rem', 
              padding: '1rem', 
              border: selectedId === opt.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', 
              borderRadius: '8px',
              background: selectedId === opt.id ? 'rgba(8, 145, 178, 0.05)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <input 
              type="radio" 
              name="headline" 
              value={opt.id} 
              checked={selectedId === opt.id}
              onChange={() => setSelectedId(opt.id)}
              disabled={loading}
              style={{ marginTop: '0.3rem', width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary-color)' }}
            />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-color)', fontSize: '1.1rem' }}>
                {opt.headline}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Keyword focal: <strong style={{ color: 'var(--primary-color)' }}>{opt.keyword}</strong>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button 
          className={`btn btn-primary ${selectedId ? 'animate-pulse-btn' : ''}`} 
          onClick={handleConfirm}
          disabled={!selectedId || loading}
          style={{ 
            padding: '1rem 2.5rem', 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: selectedId ? '0 10px 15px -3px rgba(8, 145, 178, 0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          Siguiente Paso: Redactar Artículo
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      <style jsx>{`
        @keyframes pulse-btn {
          0% { transform: scale(1); box-shadow: 0 10px 15px -3px rgba(8, 145, 178, 0.3); }
          50% { transform: scale(1.02); box-shadow: 0 15px 25px -5px rgba(8, 145, 178, 0.4); }
          100% { transform: scale(1); box-shadow: 0 10px 15px -3px rgba(8, 145, 178, 0.3); }
        }
        .animate-pulse-btn {
          animation: pulse-btn 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}

