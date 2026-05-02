'use client'

import { useEffect, useState } from 'react'
import { useCamera } from '@/hooks/useCamera'
import styles from './CameraCapture.module.css'

interface CameraCaptureProps {
  onPhotoCapture?: (blob: Blob, url: string) => void
  onVideoCapture?: (blob: Blob, url: string) => void
  onClose?: () => void
}

export default function CameraCapture({ onPhotoCapture, onVideoCapture, onClose }: CameraCaptureProps) {
  const {
    videoRef, isActive, isRecording, error, mimeTypeRef,
    startCamera, stopCamera, toggleFacing,
    takePhotoAsync, startRecording, stopRecording,
  } = useCamera()

  const [preview, setPreview] = useState<{ url: string; type: 'photo' | 'video'; blob: Blob } | null>(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  const handlePhoto = async () => {
    try {
      const blob = await takePhotoAsync()
      const url = URL.createObjectURL(blob)
      setPreview({ url, type: 'photo', blob })
    } catch (err) {
      console.error(err)
    }
  }

  const handleVideoToggle = async () => {
    if (isRecording) {
      try {
        const blob = await stopRecording()
        const url = URL.createObjectURL(blob)
        setPreview({ url, type: 'video', blob })
      } catch (err) {
        console.error(err)
      }
    } else {
      startRecording()
    }
  }

  const handleConfirm = () => {
    if (!preview) return
    if (preview.type === 'photo') {
      onPhotoCapture?.(preview.blob, preview.url)
    } else {
      onVideoCapture?.(preview.blob, preview.url)
    }
  }

  const handleDiscard = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url)
      setPreview(null)
    }
  }

  const triggerNative = (mode: 'photo' | 'video') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = mode === 'video' ? 'video/*' : 'image/*'
    input.capture = 'environment'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        const type = file.type.startsWith('video/') ? 'video' : 'photo'
        setPreview({ url, type, blob: file })
      }
      document.body.removeChild(input)
    }
    input.click()
  }

  return (
    <div className={styles.wrapper}>
      {error && <p className={styles.error}>{error}</p>}

      <div style={{ display: preview ? 'none' : 'block' }}>
        <div className={styles.viewfinder}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
          {isRecording && <span className={styles.recBadge}>● REC</span>}
        </div>

        <div className={styles.controls}>
          <button onClick={() => triggerNative('photo')} className={styles.btnSecondary} title="Cámara Nativa Foto">
            🖼️
          </button>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handlePhoto} className={styles.btnCapture} title="Tomar foto (Web)" disabled={isRecording || !!error}>
              📷
            </button>
            <button
              onClick={handleVideoToggle}
              className={`${styles.btnVideo} ${isRecording ? styles.recording : ''}`}
              title={isRecording ? 'Detener grabación' : 'Grabar video (Web)'}
              disabled={!!error && !isRecording}
            >
              {isRecording ? '⏹' : '🎥'}
            </button>
          </div>

          <button onClick={() => triggerNative('video')} className={styles.btnSecondary} title="Cámara Nativa Video">
            🎞️
          </button>
        </div>
        
        {error && (
          <div style={{ 
            textAlign: 'center', 
            margin: '15px 0', 
            padding: '20px', 
            background: 'rgba(239, 68, 68, 0.15)', 
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginBottom: '15px', fontWeight: '500' }}>
              ⚠️ No se pudo activar la cámara web (Modo Offline)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => triggerNative('photo')} 
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: '600' }}
              >
                📸 Usar Cámara del Sistema (Foto)
              </button>
              <button 
                onClick={() => triggerNative('video')} 
                className="btn btn-secondary"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                🎥 Usar Cámara del Sistema (Video)
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '15px' }}>
              El navegador restringe el acceso directo offline. Usa la cámara de tu teléfono para continuar.
            </p>
          </div>
        )}
        {onClose && (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px 20px' }}>Cerrar Cámara</button>
          </div>
        )}
      </div>

      {preview && (
        <div className={styles.preview}>
          {preview.type === 'photo' ? (
            <img src={preview.url} alt="Foto capturada" className={styles.previewMedia} />
          ) : (
            <video src={preview.url} controls className={styles.previewMedia} />
          )}
          <div className={styles.previewActions}>
            <button onClick={handleDiscard} className={styles.btnCancel}>Rehacer</button>
            <button onClick={handleConfirm}>Usar {preview.type === 'photo' ? 'Foto' : 'Video'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
