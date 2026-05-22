'use client'

import React, { useState } from 'react'
import { refineArticleAction, updateArticleContentAction, forcePipelineStatusAction } from '@/actions/marketing'
import { useRouter } from 'next/navigation'

interface ArticleEditorViewProps {
  article: any
  pipelineId: number
}

// CAMBIO A EXPORTACIÓN NOMBRADA Y NOMBRE ÚNICO
export function UltraLocalEditor({ article, pipelineId }: ArticleEditorViewProps) {
  const [content, setContent] = useState(article?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (!article?.id) return { success: false, error: 'Artículo no identificado' }
    setIsSaving(true)
    const res = await updateArticleContentAction(article.id, content)
    setIsSaving(false)
    return res
  }

  return (
    <div style={{ padding: '2rem', background: '#fff', border: '10px solid #ff0000', color: '#000', borderRadius: '20px' }}>
      <h1 style={{ color: 'red' }}>🛑 NIVEL DE AISLAMIENTO MÁXIMO 🛑</h1>
      <p>Si ves este borde ROJO, hemos solucionado el problema de importación.</p>
      <textarea 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: '100%', height: '200px', border: '1px solid black' }}
      />
      <button onClick={handleSave} style={{ padding: '10px', background: 'red', color: 'white', marginTop: '10px' }}>
        {isSaving ? 'Guardando...' : 'Probar Guardado'}
      </button>
    </div>
  )
}
