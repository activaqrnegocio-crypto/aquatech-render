'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Captura errores de hidratación (#418, #423, #425) que ocurren cuando el HTML
 * cacheado por el Service Worker no coincide con lo esperado por React.
 * Fuerza un re-render silencioso client-side en lugar de colapsar la app.
 */
export default class OfflineErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Si es un error de hidratación, preparamos el re-render
    const isHydrationError = 
      error.message.includes('Minified React error #418') || 
      error.message.includes('Minified React error #423') ||
      error.message.includes('Minified React error #425') ||
      error.message.includes('Hydration failed') ||
      error.message.includes('Text content does not match server-rendered HTML');

    if (isHydrationError) {
      return { hasError: true }
    }
    
    // Si es otro tipo de error, lo dejamos pasar (no lo manejamos aquí)
    throw error;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.state.hasError) {
      console.warn('[OfflineErrorBoundary] Capturado error de hidratación. Forzando re-render client-side...');
      
      // Esperamos un momento y quitamos el error para que React 
      // vuelva a renderizar todo el árbol pero ahora 100% en el cliente
      setTimeout(() => {
        this.setState({ hasError: false })
      }, 50);
    }
  }

  public render() {
    if (this.state.hasError) {
      // Mientras se recupera, mostramos nada o un spinner sutil
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )
    }

    return this.props.children
  }
}
