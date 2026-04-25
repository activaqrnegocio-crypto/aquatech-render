'use client'

import { signIn, getSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db' // Assuming this path is correct

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const handleStatus = () => setIsOffline(!navigator.onLine)
    window.addEventListener('online', handleStatus)
    window.addEventListener('offline', handleStatus)
    return () => {
      window.removeEventListener('online', handleStatus)
      window.removeEventListener('offline', handleStatus)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // --- CASE 1: OFFLINE LOGIN ---
    if (!navigator.onLine) {
      try {
        const cachedAuth = await db.auth.get('last_session')
        
        // Simple verification: if username matches the last successful login,
        // we allow entry. For production, we would ideally store a password hash too.
        if (cachedAuth && cachedAuth.username.toLowerCase() === username.toLowerCase()) {
          // Success! Even if we are offline, we trick the app via the Service Worker interceptor
          localStorage.setItem('auth_shadow_active', 'true')
          window.location.href = cachedAuth.role === 'OPERATOR' ? '/admin/operador' : cachedAuth.role === 'SUBCONTRATISTA' ? '/admin/subcontratista' : '/admin'
          return
        } else {
          setError('No hay conexión. Ingrese con el último usuario usado en este equipo.')
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Offline auth error', err)
      }
    }

    // --- CASE 2: ONLINE LOGIN ---
    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Credenciales incorrectas')
      setLoading(false)
    } else {
      // Redirigir inmediatamente. El servidor en /admin manejará el rol y los trabajadores 
      // de segundo plano guardarán la sesión en IndexedDB para el modo offline.
      window.location.href = '/admin'
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      
      <div className="login-card">
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <button 
            type="button" 
            onClick={() => router.push('/')}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Volver al inicio
          </button>
        </div>

        <div className="login-brand" style={{ marginTop: '20px' }}>
          <img src="/logo.jpg" alt="Aquatech" className="login-logo" />
          <h1 className="login-title">
            A<span>Q</span>UATECH
          </h1>
          <p className="login-tagline">innovación hidráulica</p>
        </div>

        <div className="login-divider" />

        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-form-title">Acceso al CRM</h2>
          <p className="login-form-subtitle">Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? (
              <>
                <span className="login-spinner" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <p className="login-footer">
          © 2026 Aquatech Loja — Todos los derechos reservados
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-deep);
          position: relative;
          overflow: hidden;
          padding: var(--space-md);
        }

        .login-bg-pattern {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 50%, rgba(56, 189, 248, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(3, 105, 161, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(56, 189, 248, 0.05) 0%, transparent 50%);
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-xl);
          position: relative;
          z-index: 1;
          animation: fadeIn 0.6s ease;
          box-shadow: var(--shadow-lg);
        }

        .login-brand {
          text-align: center;
          margin-bottom: var(--space-lg);
        }

        .login-logo {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-md);
          box-shadow: var(--shadow-glow);
        }

        .login-title {
          font-family: var(--font-brand);
          font-weight: 800;
          font-size: 1.8rem;
          letter-spacing: 2px;
          color: var(--text);
        }

        .login-title span {
          color: var(--primary);
        }

        .login-tagline {
          font-family: var(--font-brand);
          font-weight: 300;
          font-style: italic;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: -4px;
        }

        .login-divider {
          height: 1px;
          background: var(--border);
          margin-bottom: var(--space-lg);
        }

        .login-form-title {
          font-family: var(--font-brand);
          font-weight: 700;
          font-size: 1.15rem;
          color: var(--text);
          margin-bottom: var(--space-xs);
        }

        .login-form-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: var(--space-lg);
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: 10px 14px;
          background: var(--danger-bg);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: var(--danger);
          font-size: 0.8rem;
          margin-bottom: var(--space-md);
          animation: fadeIn 0.3s ease;
        }

        .login-footer {
          text-align: center;
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: var(--space-lg);
        }

        .login-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(11, 22, 35, 0.3);
          border-top-color: var(--text-inverse);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
