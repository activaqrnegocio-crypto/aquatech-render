'use client'

import React, { useState, useRef, useMemo } from 'react'
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileText,
  X,
  Filter,
  Trash2
} from 'lucide-react'

export interface ProjectFile {
  url: string
  filename: string
  mimeType: string
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
}

interface ProjectUploaderProps {
  files: ProjectFile[]
  onAddFile: (file: ProjectFile) => void
  onRemoveFile?: (url: string) => void
  readOnly?: boolean
  title?: string
  minimal?: boolean
  showGrid?: boolean
  onFilterChange?: (filter: FilterType) => void
}

type FilterType = 'ALL' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export default function ProjectUploader({ 
  files, 
  onAddFile, 
  onRemoveFile, 
  readOnly = false,
  title = "Archivos del Proyecto",
  minimal = false,
  showGrid = true,
  onFilterChange
}: ProjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    if (onFilterChange) onFilterChange(newFilter)
  }

  const filteredFiles = useMemo(() => {
    if (filter === 'ALL') return files
    return files.filter(f => f.type === filter)
  }, [files, filter])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setIsUploading(true)
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]

        if (!isOnline) {
          // Offline Mode: Convert to base64 locally
          const reader = new FileReader()
          const base64: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          const localFile = {
            url: base64, // Local preview/base64 for outbox
            filename: file.name,
            mimeType: file.type,
            type: (file.type.startsWith('image/') ? 'IMAGE' : (file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT')) as 'IMAGE' | 'VIDEO' | 'DOCUMENT'
          }
          
          onAddFile(localFile)
          continue
        }

        // Online Mode: Normal upload
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!res.ok) throw new Error('Upload failed')
        
        const data = await res.json()
        onAddFile(data)
      }
    } catch (error) {
      console.error('Error handling files:', error)
      if (isOnline) {
        alert('Error al subir archivos. Por favor intente de nuevo.')
      } else {
        alert('Error al procesar archivos offline.')
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'IMAGE': return <ImageIcon size={20} className="text-blue-400" />
      case 'VIDEO': return <VideoIcon size={20} className="text-purple-400" />
      default: return <FileText size={20} className="text-gray-400" />
    }
  }

  return (
    <div className={minimal ? "" : "card"} style={{ width: '100%', marginTop: minimal ? '0' : '24px' }}>
      <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: minimal ? 'flex-start' : 'space-between', 
          gap: '16px', 
          marginBottom: minimal ? '0' : '24px' 
      }}>
        {!minimal && (
          <div>
            <h3 className="card-title" style={{ fontSize: '1.125rem', margin: '0' }}>{title}</h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>Gestiona imágenes, videos y documentos</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!readOnly && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn btn-primary btn-sm flex items-center gap-2"
              style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Subiendo...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  <span>Subir Archivos</span>
                </>
              )}
            </button>
          )}

          {/* Filters - Professional Styling */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              <Filter size={14} />
              <span>Filtrar</span>
            </div>
            
            {(['ALL', 'IMAGE', 'VIDEO', 'DOCUMENT'] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleFilterChange(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  border: '1px solid',
                  cursor: 'pointer',
                  backgroundColor: filter === t ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: filter === t ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                  color: filter === t ? 'white' : 'var(--text-muted)',
                  boxShadow: filter === t ? '0 4px 12px rgba(54, 162, 235, 0.3)' : 'none'
                }}
                className={filter === t ? 'scale-105' : 'hover:bg-white/10'}
              >
                {t === 'ALL' ? 'Todos' : t === 'IMAGE' ? 'Fotos' : t === 'VIDEO' ? 'Videos' : 'Docs'}
              </button>
            ))}
          </div>
        </div>

        <input 
          type="file" 
          multiple 
          hidden 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
        />
      </div>

      {showGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginTop: '24px' }}>
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, idx) => (
              <div 
                key={file.url + idx} 
                className="card-shadow-hover"
                style={{
                   position: 'relative',
                   aspectRatio: '1/1',
                   borderRadius: '12px',
                   overflow: 'hidden',
                   backgroundColor: 'var(--bg-deep)',
                   border: '1px solid var(--border)',
                   transition: 'all 0.3s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  const overlay = e.currentTarget.querySelector('.file-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  const overlay = e.currentTarget.querySelector('.file-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
              >
                {file.type === 'IMAGE' ? (
                  <img 
                    src={file.url} 
                    alt={file.filename} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center', gap: '5px' }}>
                    {getIcon(file.type)}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: '500', width: '100%', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {file.filename}
                    </span>
                  </div>
                )}

                <div 
                  className="file-overlay"
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    backgroundColor: 'rgba(0,0,0,0.6)', 
                    opacity: 0, 
                    transition: 'opacity 0.2s', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px' 
                  }}
                >
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    title="Ver archivo"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                  <button 
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const response = await fetch(file.url);
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = file.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                      } catch (err) {
                        window.open(file.url, '_blank');
                      }
                    }}
                    style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', border: 'none', cursor: 'pointer', color: 'white', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    title="Descargar"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  {!readOnly && onRemoveFile && (
                    <button 
                      onClick={() => onRemoveFile(file.url)}
                      style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '8px', border: 'none', cursor: 'pointer', color: '#f87171', transition: 'background 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.4)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                      title="Eliminar"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '2px 8px', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {file.type}
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '12px' }}>
              <UploadCloud size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
              <p style={{ fontSize: '0.9rem', margin: 0 }}>No hay archivos {filter !== 'ALL' ? 'de este tipo' : ''}</p>
              {!readOnly && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', marginTop: '10px', textDecoration: 'none' }}
                  onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  Subir ahora
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .card-shadow-hover:hover {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(56, 189, 248, 0.15);
        }
      `}</style>
    </div>
  )
}
