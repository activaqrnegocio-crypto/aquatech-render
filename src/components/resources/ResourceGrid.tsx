'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './Resources.css'

interface ResourceGridProps {
  initialResources: any[]
  isSuperAdmin: boolean
}

export default function ResourceGrid({ initialResources, isSuperAdmin }: ResourceGridProps) {
  const [resources, setResources] = useState(initialResources)
  const [selectedGallery, setSelectedGallery] = useState<{images: string[], index: number} | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newResource, setNewResource] = useState({ title: '', description: '', imageUrl: '', type: 'General' })
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingSync, setIsLoadingSync] = useState(false)

  // Re-fetch resources on mount to sync with latest data (fixes stale SW cache)
  useEffect(() => {
    const fetchLatest = async () => {
      setIsLoadingSync(true);
      try {
        const res = await fetch('/api/resources');
        if (res.ok) {
          const data = await res.json();
          setResources(data);
        }
      } catch (err) {
        console.warn('[ResourceGrid] Failed to re-fetch latest data offline, using initial props.');
      } finally {
        setIsLoadingSync(false);
      }
    };
    fetchLatest();
  }, []);

  // Preloading next image
  useEffect(() => {
    if (selectedGallery && selectedGallery.images.length > 1) {
      const nextIdx = (selectedGallery.index + 1) % selectedGallery.images.length;
      const nextImgUrl = selectedGallery.images[nextIdx];
      if (nextImgUrl && !nextImgUrl.includes('type=video')) {
        const img = new Image();
        img.src = nextImgUrl;
      }
    }
  }, [selectedGallery]);

  const compressImage = async (file: File): Promise<Blob | File> => {
    if (!file.type.startsWith('image/') || file.type.includes('gif') || file.type.includes('svg')) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_SIZE = 1600;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob || file),
            'image/webp',
            0.82
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const getImagesArray = (urlStr: string | null) => {
    if (!urlStr) return [];
    try {
      const parsed = JSON.parse(urlStr);
      if (Array.isArray(parsed)) return parsed;
      return [urlStr];
    } catch {
      return [urlStr];
    }
  }

  const isVideo = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v|avi|mkv|3gp)(\?.*)?$/.test(lowerUrl) || lowerUrl.includes('video') || lowerUrl.includes('type=video');
  };

  const isAudio = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/.test(lowerUrl) || lowerUrl.includes('audio') || lowerUrl.includes('type=audio');
  };

  const resetForm = () => {
    setIsAdding(false)
    setEditingId(null)
    setNewResource({ title: '', description: '', imageUrl: '', type: 'General' })
  }

  const startEdit = (res: any) => {
    setEditingId(res.id)
    setNewResource({
      title: res.title,
      description: res.description || '',
      imageUrl: res.imageUrl || '',
      type: res.type || 'General'
    })
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    setIsUploading(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of files) {
        let finalFile: Blob | File = file;
        let finalName = file.name;
        
        const isImg = file.type.startsWith('image/') && !file.type.includes('gif') && !file.type.includes('svg');
        const isVid = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v|avi|mkv|3gp)$/i.test(finalName);

        if (isImg) {
          finalFile = await compressImage(file);
          finalName = finalName.replace(/\.[^/.]+$/, "") + ".webp";
        }

        // Forzar extensión si es un video y no tiene una conocida
        if (isVid && !/\.(mp4|webm|ogg|mov|m4v|avi|mkv|3gp)$/i.test(finalName)) {
          finalName += '.mp4';
        } else if (isImg && !/\.(webp)$/i.test(finalName)) {
          finalName += '.webp';
        }

        const res = await fetch(`/api/upload?filename=${encodeURIComponent(finalName)}`, { 
          method: 'POST', 
          body: finalFile,
          headers: { 'Content-Type': isImg ? 'image/webp' : (file.type || 'application/octet-stream') }
        })
        const data = await res.json()
        if (data.url) {
          uploadedUrls.push(isVid ? data.url + (data.url.includes('?') ? '&type=video' : '?type=video') : data.url);
        }
      }
      
      const currentImages = getImagesArray(newResource.imageUrl)
      setNewResource({ ...newResource, imageUrl: JSON.stringify([...currentImages, ...uploadedUrls]) })
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Error al subir los archivos')
    } finally {
      setIsUploading(false)
    }
  }

  const removeImage = (indexToRemove: number) => {
    const currentImages = getImagesArray(newResource.imageUrl)
    const newImages = currentImages.filter((_, idx) => idx !== indexToRemove)
    setNewResource({ ...newResource, imageUrl: JSON.stringify(newImages) })
  }

  const handleSave = async () => {
    if (!newResource.title || !newResource.imageUrl) return
    
    setIsSaving(true)
    try {
      const url = editingId ? `/api/resources/${editingId}` : '/api/resources'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResource)
      })
      
      if (!res.ok) throw new Error('Failed to save')
      
      const data = await res.json()
      
      if (editingId) {
        setResources(resources.map(r => r.id === editingId ? data : r))
      } else {
        setResources([data, ...resources])
      }
      
      resetForm()
    } catch (error) {
      console.error('Save failed:', error)
      alert('Error al guardar el recurso')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este recurso permanentemente?')) return
    try {
      const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setResources(resources.filter(r => r.id !== id))
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Error al eliminar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '20px', 
        flexWrap: 'wrap',
        marginBottom: '10px'
      }}>
        {/* BUSCADOR INTELIGENTE */}
        <div style={{ 
          flex: 1, 
          minWidth: '280px', 
          position: 'relative',
          maxWidth: '500px'
        }}>
          <input 
            type="text" 
            placeholder="Buscar por título, descripción o etiqueta..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '14px 20px 14px 50px', 
              borderRadius: '16px', 
              border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(255,255,255,0.05)', 
              color: 'white',
              fontSize: '1rem',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            className="search-input-hover"
          />
          <svg 
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
            style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.8 }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px' }}
            >✕</button>
          )}
        </div>

        {isSuperAdmin && (
          <button 
            onClick={() => setIsAdding(!isAdding)} 
            className="btn btn-primary"
            style={{ borderRadius: '12px', padding: '12px 28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', height: '52px' }}
          >
            {isAdding ? '✕ Cerrar' : '+ Agregar Recurso'}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="card animate-fade-in resource-form-container" style={{ 
          padding: 'clamp(20px, 5vw, 40px)', 
          border: '1px solid rgba(54, 162, 235, 0.3)', 
          backgroundColor: 'var(--bg-card)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          maxWidth: '800px',
          width: '95%',
          margin: '0 auto 40px auto'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '35px' }}>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text)', margin: 0 }}>
              {editingId ? 'Editar Recurso' : 'Crear Nuevo Recurso'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
              {editingId ? 'Modifique los detalles del recurso existente.' : 'Complete los detalles para publicar un activo en el Centro de Recursos.'}
            </p>
          </div>

          <div className="resource-form-grid">
            {/* Columna Izquierda: Datos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Título</label>
                <input 
                  type="text" 
                  placeholder="Ej: Manual de Mantenimiento 2024" 
                  className="form-control" 
                  value={newResource.title} 
                  onChange={e => setNewResource({...newResource, title: e.target.value})}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.95rem', width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Descripción</label>
                <textarea 
                  placeholder="Proporcione una breve explicación del contenido..." 
                  className="form-control" 
                  rows={4} 
                  value={newResource.description} 
                  onChange={e => setNewResource({...newResource, description: e.target.value})}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.9rem', lineHeight: '1.6', resize: 'none', width: '100%' }}
                />
              </div>
            </div>

            {/* Columna Derecha: Multimedia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Imagen de Portada</label>
                <div style={{ 
                  border: '2px dashed rgba(255,255,255,0.1)', 
                  borderRadius: '16px', 
                  minHeight: '200px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: '20px'
                }}>
                  {getImagesArray(newResource.imageUrl).length > 0 ? (
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
                        {getImagesArray(newResource.imageUrl).map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                            {isVideo(url) ? (
                              <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                            ) : isAudio(url) ? (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' }}>
                                <span style={{ fontSize: '1.5rem' }}>🎵</span>
                              </div>
                            ) : (
                              <img 
                                src={url} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                onError={(e) => { e.currentTarget.src = '/Logo.jpg'; }}
                              />
                            )}
                            <button 
                              onClick={(e) => { e.preventDefault(); removeImage(idx); }}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} id="resource-upload" accept="image/*,video/*" />
                        <label htmlFor="resource-upload" className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', borderRadius: '8px' }}>
                          {isUploading ? 'Procesando...' : '+ Añadir más archivos'}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: '10px' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isUploading ? 'Subiendo archivos...' : 'Se requiere al menos un archivo'}</p>
                      <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} id="resource-upload" accept="image/*,video/*" />
                      <label htmlFor="resource-upload" className="btn btn-ghost btn-sm" style={{ marginTop: '15px', cursor: 'pointer', borderRadius: '8px' }}>
                        {isUploading ? 'Procesando...' : 'Seleccionar Archivos'}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '40px', paddingTop: '25px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={handleSave} 
              className="btn btn-primary" 
              disabled={!newResource.title || !newResource.imageUrl || isSaving || isUploading}
              style={{ flex: 2, height: '52px', borderRadius: '14px', fontSize: '1rem', fontWeight: '800', boxShadow: '0 10px 20px rgba(54, 162, 235, 0.2)' }}
            >
              {isSaving ? 'Guardando...' : (editingId ? '💾 Actualizar Recurso' : '🚀 Publicar Recurso')}
            </button>
            <button 
              onClick={resetForm} 
              className="btn btn-secondary"
              style={{ flex: 1, height: '52px', borderRadius: '14px', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="resource-grid-uniform">
        {resources
          .filter(res => 
            res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (res.description && res.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (res.type && res.type.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          .map((res: any) => (
            <div key={res.id} className="resource-card-uniform card animate-fade-in">
              <div className="resource-image-container" onClick={() => setSelectedGallery({ images: getImagesArray(res.imageUrl), index: 0 })}>
                {isVideo(getImagesArray(res.imageUrl)[0] || '') ? (
                  <video src={getImagesArray(res.imageUrl)[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                ) : isAudio(getImagesArray(res.imageUrl)[0] || '') ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117' }}>
                    <span style={{ fontSize: '2.5rem' }}>🎵</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '5px' }}>Audio / Podcast</span>
                  </div>
                ) : (
                  <img 
                    src={getImagesArray(res.imageUrl)[0] || '/Logo.jpg'} 
                    alt={res.title} 
                    loading="lazy" 
                    onError={(e) => { e.currentTarget.src = '/Logo.jpg'; }}
                  />
                )}
                {getImagesArray(res.imageUrl).length > 1 && (
                   <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 2 }}>
                     1/{getImagesArray(res.imageUrl).length}
                   </div>
                )}
                <div className="resource-overlay">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </div>
              </div>
              <div className="resource-content">
                <h4 className="resource-title">{res.title}</h4>
                <p className="resource-desc">{res.description || 'Sin descripción disponible.'}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => setSelectedGallery({ images: getImagesArray(res.imageUrl), index: 0 })} 
                    className="btn btn-primary btn-sm" 
                    style={{ flex: 1, height: '36px', borderRadius: '10px', fontWeight: 'bold' }}
                  >
                    Ver Recurso
                  </button>
                  {isSuperAdmin && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => startEdit(res)} 
                        className="btn btn-secondary btn-sm" 
                        style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Editar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(res.id)} 
                        className="btn btn-danger btn-sm" 
                        style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Eliminar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>

      {resources.length === 0 && !isAdding && (
        <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: 'var(--bg-deep)', borderRadius: '20px', border: '2px dashed rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📁</div>
          <h3 style={{ color: 'var(--text-muted)' }}>No hay recursos publicados todavía</h3>
          {isSuperAdmin && <p>Comienza agregando el primer recurso para tu equipo.</p>}
        </div>
      )}

      <AnimatePresence>
        {selectedGallery && selectedGallery.images.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lightbox-overlay" 
            onClick={() => setSelectedGallery(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lightbox-content" 
              onClick={e => e.stopPropagation()} 
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}
            >
              
              <AnimatePresence mode="wait">
                <motion.div 
                  key={selectedGallery.index}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isVideo(selectedGallery.images[selectedGallery.index]) ? (
                    <video src={selectedGallery.images[selectedGallery.index]} controls autoPlay playsInline style={{ maxHeight: '90vh', maxWidth: '90vw' }} />
                  ) : isAudio(selectedGallery.images[selectedGallery.index]) ? (
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '50px', borderRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                       <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                         <svg width="50" height="50" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                       </div>
                       <h3 style={{ margin: 0, color: 'white' }}>Reproduciendo Audio</h3>
                       <audio src={selectedGallery.images[selectedGallery.index]} controls autoPlay style={{ width: '100%' }} />
                    </div>
                  ) : (
                    <img 
                      src={selectedGallery.images[selectedGallery.index]} 
                      alt="Preview" 
                      style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }} 
                      onError={(e) => { e.currentTarget.src = '/Logo.jpg'; }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              
              {selectedGallery.images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedGallery({...selectedGallery, index: (selectedGallery.index - 1 + selectedGallery.images.length) % selectedGallery.images.length}) }} 
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', fontSize: '24px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                  >‹</button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedGallery({...selectedGallery, index: (selectedGallery.index + 1) % selectedGallery.images.length}) }} 
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', fontSize: '24px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                  >›</button>
                  <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '0.9rem', zIndex: 10, backdropFilter: 'blur(4px)', fontWeight: 'bold' }}>
                    {selectedGallery.index + 1} / {selectedGallery.images.length}
                  </div>
                </>
              )}
              <button className="lightbox-close" onClick={() => setSelectedGallery(null)} style={{ zIndex: 20 }}>✕</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
