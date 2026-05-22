'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { updateArticleContentAction, forcePipelineStatusAction, refineArticleAction } from '@/actions/marketing'
import { useRouter } from 'next/navigation'

interface EditorWrapperProps {
  articleId: number | null
  articleContent: string
  pipelineId: number
}

export default function EditorWrapper({ articleId, articleContent, pipelineId }: EditorWrapperProps) {
  const [content, setContent] = useState(articleContent || '')
  const [feedback, setFeedback] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const router = useRouter()

  const handleSave = async () => {
    if (!articleId) return
    setIsSaving(true)
    setSaveMsg('')
    try {
      const res = await updateArticleContentAction(articleId, content)
      setSaveMsg(res.success ? '✅ Guardado' : `❌ ${res.error}`)
    } catch (e: any) {
      setSaveMsg(`❌ ${e.message}`)
    }
    setIsSaving(false)
  }

  const handleRefine = async () => {
    if (!articleId || !feedback.trim()) return
    setIsRefining(true)
    setSaveMsg('')
    try {
      const res = await refineArticleAction(articleId, feedback, content)
      if (res.success && res.newContent) {
        setContent(res.newContent)
        setFeedback('')
        setSaveMsg('✅ Artículo refinado por IA')
      } else {
        setSaveMsg(`❌ ${res.error}`)
      }
    } catch (e: any) {
      setSaveMsg(`❌ ${e.message}`)
    }
    setIsRefining(false)
  }

  const handleFinish = async () => {
    if (!articleId) return
    setIsSaving(true)
    // Save first
    await updateArticleContentAction(articleId, content)
    // Then advance
    const res = await forcePipelineStatusAction(pipelineId, 'GENERATING_IMAGES')
    if (res.success) router.refresh()
    setIsSaving(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      {/* LEFT: Markdown Editor */}
      <div className="card" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-color)' }}>
          ✏️ Editor Markdown
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            flex: 1,
            minHeight: '500px',
            padding: '1.5rem',
            background: 'var(--app-bg)',
            color: 'var(--text-color)',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}
        />
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.5rem' }}
          >
            {isSaving ? 'Guardando...' : '💾 Guardar'}
          </button>
          <button
            onClick={handleFinish}
            disabled={isSaving}
            className="btn btn-outline-secondary"
            style={{ padding: '0.5rem 1.5rem' }}
          >
            Aprobar y Continuar →
          </button>
          {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('✅') ? 'green' : 'red' }}>{saveMsg}</span>}
        </div>
      </div>

      {/* RIGHT: Preview + AI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Preview */}
        <div className="card" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-color)' }}>
            👁️ Vista Previa
          </div>
          <div 
            className="markdown-preview"
            style={{
              flex: 1,
              minHeight: '300px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '1.5rem',
              lineHeight: 1.8,
              color: 'var(--text-color)',
              fontSize: '0.95rem',
            }}
          >
            {content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--primary-color)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.75rem', marginTop: '1.25rem', color: 'var(--text-color)' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '0.5rem', marginTop: '1rem', color: 'var(--text-color)' }}>{children}</h3>,
                  p: ({ children }) => <p style={{ marginBottom: '0.75rem', lineHeight: 1.8 }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: '0.3rem' }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: '700', color: 'var(--text-color)' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{children}</em>,
                  a: ({ children, href }) => <a href={href} style={{ color: 'var(--primary-color)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{children}</a>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid var(--primary-color)', paddingLeft: '1rem', margin: '1rem 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</blockquote>,
                  code: ({ children }) => <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.85em', fontFamily: 'monospace' }}>{children}</code>,
                  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />,
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin contenido aún...</p>
            )}
          </div>
        </div>

        {/* AI Co-Pilot */}
        <div className="card" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--primary-color)', padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '0.75rem', fontSize: '1rem' }}>🤖 IA Co-Piloto</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Escribe instrucciones como: "Hazlo más corto", "Agrega una sección de FAQ", "Cambia el tono a más formal"
          </p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ej: Reduce a 800 palabras y agrega mis redes sociales al final..."
            style={{
              width: '100%',
              height: '80px',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--app-bg)',
              color: 'var(--text-color)',
              resize: 'none',
              outline: 'none',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={handleRefine}
            disabled={isRefining || !feedback.trim()}
            className="btn btn-primary mt-2"
            style={{ width: '100%', padding: '0.5rem', opacity: (!feedback.trim() || isRefining) ? 0.5 : 1 }}
          >
            {isRefining ? '⏳ La IA está trabajando...' : '🚀 Aplicar con IA'}
          </button>
        </div>
      </div>
    </div>
  )
}
