'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import MarkdownRenderer from './MarkdownRenderer';
import { useRouter } from 'next/navigation';

export default function BlogEditor() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    categoryId: '',
    tags: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    imageUrl: '',
    content: ''
  });

  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    fetch('/api/blog')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // auto-generate slug from title
      if (name === 'title' && !prev.slug) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      return next;
    });
  };

  const handleSave = async (isPublished: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, isPublished })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error saving post');
      alert(`Artículo ${isPublished ? 'publicado' : 'guardado'} correctamente`);
      router.push('/admin/blog');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-xl)', alignItems: 'start' }}>
      <div className="card">
        <div className="card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <h2 className="card-title">Contenido del Artículo</h2>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button className={`tab ${!previewMode ? 'active' : ''}`} onClick={() => setPreviewMode(false)}>Escribir</button>
            <button className={`tab ${previewMode ? 'active' : ''}`} onClick={() => setPreviewMode(true)}>Vista Previa</button>
          </div>
        </div>
        
        {!previewMode ? (
          <div>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input type="text" className="form-input" name="title" value={formData.title} onChange={handleChange} placeholder="Ej: Importancia del Tratamiento del Agua" required />
            </div>
            <div className="form-group">
              <label className="form-label">Contenido Principal (Markdown)</label>
              <textarea 
                className="form-textarea" 
                name="content" 
                value={formData.content} 
                onChange={handleChange} 
                placeholder="Escribe el cuerpo de tu artículo aquí usando Markdown..."
                style={{ minHeight: '400px', fontFamily: 'monospace' }}
                required 
              />
            </div>
          </div>
        ) : (
          <div style={{ minHeight: '400px', padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
            <h1 style={{ fontFamily: 'var(--font-brand)', color: 'var(--text)', fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>
              {formData.title || 'Título sin definir'}
            </h1>
            <MarkdownRenderer content={formData.content} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div className="card" style={{ padding: 'var(--space-md)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Configuración</h3>
          
          <div className="form-group">
            <label className="form-label">Slug (URL)</label>
            <input type="text" className="form-input" name="slug" value={formData.slug} onChange={handleChange} placeholder="mi-titulo-genial" />
          </div>

          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-select" name="categoryId" value={formData.categoryId} onChange={handleChange}>
              <option value="">-- Seleccionar --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Imagen Principal (URL)</label>
            <input type="text" className="form-input" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://..." />
            {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" style={{ marginTop: '0.5rem', borderRadius: '4px', maxWidth: '100%' }} />}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-md)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Optimización SEO</h3>

          <div className="form-group">
            <label className="form-label">Extracto</label>
            <textarea className="form-textarea" style={{ minHeight: '60px' }} name="excerpt" value={formData.excerpt} onChange={handleChange} placeholder="Breve introducción para las tarjetas de blog..." />
          </div>

          <div className="form-group">
            <label className="form-label">Palabra Clave (Focus Keyword)</label>
            <input type="text" className="form-input" name="focusKeyword" value={formData.focusKeyword} onChange={handleChange} placeholder="Ej: mantenimiento de piscinas" />
          </div>

          <div className="form-group">
            <label className="form-label">Meta Descripción</label>
            <textarea className="form-textarea" style={{ minHeight: '60px' }} name="metaDescription" value={formData.metaDescription} onChange={handleChange} placeholder="Aparecerá en los resultados de Google..." />
          </div>
          
          <div className="form-group">
            <label className="form-label">Etiquetas (separadas por coma)</label>
            <input type="text" className="form-input" name="tags" value={formData.tags} onChange={handleChange} placeholder="piscinas, química, equipos..." />
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-md)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Publicación</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-full" disabled={loading} onClick={() => handleSave(true)}>
              {loading ? 'Guardando...' : 'Publicar Ahora'}
            </button>
            <button className="btn btn-secondary btn-full" disabled={loading} onClick={() => handleSave(false)}>
              Guardar como Borrador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
