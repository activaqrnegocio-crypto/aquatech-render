'use client'

import React, { useState } from 'react'
// Eliminamos react-markdown temporalmente para diagnóstico
import { refineArticleAction, updateArticleContentAction, forcePipelineStatusAction } from '@/actions/marketing'
import { useRouter } from 'next/navigation'

interface ArticleEditorViewProps {
  article: any
  pipelineId: number
}

export default function ArticleEditorView({ article, pipelineId }: ArticleEditorViewProps) {
  const [content, setContent] = useState(article?.content || '')
  const [feedback, setFeedback] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (!article?.id) return { success: false, error: 'Artículo no identificado' }
    setIsSaving(true)
    const res = await updateArticleContentAction(article.id, content)
    setIsSaving(false)
    return res
  }

  const handleFinish = async () => {
    setIsSaving(true)
    const res = await forcePipelineStatusAction(pipelineId, 'GENERATING_IMAGES')
    if (res.success) router.refresh()
    setIsSaving(false)
  }

  return (
    <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '2px solid var(--primary-color)' }}>
      <h2 style={{ color: 'var(--primary-color)' }}>🛠 Modo Diagnóstico: Editor de Aquatech</h2>
      <p style={{ color: 'var(--text-muted)' }}>Si ves esto, el problema era la librería react-markdown. El editor está cargado correctamente.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '1rem' }}>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ height: '400px', padding: '1rem', borderRadius: '8px', background: 'var(--app-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
        />
        <div style={{ height: '400px', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
        <button onClick={handleSave} className="btn btn-primary">Probar Guardado</button>
        <button onClick={handleFinish} className="btn btn-outline-secondary">Forzar Siguiente Fase</button>
      </div>
    </div>
  )
}
