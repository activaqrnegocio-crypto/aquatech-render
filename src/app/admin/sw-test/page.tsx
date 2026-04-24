'use client'

import { useState, useEffect } from 'react'

/**
 * SW Diagnostic Page — shows exactly what's happening with the Service Worker.
 * Open this on the phone to debug offline issues.
 */
export default function SWTestPage() {
  const [status, setStatus] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const log = (msg: string) => {
    setStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  async function runDiagnostics() {
    log('🔍 Iniciando diagnóstico...')

    // Check basic support
    if (!('serviceWorker' in navigator)) {
      log('❌ Service Worker NO soportado en este navegador')
      setLoading(false)
      return
    }
    log('✅ Service Worker soportado')

    // Check HTTPS
    log(`🔗 Protocolo: ${window.location.protocol}`)
    log(`🏠 Host: ${window.location.hostname}`)

    // Check existing registrations
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      log(`📋 Registros SW encontrados: ${regs.length}`)
      for (const reg of regs) {
        const sw = reg.active || reg.installing || reg.waiting
        log(`  → Script: ${sw?.scriptURL || 'ninguno'}`)
        log(`  → Scope: ${reg.scope}`)
        log(`  → Estado: active=${!!reg.active}, installing=${!!reg.installing}, waiting=${!!reg.waiting}`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log(`❌ Error listando registros: ${msg}`)
    }

    // Check controller
    if (navigator.serviceWorker.controller) {
      log(`✅ Controller activo: ${navigator.serviceWorker.controller.scriptURL}`)
    } else {
      log('⚠️ Sin controller — el SW no está controlando esta página')
    }

    // Check cache storage
    try {
      const cacheNames = await caches.keys()
      log(`💾 Caches encontrados: ${cacheNames.length}`)
      for (const name of cacheNames) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        log(`  → ${name}: ${keys.length} entradas`)
        // Show first 5 entries
        for (let i = 0; i < Math.min(5, keys.length); i++) {
          log(`    • ${new URL(keys[i].url).pathname}`)
        }
        if (keys.length > 5) log(`    ... y ${keys.length - 5} más`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log(`❌ Error leyendo caches: ${msg}`)
    }

    setLoading(false)
  }

  async function tryRegister() {
    log('🔧 Intentando registrar SW manualmente...')
    
    const paths = ['/api/serve-sw', '/custom-sw.js', '/sw.js']
    
    for (const path of paths) {
      try {
        log(`  Intentando: ${path}`)
        
        // First check if the file is accessible
        const check = await fetch(path)
        const contentType = check.headers.get('content-type') || 'unknown'
        log(`  → Respuesta: status=${check.status}, content-type=${contentType}`)
        
        if (!contentType.includes('javascript')) {
          log(`  ⚠️ Content-Type incorrecto! Se espera javascript, se recibió: ${contentType}`)
          // Read first 100 chars of response to see what it contains
          const text = await check.clone().text()
          log(`  → Contenido (primeros 100 chars): ${text.substring(0, 100)}`)
          continue
        }
        
        const reg = await navigator.serviceWorker.register(path, { scope: '/' })
        log(`  ✅ Registrado exitosamente via ${path}`)
        log(`  → Scope: ${reg.scope}`)
        log(`  → Active: ${!!reg.active}`)
        log(`  → Installing: ${!!reg.installing}`)
        log(`  → Waiting: ${!!reg.waiting}`)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        log(`  ❌ Falló ${path}: ${msg}`)
      }
    }
    
    log('❌ TODOS los intentos de registro fallaron')
  }

  async function testOfflineCache() {
    log('🌐 Probando si las páginas están en caché...')
    const testUrls = ['/admin', '/admin/', '/admin/login', '/offline.html', '/admin/operador']
    
    for (const url of testUrls) {
      const match = await caches.match(url)
      if (match) {
        const ct = match.headers.get('content-type') || 'unknown'
        log(`  ✅ ${url} → EN CACHÉ (${ct}, status: ${match.status})`)
      } else {
        log(`  ❌ ${url} → NO en caché`)
      }
    }
  }

  async function forceWarmUp() {
    log('🔥 Forzando warm-up de caché...')
    if (!navigator.serviceWorker.controller) {
      log('⚠️ No hay controller, intentando registrar primero...')
      await tryRegister()
      // Wait for activation
      await new Promise(r => setTimeout(r, 3000))
      if (!navigator.serviceWorker.controller) {
        log('❌ Aún sin controller después de registrar')
        return
      }
    }

    const pages = [
      '/admin', '/admin/', '/admin/login', '/admin/cotizaciones',
      '/admin/operador', '/admin/operador/', '/offline.html'
    ]

    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE_URLS',
      urls: pages,
    })
    log(`📤 Enviado PRECACHE_URLS con ${pages.length} páginas`)
    log('⏳ Esperando 5 segundos para que el caché se llene...')
    
    await new Promise(r => setTimeout(r, 5000))
    await testOfflineCache()
  }

  async function clearEverything() {
    log('🗑️ Borrando TODO...')
    
    // Clear caches
    const names = await caches.keys()
    for (const name of names) {
      await caches.delete(name)
      log(`  Eliminado caché: ${name}`)
    }
    
    // Unregister SWs
    const regs = await navigator.serviceWorker.getRegistrations()
    for (const reg of regs) {
      await reg.unregister()
      log(`  Desregistrado SW: ${reg.scope}`)
    }
    
    log('✅ Todo limpio. Recarga la página y vuelve a probar.')
  }

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      fontSize: '13px',
      background: '#0a0f1e',
      color: '#e2e8f0',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#3b82f6', marginBottom: '10px' }}>🔧 SW Diagnóstico</h1>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Abre esta página en el teléfono para ver qué pasa con el Service Worker</p>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        <button onClick={runDiagnostics} style={btnStyle}>🔍 Re-diagnosticar</button>
        <button onClick={tryRegister} style={btnStyle}>🔧 Registrar SW</button>
        <button onClick={testOfflineCache} style={btnStyle}>💾 Ver Caché</button>
        <button onClick={forceWarmUp} style={btnStyle}>🔥 Forzar Warm-up</button>
        <button onClick={clearEverything} style={{...btnStyle, background: '#dc2626'}}>🗑️ Limpiar TODO</button>
      </div>

      <div style={{
        background: '#1e293b',
        borderRadius: '8px',
        padding: '15px',
        maxHeight: '60vh',
        overflow: 'auto',
        border: '1px solid #334155'
      }}>
        {loading && <p style={{ color: '#fbbf24' }}>Cargando diagnóstico...</p>}
        {status.map((msg, i) => (
          <div key={i} style={{ 
            borderBottom: '1px solid #1e293b',
            padding: '4px 0',
            color: msg.includes('❌') ? '#ef4444' : msg.includes('✅') ? '#22c55e' : msg.includes('⚠️') ? '#fbbf24' : '#e2e8f0'
          }}>
            {msg}
          </div>
        ))}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'monospace',
}
