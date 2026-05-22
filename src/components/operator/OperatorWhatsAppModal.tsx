'use client'

import { useState, useMemo } from 'react'

// v373: Modal de reenvío por WhatsApp — Extraído del operador
interface OperatorWhatsAppModalProps {
  forwardMsg: any
  projectTitle: string
  projectId: number | string
  onClose: () => void
}

export default function OperatorWhatsAppModal({ forwardMsg, projectTitle, projectId, onClose }: OperatorWhatsAppModalProps) {
  const [waCategory, setWaCategory] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSuccess, setWaSuccess] = useState(false)

  const waCategories = useMemo(() => [
    { id: 'urgencia', label: '🚨 Urgencia', color: '#ef4444', template: `⚠️ URGENCIA - Proyecto: ${projectTitle}\n\nDescripción: ` },
    { id: 'material', label: '📦 Falta de Material', color: '#f59e0b', template: `📦 SOLICITUD DE MATERIAL - Proyecto: ${projectTitle}\n\nMaterial requerido: ` },
    { id: 'cotizacion', label: '💰 Cotización', color: '#3b82f6', template: `💰 SOLICITUD DE COTIZACIÓN - Proyecto: ${projectTitle}\n\nDetalle: ` },
    { id: 'reporte', label: '📋 Reporte', color: '#8b5cf6', template: `📋 REPORTE DE AVANCE - Proyecto: ${projectTitle}\n\nEstado: ` },
    { id: 'otro', label: '💬 Otro', color: '#06b6d4', template: `📌 NOTIFICACIÓN - Proyecto: ${projectTitle}\n\n` },
  ], [projectTitle])

  const handleWaSend = async () => {
    if (!waPhone.trim() || !waMessage.trim()) {
      alert('Por favor completa el número y el mensaje')
      return
    }
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: waPhone.replace(/\D/g, ''),
          message: waMessage,
          projectId,
          category: waCategory,
        })
      })
      if (res.ok) {
        setWaSuccess(true)
        setTimeout(() => {
          setWaSuccess(false)
          onClose()
        }, 2000)
      } else {
        const data = await res.json()
        alert(data.error || 'Error enviando mensaje de WhatsApp')
      }
    } catch (e) {
      alert('Error de conexión al enviar WhatsApp')
    } finally {
      setWaSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Reenviar por WhatsApp</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-deep)', borderRadius: '8px', borderLeft: '3px solid var(--primary)', fontSize: '0.85rem', color: 'var(--text-secondary)', maxHeight: '100px', overflow: 'auto' }}>
            {forwardMsg.content || '[Multimedia]'}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0' }}>Selecciona la categoría y completa los datos:</p>

          {!waCategory ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {waCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setWaCategory(cat.id); setWaMessage(`${cat.template}\n\n--- Mensaje original ---\n${forwardMsg.content || '[Multimedia]'}`) }}
                  style={{ padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', textAlign: 'left', borderLeft: `4px solid ${cat.color}`, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; e.currentTarget.style.transform = 'translateX(4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateX(0)' }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button onClick={() => { setWaCategory(''); setWaMessage(''); setWaPhone('') }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', alignSelf: 'flex-start', fontSize: '0.8rem', padding: 0 }}>← Cambiar categoría</button>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Número de WhatsApp</label>
                <input type="tel" className="form-input" placeholder="593967491847" value={waPhone} onChange={e => setWaPhone(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Mensaje</label>
                <textarea className="form-input" rows={4} value={waMessage} onChange={e => setWaMessage(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <button
                onClick={handleWaSend}
                disabled={waSending || !waPhone.trim() || !waMessage.trim()}
                style={{ padding: '12px', background: waSending ? '#128C7E' : '#25D366', color: 'white', border: 'none', borderRadius: '10px', cursor: waSending ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!waPhone.trim() || !waMessage.trim()) ? 0.5 : 1 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {waSending ? 'Enviando...' : 'Enviar por WhatsApp'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
