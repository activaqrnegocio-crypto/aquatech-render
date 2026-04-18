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

  return (
    <div className={styles.wrapper}>
      {error && <p className={styles.error}>{error}</p>}

      {!preview ? (
        <>
          <div className={styles.viewfinder}>
            <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
            {isRecording && <span className={styles.recBadge}>● REC</span>}
          </div>

          <div className={styles.controls}>
            <button onClick={toggleFacing} className={styles.btnSecondary} title="Girar cámara">
              🔄
            </button>
            <button onClick={handlePhoto} className={styles.btnCapture} title="Tomar foto" disabled={isRecording}>
              📷
            </button>
            <button
              onClick={handleVideoToggle}
              className={`${styles.btnVideo} ${isRecording ? styles.recording : ''}`}
              title={isRecording ? 'Detener grabación' : 'Grabar video'}
            >
              {isRecording ? '⏹' : '🎥'}
            </button>
          </div>
          {onClose && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px 20px' }}>Cerrar Cámara</button>
            </div>
          )}
        </>
      ) : (
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
