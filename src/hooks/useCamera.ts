import { useRef, useState, useCallback, useEffect } from 'react'

export type CameraFacing = 'user' | 'environment'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef<string>('video/webm')

  const [facing, setFacing] = useState<CameraFacing>('environment')
  const [isRecording, setIsRecording] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async (facingMode: CameraFacing = 'environment') => {
    try {
      setError(null)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsActive(true)
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos de tu navegador o asegúrate de usar HTTPS.')
      console.error(err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsActive(false)
    setIsRecording(false)
  }, [])

  const toggleFacing = useCallback(() => {
    const next: CameraFacing = facing === 'environment' ? 'user' : 'environment'
    setFacing(next)
    startCamera(next)
  }, [facing, startCamera])

  const takePhoto = useCallback((): Blob | null => {
    if (!videoRef.current) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
    
    let blob: Blob | null = null
    canvas.toBlob((b) => { blob = b }, 'image/jpeg', 0.92)
    return blob
  }, [])

  const takePhotoAsync = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) return reject('Sin video')
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject('Error al capturar foto')
      }, 'image/jpeg', 0.92)
    })
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    chunksRef.current = []

    // iOS Safari solo soporta mp4, Android soporta webm
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorderRef.current = recorder
    recorder.start(100)
    setIsRecording(true)
    // Guarda el mimeType para usarlo al detener
    mimeTypeRef.current = mimeType
  }, [])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) return reject('Sin grabación activa')
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
        resolve(blob)
      }
      recorder.stop()
      setIsRecording(false)
    })
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return {
    videoRef,
    isActive,
    isRecording,
    facing,
    error,
    mimeTypeRef,
    startCamera,
    stopCamera,
    toggleFacing,
    takePhoto,
    takePhotoAsync,
    startRecording,
    stopRecording,
  }
}
