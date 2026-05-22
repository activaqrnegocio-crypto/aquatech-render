'use client'

import { useState, useEffect } from 'react'

export function IosInstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Check if it's iOS/iPadOS
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    // Check if it's already running as a standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    // Check if user dismissed it recently
    const dismissed = localStorage.getItem('iosInstallBannerDismissed')
    
    if (isIos && !isStandalone && !dismissed) {
      setShow(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('iosInstallBannerDismissed', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="ios-banner">
      <div className="ios-banner-content">
        <div className="ios-banner-text">
          <h4>📱 Instala Aquatech en tu iPhone</h4>
          <p>Para recibir notificaciones push en iOS, debes instalar la aplicación en tu pantalla de inicio.</p>
        </div>
        <div className="ios-banner-steps">
          <div className="ios-step">
            <span>1</span> Toca el botón <strong>Compartir</strong> (cuadrado con flecha ↑)
          </div>
          <div className="ios-step">
            <span>2</span> Desliza hacia abajo y elige <strong>"Agregar a pantalla de inicio"</strong>
          </div>
        </div>
        <button className="ios-banner-close" onClick={handleDismiss}>Cerrar</button>
      </div>

      <style jsx>{`
        .ios-banner {
          background: linear-gradient(135deg, #2c2c2e, #1c1c1e);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 20px;
          color: white;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.5s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        h4 {
          margin: 0 0 8px 0;
          font-size: 1.1rem;
          font-weight: 800;
        }
        p {
          margin: 0 0 15px 0;
          font-size: 0.85rem;
          color: #aaa;
          line-height: 1.4;
        }
        .ios-banner-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }
        .ios-step {
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.05);
          padding: 10px;
          border-radius: 12px;
        }
        .ios-step span {
          background: #007aff;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: bold;
          flex-shrink: 0;
        }
        .ios-banner-close {
          width: 100%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
