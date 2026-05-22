'use client'

// v373: Galería de Planos y Referencias — compartida entre Admin y Operador
interface ProjectGalleryTabProps {
  items: any[]
  galleryLabel: string
  galleryFilter: string
  showAll: boolean
  galleryLimit: number
  onUpload: (file: any, category?: string) => void
  onDelete: (itemId: number | string) => void
  onPreview: (item: any) => void
  onFilterChange: (filter: string) => void
  onToggleShowAll: () => void
  category?: string
}

function getCleanType(mime: string, url: string) {
  if (url && url.startsWith('data:image/')) return 'image/jpeg'
  if (url && url.startsWith('data:video/')) return 'video/mp4'
  if (url && url.startsWith('data:audio/')) return 'audio/mpeg'
  if (mime === 'application/octet-stream' || !mime) {
    const ext = url.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg'
    if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4'
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg'
  }
  return mime
}

function cleanFilename(name: string) {
  if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia'
  return name
}

export default function ProjectGalleryTab({
  items, galleryLabel, galleryFilter, showAll, galleryLimit,
  onUpload, onDelete, onPreview, onFilterChange, onToggleShowAll,
  category = 'MASTER'
}: ProjectGalleryTabProps) {
  const isEvidence = category === 'EVIDENCE'
  const accentColor = isEvidence ? '#d946ef' : 'var(--primary)'
  const filteredItems = galleryFilter === 'ALL' ? items : items.filter((i: any) =>
    i.type === galleryFilter ||
    (galleryFilter === 'IMAGE' && i.mimeType?.startsWith('image/')) ||
    (galleryFilter === 'VIDEO' && i.mimeType?.startsWith('video/')) ||
    (galleryFilter === 'DOCUMENT' && !i.mimeType?.startsWith('image/') && !i.mimeType?.startsWith('video/') && i.type !== 'EXPENSE')
  )
  const displayed = showAll ? filteredItems : filteredItems.slice(0, galleryLimit)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <h3 style={{ margin: 0, fontSize: '1.4rem', color: isEvidence ? '#d946ef' : 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isEvidence ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
            {isEvidence ? 'Finales' : galleryLabel}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isEvidence ? 'Evidencias de obra, fotos para publicidad y documentación visual del progreso.' : 'Documentos maestros, planos y especificaciones técnicas oficiales.'}
          </p>
        </div>
      </div>

      <div className="custom-scrollbar" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
        gap: '12px',
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '4px'
      }}>
        {displayed.map((item: any) => {
          const realMime = getCleanType(item.mimeType, item.url)
          const fileName = cleanFilename(item.filename)

          return (
            <div 
              key={item.id} 
              className="group" 
              onClick={() => onPreview(item)}
              style={{ 
                position: 'relative', 
                aspectRatio: '1/1', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                border: '1px solid var(--border-color)', 
                backgroundColor: 'var(--bg-surface)',
                cursor: 'pointer'
              }}
            >
              {/* Expense overlay */}
              {item.isExpense ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: '15px', position: 'relative' }}>
                  {item.url ? (
                    <img src={item.url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
                  ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5" style={{ opacity: 0.5 }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  )}
                  <div style={{ zIndex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>$ {item.amount}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                  </div>
                  <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--success)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>GASTO</div>
                </div>
              ) : realMime.startsWith('image/') ? (
                <img src={item.url} alt={fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : realMime.startsWith('video/') ? (
                <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
                  <video 
                    src={`${item.url}#t=0.001`} 
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} 
                    preload="metadata" 
                    muted 
                    playsInline 
                  />
                  <div style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', display: 'flex', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>{fileName}</div>
                </div>
              ) : realMime.startsWith('audio/') ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px' }}>
                  <audio src={item.url} controls style={{ width: '100%', height: '40px' }} />
                  <span style={{ fontSize: '0.7rem', color: isEvidence ? '#a855f7' : 'var(--info)', textAlign: 'center', wordBreak: 'break-all' }}>{fileName}</span>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <span style={{ fontSize: '0.7rem', color: isEvidence ? '#a855f7' : 'var(--info)', maxWidth: '90%', textAlign: 'center', wordWrap: 'break-word' }}>{fileName}</span>
                </div>
              )}

              {/* Pending overlays */}
              {item.isPending && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>🕒</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subiendo</span>
                </div>
              )}
              {item.isPendingDelete && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(239, 68, 68, 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'grayscale(100%)' }}>
                  <span style={{ fontSize: '1.2rem' }}>🕒</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Borrando...</span>
                </div>
              )}

              {/* Delete button */}
              <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 20 }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                  style={{ 
                    width: '28px', height: '28px', borderRadius: '50%', 
                    backgroundColor: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(4px)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                    transition: 'transform 0.2s, background-color 0.2s',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  title="Eliminar"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
              
              {/* View badge */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', padding: '20px 6px 6px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.9)', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '0.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 8px rgba(56,189,248,0.4)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Ver
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {items.length > galleryLimit && (
        <button onClick={onToggleShowAll} className="btn btn-ghost" style={{ width: '100%', marginTop: '20px' }}>
          {showAll ? 'Ver Menos' : 'Ver Todos'}
        </button>
      )}
    </div>
  )
}
