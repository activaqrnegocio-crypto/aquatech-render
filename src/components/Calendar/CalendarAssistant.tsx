'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Mic, X, Send, Bot, User, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'assistant' | 'user'
  content: string
  audioUrl?: string
}

export default function CalendarAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de agenda Aquatech. ¿En qué puedo ayudarte hoy con la programación del equipo?' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [volume, setVolume] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Pre-autorizar mic al abrir la ventana para evitar lag
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => stream.getTracks().forEach(t => t.stop())) // Activar permiso
        .catch(console.warn)
    }
  }, [isOpen])

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  // Timer for recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  const handleSend = async (text: string, skipUIUpdate = false, customMessages?: Message[]) => {
    if (!text.trim() || isLoading) return
    
    let updatedMessagesForAI: Message[]

    if (customMessages) {
      updatedMessagesForAI = customMessages
    } else if (!skipUIUpdate) {
      const userMsg: Message = { role: 'user', content: text }
      setMessages(prev => [...prev, userMsg])
      updatedMessagesForAI = [...messages, userMsg]
    } else {
      updatedMessagesForAI = messages.map(m => 
        m.content.includes('transcribiendo...') ? { ...m, content: text } : m
      )
    }

    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/calendar/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessagesForAI.map(m => ({ role: m.role, content: m.content })),
          currentDate: new Date().toISOString() 
        })
      })

      if (!res.ok) throw new Error('Error al consultar la IA')
      const data = await res.json()
      
      if (data.reloadCalendar) {
        window.dispatchEvent(new CustomEvent('calendar-refresh'))
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || 'No encontré información relevante para esa consulta.' }])
    } catch (error) {
      console.error('Chat AI Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo en unos momentos.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const [capturedSize, setCapturedSize] = useState(0)

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const startRecording = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50)
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Setup Visualizador
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyzer = audioCtx.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer)
      analyzerRef.current = analyzer

      const dataArray = new Uint8Array(analyzer.frequencyBinCount)
      const updateVolume = () => {
        if (!analyzerRef.current) return
        analyzerRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length
        setVolume(avg)
        animFrameRef.current = requestAnimationFrame(updateVolume)
      }
      updateVolume()

      const getValidMimeType = () => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/aac', 'audio/mp4'];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
      }

      const mime = getValidMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        audioCtx.close()
        
        const audioBlob = new Blob(chunks, { type: mime || 'audio/webm' })
        setCapturedSize(Math.round(audioBlob.size / 1024))

        if (audioBlob.size < 200) { 
           stream.getTracks().forEach(track => track.stop())
           return
        }

        await handleTranscription(audioBlob, 'webm')
        stream.getTracks().forEach(track => track.stop())
      }

      audioChunksRef.current = chunks
      mediaRecorderRef.current = recorder
      
      recorder.start()
      setIsRecording(true)
      setCapturedSize(0)

    } catch (err) {
      console.error('Error al iniciar micrófono:', err)
      alert('Error de micrófono: Verifica permisos.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setVolume(0)
    }
  }

  const handleTranscription = async (audioBlob: Blob, ext: string) => {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audioMsg: Message = { 
      role: 'user', 
      content: '🎤 Audio enviado (transcribiendo...)',
      audioUrl 
    }
    
    setMessages(prev => [...prev, audioMsg])
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', new File([audioBlob], `audio.${ext}`, { type: audioBlob.type }))

      const res = await fetch('/api/media/transcribe', {
        method: 'POST',
        body: formData
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Error en transcripción')
      }
      
      const transcriptionText = data.text || ''
      
      if (transcriptionText) {
        // Actualizar el mensaje de audio con la transcripción en la UI
        setMessages(prev => prev.map(m => 
          m.content.includes('transcribiendo...') ? { ...m, content: `🎤 ${transcriptionText}` } : m
        ))
        
        // Enviar al bot con el texto transcrito
        // Creamos la lista de mensajes actualizada para el bot
        const updatedMessages: Message[] = [
          ...messages,
          { role: 'user', content: transcriptionText }
        ]
        await handleSend(transcriptionText, true, updatedMessages)
      } else {
        throw new Error('No se pudo obtener texto del audio')
      }
    } catch (error) {
      console.error('Transcription Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, no pude transcribir el audio. ¿Podrías intentar escribirlo o hablar más claro?' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="calendar-ai-assistant">
      {/* Floating Button */}
      {!isOpen && (
        <button 
          className="ai-bubble-btn pulsate"
          onClick={() => setIsOpen(true)}
        >
          <div className="orb-inner">
             <Bot size={28} color="white" />
          </div>
          <span className="bubble-label">Asistente AI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window animate-slide-up">
           <div className="chat-header">
              <div className="bot-status">
                 <div className="status-dot"></div>
                 <span>Aquatech AI</span>
              </div>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                 <X size={20} />
              </button>
           </div>

           <div className="chat-messages" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`msg-row ${m.role}`}>
                   <div className="avatar">
                      {m.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                   </div>
                   <div className="msg-content">
                      {m.audioUrl && (
                        <div className="audio-player-container">
                          <audio src={m.audioUrl} controls className="mini-audio" />
                        </div>
                      )}
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                   </div>
                </div>
              ))}
              {isLoading && (
                <div className="msg-row assistant typing">
                   <div className="avatar pulsate-mini">
                      <Bot size={16} />
                   </div>
                   <div className="msg-content">
                      <div className="thinking-dots">
                         <span></span><span></span><span></span>
                      </div>
                   </div>
                </div>
              )}
           </div>

           <div className="chat-footer">
              <div className="input-container">
                 <input 
                   type="text" 
                   placeholder="Escribe tu duda..." 
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                 />
                 
                 <div className="action-btns">
                    {input.trim() ? (
                        <button className="send-btn" onClick={() => handleSend(input)}>
                           <Send size={18} />
                        </button>
                    ) : (
                        <button 
                          className={`mic-btn ${isRecording ? 'active' : ''}`}
                          onClick={toggleRecording}
                        >
                           {isRecording ? (
                             <div className="recording-status">
                                <div className="volume-visualizer">
                                  <div className="volume-bar" style={{ height: `${Math.min(100, volume * 2)}%` }}></div>
                                </div>
                                <span className="kb-indicator">{capturedSize} KB</span>
                                <div className="recording-timer">{recordingDuration}s</div>
                             </div>
                           ) : <Mic size={20} />}
                        </button>
                    )}
                 </div>
              </div>
              {isRecording && <p className="recording-hint">Pulsa para detener la grabación</p>}
           </div>
        </div>
      )}

      <style jsx>{`
        .calendar-ai-assistant {
          position: fixed;
          bottom: 25px;
          right: 25px;
          z-index: 1000;
          font-family: inherit;
        }

        @media (max-width: 768px) {
          .calendar-ai-assistant {
            bottom: calc(var(--mobile-nav-height, 64px) + 20px);
            right: 15px;
          }
        }

        /* Bubble Button */
        .ai-bubble-btn {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
          box-shadow: 0 10px 25px rgba(8, 145, 178, 0.4), inset 0 0 15px rgba(255,255,255,0.2);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @media (max-width: 768px) {
          .ai-bubble-btn {
            width: 55px;
            height: 55px;
          }
        }

        .ai-bubble-btn:hover {
          transform: scale(1.1) rotate(5deg);
        }

        .orb-inner {
          position: relative;
          z-index: 2;
        }

        .bubble-label {
          position: absolute;
          right: 120%;
          background: var(--bg-card, #132238);
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          color: var(--text, #ffffff);
          font-weight: 600;
          font-size: 0.9rem;
          white-space: nowrap;
          border: 1px solid var(--border, rgba(56, 189, 248, 0.1));
          opacity: 0;
          transform: translateX(10px);
          transition: all 0.3s;
          pointer-events: none;
        }

        @media (max-width: 768px) {
          .bubble-label {
            display: none; /* Ocultar etiqueta en móvil */
          }
        }

        .ai-bubble-btn:hover .bubble-label {
          opacity: 1;
          transform: translateX(0);
        }

        /* Chat Window */
        .chat-window {
          width: 380px;
          max-width: calc(100vw - 30px);
          height: 550px;
          max-height: calc(100vh - 120px);
          background: rgba(19, 34, 56, 0.9);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: absolute;
          bottom: 0;
          right: 0;
        }

        @media (max-width: 480px) {
          .chat-window {
            width: calc(100vw - 32px);
            height: 500px;
            bottom: 0;
            right: 0;
          }
        }

        .chat-header {
          padding: 16px 20px;
          background: linear-gradient(90deg, #0891b2, #0e7490);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .bot-status {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #34d399;
          border-radius: 50%;
          box-shadow: 0 0 10px #34d399;
          animation: glow 2s infinite;
        }

        .close-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
        }

        .msg-row {
          display: flex;
          gap: 12px;
          max-width: 85%;
        }

        .msg-row.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #64748b;
          flex-shrink: 0;
        }

        .user .avatar {
          background: #0891b2;
          color: white;
        }

        .assistant .avatar {
          background: #e0f2fe;
          color: #0c4a6e;
        }

        .msg-content {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 0.95rem;
          line-height: 1.5;
          color: #0f172a;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          word-break: break-word;
          border: 1px solid #e2e8f0;
        }

        .audio-player-container {
          margin-bottom: 8px;
          width: 100%;
        }

        .mini-audio {
          height: 30px;
          width: 100%;
          border-radius: 8px;
        }

        .user .msg-content {
          background: #0891b2;
          color: white;
          border: none;
          border-bottom-right-radius: 4px;
        }

        .assistant .msg-content {
          border-bottom-left-radius: 4px;
        }

        .chat-footer {
          padding: 20px 24px;
          background: white;
          border-top: 1px solid #f1f5f9;
        }

        .input-container {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          padding: 4px 6px 4px 16px;
          transition: border-color 0.2s;
        }

        .input-container:focus-within {
          border-color: #0891b2;
          background: white;
        }

        input {
          flex: 1;
          border: none;
          background: transparent;
          padding: 10px 0;
          font-size: 0.95rem;
          outline: none;
          color: #0f172a;
        }

        input::placeholder {
          color: #64748b;
          opacity: 1;
        }

        .action-btns {
          display: flex;
          gap: 4px;
        }

        .send-btn, .mic-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-btn {
          background: #0891b2;
          color: white;
        }

        .mic-btn {
          background: #f1f5f9;
          color: #64748b;
          position: relative;
        }

        .mic-btn:hover {
          background: #e2e8f0;
        }

        .mic-btn.active {
          background: #ef4444;
          color: white;
          width: 90px;
          animation: breathe 1.5s infinite;
          padding: 0 10px;
        }

        .recording-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          line-height: 1;
        }

        .kb-indicator {
          font-size: 0.65rem;
          opacity: 0.9;
          background: rgba(0,0,0,0.2);
          padding: 1px 4px;
          border-radius: 4px;
        }

        .recording-timer {
          font-size: 0.85rem;
          font-weight: 800;
        }

        .recording-hint {
          font-size: 0.75rem;
          color: #94a3b8;
          text-align: center;
          margin-top: 8px;
        }

        /* Animations */
        @keyframes glow {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }

        @keyframes breathe {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-origin: bottom right;
        }

        .volume-visualizer {
          width: 4px;
          height: 18px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
          margin-bottom: 2px;
        }

        .volume-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          background: white;
          transition: height 0.05s ease-out;
        }

        .thinking-dots span {
          width: 6px;
          height: 6px;
          background: #cbd5e1;
          border-radius: 50%;
          animation: dot-jump 1.4s infinite ease-in-out;
        }

        .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dot-jump {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }

        .pulsate {
          animation: pulsate-glow 3s infinite;
        }

        @keyframes pulsate-glow {
          0% { box-shadow: 0 10px 25px rgba(8, 145, 178, 0.4); }
          50% { box-shadow: 0 10px 40px rgba(8, 145, 178, 0.7); }
          100% { box-shadow: 0 10px 25px rgba(8, 145, 178, 0.4); }
        }

        .pulsate-mini {
          animation: mini-glow 2s infinite;
        }

        @keyframes mini-glow {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
