'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { refineArticleAction, updateArticleContentAction, forcePipelineStatusAction } from '@/actions/marketing'
import { useRouter } from 'next/navigation'

interface ArticleDualEditorProps {
  article: any
  pipelineId: number
}

export default function ArticleDualEditor({ article, pipelineId }: ArticleDualEditorProps) {
  const [content, setContent] = useState(article?.content || '')
  const [feedback, setFeedback] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (!article?.id) return { success: false, error: 'Artículo no identificado' }
    setIsSaving(true)
    const res = await updateArticleContentAction(article.id, content)
    if (!res.success) {
      alert('Error al guardar: ' + res.error)
    }
    setIsSaving(false)
    return res
  }

  const handleAskAI = async () => {
    if (!feedback.trim() || !article?.id) return
    setIsAsking(true)
    
    const res = await refineArticleAction(article.id, feedback, content)
    
    if (res.success && res.newContent) {
        setContent(res.newContent)
        setFeedback('') 
    } else {
        alert('La IA tuvo un problema: ' + res.error)
    }
    
    setIsAsking(false)
  }

  const handleFinish = async () => {
    if (!confirm('¿Estás seguro de que has terminado la revisión? Pasaremos a la fase de Clusters e Imágenes.')) return
    
    setIsSaving(true)
    const saveRes = await handleSave()
    if (!saveRes.success) {
      setIsSaving(false)
      return
    }

    const res = await forcePipelineStatusAction(pipelineId, 'GENERATING_IMAGES')
    if (res.success) {
        router.refresh()
    } else {
        alert('Error al avanzar fase: ' + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="article-dual-editor" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'minmax(0, 1fr) 280px', 
      gap: '1.5rem', 
      height: '700px', 
      marginTop: '1rem',
      marginBottom: '6rem'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: var(--primary-color); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
      `}} />
      
      {/* Columna Izquierda: Editor/Preview */}
      <div className="editor-column" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0 }}>
            📝 Editor de Artículo Pilar
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button 
                className="btn btn-outline-secondary" 
                onClick={handleSave} 
                disabled={isSaving || isAsking}
                style={{ padding: '0.5rem 1rem' }}
             >
               {isSaving ? 'Guardando...' : 'Guardar Borrador'}
             </button>
             <button 
                className="btn btn-primary" 
                style={{ padding: '0.5rem 1.5rem', fontWeight: 'bold' }} 
                onClick={handleFinish}
                disabled={isSaving || isAsking}
             >
               Finalizar Revisión →
             </button>
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1px', 
          background: 'var(--border-color)', 
          borderRadius: '16px', 
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          {/* Textarea Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 1.2rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
                MARKDOWN SOURCE
            </div>
            <textarea 
              value={content}
              className="custom-scroll"
              onChange={(e) => setContent(e.target.value)}
              style={{ 
                flex: 1,
                padding: '1.5rem', 
                background: 'transparent', 
                color: 'var(--text-color)', 
                border: 'none', 
                resize: 'none',
                fontFamily: "'Fira Code', monospace",
                fontSize: '1rem',
                lineHeight: '1.7',
                outline: 'none',
                overflowY: 'auto'
              }}
              placeholder="Empieza a escribir..."
            />
          </div>
          
          {/* Preview Container */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 1.2rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                VISTA PREVIA (RESULTADO FINAL)
            </div>
            <div className="markdown-preview custom-scroll" style={{ 
              flex: 1,
              padding: '2.5rem', 
              overflowY: 'auto',
              color: 'var(--text-color)',
              lineHeight: '1.8',
              fontSize: '1.1rem'
            }}>
              <style dangerouslySetInnerHTML={{ __html: `
                .markdown-preview h1 { font-size: 2.2rem; margin-bottom: 1.5rem; color: var(--primary-color); }
                .markdown-preview h2 { font-size: 1.6rem; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
                .markdown-preview p { margin-bottom: 1.2rem; }
                .markdown-preview ul { padding-left: 1.5rem; margin-bottom: 1.2rem; }
                .markdown-preview li { margin-bottom: 0.5rem; }
              `}} />
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Derecha: AI Feedback */}
      <div className="ai-feedback-column" style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '16px', 
        border: '1px solid var(--border-color)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        height: '700px', 
        position: 'sticky',
        top: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1rem' }}>
          <span style={{ fontSize: '1.2rem' }}>✨</span> IA Co-Piloto
        </div>
        
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
          Dile a la IA qué cambiar. Ella lo hará por ti.
        </p>

        <textarea 
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Ej: Reescribe la intro, sé más agresivo..."
          style={{ 
            width: '100%', 
            height: '150px',
            padding: '0.8rem', 
            borderRadius: '10px', 
            background: 'var(--app-bg)', 
            color: 'var(--text-color)', 
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            resize: 'none',
            outline: 'none'
          }}
        />

        <button 
          className="btn btn-primary w-100" 
          disabled={!feedback.trim() || isAsking}
          onClick={handleAskAI}
          style={{ padding: '0.8rem', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {isAsking ? (
            <>
              <div className="spinner-border spinner-border-sm" role="status"></div>
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <span>Aplicar Magia IA</span>
              <span style={{ fontSize: '1.1rem' }}>🚀</span>
            </>
          )}
        </button>

        <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '10px', border: '1px dashed var(--primary-color)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--primary-color)' }}>PRO-TIP:</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
            Dile: "Quita 200 palabras de relleno" o "Añade una sección sobre químicos".
          </p>
        </div>
      </div>

    </div>
  )
}
