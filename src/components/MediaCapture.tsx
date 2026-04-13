'use client'

import React, { useState, useRef, useEffect } from 'react'

// Inline SVG icons to avoid lucide-react webpack bundling issues
const svgProps = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'middle' } as React.CSSProperties
})
const Mic = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
const Video = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
const Square = ({ size = 24 }: any) => <svg {...svgProps(size)}><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
const Trash2 = ({ size = 24 }: any) => <svg {...svgProps(size)}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
const Loader2 = ({ size = 24, className }: any) => <svg {...svgProps(size)} className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
const CheckCircle2 = ({ size = 24 }: any) => <svg {...svgProps(size)}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>

interface MediaCaptureProps {
  onCapture: (blob: Blob, type: 'audio' | 'video', transcription: string) => void
  mode?: 'audio' | 'video'
  placeholder?: string
  transcriptionOnly?: boolean
  skipTranscription?: boolean
}

export default function MediaCapture({ 
  onCapture, 
  mode = 'audio', 
  placeholder = "Grabando...",
  transcriptionOnly = false,
  skipTranscription = false,
  compact = false
}: MediaCaptureProps & { compact?: boolean }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [transcription, setTranscription] = useState('')
  const [timer, setTimer] = useState(0)
  const [recordedDuration, setRecordedDuration] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRecorderRef = useRef<MediaRecorder | null>(null) // Separate audio recorder for video transcription
  const timerRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const chunksRef = useRef<Blob[]>([])
  const audioChunksRef = useRef<Blob[]>([]) // Separate audio chunks

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const getSupportedMimeType = (mediaType: 'audio' | 'video'): string => {
    const candidates = mediaType === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
    
    for (const mime of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime
      }
    }
    return '' // Let browser choose default
  }

  const startRecording = async () => {
    try {
      // Clear previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video' ? { facingMode } : false
      })

      streamRef.current = newStream

      // Attach live preview for video
      if (mode === 'video' && videoRef.current) {
        videoRef.current.srcObject = newStream
        videoRef.current.play().catch(() => {}) // Ignore autoplay errors
      }

      // --- Main recorder (video+audio or audio-only) ---
      const supportedMime = getSupportedMimeType(mode)
      const options: MediaRecorderOptions = supportedMime ? { mimeType: supportedMime } : {}
      const recorder = new MediaRecorder(newStream, options)
      const actualMime = recorder.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm')
      
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // --- Separate AUDIO-ONLY recorder for video transcription ---
      let audioRecorder: MediaRecorder | null = null
      if (mode === 'video') {
        // Create an audio-only stream from the same microphone tracks
        const audioTracks = newStream.getAudioTracks()
        if (audioTracks.length > 0) {
          const audioOnlyStream = new MediaStream(audioTracks)
          const audioMime = getSupportedMimeType('audio')
          const audioOpts: MediaRecorderOptions = audioMime ? { mimeType: audioMime } : {}
          audioRecorder = new MediaRecorder(audioOnlyStream, audioOpts)
          audioChunksRef.current = []
          audioRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data)
          }
          audioRecorderRef.current = audioRecorder
        }
      }

      recorder.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: actualMime })
        setMediaBlob(videoBlob)
        setPreviewUrl(URL.createObjectURL(videoBlob))
        setRecordedDuration(timer)

        if (skipTranscription) {
          // Immediately send to parent without transcribing
          onCapture(videoBlob, mode, '')
        } else {
          // For transcription: use audio-only blob if available, otherwise fall back to full blob
          let transcriptionBlob: Blob
          if (mode === 'video' && audioChunksRef.current.length > 0) {
            const audioMime = audioRecorderRef.current?.mimeType || 'audio/webm'
            transcriptionBlob = new Blob(audioChunksRef.current, { type: audioMime })
          } else {
            transcriptionBlob = videoBlob
          }

          // Transcribe the AUDIO blob, but pass the VIDEO blob to onCapture for gallery
          await handleTranscription(transcriptionBlob, videoBlob)
        }
        
        // Clean up stream
        newStream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      // Start all recorders
      recorder.start()
      if (audioRecorder) audioRecorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      startTimer()
    } catch (err) {
      console.error('Error starting recording:', err)
      alert('Error: No se pudo acceder a la cámara o micrófono. Verifica los permisos del navegador.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop audio recorder first (if exists)
      if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop()
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setRecordedDuration(timer)
      stopTimer()

      // Stop live preview
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }

  const handleTranscription = async (audioBlob: Blob, originalBlob: Blob) => {
    setIsProcessing(true)
    let transcribedText = ''
    try {
      const formData = new FormData()
      // Always send as audio for Groq/Whisper compatibility
      formData.append('file', new File([audioBlob], 'audio.webm', { type: 'audio/webm' }))

      const res = await fetch('/api/media/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Transcription response error:', errData)
        throw new Error(errData.details || 'Transcription failed')
      }
      
      const data = await res.json()
      transcribedText = data.text || ''
      setTranscription(transcribedText)
    } catch (err) {
      console.error('Transcription error:', err)
      setTranscription('Error al transcribir.')
    } finally {
      setIsProcessing(false)
      // ALWAYS call onCapture with the ORIGINAL blob (video or audio) for gallery upload
      onCapture(originalBlob, mode, transcribedText)
    }
  }

  const startTimer = () => {
    setTimer(0)
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setMediaBlob(null)
    setPreviewUrl(null)
    setTranscription('')
    setTimer(0)
    setRecordedDuration(0)
    setIsProcessing(false)
    setIsRecording(false)
  }

  return (
    <div className={`media-capture-container ${compact ? 'compact' : ''}`} style={compact ? {
      padding: '10px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-deep)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      minWidth: '80px',
      position: 'relative'
    } : {
      padding: '20px',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-deep)',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      transition: 'all 0.3s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between', width: '100%' }}>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isRecording ? 'var(--danger)' : 'var(--text-muted)',
              boxShadow: isRecording ? '0 0 10px var(--danger)' : 'none',
              animation: isRecording ? 'pulse-red 1.5s infinite' : 'none'
            }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isRecording ? 'var(--danger)' : 'var(--text-muted)' }}>
              {isRecording 
                ? `GRABANDO - ${formatTime(timer)}` 
                : transcription 
                  ? `Completado (${formatTime(recordedDuration)})` 
                  : mode === 'video' ? 'Video' : 'Audio'
              }
            </span>
          </div>
        )}
        
        {compact && isRecording && (
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--danger)', position: 'absolute', top: 5, right: 5 }}>
            {formatTime(timer)}
          </span>
        )}

        {transcription && !compact && (
          <button onClick={reset} className="btn-icon" style={{ color: 'var(--danger)', padding: '5px' }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        {mode === 'video' && (
          <div style={{ 
            display: (isRecording || previewUrl) ? 'block' : 'none', 
            width: '100%', 
            maxWidth: '320px', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            backgroundColor: 'black', 
            position: 'relative', 
            margin: '0 auto' 
          }}>
            {/* Live preview during recording */}
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              style={{ 
                display: isRecording ? 'block' : 'none', 
                width: '100%', 
                height: 'auto',
                maxHeight: '200px',
                objectFit: 'cover' 
              }} 
            />
            {/* Playback after recording - with duration info */}
            {!isRecording && previewUrl && (
              <div>
                <video 
                  src={previewUrl} 
                  controls 
                  playsInline
                  style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'cover' }} 
                />
                <div style={{ 
                  padding: '6px 10px', 
                  backgroundColor: 'rgba(0,0,0,0.7)', 
                  color: '#fff',
                  fontSize: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>⏱ Duración: {formatTime(recordedDuration)}</span>
                  <span style={{ opacity: 0.7 }}>
                    {mediaBlob ? `${(mediaBlob.size / (1024 * 1024)).toFixed(1)} MB` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'audio' && isRecording && (
          <div style={{ display: 'flex', gap: '4px', height: '40px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{
                width: '4px',
                height: `${(i % 5) * 6 + 10}px`,
                backgroundColor: 'var(--primary)',
                borderRadius: '2px',
                animation: 'pulse-bar 0.5s infinite alternate',
                animationDelay: `${i * 0.1}s`
              }} />
            ))}
          </div>
        )}

        {/* Camera toggle button */}
        {mode === 'video' && !isRecording && !transcription && (
          <button
            type="button"
            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
            style={{ 
              fontSize: '0.75rem', 
              padding: '6px 14px', 
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {facingMode === 'user' ? '📷 Frontal' : '📷 Trasera'}
          </button>
        )}

        {/* Record / Stop buttons */}
        {!isRecording && !transcription && (
          <button 
            type="button"
            onClick={startRecording}
            style={{
              width: compact ? '40px' : '60px',
              height: compact ? '40px' : '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px var(--primary-glow)',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title={mode === 'video' ? 'Grabar Video' : 'Grabar Audio'}
          >
            {mode === 'video' ? <Video size={compact ? 18 : 24} /> : <Mic size={compact ? 18 : 24} />}
          </button>
        )}

        {isRecording && (
          <button 
            type="button"
            onClick={stopRecording}
            style={{
              width: compact ? '40px' : '60px',
              height: compact ? '40px' : '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Detener grabación"
          >
            <Square size={compact ? 18 : 24} />
          </button>
        )}

        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: '0.85rem' }}>Transcribiendo audio con IA...</span>
          </div>
        )}

        {transcription && !isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', width: '100%' }}>
            <CheckCircle2 size={18} />
            <div style={{ 
              fontSize: '0.85rem', 
              fontStyle: 'italic',
              color: 'var(--text)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '10px',
              borderRadius: '8px',
              width: '100%',
              border: '1px solid var(--success-bg)'
            }}>
              "{transcription}"
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse-red {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-bar {
          0% { height: 10px; }
          100% { height: 40px; }
        }
        .media-capture-container:hover {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )
}
