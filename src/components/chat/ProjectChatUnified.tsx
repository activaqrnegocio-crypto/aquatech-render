'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { formatTimeEcuador, formatDateEcuador } from '@/lib/date-utils'
import MediaCapture from '@/components/MediaCapture'
import CameraCapture from '@/components/camera/CameraCapture'

// --- SVGs for WhatsApp Icons ---
const svgProps = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const
})

const Paperclip = ({ size = 20 }: any) => <svg {...svgProps(size)}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
const Camera = ({ size = 20 }: any) => <svg {...svgProps(size)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
const Mic = ({ size = 20 }: any) => <svg {...svgProps(size)}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
const Send = ({ size = 20 }: any) => <svg {...svgProps(size)}><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const MoreVertical = ({ size = 20 }: any) => <svg {...svgProps(size)}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
const Smile = ({ size = 20 }: any) => <svg {...svgProps(size)}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
const Play = ({ size = 16 }: any) => <svg {...svgProps(size)} fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const ImageIcon = ({ size = 20 }: any) => <svg {...svgProps(size)}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
const VideoIcon = ({ size = 20 }: any) => <svg {...svgProps(size)}><rect width="14" height="14" x="2" y="5" rx="2" ry="2"/><path d="M16 14.5V9.5L22 6.5v11z"/></svg>
const Clock = ({ size = 12 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const getSenderColor = (name: string) => {
  const colors = [
    '#25d366', '#34d399', '#3b82f6', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f97316'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}


interface ProjectChatUnifiedProps {
  project: any
  messages: any[]
  userId: number
  onSendMessage: (content: string, type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'EXPENSE_LOG' | 'NOTE' | 'LOCATION', extraData?: any) => void
  onDayAction?: () => void
  activeRecord?: any
  isOperatorView?: boolean
  backUrl?: string
  onBack?: () => void
  hideBack?: boolean
}

export default function ProjectChatUnified({
  project,
  messages,
  userId,
  onSendMessage,
  onDayAction,
  activeRecord,
  isOperatorView = false,
  backUrl = '/admin/proyectos',
  onBack,
  hideBack = false
}: ProjectChatUnifiedProps) {
  const [inputValue, setInputValue] = useState('')
  const [showAttachments, setShowAttachments] = useState(false)
  const [showMediaCapture, setShowMediaCapture] = useState<'audio' | 'video' | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilesBrowser, setShowFilesBrowser] = useState(false)
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null)
  const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean; isNote: boolean }>({ isOpen: false, isNote: false })
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', file: null as File | null })
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)

  const [autoScroll, setAutoScroll] = useState(true)
  const [showNewMsgBtn, setShowNewMsgBtn] = useState(false)
  const [msgCount, setMsgCount] = useState(messages.length)
  const [gpsStatus, setGpsStatus] = useState<string | null>(null)
  const [filesFilter, setFilesFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS' | 'EXPENSES'>('ALL')
  const [showCamera, setShowCamera] = useState(false)
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<any>(null)
  
  const allMedia = useMemo(() => {
    const list: any[] = []
    messages.forEach(m => {
      // m.media can be an array of objects {url, name, type...} or a single object
      const parts = Array.isArray(m.media) ? m.media : (m.media ? [m.media] : [])
      parts.forEach((p: any) => {
        if (p?.url) {
          let type: 'IMAGES' | 'VIDEOS' | 'AUDIOS' | 'DOCS' = 'DOCS'
          const url = p.url.toLowerCase()
          if (url.match(/\.(jpg|jpeg|png|gif|webp|heic|svg)$/)) type = 'IMAGES'
          else if (url.match(/\.(mp4|mov|avi|webm|mkv)$/)) type = 'VIDEOS'
          else if (url.match(/\.(mp3|wav|ogg|m4a|aac)$/)) type = 'AUDIOS'
          
          list.push({ 
            ...p, 
            type, 
            timestamp: m.createdAt || m.timestamp,
            sender: m.userName || m.senderName || 'Sistema'
          })
        }
      })
      if (m.type === 'EXPENSE_LOG' || m.type === 'NOTE') {
        list.push({
          id: `msg-exp-${m.id}`,
          filename: m.content || 'Gasto',
          url: m.extraData?.receiptUrl || m.extraData?.url || '',
          type: 'EXPENSES',
          amount: m.extraData?.amount,
          timestamp: m.createdAt || m.timestamp,
          sender: m.userName || m.senderName || 'Sistema'
        })
      }
    })
    return list;
  }, [messages])

  const evidenceGallery = useMemo(() => {
    if (!project?.gallery) return []
    return project.gallery.filter((item: any) => item.category === 'EVIDENCE')
  }, [project?.gallery])

  const filteredMedia = useMemo(() => {
    if (filesFilter === 'ALL') return allMedia
    return allMedia.filter(m => m.type === filesFilter)
  }, [allMedia, filesFilter])

  // Scroll logic
  useEffect(() => {
    if (messages.length > msgCount) {
      if (!autoScroll) setShowNewMsgBtn(true)
      setMsgCount(messages.length)
    }
  }, [messages.length, autoScroll, msgCount])

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    
    const lastMessage = messages[messages.length - 1];
    const isMe = lastMessage && (Number(lastMessage.userId) === Number(userId) || lastMessage.isMe);
    
    if (autoScroll || isMe) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      if (isMe) {
        setAutoScroll(true);
        setShowNewMsgBtn(false);
      }
    }
  }, [messages]);



  const handleSend = () => {
    if (!inputValue.trim()) return
    onSendMessage(inputValue, 'TEXT', { phaseId: selectedPhaseId })
    setInputValue('')
  }

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      return alert('La geolocalización no es compatible con este navegador.')
    }
    
    setGpsStatus('Obteniendo ubicación...')
    
    const options = { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0 
    }

    const onSuccess = (position: any) => {
      const { latitude, longitude } = position.coords
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
      onSendMessage(`📍 Ubicación compartida: ${mapsUrl}`, 'LOCATION', { 
         phaseId: selectedPhaseId,
         lat: latitude,
         lng: longitude
      })
      setGpsStatus(null)
    }

    const onError = (error: any) => {
      console.warn('GPS High Accuracy Error, trying normal:', error)
      // Fallback a baja precisión si falla la alta (común en PC)
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err2) => {
          console.error('GPS Fatal Error:', err2)
          let msg = 'No se pudo obtener la ubicación.';
          switch(err2.code) {
            case 1: msg = 'Permiso denegado. Por favor, permita el acceso a la ubicación.'; break;
            case 2: msg = 'La ubicación no está disponible.'; break;
            case 3: msg = 'Se agotó el tiempo de espera.'; break;
          }
          alert(msg);
          setGpsStatus(null)
        },
        { enableHighAccuracy: false, timeout: 15000 }
      )
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFinalizePhase = async () => {
    if (!selectedPhaseId) return;
    const phase = project.phases.find((p: any) => p.id === selectedPhaseId);
    if (!phase) return;

    if (!confirm(`¿Estás seguro de que deseas finalizar la fase "${phase.title}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/phases/${selectedPhaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) {
        alert("Fase finalizada con éxito.");
        window.location.reload(); // Refresh to show updated status
      }
    } catch (err) {
      console.error("Error finalizing phase:", err);
    }
  }

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      onSendMessage('', type, { file });
    }
  }

  const handleSendWithPhase = (content: string, type: any, extra?: any) => {
    onSendMessage(content, type, { ...extra, phaseId: selectedPhaseId });
  }

  const toggleDayRecord = () => {
    if (onDayAction) onDayAction()
  }

  // --- Render Attachment Menu Item ---
  const AttachmentItem = ({ icon, label, color, onClick }: any) => (
    <div 
      onClick={() => { onClick(); setShowAttachments(false); }}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '8px', 
        cursor: 'pointer',
        width: '75px'
      }}
    >
      <div style={{ 
        width: '52px', 
        height: '52px', 
        borderRadius: '50%', 
        backgroundColor: color, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        transition: 'transform 0.1s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {icon}
      </div>
      <span style={{ fontSize: '0.7rem', color: '#e9edef', fontWeight: '500', textAlign: 'center' }}>{label}</span>
    </div>
  )

  const handleExpenseAction = (isNote: boolean) => {
    setShowAttachments(false); 
    setExpenseModal({ isOpen: true, isNote });
    setExpenseForm({ amount: '', description: '', file: null });
  }

  const submitExpenseForm = () => {
    const isNote = expenseModal.isNote;
    setExpenseModal({ isOpen: false, isNote: false });

    handleSendWithPhase(expenseForm.description, 'EXPENSE_LOG', { 
      amount: Number(expenseForm.amount) || 0, 
      isNote: isNote,
      file: expenseForm.file 
    });
  }

  const handleNoteAction = () => {
    const content = prompt("Escriba su nota técnica:");
    if (content) handleSendWithPhase(content, 'NOTE');
  }

  const filteredMessages = messages.filter(msg => {
    const searchMatch = !searchQuery || (msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const phaseMatch = selectedPhaseId === null || Number(msg.phaseId) === selectedPhaseId;
    return searchMatch && phaseMatch;
  });


  return (
    <div className="whatsapp-chat-container">
      {/* --- HEADER --- */}
      <header className="chat-header">
        <div className="header-left">
          {!hideBack && (
            <button 
              onClick={(e) => {
                if (onBack) {
                  e.preventDefault();
                  onBack();
                }
              }}
              style={{ background: 'none', border: 'none', cursor: onBack ? 'pointer' : 'default', padding: 0 }}
            >
              <a 
                href={onBack ? '#' : backUrl} 
                className="btn-icon header-back"
                onClick={(e) => {
                  if (onBack) e.preventDefault();
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </a>
            </button>
          )}
           <div className="project-avatar">
              {project.title.substring(0, 2).toUpperCase()}
           </div>
           <div className="project-info">
             <h1>{project.title}</h1>
             <p style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ whiteSpace: 'nowrap' }}>{activeRecord ? '🟢 Jornada Activa' : '⚪ Jornada cerrada'}</span>
             </p>
           </div>

        </div>
        <div className="header-actions">
           {false && showSearch && (
             <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-deep)', borderRadius: '20px', padding: '4px 12px', marginRight: '8px' }}>
               <input 
                 type="text" 
                 placeholder="Buscar..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 style={{ background: 'none', border: 'none', color: 'var(--text)', outline: 'none', width: '120px', fontSize: '0.9rem' }}
                 autoFocus
               />
               <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0' }}>✕</button>
             </div>
           )}
           {!showSearch && (
             <>
               {isOperatorView && (
                 <button 
                    onClick={toggleDayRecord}
                    className={`btn-jornada ${activeRecord ? 'active' : ''}`}
                 >
                   {activeRecord ? 'Cerrar Jornada' : 'Iniciar Jornada'}
                 </button>
               )}
               <button onClick={() => setShowMenu(!showMenu)} className="btn-icon">
                 <MoreVertical />
               </button>
             </>
           )}
           
           {showMenu && (
             <div className="dropdown-menu">
               <div className="menu-item" onClick={() => { setShowFilesBrowser(true); setShowMenu(false); }}>📁 Archivos y documentos</div>
             </div>
           )}
        </div>
      </header>

      {/* --- QUICK EVIDENCE GALLERY --- */}
      {evidenceGallery.length > 0 && (
        <div style={{ 
          padding: '10px 16px', 
          backgroundColor: 'rgba(255,255,255,0.02)', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#d946ef', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📸 Archivos Finales (Evidencia)
            </span>
            <span onClick={() => setShowFilesBrowser(true)} style={{ fontSize: '0.6rem', color: 'var(--primary)', cursor: 'pointer' }}>Ver todo</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
            {evidenceGallery.map((file: any, i: number) => (
              <div 
                key={i} 
                onClick={() => setSelectedPreviewMedia(file)}
                style={{ 
                  flexShrink: 0, 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative'
                }}
              >
                {file.mimeType?.startsWith('image/') ? (
                  <img src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="evidence" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                    <Play size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MESSAGE LIST --- */}
      <div 
        ref={chatBodyRef} 
        className="chat-body" 
        onClick={() => { setShowAttachments(false); setShowMenu(false); }}
        onScroll={() => {
          const el = chatBodyRef.current
          if (!el) return
          const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 220
          if (!isAtBottom) {
             if (autoScroll) setAutoScroll(false)
          } else {
             if (!autoScroll) setAutoScroll(true)
             setShowNewMsgBtn(false)
          }
        }}
      >
        <div className="date-badge">HOY</div>
        {filteredMessages.map((msg, idx, filteredArray) => {
          const isMe = Number(msg.userId) === Number(userId) || msg.isMe;
          const showPointer = idx === 0 || filteredArray[idx-1]?.userId !== msg.userId;

          const userName = msg.userName || msg.user?.name || 'Usuario';
          const parsedExtraData = typeof msg.extraData === 'string' ? JSON.parse(msg.extraData) : (msg.extraData || {});
          const isExpense = msg.type === 'EXPENSE_LOG' || msg.type === 'EXPENSE';
          const isNote = parsedExtraData.isNote || msg.isNote;
          const amount = parsedExtraData.amount || msg.amount;
          
          let mediaArray = Array.isArray(msg.media) ? [...msg.media] : (msg.media ? [msg.media] : []);
          const mediaObj = mediaArray[0];
          const mime = mediaObj?.mimeType || '';

          return (
            <div key={msg.id || idx} className={`message-row ${isMe ? 'me' : 'them'}`}>
               {!isMe && showPointer && (
                 <div className="user-name" style={{ 
                   color: getSenderColor(userName),
                   fontWeight: '700',
                   fontSize: '0.75rem',
                   marginBottom: '2px',
                   paddingLeft: '2px'
                 }}>
                   {userName}
                 </div>
               )}
               <div className={`message-bubble ${showPointer ? 'has-pointer' : ''}`}>
                 {msg.phaseId && selectedPhaseId === null && (
                   <div style={{ fontSize: '0.6rem', color: 'var(--primary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      ⚡ {project.phases?.find((p:any) => p.id === Number(msg.phaseId))?.title}
                   </div>
                 )}
                 
                 {/* Text Content */}
                    {msg.content && (msg.type === 'TEXT' || msg.type === 'MESSAGE' || msg.type === 'DOCUMENT' || msg.type === 'FILE' || !msg.type) && (
                      msg.content.includes('COTIZACIÓN COMPARTIDA') ? (
                        <div className="quote-bubble" style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.05)', 
                          borderRadius: '10px', 
                          padding: '12px',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          marginTop: '5px',
                          marginBottom: '10px',
                          maxWidth: 'calc(100% - 4px)',
                          marginRight: '2px',
                          marginLeft: '2px',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.5rem' }}>📄</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                               <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#3b82f6', textTransform: 'uppercase' }}>Cotización Compartida</div>
                               <div style={{ fontSize: '0.75rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                 {msg.content.split('Para:')[1]?.split('Total:')[0]?.trim() || 'Cliente'}
                               </div>
                            </div>
                          </div>
                          
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '2px' }}>Total Cotizado</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'white' }}>
                              {msg.content.split('Total:')[1]?.split('📄')[0]?.trim() || '$0.00'}
                            </div>
                          </div>

                          <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '0 0 10px 0', lineHeight: '1.4' }}>
                            {msg.content.includes('Ver cotización completa') ? 'Se ha compartido una cotización formal. Puede revisarla y descargar el PDF adjunto.' : msg.content}
                          </p>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )
                    )}

                                  {(msg.type === 'LOCATION' || (msg.content && msg.content.includes('google.com/maps'))) && (
                      <div className="location-bubble" style={{ 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        borderRadius: '8px', 
                        padding: '12px',
                        border: '1px solid var(--primary)',
                        marginTop: '5px',
                        marginBottom: '10px',
                        maxWidth: 'calc(100% - 4px)',
                        marginLeft: '2px',
                        marginRight: '2px',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📍</span>
                        <div>
                           <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Ubicación Compartida</div>
                           <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Google Maps</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const urlMatch = msg.content.match(/https:\/\/www\.google\.com\/maps\S*/);
                          if (urlMatch) window.open(urlMatch[0], '_blank');
                        }}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          background: 'var(--primary)', 
                          border: 'none', 
                          color: 'white', 
                          fontWeight: 'bold', 
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        Ver en el Mapa
                      </button>
                    </div>
                  )}

                  {/* Media Rendering */}
                  {mediaArray.length > 0 && !isExpense && mediaArray.map((m: any, mIdx: number) => (
                    <div key={m.id || mIdx} className="media-attachment-container">
                     {(m.mimeType?.startsWith('image/') || m.type === 'IMAGE' || (!m.mimeType && m.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i))) && (
                       <div className="media-preview">
                         <img src={m.url} alt="Media" onClick={() => window.open(m.url, '_blank')} />
                       </div>
                     )}
                     
                     {(m.mimeType?.startsWith('video/') || m.type === 'VIDEO' || (!m.mimeType && m.url?.match(/\.(mp4|mov|webm)$/i))) && (
                       <div className="media-preview video">
                         <video src={m.url} controls preload="metadata" />
                       </div>
                     )}
                     
                     {(m.mimeType?.startsWith('audio/') || m.type === 'AUDIO') && (
                       <div className="audio-bubble">
                         <audio src={m.url} controls style={{ height: '32px', width: '220px' }} />
                       </div>
                     )}

                     {(m.type === 'FILE' || m.type === 'DOCUMENT' || m.mimeType?.includes('pdf') || m.mimeType?.includes('doc') || (!m.mimeType && m.url?.match(/\.(pdf|doc|docx|xls|xlsx|zip)$/i))) && !m.mimeType?.startsWith('image/') && !m.mimeType?.startsWith('video/') && (
                       <div className="document-box" onClick={() => window.open(m.url, '_blank')}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                          <div className="doc-info">
                            <span className="doc-name">{m.filename || 'Archivo'}</span>
                            <span className="doc-type">Documento</span>
                          </div>
                       </div>
                     )}
                   </div>
                 ))}
                 
                 {msg.type === 'NOTE' && (
                    <div className="note-box" style={{ borderLeft: '4px solid #f59e0b', padding: '8px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '4px' }}>
                       <div style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '4px' }}>📝 NOTA TÉCNICA</div>
                       <p style={{ margin: 0 }}>{msg.content}</p>
                    </div>
                  )}

                    {(msg.type === 'EXPENSE_LOG' || msg.type === 'EXPENSE') && (
                      <div className="expense-box" style={{ 
                        backgroundColor: isNote ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        borderLeft: `4px solid ${isNote ? '#3b82f6' : '#10b981'}`,
                        padding: '12px',
                        borderRadius: '8px',
                        marginTop: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        maxWidth: 'calc(100% - 4px)',
                        marginLeft: '2px',
                        marginRight: '2px',
                        boxSizing: 'border-box'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: isNote ? '#3b82f6' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {isNote ? '🏷️ Nota de Gasto' : '💰 Gasto Real'}
                        </div>
                        {msg.userName && <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{msg.userName}</div>}
                      </div>

                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#e9edef', marginBottom: '4px' }}>
                        $ {amount !== undefined && amount !== null ? Number(amount).toFixed(2) : '0.00'}
                      </div>

                      <div style={{ fontSize: '0.9rem', lineHeight: '1.4', opacity: 0.95, color: '#e9edef', marginBottom: '8px' }}>
                        {msg.content}
                      </div>

                      {mediaObj && (
                        <div 
                          style={{ 
                            marginTop: '10px', 
                            borderRadius: '8px', 
                            overflow: 'hidden', 
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.2)'
                          }} 
                          onClick={() => window.open(mediaObj.url, '_blank')}
                        >
                          <img 
                            src={mediaObj.url} 
                            style={{ 
                              width: '100%', 
                              maxHeight: '280px', 
                              objectFit: 'contain',
                              display: 'block'
                            }} 
                            alt="Recibo" 
                          />
                        </div>
                      )}
                    </div>
                  )}
                 <div className="message-footer">
                   <span className="time">{formatTimeEcuador(msg.createdAt)}</span>
                   {isMe && (
                     (msg.status === 'pending' || msg.isPending) ? (
                       <span className="pending-icon" title="Pendiente de envío" style={{ marginLeft: '4px', opacity: 0.7, color: 'var(--text-muted)' }}>
                         <Clock size={12} />
                       </span>
                     ) : (
                       <span className="check">✓✓</span>
                     )
                   )}
                 </div>
               </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {showNewMsgBtn && (
        <button 
          onClick={() => { chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' }); setAutoScroll(true); setShowNewMsgBtn(false); }}
          className="new-messages-btn"
        >
          ⬇️ Mensajes nuevos
        </button>
      )}

      {/* --- ATTACHMENT MENU --- */}
      {showAttachments && (
        <div className="attachments-menu">
          <div className="attachments-grid">
            <AttachmentItem 
              icon={<Camera size={28} />} 
              label="CÁMARA" 
              color="#d946ef" 
              onClick={() => setShowCamera(true)} 
            />
            <AttachmentItem 
              icon={<ImageIcon size={28} />} 
              label="GALERÍA" 
              color="#00a884" 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,video/*';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const type = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
                    onSendMessage('', type, { file });
                  }
                };
                input.click();
              }} 
            />
            <AttachmentItem 
              icon={<Paperclip size={28} />} 
              label="Documento" 
              color="#5f66cd" 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) onSendMessage('', 'FILE', { file });
                };
                input.click();
              }} 
            />

            <AttachmentItem 
              icon={<span style={{ fontSize: '1.8rem' }}>💰</span>} 
              label="Nota Gasto" 
              color="#007bfc" 
              onClick={() => handleExpenseAction(true)} 
            />
             <AttachmentItem 
              icon={<span style={{ fontSize: '1.8rem' }}>📍</span>} 
              label={gpsStatus || "Ubicación"} 
              color={gpsStatus ? "#f59e0b" : "#009688"} 
              onClick={handleGetGPS} 
            />
          </div>
        </div>
      )}

      {showFilesBrowser && (
        <div className="media-modal-overlay" onClick={() => setShowFilesBrowser(false)}>
           <div className="media-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', padding: '0', borderRadius: '16px' }}>
              
              {/* Header */}
              <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Archivos, enlaces y docs</h2>
                <button onClick={() => setShowFilesBrowser(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.9rem', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* Filters */}
              <div style={{ padding: '10px 20px', display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hide-scrollbar">
                {['ALL', 'IMAGES', 'VIDEOS', 'AUDIOS', 'DOCS', 'EXPENSES'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilesFilter(f as any)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      backgroundColor: filesFilter === f ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: filesFilter === f ? 'white' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {f === 'ALL' ? 'Todo' : f === 'IMAGES' ? 'Fotos' : f === 'VIDEOS' ? 'Videos' : f === 'AUDIOS' ? 'Audio' : f === 'DOCS' ? 'Docs' : 'Gastos'}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                  {filteredMedia.map((media, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        // Map the media object to match the expected preview format if necessary
                        const previewItem = {
                          url: media.url,
                          filename: media.name || media.filename || 'Archivo',
                          mimeType: media.mimeType || (
                            media.type === 'IMAGES' ? 'image/jpeg' : 
                            media.type === 'VIDEOS' ? 'video/mp4' : 
                            media.type === 'AUDIOS' ? 'audio/mpeg' : 'application/octet-stream'
                          )
                        };
                        setSelectedPreviewMedia(previewItem);
                      }}
                      style={{ 
                        aspectRatio: '1/1', 
                        backgroundColor: 'rgba(255,255,255,0.03)', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        cursor: 'pointer',
                        position: 'relative',
                        border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'transform 0.2s ease'
                      }}
                      className="media-item-hover"
                    >
                      {media.type === 'IMAGES' ? (
                        <img 
                          src={media.url} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          alt="Media"
                        />
                      ) : media.type === 'VIDEOS' ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                           <Play size={32} />
                           <video src={media.url} style={{ display: 'none' }} />
                        </div>
                      ) : media.type === 'AUDIOS' ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                           <span style={{ fontSize: '2rem' }}>🎵</span>
                           <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Audio</span>
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', textAlign: 'center' }}>
                           <span style={{ fontSize: '2rem' }}>📄</span>
                           <span style={{ fontSize: '0.65rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                             {media.name || 'Documento'}
                           </span>
                        </div>
                      )}
                      
                      {/* Overlay info */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', fontSize: '0.65rem' }}>
                         <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.sender}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredMedia.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', opacity: 0.5 }}>
                    <span style={{ fontSize: '3rem', marginBottom: '10px' }}>📂</span>
                    <p style={{ margin: 0 }}>No hay {filesFilter === 'ALL' ? 'archivos' : filesFilter.toLowerCase()} compartidos aún.</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* --- MEDIA PREVIEW LIGHTBOX --- */}
      {selectedPreviewMedia && (
        <div 
          className="media-modal-overlay" 
          style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.95)' }} 
          onClick={() => setSelectedPreviewMedia(null)}
        >
          <div 
            className="media-modal-content" 
            style={{ 
              maxWidth: '90vw', 
              maxHeight: '90vh', 
              width: 'auto', 
              background: 'transparent', 
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedPreviewMedia(null)}
              style={{ 
                position: 'fixed', 
                top: '20px', 
                right: '20px', 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                color: 'white', 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                fontSize: '1.2rem', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2001
              }}
            >✕</button>

            {selectedPreviewMedia.mimeType?.startsWith('image/') || selectedPreviewMedia.type === 'IMAGES' ? (
              <img 
                src={selectedPreviewMedia.url} 
                alt="Preview" 
                style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              />
            ) : selectedPreviewMedia.mimeType?.startsWith('video/') || selectedPreviewMedia.type === 'VIDEOS' ? (
              <video 
                src={selectedPreviewMedia.url} 
                controls 
                autoPlay 
                playsInline
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', outline: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              />
            ) : selectedPreviewMedia.mimeType?.startsWith('audio/') || selectedPreviewMedia.type === 'AUDIOS' ? (
              <div style={{ 
                backgroundColor: '#202c33', 
                padding: '40px', 
                borderRadius: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '20px', 
                width: '100%', 
                maxWidth: '400px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)' 
              }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <Mic size={40} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: 'white' }}>{selectedPreviewMedia.filename || 'Nota de Voz'}</h3>
                  <p style={{ color: '#8696a0', fontSize: '0.8rem', margin: 0 }}>Audio / Mensaje de Voz</p>
                </div>
                <audio src={selectedPreviewMedia.url} controls autoPlay style={{ width: '100%' }} />
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#202c33', 
                padding: '30px', 
                borderRadius: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '20px', 
                maxWidth: '400px', 
                width: '100%' 
              }}>
                <Paperclip size={60} />
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{selectedPreviewMedia.filename || 'Archivo'}</h3>
                  <p style={{ color: '#8696a0', fontSize: '0.8rem', marginTop: '4px' }}>{selectedPreviewMedia.mimeType || 'Documento'}</p>
                </div>
                <button 
                  onClick={() => window.open(selectedPreviewMedia.url, '_blank')} 
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '12px', 
                    background: '#00a884', 
                    border: 'none', 
                    color: 'white', 
                    fontWeight: 'bold', 
                    cursor: 'pointer' 
                  }}
                >
                  Abrir Documento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MEDIA CAPTURE MODAL --- */}
      {showMediaCapture && (
        <div className="media-modal-overlay">
           <div className="media-modal-content">
              <button 
                className="close-btn" 
                onClick={() => setShowMediaCapture(null)}
              >✕</button>
              <MediaCapture 
                mode={showMediaCapture}
                skipTranscription={true}
                onCapture={(blob, type, transcription) => {
                  const fileStr = type === 'audio' ? 'AUDIO' : type === 'photo' ? 'IMAGE' : 'VIDEO';
                  
                  // Use actual mime type for extension fallback
                  let ext = 'webm';
                  if (blob.type.includes('mp4')) ext = 'mp4';
                  else if (blob.type.includes('mpeg')) ext = 'mp3';
                  else if (blob.type.includes('ogg')) ext = 'ogg';
                  else if (blob.type.includes('jpeg') || type === 'photo') ext = 'jpg';
                  else if (blob.type.includes('png')) ext = 'png';

                  const mediaFile = new File([blob], `capture_${Date.now()}.${ext}`, { type: blob.type });
                  
                  // For audio without transcription, we can pass a small placeholder or just empty
                  onSendMessage(transcription || (type === 'audio' ? 'Nota de voz' : ''), fileStr, { file: mediaFile });
                  setShowMediaCapture(null);
                }}
              />
           </div>
        </div>
      )}

      {/* --- INPUT BAR --- */}
      <footer className="chat-footer">
        <div className="input-row">
           <button className="btn-icon"><Smile /></button>
            <div className="input-container">
              <textarea 
                placeholder="Escribir un mensaje"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
              />
              <button onClick={() => setShowAttachments(!showAttachments)} className="btn-icon">
                 <Paperclip />
              </button>
              <button onClick={() => setShowCamera(true)} className="btn-icon" title="Cámara (Foto/Video)">
                 <Camera />
              </button>
            </div>
           
           <button 
            className={`btn-send ${inputValue.trim() ? 'active' : ''}`}
            onClick={inputValue.trim() ? handleSend : () => setShowMediaCapture('audio')}
           >
             {inputValue.trim() ? <Send /> : <Mic />}
           </button>
        </div>
      </footer>

      {/* --- EXPENSE MODAL --- */}
      {expenseModal.isOpen && (
        <div className="media-modal-overlay" onClick={() => setExpenseModal({ isOpen: false, isNote: false })}>
          <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setExpenseModal({ isOpen: false, isNote: false })}>✕</button>
            <h3 style={{ marginTop: 0, color: expenseModal.isNote ? '#3b82f6' : '#10b981' }}>
              {expenseModal.isNote ? '🏷️ Registrar Nota de Gasto' : '💰 Registrar Gasto Real'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) setExpenseForm({ ...expenseForm, file });
                    };
                    input.click();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px dashed rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    padding: '20px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={28} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cámara</span>
                </div>
                
                <div 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) setExpenseForm({ ...expenseForm, file });
                    };
                    input.click();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px dashed rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    padding: '20px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Galería</span>
                </div>
              </div>

              {expenseForm.file && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--primary)' }}>
                   <img 
                    src={URL.createObjectURL(expenseForm.file)} 
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }} 
                    alt="Preview"
                   />
                   <button 
                    onClick={() => setExpenseForm({ ...expenseForm, file: null })}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}
                   >✕</button>
                   <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '8px', fontSize: '0.7rem' }}>
                      {expenseForm.file.name}
                   </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Monto del gasto ($) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  inputMode="decimal"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'white',
                    fontSize: '1.1rem',
                    fontWeight: '700'
                  }}
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Descripción / Concepto *</label>
                <textarea 
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'white', 
                    minHeight: '100px', 
                    fontSize: '0.95rem',
                    resize: 'none'
                  }}
                  placeholder="¿En qué se gastó este dinero?"
                  required
                />
              </div>
              
              <button 
                onClick={(e) => {
                  e.currentTarget.disabled = true;
                  submitExpenseForm();
                }}
                disabled={!expenseForm.amount || !expenseForm.description}
                style={{
                  background: expenseModal.isNote ? '#3b82f6' : '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '16px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  opacity: (!expenseForm.amount || !expenseForm.description) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                Registrar {expenseModal.isNote ? 'Nota' : 'Gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CAMERA MODAL --- */}
      {showCamera && (
        <div className="media-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="media-modal-content" style={{ maxWidth: '500px', padding: '10px' }}>
            <button className="close-btn" onClick={() => setShowCamera(false)} style={{ top: '10px', right: '10px' }}>✕</button>
            <div style={{ marginTop: '20px' }}>
              <CameraCapture 
                onPhotoCapture={(blob) => {
                  const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                  onSendMessage('', 'IMAGE', { file, phaseId: selectedPhaseId });
                  setShowCamera(false);
                }}
                onVideoCapture={(blob) => {
                  const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
                  onSendMessage('', 'VIDEO', { file, phaseId: selectedPhaseId });
                  setShowCamera(false);
                }}
                onClose={() => setShowCamera(false)}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .whatsapp-chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background-color: #0b141a;
          background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
          background-size: 400px;
          position: relative;
          overflow: hidden;
          color: #e9edef;
        }

        /* --- HEADER --- */
        .chat-header {
          flex-shrink: 0;
          background-color: #202c33;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          z-index: 100;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .header-back {
          margin-right: -4px;
          color: #8696a0;
        }
        .project-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1rem;
        }
        .project-info h1 {
          font-size: 1rem;
          font-weight: 500;
          margin: 0;
        }
        .project-info p {
          font-size: 0.75rem;
          color: #8696a0;
          margin: 0;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }
        .btn-jornada {
          background-color: var(--primary);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-jornada.active {
          background-color: var(--danger);
        }

        /* --- BODY --- */
        .chat-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 16px 100px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .date-badge {
          align-self: center;
          background-color: #202c33;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          color: #8696a0;
          margin-bottom: 20px;
        }
        .message-row {
          display: flex;
          flex-direction: column;
          max-width: 82%;
          margin-bottom: 4px;
          position: relative;
        }
        .message-row.me {
          align-self: flex-end;
          align-items: flex-end;
        }
        .message-row.them {
          align-self: flex-start;
          align-items: flex-start;
        }
        .user-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: #34d399;
          margin-bottom: 2px;
          margin-left: 8px;
        }
        .message-bubble {
          padding: 8px 12px 10px 12px;
          border-radius: 16px;
          position: relative;
          min-width: 80px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .me .message-bubble {
          background-color: #005c4b; /* WA Me Color */
          border-top-right-radius: 4px;
        }
        .them .message-bubble {
          background-color: #202c33; /* WA Them Color */
          border-top-left-radius: 4px;
        }

        .message-bubble p {
          margin: 0;
          line-height: 1.5;
          font-size: 0.95rem;
          word-break: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
          overflow: hidden;
        }

        .message-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
          height: 15px;
          opacity: 0.8;
        }
        .time {
          font-size: 0.68rem;
          color: #8696a0;
        }
        .check {
          font-size: 0.75rem;
          color: #53bdeb;
        }

        .expense-box {
          max-width: 100%;
          overflow: hidden;
        }
        .expense-box div {
          word-break: break-word;
        }

        .document-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: rgba(0,0,0,0.2);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.05);
          margin-top: 5px;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          box-sizing: border-box;
        }
        .document-box:hover {
          background: rgba(0,0,0,0.3);
        }
        .doc-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .doc-name {
          font-size: 0.85rem;
          font-weight: 600;
          word-break: break-all;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .doc-type {
          font-size: 0.65rem;
          opacity: 0.6;
          text-transform: uppercase;
        }

        .note-box {
          background: rgba(245, 158, 11, 0.05);
          border-left: 3px solid #f59e0b;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 5px;
        }

          .media-preview {
            margin: 4px -2px;
            border-radius: 8px;
            overflow: hidden;
            background-color: #0d1418;
            display: flex;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.05);
          }
        .media-preview img, .media-preview video {
          max-width: 100%;
          max-height: 280px; 
          min-width: 180px;
          object-fit: contain;
          cursor: pointer;
        }
        .audio-bubble {
          padding: 5px 0;
          display: flex;
          align-items: center;
        }

        /* --- ATTACHMENTS --- */
        .attachments-menu {
          position: absolute;
          bottom: 70px;
          left: 10px;
          right: 10px;
          background-color: #233138;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
          animation: slideUp 0.3s ease;
          z-index: 90;
        }
        .attachments-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-around;
          gap: 20px;
        }

        /* --- FOOTER --- */
        .chat-footer {
          flex-shrink: 0;
          padding: 8px 10px;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          background-color: transparent;
          z-index: 100;
        }
        .input-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        .input-container {
          flex: 1;
          min-width: 0;
          background-color: #202c33;
          border-radius: 28px;
          display: flex;
          align-items: center;
          padding: 4px 8px 4px 16px;
          min-height: 48px;
          gap: 2px;
        }
        .input-container textarea {
          flex: 1;
          background: none;
          border: none;
          color: white;
          resize: none;
          padding: 12px 5px;
          font-size: 1.05rem;
          outline: none;
          max-height: 150px;
        }
        .btn-send {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #00a884;
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .btn-icon {
          background: none;
          border: none;
          color: #8696a0;
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* --- MODALS --- */
        .media-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.9);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .new-messages-btn {
          position: absolute;
          bottom: 80px;
          right: 20px;
          background-color: #202c33;
          color: #00a884;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .media-modal-content {
          background: #202c33;
          padding: 20px;
          border-radius: 16px;
          width: 90%;
          max-width: 400px;
          position: relative;
        }
        .close-btn {
          position: absolute;
          top: -40px;
          right: 0;
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
        }

        /* Responsive Fixes */
        @media (max-width: 480px) {
          .chat-header {
            padding: 8px 12px;
          }
          .project-avatar {
            width: 36px;
            height: 36px;
            font-size: 0.9rem;
          }
          .project-info h1 {
            font-size: 0.95rem;
            max-width: 140px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .project-info p {
            font-size: 0.65rem;
            gap: 4px !important;
          }
          .chat-body {
            padding: 12px 14px 80px 14px;
          }
          .message-row {
            max-width: 84%;
          }
          .message-bubble {
            padding: 6px 8px;
          }
          .message-bubble p {
            font-size: 0.85rem;
            line-height: 1.4;
          }
          .media-preview img, .media-preview video {
            max-height: 180px;
            min-width: 140px;
          }
          .document-box {
            padding: 6px;
            gap: 8px;
          }
          .doc-name {
            font-size: 0.75rem;
          }
          .quote-bubble, .location-bubble, .expense-box {
            padding: 8px !important;
          }
          .quote-bubble h2, .quote-bubble div {
            font-size: 0.8rem !important;
          }
          .expense-box div {
            font-size: 0.8rem !important;
          }
          .header-actions {
            gap: 6px;
          }
          .btn-jornada {
            padding: 4px 10px;
            font-size: 0.7rem;
            border-radius: 12px;
          }
          .input-container {
            padding: 2px 4px 2px 12px;
            min-height: 40px;
          }
          .input-container textarea {
            font-size: 0.9rem;
            padding: 8px 2px;
          }
          .btn-send {
            width: 40px;
            height: 40px;
          }
          .input-row {
            gap: 4px;
          }
          .chat-footer {
            padding: 4px 6px;
            padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
          }
          .attachments-menu {
            bottom: 60px;
            padding: 15px;
          }
          .attachments-grid {
             gap: 15px;
          }
          .location-bubble {
            padding: 8px;
          }
          .location-bubble button {
            padding: 8px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  )
}
