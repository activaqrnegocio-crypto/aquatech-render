'use client'

import { useState, useEffect } from 'react'

interface OnboardingProps {
  onDone: () => void
}

function detectBrand() {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad/.test(ua)) return 'iphone'
  if (/xiaomi|miui|hyperos|redmi|poco/.test(ua)) return 'xiaomi'
  if (/huawei|honor/.test(ua)) return 'huawei'
  if (/oppo|realme|oneplus/.test(ua)) return 'oppo'
  if (/vivo/.test(ua)) return 'vivo'
  if (/samsung/.test(ua)) return 'samsung'
  return 'android'
}

const GUIDES: Record<string, { titulo: string; pasos: string[] }> = {
  xiaomi: {
    titulo: 'Tu Xiaomi bloquea notificaciones por defecto',
    pasos: [
      'Ajustes → Batería → Modo → elige "Equilibrado"',
      'Ajustes → Apps → Chrome → Ahorro batería → Sin restricciones',
      'Ajustes → Apps → Permisos → Inicio automático → activa Chrome',
      'En apps recientes: mantén pulsado Chrome → toca el candado',
    ]
  },
  huawei: {
    titulo: 'Configura tu Huawei para recibir avisos',
    pasos: [
      'Ajustes → Batería → Inicio de apps → Chrome → gestión manual → activa todo',
      'Ajustes → Notificaciones → Chrome → activa todas',
      'Ajustes → Batería → Sin optimizar → añade Chrome',
    ]
  },
  oppo: {
    titulo: 'Un ajuste rápido en tu teléfono',
    pasos: [
      'Ajustes → Batería → Optimización batería → Chrome → No optimizar',
      'Ajustes → Apps → Chrome → Ahorro energía → Sin restricciones',
    ]
  },
  vivo: {
    titulo: 'Activa notificaciones en segundo plano',
    pasos: [
      'Ajustes → Batería → Consumo energía en segundo plano → Chrome → permitir',
      'Ajustes → Apps → Chrome → Permisos → Notificaciones → activar todo',
    ]
  },
  samsung: {
    titulo: 'Un ajuste rápido en tu Samsung',
    pasos: [
      'Ajustes → Batería → Límites en segundo plano → añade Chrome a "Apps que nunca duermen"',
      'Ajustes → Batería → desactiva "Batería adaptable" para Chrome',
    ]
  },
  iphone: {
    titulo: 'Instala Aquatech para recibir notificaciones',
    pasos: [
      'Abre esta página en Safari (no Chrome)',
      'Toca el botón compartir (cuadrado con flecha)',
      'Toca "Agregar a pantalla de inicio"',
      'Abre Aquatech desde el ícono y acepta los permisos',
    ]
  },
  android: {
    titulo: 'Activa notificaciones en segundo plano',
    pasos: [
      'Ajustes → Apps → Chrome → Batería → Sin restricciones',
      'Comprueba que Chrome tenga permiso de notificaciones activado',
    ]
  }
}

export function NotificationOnboarding({ onDone }: OnboardingProps) {
  const [brand, setBrand] = useState('android')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setBrand(detectBrand())
    // Subtle entry animation delay
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const guide = GUIDES[brand] || GUIDES.android

  return (
    <div className={`onboarding-overlay ${visible ? 'visible' : ''}`}>
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-icon">⚠️</div>
          <h3>{guide.titulo}</h3>
          <button className="close-btn" onClick={onDone}>✕</button>
        </div>
        <p className="onboarding-desc">Para que las notificaciones lleguen al instante en tu {brand === 'iphone' ? 'iPhone' : 'dispositivo'}, sigue estos pasos:</p>
        
        <ul className="onboarding-steps">
          {guide.pasos.map((paso, i) => (
            <li key={i}>
              <span className="step-number">{i + 1}</span>
              <span className="step-text">{paso}</span>
            </li>
          ))}
        </ul>

        <button className="onboarding-button" onClick={onDone}>
          Entendido, ya lo configuré
        </button>
      </div>

      <style jsx>{`
        .onboarding-overlay {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 20px;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 10px 20px;
          opacity: 0;
          transition: all 0.4s ease;
          pointer-events: none;
        }
        .onboarding-overlay.visible {
          opacity: 1;
          pointer-events: auto;
        }
        .onboarding-card {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          padding: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
          transform: translateY(20px);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .onboarding-overlay.visible .onboarding-card {
          transform: translateY(0);
        }
        .close-btn {
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          color: #aaa;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 5px;
        }
        .onboarding-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding-right: 20px;
        }
        .onboarding-icon {
          font-size: 1.5rem;
        }
        h3 {
          margin: 0;
          font-size: 1.1rem;
          color: white;
          font-weight: 700;
          line-height: 1.2;
        }
        .onboarding-desc {
          color: #aaa;
          font-size: 0.85rem;
          margin-bottom: 15px;
          line-height: 1.4;
        }
        .onboarding-steps {
          list-style: none;
          padding: 0;
          margin: 0 0 15px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .onboarding-steps li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(255, 255, 255, 0.03);
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .step-number {
          background: var(--brand-primary, #0070c0);
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: bold;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .step-text {
          color: #eee;
          font-size: 0.8rem;
          line-height: 1.3;
        }
        .onboarding-button {
          width: 100%;
          background: white;
          color: black;
          border: none;
          padding: 10px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .onboarding-button:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
