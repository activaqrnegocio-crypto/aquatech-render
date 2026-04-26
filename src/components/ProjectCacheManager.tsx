'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'

export default function ProjectCacheManager() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncComplete, setSyncComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [projectCount, setProjectCount] = useState(0)

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const meta = await db.cacheMetadata.get('projects_bulk')
        if (meta) {
          setLastSync(meta.lastSync)
          setProjectCount(meta.count)
        } else {
          const count = await db.projectsCache.count()
          setProjectCount(count)
        }
      } catch (e) {
        console.error('Error loading cache metadata:', e)
      }
    }
    loadMetadata()
  }, [])

  const handleManualSync = async () => {
    if (isSyncing || syncComplete) return
    if (!navigator.onLine) {
      alert('Debes estar conectado a internet para guardar el caché.')
      return
    }

    setIsSyncing(true)
    setSyncComplete(false)
    setProgress({ current: 0, total: 0 })

    try {
      // 1. Obtener la lista primero
      const limit = 50
      const res = await fetch(`/api/projects/bulk-cache?limit=${limit}`)
      
      if (!res.ok) throw new Error('Error al conectar con el servidor')

      const projects = await res.json()
      
      // 2. Establecer el total de inmediato para que el usuario lo vea
      setProgress({ current: 0, total: projects.length })

      if (projects.length === 0) {
        // Guardar metadata aunque sea cero para quitar el mensaje de "no hay datos"
        const now = Date.now()
        await db.cacheMetadata.put({
          id: 'projects_bulk',
          lastSync: now,
          count: 0,
          status: 'idle'
        })
        setProjectCount(0)
        setLastSync(now)
        setSyncComplete(true)
        setIsSyncing(false)
        return
      }

      const CHUNK_SIZE = 3 // Más pequeño para no saturar memoria móvil
      const TIMEOUT_MS = 30000 

      for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
        const chunk = projects.slice(i, i + CHUNK_SIZE)
        
        const processChunk = async () => {
          const chunkPromises = chunk.map(async (p: any) => {
            try {
              const projectToCache = { 
                ...p,
                lastAccessedAt: Date.now()
              }
              const chatMessages = p.chatMessages || []
              delete projectToCache.chatMessages

              await db.projectsCache.put(projectToCache)
              
              // Precarga de imágenes ULTRA segura (sin bloquear el hilo principal)
              if (p.gallery && p.gallery.length > 0) {
                setTimeout(() => {
                  p.gallery.slice(0, 5).forEach((item: any) => {
                    if (item.url && item.url.startsWith('http')) {
                      const img = new Image();
                      img.src = item.url;
                    }
                  });
                }, 100);
              }

              if (chatMessages.length > 0) {
                await db.chatCache.put({ projectId: p.id, messages: chatMessages })
              }
              
              setProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, prev.total) }))
              return true
            } catch (err) {
              console.error(`Error caching project ${p.id}:`, err)
              return false
            }
          })
          await Promise.all(chunkPromises)
        }

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Chunk Timeout')), TIMEOUT_MS)
        )

        try {
          await Promise.race([processChunk(), timeoutPromise])
        } catch (err) {
          console.warn(`Lote demoró demasiado. Continuando...`)
          const remainingInChunk = Math.min(CHUNK_SIZE, projects.length - i)
          setProgress(prev => ({ 
            ...prev, 
            current: Math.min(prev.current + remainingInChunk, prev.total) 
          }))
        }
      }

      const now = Date.now()
      const finalCount = await db.projectsCache.count()
      setLastSync(now)
      setProjectCount(finalCount)

      await db.cacheMetadata.put({
        id: 'projects_bulk',
        lastSync: now,
        count: finalCount,
        status: 'idle'
      })

      setSyncComplete(true)

    } catch (e: any) {
      console.error('Manual sync failed:', e)
      alert(`Error al guardar caché: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000)
    if (minutes < 1) return 'hace un momento'
    if (minutes < 60) return `hace ${minutes} m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours} h`
    const days = Math.floor(hours / 24)
    return `hace ${days} d`
  }

  return (
    <div style={{
      background: syncComplete 
        ? 'rgba(16, 185, 129, 0.08)' 
        : 'rgba(255,255,255,0.03)',
      border: syncComplete 
        ? '1px solid rgba(16, 185, 129, 0.3)' 
        : '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '16px 20px',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.4s ease'
    }}>
      {/* Progress bar */}
      {isSyncing && (
        <div 
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            background: 'rgba(56, 189, 248, 0.15)',
            transition: 'width 0.3s ease-out',
            width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
          }}
        />
      )}

      {/* Success banner */}
      {syncComplete && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          padding: '10px 16px',
          borderRadius: '10px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          animation: 'fadeSlideIn 0.4s ease-out'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          ¡Caché guardado! — {projectCount} proyectos listos para modo offline
        </div>
      )}
      
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', margin: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Modo Offline (Caché)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px', margin: '4px 0 0 0' }}>
            {lastSync 
              ? `Último sync: ${formatTimeAgo(lastSync)} · ${projectCount} proyectos listos` 
              : 'No hay datos guardados para modo offline completo.'}
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing || syncComplete}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            border: 'none',
            cursor: isSyncing || syncComplete ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            ...(syncComplete ? {
              background: '#10b981',
              color: 'white',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            } : isSyncing ? {
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)'
            } : {
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              color: '#0F172A',
              boxShadow: '0 4px 20px rgba(56, 189, 248, 0.4)'
            })
          }}
        >
          {syncComplete ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              ✓ Caché Guardado
            </>
          ) : isSyncing ? (
            <>
              <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              {progress.total > 0 
                ? `Descargando ${progress.current}/${progress.total}` 
                : 'Preparando lista...'}
            </>
          ) : lastSync && (Date.now() - lastSync < 3600000) ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Actualizado (Re-sync)
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Sincronizar Mis Proyectos
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
