'use client'

import React, { useState } from 'react'

interface PostDetailsModalProps {
  posts: any[]
  onClose: () => void
}

export default function PostDetailsModal({ posts, onClose }: PostDetailsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Aplanar todas las variantes de todos los posts del día
  const allVariants = posts.flatMap(post => 
    post.variants.map((v: any) => ({ ...v, pipelineIdea: post.pipeline?.idea }))
  )

  const currentVariant = allVariants[currentIndex]

  const nextVariant = () => {
    setCurrentIndex((prev) => (prev + 1) % allVariants.length)
  }

  const prevVariant = () => {
    setCurrentIndex((prev) => (prev - 1 + allVariants.length) % allVariants.length)
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem'
    }}>
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: 'white',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          zIndex: 10000
        }}
      >
        ×
      </button>

      <div className="modal-container" style={{
        background: 'var(--card-bg)',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        borderRadius: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        border: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        
        {/* Header con indicadores de navegación */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge" style={{ 
                background: currentVariant.platform === 'INSTAGRAM' ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' : '#1877F2',
                color: 'white',
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                fontWeight: 'bold',
                fontSize: '0.85rem'
            }}>
              {currentVariant.platform}
            </span>
            <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Idea: <strong style={{ color: 'var(--text-color)' }}>{currentVariant.pipelineIdea}</strong>
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Publicación {currentIndex + 1} de {allVariants.length}
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="modal-body" style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            flexGrow: 1, 
            overflow: 'hidden' 
        }}>
          
          {/* Lado Izquierdo: Imagen */}
          <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {currentVariant.images && currentVariant.images.length > 0 ? (
                <img 
                    src={currentVariant.images.find((i: any) => i.isSelected)?.imageUrl || currentVariant.images[0].imageUrl} 
                    alt="Post Preview" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
            ) : (
                <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '2rem' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p>Sin imagen seleccionada</p>
                </div>
            )}
            
            {/* Navegación Superpuesta */}
            <button onClick={prevVariant} style={{ position: 'absolute', left: '1rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>&lt;</button>
            <button onClick={nextVariant} style={{ position: 'absolute', right: '1rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>&gt;</button>
          </div>

          {/* Lado Derecho: Contenido */}
          <div style={{ padding: '2.5rem', overflowY: 'auto', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '1.5rem' }}>Contenido de la Publicación</h3>
            
            <div style={{ marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>Caption / Texto</label>
                <p style={{ color: 'var(--text-color)', fontSize: '1.1rem', lineHeight: '1.6', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                    {currentVariant.caption || 'Sin texto generado aún.'}
                </p>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>Hashtags</label>
                <div style={{ color: 'var(--primary-color)', fontSize: '1rem', marginTop: '0.5rem', fontWeight: '500' }}>
                    {currentVariant.hashtags || '#aquatech #mantenimiento #ecuador'}
                </div>
            </div>

            {currentVariant.articleLink && (
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>Enlace de Artículo</label>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', textDecoration: 'underline' }}>
                    {currentVariant.articleLink}
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ flexGrow: 1, borderRadius: '12px', padding: '0.8rem' }}
                >
                  Confirmar Programación
                </button>
                <button 
                  className="btn btn-outline-secondary" 
                  style={{ flexGrow: 1, borderRadius: '12px', padding: '0.8rem' }}
                  onClick={onClose}
                >
                  Cerrar
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
