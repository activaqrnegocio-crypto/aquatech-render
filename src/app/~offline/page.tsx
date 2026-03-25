'use client'

import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#0f172a',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ 
        width: '80px', 
        height: '80px', 
        backgroundColor: '#3b82f6', 
        borderRadius: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: '20px'
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>
        </svg>
      </div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Modo Offline</h1>
      <p style={{ color: '#94a3b8', marginBottom: '30px', maxWidth: '300px' }}>
        No tienes conexión a internet, pero puedes seguir trabajando. 
        Tus mensajes y gastos se guardarán y se enviarán automáticamente cuando vuelvas a estar en línea.
      </p>
      <a href="/admin/operador" style={{ 
        padding: '12px 24px', 
        backgroundColor: '#3b82f6', 
        color: 'white', 
        borderRadius: '8px', 
        textDecoration: 'none',
        fontWeight: 'bold'
      }}>
        Ir a mis proyectos locales
      </a>
    </div>
  )
}
