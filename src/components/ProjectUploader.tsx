'use client'

import React, { useState, useRef, useMemo } from 'react'
import { compressImage as optimizedCompress, blobToBase64 } from '@/lib/image-optimization'

// Inline SVG icons to avoid lucide-react webpack bundling issues
const svgProps = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle' } as React.CSSProperties
})
const UploadCloud = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
const ImageIcon = ({ size = 24 }: any) => <svg {...svgProps(size)}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
const VideoIcon = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
const FileText = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
const X = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
const Filter = ({ size = 24 }: any) => <svg {...svgProps(size)}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const Trash2 = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>

export interface ProjectFile {
  url: string
  filename: string
  mimeType: string
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'
  category?: string
  size?: number
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
  hideCaptureButtons?: boolean
  defaultCategory?: string
}

type FilterType = 'ALL' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'EXPENSE'

export default function ProjectUploader({ 
  files, 
  onAddFile, 
  onRemoveFile, 
  readOnly = false,
  title = "Archivos del Proyecto",
  minimal = false,
  showGrid = true,
  onFilterChange,
  hideCaptureButtons = false,
  defaultCategory = 'MASTER'
}: ProjectUploaderProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<ProjectFile | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    if (onFilterChange) onFilterChange(newFilter)
  }

  const formatFileName = (name: string) => name.length > 20 ? name.substring(0, 17) + '...' : name
  const getCleanMimeType = (file: ProjectFile) => file.mimeType || 'application/octet-stream'

  const handleDownload = async (file: ProjectFile) => {
    setIsDownloading(file.url)
    try {
      const response = await fetch(file.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) { console.error(e) }
    setIsDownloading(null)
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
      const batchSize = 3;
      const filesArray = Array.from(selectedFiles);
      
      for (let i = 0; i < filesArray.length; i += batchSize) {
        const batch = filesArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (file) => {
          const isImage = file.type.startsWith('image/')

          if (!isOnline) {
            let base64: string
            if (isImage) {
              const blob = await optimizedCompress(file)
              base64 = await blobToBase64(blob)
            } else {
              const reader = new FileReader()
              base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
              })
            }

            const localFile: ProjectFile = {
              url: base64,
              filename: file.name,
              mimeType: file.type,
              type: (isImage ? 'IMAGE' : (file.type.startsWith('video/') ? 'VIDEO' : (file.type.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT'))) as any,
              category: defaultCategory,
              size: file.size
            }
            
            onAddFile(localFile)
            return
          }

          try {
            const { uploadToBunnyClientSide } = await import('@/lib/storage-client')
            let uploadFile: File | Blob = file
            let finalFilename = file.name

            if (isImage) {
              try {
                uploadFile = await optimizedCompress(file)
                finalFilename = finalFilename.replace(/\.[^/.]+$/, "") + ".webp"
              } catch (err) {
                console.error('Compression failed, falling back to original', err)
              }
            }

            const data = await uploadToBunnyClientSide(uploadFile, finalFilename, 'projects')
            onAddFile({
              ...data,
              category: defaultCategory,
              size: file.size
            })
          } catch (err) {
            console.error('Project upload failed:', err)
            throw err
          }
        }));
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
      case 'AUDIO': return <span style={{ fontSize: '20px' }}>🎙️</span>
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

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          flexWrap: 'wrap',
          width: '100%',
          justifyContent: 'space-between'
        }}>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="btn btn-primary btn-sm"
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  flexShrink: 0
                }}
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

              {!hideCaptureButtons && (
                <>
                  <button 
                    onClick={() => {
                      const camInput = document.createElement('input');
                      camInput.type = 'file';
                      camInput.accept = 'image/*';
                      camInput.capture = 'environment';
                      camInput.onchange = (e: any) => handleFileChange(e);
                      camInput.click();
                    }}
                    disabled={isUploading}
                    className="btn btn-secondary btn-sm"
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      flexShrink: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    <span>Foto</span>
                  </button>

                  <button 
                    onClick={() => {
                      const camInput = document.createElement('input');
                      camInput.type = 'file';
                      camInput.accept = 'video/*';
                      camInput.capture = 'environment';
                      camInput.onchange = (e: any) => handleFileChange(e);
                      camInput.click();
                    }}
                    disabled={isUploading}
                    className="btn btn-secondary btn-sm"
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      flexShrink: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    <span>Video</span>
                  </button>
                </>
              )}
            </div>
          )}

          <div 
            className="scrollbar-hide" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              overflowX: 'auto', 
              paddingBottom: '4px',
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch'
            }}
          >
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
              fontWeight: 600,
              flexShrink: 0
            }}>
              <Filter size={14} />
              <span>Filtrar</span>
            </div>
            
            {(['ALL', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'EXPENSE'] as FilterType[]).map((t) => (
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
                  boxShadow: filter === t ? '0 4px 12px rgba(54, 162, 235, 0.3)' : 'none',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
                className={filter === t ? 'scale-105' : 'hover:bg-white/10'}
              >
                {t === 'ALL' ? 'Todos' : t === 'IMAGE' ? 'Fotos' : t === 'VIDEO' ? 'Videos' : t === 'AUDIO' ? 'Audio' : t === 'DOCUMENT' ? 'Docs' : 'Gastos'}
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
                onClick={() => setSelectedFileForPreview(file)}
                style={{
                   position: 'relative',
                   aspectRatio: '1/1',
                   borderRadius: '12px',
                   overflow: 'hidden',
                   backgroundColor: 'var(--bg-deep)',
                   border: '1px solid var(--border)',
                   transition: 'all 0.3s',
                   cursor: 'pointer'
                }}
              >
                {(() => {
                  const getCleanType = (mime: string, url: string) => {
                    if (mime === 'application/octet-stream' || !mime) {
                      const ext = url.split('.').pop()?.toLowerCase();
                      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg';
                      if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4';
                      if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg';
                    }
                    return mime;
                  };

                  const cleanFilename = (name: string) => {
                    if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
                    return name;
                  };

                  const realMime = getCleanType(file.mimeType, file.url);
                  const fileName = cleanFilename(file.filename);

                  if (realMime.startsWith('image/')) {
                    return <img src={file.url} alt={fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                  } else if (realMime.startsWith('video/')) {
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                        <VideoIcon size={40} />
                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                          {fileName}
                        </div>
                      </div>
                    );
                  } else if (realMime.startsWith('audio/')) {
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: '2rem' }}>🎙️</span>
                        <audio src={file.url} controls style={{ width: '90%', marginTop: '5px', height: '30px' }} />
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{fileName}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center' }}>
                        {getIcon(file.type)}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{fileName}</span>
                      </div>
                    );
                  }
                })()}
                <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '2px 8px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                  {file.type}
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay archivos
            </div>
          )}
        </div>
      )}

      {selectedFileForPreview && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
          onClick={() => setSelectedFileForPreview(null)}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              onClick={(e) => { e.stopPropagation(); setSelectedFileForPreview(null); }}
            >
              ✕
            </button>
            
            {selectedFileForPreview.type === 'IMAGE' || (selectedFileForPreview.type === 'DOCUMENT' && getCleanMimeType(selectedFileForPreview).startsWith('image/')) ? (
              <img 
                src={selectedFileForPreview.url} 
                alt={selectedFileForPreview.filename} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : selectedFileForPreview.type === 'VIDEO' || (selectedFileForPreview.type === 'DOCUMENT' && getCleanMimeType(selectedFileForPreview).startsWith('video/')) ? (
              <video 
                src={selectedFileForPreview.url} 
                controls 
                autoPlay 
                playsInline
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', outline: 'none' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : selectedFileForPreview.type === 'AUDIO' || (selectedFileForPreview.type === 'DOCUMENT' && getCleanMimeType(selectedFileForPreview).startsWith('audio/')) ? (
              <div 
                style={{ backgroundColor: 'var(--bg-card)', padding: '40px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{formatFileName(selectedFileForPreview.filename)}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Audio / Grabación</p>
                </div>
                <audio src={selectedFileForPreview.url} controls autoPlay style={{ width: '100%' }} />
                <button onClick={() => handleDownload(selectedFileForPreview)} className="btn btn-ghost" style={{ width: '100%', border: '1px solid var(--border-color)', marginTop: '10px' }}>
                  {isDownloading === selectedFileForPreview.url ? 'Descargando...' : 'Descargar'}
                </button>
              </div>
            ) : (
              <div 
                style={{ backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px', width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{formatFileName(selectedFileForPreview.filename)}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{getCleanMimeType(selectedFileForPreview)}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button onClick={() => window.open(selectedFileForPreview.url, '_blank')} className="btn btn-primary" style={{ width: '100%' }}>Abrir Documento</button>
                  <button onClick={() => handleDownload(selectedFileForPreview)} className="btn btn-ghost" style={{ width: '100%', border: '1px solid var(--border-color)' }}>{isDownloading === selectedFileForPreview.url ? 'Descargando...' : 'Descargar'}</button>
                </div>
              </div>
            )}
          </div>
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
