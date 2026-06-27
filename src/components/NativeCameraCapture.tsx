'use client'

import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder'

interface Props {
  onPhotoCapture: (blob: Blob, url: string) => void
  onVideoCapture: (blob: Blob, url: string) => void
  onAudioCapture: (blob: Blob, url: string) => void
  onClose: () => void
}

export default function NativeCameraCapture({ onPhotoCapture, onVideoCapture, onAudioCapture, onClose }: Props) {
  const [mode, setMode] = useState<'photo' | 'video' | 'audio'>('photo')
  const [recording, setRecording] = useState(false)
  const [timer, setTimer] = useState(0)
  let timerInterval: any = null

  const takePhoto = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 75,
        width: 1280,
        height: 1280,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      })
      if (photo.webPath) {
        const resp = await fetch(photo.webPath)
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        onPhotoCapture(blob, url)
        onClose()
      }
    } catch (err) { console.error('Error taking photo:', err) }
  }

  const recordVideo = async () => {
    if (recording) {
      setRecording(false)
      clearInterval(timerInterval)
      return
    }
    try {
      setRecording(true)
      setTimer(0)
      timerInterval = setInterval(() => setTimer(t => t + 1), 1000)
      const video = await Camera.recordVideo({ resultType: CameraResultType.Uri } as any)
      clearInterval(timerInterval)
      setRecording(false)
      if (video.webPath) {
        const resp = await fetch(video.webPath)
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        onVideoCapture(blob, url)
        onClose()
      }
    } catch (err) { console.error('Error recording video:', err); setRecording(false) }
  }

  const recordAudio = async () => {
    if (recording) {
      try {
        setRecording(false)
        clearInterval(timerInterval)
        const result = await CapacitorAudioRecorder.stopRecording()
        console.log('[NativeCamera] Audio result:', JSON.stringify(result));
        if (result.uri) {
          const uri = result.uri;
          let blob: Blob | null = null;
          
          // Try fetch first (Android 10+)
          try {
            const fetchResp = await fetch(uri);
            if (fetchResp.ok) {
              blob = await fetchResp.blob();
              console.log('[NativeCamera] Audio via fetch, size:', blob.size);
            }
          } catch (e) {
            console.warn('[NativeCamera] fetch failed, trying XHR');
            // XHR fallback
            const xhr = new XMLHttpRequest();
            xhr.open('GET', uri, true);
            xhr.responseType = 'blob';
            const loaded = await new Promise<boolean>((resolve) => {
              xhr.onload = () => {
                if (xhr.status === 200) {
                  blob = xhr.response;
                  console.log('[NativeCamera] Audio via XHR, size:', blob?.size);
                  resolve(true);
                } else resolve(false);
              };
              xhr.onerror = () => resolve(false);
              xhr.send();
            });
            if (!loaded) blob = null;
          }
          
          if (blob && blob.size > 0) {
            const url = URL.createObjectURL(blob);
            onAudioCapture(blob, url);
            onClose();
          } else {
            console.error('[NativeCamera] Failed to load audio');
          }
        }
      } catch (err) { console.error('Error stopping audio:', err) }
      return
    }
    try {
      setRecording(true)
      setTimer(0)
      const perm = await CapacitorAudioRecorder.requestPermissions()
      if (perm.recordAudio !== 'granted') {
        alert('Permiso de microfono denegado')
        setRecording(false)
        return
      }
      await CapacitorAudioRecorder.startRecording({ sampleRate: 44100, bitRate: 128000 })
      timerInterval = setInterval(() => setTimer(t => t + 1), 1000)
    } catch (err) { console.error('Error recording audio:', err); setRecording(false) }
  }

  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#1a1a1a', color: 'white' }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{mode === 'photo' ? 'PHOTO' : mode === 'video' ? 'VIDEO' : 'AUDIO'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>X</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px', backgroundColor: '#2a2a2a' }}>
        <button onClick={() => setMode('photo')} style={{ padding: '12px 24px', borderRadius: '12px', border: mode === 'photo' ? '2px solid #036BB2' : '2px solid transparent', backgroundColor: mode === 'photo' ? '#036BB2' : '#3a3a3a', color: 'white', fontSize: '16px', cursor: 'pointer' }}>PHOTO</button>
        <button onClick={() => setMode('video')} style={{ padding: '12px 24px', borderRadius: '12px', border: mode === 'video' ? '2px solid #036BB2' : '2px solid transparent', backgroundColor: mode === 'video' ? '#036BB2' : '#3a3a3a', color: 'white', fontSize: '16px', cursor: 'pointer' }}>VIDEO</button>
        <button onClick={() => setMode('audio')} style={{ padding: '12px 24px', borderRadius: '12px', border: mode === 'audio' ? '2px solid #036BB2' : '2px solid transparent', backgroundColor: mode === 'audio' ? '#036BB2' : '#3a3a3a', color: 'white', fontSize: '16px', cursor: 'pointer' }}>AUDIO</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
        {mode === 'photo' && <>
          <div style={{fontSize:'48px'}}>IMG</div>
          <button onClick={takePhoto} style={{width:'80px',height:'80px',borderRadius:'50%',backgroundColor:'#036BB2',border:'4px solid white',cursor:'pointer'}} />
          <span style={{color:'white'}}>Tap to take photo</span>
        </>}
        {mode === 'video' && <>
          <div style={{fontSize:'48px'}}>VID</div>
          {recording && <div style={{color:'#ef4444',fontSize:'24px'}}>REC {fmt(timer)}</div>}
          <button onClick={recordVideo} style={{width:'80px',height:'80px',borderRadius:'50%',backgroundColor: recording ? '#ef4444' : '#036BB2',border:'4px solid white',cursor:'pointer'}} />
          <span style={{color:'white'}}>{recording ? 'Tap to stop' : 'Tap to record'}</span>
        </>}
        {mode === 'audio' && <>
          <div style={{fontSize:'48px'}}>AUD</div>
          {recording && <div style={{color:'#ef4444',fontSize:'24px'}}>REC {fmt(timer)}</div>}
          <button onClick={recordAudio} style={{width:'80px',height:'80px',borderRadius:'50%',backgroundColor: recording ? '#ef4444' : '#036BB2',border:'4px solid white',cursor:'pointer'}} />
          <span style={{color:'white'}}>{recording ? 'Tap to stop' : 'Tap to record'}</span>
        </>}
      </div>
    </div>
  )
}