import ProjectUploader from '@/components/ProjectUploader'
import { db } from '@/lib/db'
import { Dispatch, SetStateAction } from 'react'

interface OperatorGalleryGridProps {
  title: string
  count: number
  items: any[]
  filter: 'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS'
  setFilter: Dispatch<SetStateAction<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS'>>
  onAddFile: (file: any, category?: string) => void
  onPreview: (item: any) => void
  onDelete: (id: number | string) => void
  onDownload: (url: string, filename: string) => void
  uploaderTitle: string
  defaultCategory: string
  galleryLabel: string
  handleDownloadLoading?: string | null
  showDeleteForChat?: boolean
}

function getCleanType(mime: string, url: string) {
  const cleanMime = (mime || '').toLowerCase();
  if (cleanMime === 'application/octet-stream' || !cleanMime) {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg'].includes(ext || '')) return 'image/jpeg';
    if (['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext || '')) return 'video/mp4';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) return 'audio/mpeg';
  }
  return cleanMime;
}

function cleanFilename(name: string) {
  if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia';
  return name;
}

export default function OperatorGalleryGrid({ 
  title, 
  count, 
  items, 
  filter, 
  setFilter, 
  onAddFile, 
  onPreview, 
  onDelete, 
  onDownload, 
  uploaderTitle, 
  defaultCategory, 
  galleryLabel,
  handleDownloadLoading, 
  showDeleteForChat = false 
}: OperatorGalleryGridProps) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        {title}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.6 }}>{count}</span>
      </h3>

      <ProjectUploader 
        files={[]}
        title={uploaderTitle}
        onAddFile={(file) => onAddFile(file, defaultCategory)}
        defaultCategory={defaultCategory}
        showGrid={false}
      />

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 0', marginBottom: '10px' }}>
        {(['ALL', 'IMAGES', 'VIDEOS', 'AUDIOS', 'DOCS'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              backgroundColor: filter === f ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {f === 'ALL' ? 'Todos' : f === 'IMAGES' ? 'Fotos' : f === 'VIDEOS' ? 'Videos' : f === 'AUDIOS' ? 'Audios' : 'Docs'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '12px', opacity: 0.6 }}>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>No hay archivos aún.</p>
        </div>
      ) : (
        <div className="custom-scrollbar" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
          gap: '12px',
          maxHeight: '450px',
          overflowY: 'auto',
          padding: '4px'
        }}>
          {items.map((item: any, idx: number) => {
            const realMime = getCleanType(item.mimeType, item.url);
            const fileName = cleanFilename(item.filename);

            return (
              <div 
                key={item.id || idx}
                className="group"
                onClick={() => onPreview(item)}
                style={{ 
                  position: 'relative', 
                  aspectRatio: '1/1', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }}
              >
                {/* Sync status icon badges */}
                {item.isSyncing && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: '#3b82f6', color: 'white', padding: '4px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  </div>
                )}
                {item.isPending && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'var(--warning)', color: 'white', padding: '4px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                )}
                {item.isFailed && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: '#ef4444', color: 'white', padding: '4px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                )}
                {item.isPendingDelete && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 11, background: 'rgba(239, 68, 68, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--danger)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ELIMINANDO...
                    </div>
                  </div>
                )}

                {/* Thumbnail content */}
                {realMime.startsWith('image/') ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <img 
                      src={item.url} 
                      alt={fileName} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} 
                      className="group-hover:scale-110"
                    />
                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                      {fileName}
                    </div>
                  </div>
                ) : realMime.startsWith('video/') ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                      {fileName}
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-deep)', padding: '10px', position: 'relative' }}>
                    {realMime.startsWith('audio/') ? (
                      <span style={{ fontSize: '2rem' }}>🎵</span>
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.7 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    )}
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{fileName}</span>
                  </div>
                )}

                {/* Full-card sync overlays */}
                {item.isSyncing && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(37,99,235,0.4))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>🔄</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subiendo</span>
                  </div>
                )}
                {item.isFailed && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(239,68,68,0.7), rgba(220,38,38,0.5))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>❌</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.failReason === 'FILE_DATA_LOST' ? 'Archivo perdido' : item.failReason === 'UPLOAD_FAILED' ? 'Error de subida' : 'Falló'}
                    </span>
                    {item.outboxId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); db.outbox.delete(item.outboxId).catch(() => {}); }}
                        style={{
                          marginTop: '2px', padding: '3px 10px', fontSize: '0.55rem', fontWeight: '700',
                          backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}
                      >
                        Descartar
                      </button>
                    )}
                  </div>
                )}
                {item.isPending && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>🕒</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendiente</span>
                  </div>
                )}
                {item.isPendingDelete && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(239, 68, 68, 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'grayscale(100%)' }}>
                    <span style={{ fontSize: '1.2rem' }}>🕒</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Borrando</span>
                  </div>
                )}

                {/* Action buttons overlay */}
                <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 20, display: 'flex', gap: '6px' }}>
                  {!item.isExpense && !item.isFromChat && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                      style={{ 
                        width: '28px', height: '28px', borderRadius: '50%', 
                        backgroundColor: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(4px)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                        transition: 'transform 0.2s, background-color 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.85)'; }}
                      title="Eliminar"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDownload(item.url, item.filename); }} 
                    style={{ 
                      width: '28px', height: '28px', borderRadius: '50%', 
                      backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                      transition: 'transform 0.2s, background-color 0.2s',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.9)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.55)'; }}
                    title="Descargar"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>

                {/* Bottom "Ver" badge */}
                <div style={{ 
                  position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                  padding: '20px 6px 6px', display: 'flex', justifyContent: 'center'
                }}>
                  <div style={{ 
                    backgroundColor: 'rgba(56, 189, 248, 0.9)', color: 'white', 
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '700',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    boxShadow: '0 2px 8px rgba(56,189,248,0.4)'
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ver
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
