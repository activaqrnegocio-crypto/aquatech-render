'use client'

// v373: Modal Lightbox — compartido Admin y Operador
// v440: Fixed video controls being covered by info card on mobile
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
    if (['mp4', 'mov', 'webm', '3gp', 'm4v'].includes(ext || '')) return 'video/mp4'
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

  // v440: On mobile + video, the info card goes at the TOP so it never covers the
  // native video seek bar and controls that appear at the BOTTOM of the video element.
  const infoCardAtTop = isSmallScreen && isVideo

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0,0,0,0.98)', 
        backdropFilter: 'blur(15px)', 
        zIndex: 11000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: isSmallScreen ? '0' : '40px',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Close Button */}
      <button 
        onClick={onClose}
        style={{ 
          position: 'absolute', 
          top: '16px', 
          right: '16px', 
          background: 'rgba(255,255,255,0.12)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)', 
          color: 'white', 
          fontSize: '1.2rem', 
          cursor: 'pointer', 
          // v440: z-index LOWER than info card so info card can still be read,
          // but higher than the video element (which has no z-index by default)
          zIndex: 11010,
          width: '44px', 
          height: '44px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      
      <div 
        style={{ 
          maxWidth: '1200px', 
          width: '100%', 
          height: '100%',
          maxHeight: '100%',
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          alignItems: 'center',
          // v440: On mobile+video: top gap for info card (70px) + close btn area
          // On mobile+other: bottom gap for info card (120px)
          // On desktop: uniform gap
          paddingTop: infoCardAtTop ? '80px' : (isSmallScreen ? '60px' : '0'),
          paddingBottom: infoCardAtTop ? '16px' : (isSmallScreen ? '130px' : '0'),
          gap: isSmallScreen ? '0' : '24px',
          animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media Container */}
        <div style={{ 
          width: '100%', 
          flex: 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          // v440: REMOVED overflow:hidden — it was clipping video controls on some browsers
          // v440: REMOVED paddingBottom for video — info card is now at top on mobile
          minHeight: 0
        }}>
          {isImage ? (
            <img 
              src={item.url} 
              alt={fileName} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain', 
                borderRadius: isSmallScreen ? '0' : '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }} 
            />
          ) : isVideo ? (
            <video 
              src={item.url}
              controls 
              autoPlay 
              playsInline
              controlsList="nodownload"
              style={{ 
                // v440: On mobile, use full width and auto height so native controls
                // are never outside the visible area or covered by other elements
                width: isSmallScreen ? '100vw' : '100%',
                height: isSmallScreen ? 'auto' : '100%',
                maxHeight: isSmallScreen ? 'calc(100vh - 120px)' : '100%',
                // v440: object-fit: contain ensures video never crops, so controls
                // are always at the real bottom of the video (not cropped outside frame)
                objectFit: 'contain',
                borderRadius: isSmallScreen ? '0' : '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                backgroundColor: '#000',
                // v440: display: block removes the gap below <video> in flex containers
                display: 'block'
              }} 
            />
          ) : isAudio ? (
            <div style={{ 
              padding: '60px', 
              textAlign: 'center', 
              width: isSmallScreen ? '90%' : '500px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ fontSize: '5rem', marginBottom: '30px', filter: 'drop-shadow(0 0 20px var(--primary))' }}>🎙️</div>
              <audio src={item.url} controls autoPlay style={{ width: '100%' }} />
            </div>
          ) : (
            <div style={{ 
              padding: '60px', 
              textAlign: 'center', 
              width: isSmallScreen ? '90%' : '500px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ marginBottom: '20px' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <h3 style={{ color: 'white', marginBottom: '10px' }}>{fileName}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Este archivo debe ser descargado.</p>
            </div>
          )}
        </div>

        {/* Info Card — TOP on mobile+video, BOTTOM otherwise */}
        <div style={{ 
          position: isSmallScreen ? 'absolute' : 'relative',
          // v440: Video on mobile → top of screen (below close button). No more covering controls.
          // Non-video on mobile → bottom of screen (original behavior).
          top: infoCardAtTop ? '16px' : undefined,
          bottom: isSmallScreen && !infoCardAtTop ? '16px' : undefined,
          left: isSmallScreen ? '16px' : '0',
          right: isSmallScreen ? '16px' : '0',
          background: 'rgba(10, 10, 10, 0.85)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '14px 20px', 
          borderRadius: '18px',
          display: 'flex', 
          flexDirection: isSmallScreen ? 'row' : 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '12px',
          // v440: Info card z-index is LOWER than close button (11010) but above video (default)
          // This means the close btn is always accessible and info card doesn't block controls
          zIndex: 11005,
          boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: isSmallScreen ? '0.85rem' : '1rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ backgroundColor: 'var(--primary)', width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 }}></span>
              {previewMime.split('/')[1]?.toUpperCase() || 'FILE'} • {item.isExpense ? 'Gasto' : 'Archivo de Obra'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button 
              onClick={() => window.open(item.url, '_blank')} 
              className="btn btn-ghost" 
              style={{ 
                fontSize: '0.75rem', 
                backgroundColor: 'rgba(255,255,255,0.07)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '8px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >Abrir</button>
            <a 
              href={item.url} 
              download={fileName} 
              className="btn btn-primary" 
              style={{ 
                fontSize: '0.75rem', 
                textAlign: 'center',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)',
                whiteSpace: 'nowrap',
                textDecoration: 'none'
              }}
            >Descargar</a>
          </div>
        </div>
      </div>
    </div>
  )
}
