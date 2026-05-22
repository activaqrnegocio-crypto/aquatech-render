'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export default function WhatsAppClient() {
  const [status, setStatus] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmLogout, setShowConfirmLogout] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Ref to track if we should auto-refresh the QR
  const isViewingQR = useRef(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) {
        const data = await res.json()
        const newState = data.instance?.state || data.state
        setStatus(newState)
        
        // If connected, stop QR viewing mode
        if (newState === 'open') {
          setQrCode(null)
          isViewingQR.current = false
        }
      }
    } catch (err) {
      console.warn('Status poll failed', err)
    } finally {
      if (loading) setLoading(false)
    }
  }, [loading])

  const fetchQR = async (isAuto = false) => {
    if (!isAuto) setIsProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/whatsapp/instance')
      const data = await res.json()
      console.log('[DEBUG WA QR RESPONSE]:', data)

      if (res.ok) {
        const qrBase64 = data.qrcode?.base64 || data.base64 || data.qr?.base64 || data.code?.base64
        
        if (qrBase64) {
          setQrCode(qrBase64)
          isViewingQR.current = true
        } else if (data.instance?.state === 'open' || data.state === 'open') {
          setStatus('open')
          setQrCode(null)
          isViewingQR.current = false
        } else {
          const msg = data.message || data.error || JSON.stringify(data)
          if (!isAuto) setError(`No se recibió un QR válido. Respuesta: ${msg}`)
        }
      } else {
        if (!isAuto) setError(data.error || 'Error al generar QR. Verifique que la instancia sea válida.')
      }
    } catch (err) {
      if (!isAuto) setError('Error de red al generar QR')
    } finally {
      if (!isAuto) setIsProcessing(false)
    }
  }

  const handleLogout = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch('/api/whatsapp/instance', { method: 'DELETE' })
      if (res.ok) {
        setStatus('close')
        setQrCode(null)
        isViewingQR.current = false
        setShowConfirmLogout(false)
        // Give it a moment then fetch status
        setTimeout(fetchStatus, 1000)
      } else {
        const data = await res.json()
        setError(data.error || 'Error al cerrar sesión')
      }
    } catch (err) {
      setError('Error de red al cerrar sesión')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = async () => {
    if (confirm('¿Deseas reiniciar completamente la sesión de WhatsApp? Esto cerrará cualquier intento fallido anterior.')) {
      await handleLogout()
      setTimeout(() => fetchQR(false), 2000)
    }
  }

  // Effect for Status Polling (Every 5s)
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Effect for QR Auto-refresh (Every 30s if active)
  useEffect(() => {
    const qrInterval = setInterval(() => {
      if (isViewingQR.current && status !== 'open' && document.visibilityState === 'visible') {
        console.log('Auto-refreshing QR code...')
        fetchQR(true)
      }
    }, 30000)
    return () => clearInterval(qrInterval)
  }, [status])

  if (loading) {
    return (
      <div className="whatsapp-card loading">
        <div className="shimmer-block"></div>
        <p>Cargando estado de WhatsApp...</p>
        <style jsx>{`
          .whatsapp-card { background: var(--bg-card); padding: 3rem; border-radius: var(--radius-lg); border: 1px solid var(--border); max-width: 550px; }
          .shimmer-block { height: 20px; width: 150px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); background-size: 200% 100%; animation: shimmer 1.5s infinite; margin-bottom: 20px; border-radius: 4px; }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          p { color: var(--text-muted); font-size: 0.9rem; }
        `}</style>
      </div>
    )
  }

  if (status === 'open') {
    return (
      <div className="whatsapp-card connected">
        <div className="status-indicator">
          <div className="dot green pulse"></div>
          <span>WhatsApp Conectado</span>
        </div>
        
        <div className="wa-actions">
          {!showConfirmLogout ? (
            <button 
              className="btn-danger" 
              onClick={() => setShowConfirmLogout(true)}
              disabled={isProcessing}
            >
              Desconectar Teléfono
            </button>
          ) : (
            <div className="confirm-area">
              <p>¿Estás seguro que deseas desconectar el WhatsApp? Dejarás de recibir notificaciones y mensajes en el CRM.</p>
              <div className="confirm-buttons">
                <button 
                  className="btn-danger" 
                  onClick={handleLogout}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Cerrando sesión...' : 'Sí, Desconectar'}
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowConfirmLogout(false)}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .whatsapp-card { background: var(--bg-card); padding: 2.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); max-width: 550px; margin: 2rem 0; box-shadow: var(--shadow-lg); position: relative; overflow: hidden; }
          .whatsapp-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--success); }
          .status-indicator { display: flex; align-items: center; gap: 12px; font-size: 1.25rem; font-weight: 700; margin-bottom: 2rem; font-family: var(--font-brand); }
          .dot { width: 14px; height: 14px; border-radius: 50%; }
          .green { background: var(--success); }
          .pulse { animation: pulse 2s infinite; }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
          }
          .wa-actions { border-top: 1px solid var(--border); padding-top: 1.5rem; }
          .confirm-area { background: var(--danger-bg); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--danger); }
          .confirm-area p { margin-bottom: 1.25rem; color: var(--text); font-size: 1rem; line-height: 1.5; }
          .confirm-buttons { display: flex; gap: 12px; }
          .btn-danger { background: var(--danger); color: white; border: none; padding: 12px 24px; border-radius: var(--radius-md); cursor: pointer; font-weight: 600; transition: all var(--transition-base); }
          .btn-danger:hover:not(:disabled) { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
          .btn-secondary { background: var(--bg-surface); color: var(--text); border: 1px solid var(--border); padding: 12px 24px; border-radius: var(--radius-md); cursor: pointer; font-weight: 600; transition: all var(--transition-base); }
          .btn-secondary:hover { background: var(--bg-card-hover); }
          .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`whatsapp-card ${status === 'connecting' ? 'connecting' : 'disconnected'}`}>
      <div className="status-indicator">
        <div className={`dot ${status === 'connecting' ? 'yellow' : 'red'}`}></div>
        <span>{status === 'connecting' ? 'WhatsApp Conectando...' : 'WhatsApp Desconectado'}</span>
      </div>

      <div className="wa-instructions">
        <p>Escanea el código QR con tu aplicación de WhatsApp (Configuración {'>'} Dispositivos vinculados) para conectar el CRM.</p>
        
        {error && (
          <div className="error-box">
            {error}
            <button className="reset-hint" onClick={handleReset}>¿Nada funciona? Reiniciar conexión</button>
          </div>
        )}

        {qrCode ? (
          <div className="qr-container">
            <img src={qrCode} alt="WhatsApp QR Code" />
            <p className="qr-hint">El código se actualiza automáticamente cada 30s</p>
            <button 
              className="btn-refresh" 
              onClick={() => fetchQR(false)}
              disabled={isProcessing}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              {isProcessing ? 'Actualizando...' : 'Actualizar QR ahora'}
            </button>
          </div>
        ) : (
          <button 
            className="btn-primary" 
            onClick={() => fetchQR(false)}
            disabled={isProcessing}
          >
            {isProcessing ? 'Generando QR...' : 'Generar Código QR'}
          </button>
        )}
      </div>

      <style jsx>{`
        .whatsapp-card { background: var(--bg-card); padding: 2.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); max-width: 550px; margin: 2rem 0; box-shadow: var(--shadow-lg); position: relative; overflow: hidden; }
        .whatsapp-card.disconnected::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--danger); }
        .whatsapp-card.connecting::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--warning); }
        .status-indicator { display: flex; align-items: center; gap: 12px; font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; font-family: var(--font-brand); }
        .dot { width: 14px; height: 14px; border-radius: 50%; }
        .red { background: var(--danger); }
        .yellow { background: var(--warning); animation: pulse-yellow 2s infinite; }
        @keyframes pulse-yellow {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .wa-instructions p { color: var(--text-muted); margin-bottom: 2rem; line-height: 1.6; font-size: 1rem; }
        .qr-container { display: flex; flex-direction: column; align-items: center; background: white; padding: 2rem; border-radius: var(--radius-lg); margin-top: 1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .qr-container img { width: 280px; height: 280px; }
        .qr-hint { margin-top: 1rem; font-size: 0.85rem; color: #475569; font-weight: 500; margin-bottom: 1rem; }
        .btn-refresh { display: flex; align-items: center; gap: 8px; background: var(--primary-glow); color: var(--primary); border: 1px solid var(--primary); padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; }
        .btn-refresh:hover { background: var(--primary-glow-strong); }
        .error-box { background: var(--danger-bg); color: var(--danger); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.9rem; border: 1px solid var(--danger); display: flex; flex-direction: column; gap: 10px; }
        .reset-hint { background: none; border: none; color: var(--primary); text-decoration: underline; cursor: pointer; text-align: left; font-size: 0.85rem; padding: 0; }
        .btn-primary { background: var(--primary); color: var(--text-inverse); border: none; padding: 14px 28px; border-radius: var(--radius-md); cursor: pointer; font-weight: 700; width: 100%; transition: all var(--transition-base); font-family: var(--font-brand); text-transform: uppercase; letter-spacing: 1px; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); background: var(--primary-hover); box-shadow: 0 0 16px var(--primary-glow-strong); }
        .btn-primary:disabled { opacity: 0.5; }
      `}</style>
    </div>
  )
}
