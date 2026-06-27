'use client'

/**
 * CameraCaptureModal — Cámara para APK
 * FOTO:  Camera.getPhoto() @capacitor/camera (abre cámara nativa)
 * VIDEO: Camera.recordVideo() @capacitor/camera (abre cámara nativa)
 *
 * SIN FALLBACK — si la cámara nativa no puede grabar/leer, muestra error.
 * El fallback a getUserMedia/MediaRecorder causaba que se pidiera
 * permiso de micrófono y grabara sin abrir la cámara nativa.
 */

import { useState, useRef, useEffect } from 'react'

interface Props {
  onMediaCapture: (blob: Blob, filename: string, mimeType: string) => void
  onClose: () => void
}

export default function CameraCaptureModal({ onMediaCapture, onClose }: Props) {
  const [screen, setScreen] = useState<'select' | 'loading' | 'recording' | 'error'>('select')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => () => {
    // Limpiar cualquier stream si el componente se desmonta
  }, [])

  const handleError = (msg: string) => { setError(msg); setScreen('error') }

  // ─── FOTO: @capacitor/camera (abre cámara nativa) ───
  const takePhoto = async () => {
    setScreen('loading')
    try {
      const { Camera: CapCam, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await CapCam.getPhoto({
        quality: 75,
        width: 1280,
        height: 1280,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      })
      const path = (photo as any).uri || (photo as any).webPath
      if (!path) throw new Error('No se obtuvo la foto')
      const resp = await fetch(path); const blob = await resp.blob()
      onMediaCapture(blob, `photo_${Date.now()}.jpg`, 'image/jpeg'); onClose()
    } catch (err: any) { handleError('Error al tomar foto: ' + (err?.message || err)) }
  }

  // ─── VIDEO: Camera.recordVideo() — abre cámara nativa ───
  const recordVideo = async () => {
    setScreen('loading')
    try {
      // recordVideo() maneja permisos internamente, como siempre funcionó

      // 2. Abrir cámara nativa para grabar video
      const { Camera: CapCam } = await import('@capacitor/camera')
      const video = await CapCam.recordVideo({})

      if (!video?.uri) throw new Error('No se obtuvo el video')

      // 3. Leer el archivo: Capacitor.convertFileSrc + fetch (método estándar)
      const { Capacitor } = await import('@capacitor/core')
      const webUrl = Capacitor.convertFileSrc(video.uri)
      const resp = await fetch(webUrl)
      if (!resp.ok) throw new Error(`Error HTTP al leer video: ${resp.status}`)
      const blob = await resp.blob()
      if (!blob?.size) throw new Error('El video está vacío')

      onMediaCapture(blob, `video_${Date.now()}.mp4`, blob.type || 'video/mp4')
      onClose()
    } catch (err: any) {
      console.error('[Camera] recordVideo error:', err)
      handleError('Error al grabar video: ' + (err?.message || err))
    }
  }

  return (
    <div className="media-modal-overlay" onClick={onClose}>
      <div className="media-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth:'400px', padding:0, overflow:'hidden', background:'#000' }}>
        {screen === 'select' && (
          <div style={{ padding:'30px', textAlign:'center' }}>
            <h3 style={{ margin:'0 0 24px 0', color:'white' }}>📷 Capturar</h3>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={takePhoto} style={{ flex:1, padding:'20px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:'12px', color:'white', fontSize:'16px', fontWeight:'bold', cursor:'pointer' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>📷</div><div>Foto</div>
              </button>
              <button onClick={recordVideo} style={{ flex:1, padding:'20px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', border:'none', borderRadius:'12px', color:'white', fontSize:'16px', fontWeight:'bold', cursor:'pointer' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>🎥</div><div>Video</div>
              </button>
            </div>
            <button onClick={onClose} style={{ marginTop:'16px', background:'transparent', border:'none', color:'#666', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
          </div>
        )}
        {screen === 'loading' && (
          <div style={{ padding:'60px 20px', textAlign:'center', color:'white' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>⏳</div>
            <div style={{ fontSize:'15px' }}>Abriendo cámara...</div>
          </div>
        )}
        {screen === 'error' && (
          <div style={{ padding:'30px', textAlign:'center' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>❌</div>
            <h3 style={{ color:'white', margin:'0 0 8px 0' }}>Error</h3>
            <p style={{ color:'#ef4444', fontSize:'13px', marginBottom:'16px', lineHeight:'1.5' }}>{error}</p>
            <button onClick={onClose} style={{ padding:'12px 32px', background:'#3b82f6', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'15px' }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}
