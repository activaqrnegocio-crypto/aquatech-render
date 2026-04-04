'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Mic, X, Send, Bot, User, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'assistant' | 'user'
  content: string
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return
    
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/calendar/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: text,
          currentDate: new Date().toISOString() 
        })
      })

      if (!res.ok) throw new Error('Error al consultar la IA')
      const data = await res.json()
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || 'No encontré información relevante para esa consulta.' }])
    } catch (error) {
      console.error('Chat AI Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo en unos momentos.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleTranscription(audioBlob)
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err) {
      console.error('No se pudo acceder al micrófono:', err)
      alert('Error: No se pudo acceder al micrófono.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleTranscription = async (blob: Blob) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', blob)

      const res = await fetch('/api/media/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Error en transcripción')
      const data = await res.json()
      
      if (data.text) {
        await handleSend(data.text)
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude entender el audio. ¿Podrías repetirlo o escribirlo?' }])
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
                          onMouseDown={startRecording}
                          onMouseUp={stopRecording}
                          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                        >
                           {isRecording ? <div className="recording-timer">{recordingDuration}s</div> : <Mic size={20} />}
                        </button>
                    )}
                 </div>
              </div>
              {isRecording && <p className="recording-hint">Mantén presionado para grabar</p>}
           </div>
        </div>
      )}

      <style jsx>{`
        .calendar-ai-assistant {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 1000;
          font-family: inherit;
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
          background: var(--card-bg, #ffffff);
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          color: var(--text-color, #1e293b);
          font-weight: 600;
          font-size: 0.9rem;
          white-space: nowrap;
          border: 1px solid var(--border-color, #e2e8f0);
          opacity: 0;
          transform: translateX(10px);
          transition: all 0.3s;
          pointer-events: none;
        }

        .ai-bubble-btn:hover .bubble-label {
          opacity: 1;
          transform: translateX(0);
        }

        /* Chat Window */
        .chat-window {
          width: 380px;
          height: 550px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: absolute;
          bottom: 0;
          right: 0;
        }

        .chat-header {
          padding: 18px 24px;
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
          color: #334155;
          background: white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
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
          width: 60px;
          animation: breathe 1.5s infinite;
        }

        .recording-timer {
          font-size: 0.75rem;
          font-weight: bold;
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

        .thinking-dots {
          display: flex;
          gap: 4px;
          padding: 4px 0;
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
