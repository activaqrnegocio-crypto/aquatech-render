'use client'

// v373: Modal Lightbox — compartido Admin y Operador
interface LightboxPreviewProps {
  item: any
  isSmallScreen: boolean
  onClose: () => void
}

function getCleanType(item: any) {
  let mime = item.mimeType || item.type || 'application/octet-stream'
  if (mime === 'IMAGE') return 'image/jpeg'
  if (mime === 'VIDEO') return 'video/mp4'
  if (mime === 'AUDIO') return 'audio/mpeg'
  if (mime === 'DOCUMENT') return 'application/pdf'
  if (mime === 'application/octet-stream' || !mime.includes('/')) {
    const urlPath = item.url ? item.url.split('?')[0] : ''
    const ext = urlPath.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image/jpeg'
    if (['mp4', 'mov', 'webm'].includes(ext || '')) return 'video/mp4'
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio/mpeg'
  }
  return mime.toLowerCase()
}

function cleanFilename(name: string) {
  if (!name || name === 'upload' || name.startsWith('upload-')) return 'Archivo Multimedia'
  return name
}

export default function LightboxPreview({ item, isSmallScreen, onClose }: LightboxPreviewProps) {
  const previewMime = getCleanType(item)
  const fileName = cleanFilename(item.filename)
  const isImage = previewMime.startsWith('image/')
  const isVideo = previewMime.startsWith('video/')
  const isAudio = previewMime.startsWith('audio/')

  return (
    <div 
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div 
        style={{ maxWidth: '900px', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{ 
            position: 'absolute', top: isSmallScreen ? '10px' : '-40px', right: isSmallScreen ? '10px' : '0', 
            background: isSmallScreen ? 'rgba(0,0,0,0.5)' : 'none', border: 'none', color: 'white', 
            fontSize: '1.8rem', cursor: 'pointer', zIndex: 20,
            width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >✕</button>
        
        <div style={{ 
          width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', 
          border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          minHeight: isSmallScreen ? '200px' : '300px', maxHeight: isSmallScreen ? '50vh' : '80vh'
        }}>
          {isImage ? (
            <img src={item.url} alt={fileName} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
          ) : isVideo ? (
            <video src={item.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
          ) : isAudio ? (
            <div style={{ padding: '60px', textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎙️</div>
              <audio src={item.url} controls autoPlay style={{ width: '100%' }} />
            </div>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', width: '100%' }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ marginBottom: '20px' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <h3 style={{ color: 'white', marginBottom: '10px' }}>{fileName}</h3>
              <p style={{ color: 'var(--text-muted)' }}>Este tipo de archivo debe ser descargado para visualizarse.</p>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '15px 20px', display: 'flex', flexDirection: isSmallScreen ? 'column' : 'row', justifyContent: 'space-between', alignItems: isSmallScreen ? 'stretch' : 'center', gap: '15px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>{previewMime} • {item.isExpense ? 'Registro de Gasto' : 'Documento de Obra'}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => window.open(item.url, '_blank')} className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }}>Abrir Original</button>
            <a href={item.url} download={fileName} className="btn btn-primary" style={{ flex: 1, fontSize: '0.85rem', textAlign: 'center' }}>Descargar</a>
          </div>
        </div>
      </div>
    </div>
  )
}
