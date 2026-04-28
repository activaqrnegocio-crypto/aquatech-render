'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'

export default function ProjectCacheManager() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncComplete, setSyncComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [projectCount, setProjectCount] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // 1. Load initial metadata
    const loadMetadata = async () => {
      try {
        const meta = await db.cacheMetadata.get('projects_bulk')
        if (meta) {
          setLastSync(meta.lastSync)
          setProjectCount(meta.count)
          
          // If synced recently (within 30 mins), consider it complete initially
          if (meta.lastSync && (Date.now() - meta.lastSync < 30 * 60 * 1000)) {
            setSyncComplete(true)
          }
        }
      } catch (e) {}
    }
    loadMetadata()

    // 2. Listen for global progress
    const onProgress = (e: any) => {
      setIsSyncing(true)
      setSyncComplete(false)
      setProgress(e.detail)
    }
    
    // 3. Listen for global finished
    const onFinished = (e: any) => {
      setIsSyncing(false)
      setSyncComplete(true)
      setProjectCount(e.detail.count)
      setLastSync(Date.now())
    }

    window.addEventListener('bulk-cache-sync-progress', onProgress)
    window.addEventListener('bulk-cache-sync-finished', onFinished)
    
    return () => {
      window.removeEventListener('bulk-cache-sync-progress', onProgress)
      window.removeEventListener('bulk-cache-sync-finished', onFinished)
    }
  }, [])

  if (isDismissed) return null;

  // Render Premium Status Badge
  return (
    <div className="project-cache-status" style={{
      marginBottom: '24px',
      position: 'relative',
      borderRadius: '16px',
      overflow: 'hidden',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      background: syncComplete 
        ? 'rgba(16, 185, 129, 0.05)' 
        : isSyncing 
          ? 'rgba(56, 189, 248, 0.05)'
          : 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${syncComplete ? 'rgba(16, 185, 129, 0.2)' : isSyncing ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.08)'}`,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: syncComplete ? '0 4px 20px rgba(16, 185, 129, 0.1)' : 'none'
    }}>
      {/* Background Progress Glow */}
      {isSyncing && (
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.1), transparent)',
          transition: 'width 0.4s ease-out',
          width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 5}%`,
          zIndex: 0
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: syncComplete ? 'rgba(16, 185, 129, 0.15)' : isSyncing ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: syncComplete ? '#10b981' : isSyncing ? '#38bdf8' : 'rgba(255,255,255,0.4)',
          transition: 'all 0.3s ease'
        }}>
          {isSyncing ? (
            <svg style={{ animation: 'spin 2s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : syncComplete ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M12 6v6l4 2" />
            </svg>
          )}
        </div>

        <div>
          <h4 style={{ 
            margin: 0, 
            fontSize: '0.9rem', 
            fontWeight: '600', 
            color: syncComplete ? '#10b981' : 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isSyncing ? 'Sincronizando...' : syncComplete ? 'Sincronizado Offline' : 'Estado Offline'}
            {isSyncing && progress.total > 0 && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 'normal' }}>
                ({progress.current}/{progress.total})
              </span>
            )}
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            {isSyncing 
              ? 'Preparando acceso sin conexión para tus proyectos.' 
              : syncComplete 
                ? `${projectCount} proyectos listos para trabajar sin internet.` 
                : 'Iniciando descarga de datos necesarios...'}
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {syncComplete ? (
           <div style={{
             display: 'flex',
             alignItems: 'center',
             gap: '8px',
             background: 'rgba(16, 185, 129, 0.1)',
             color: '#10b981',
             padding: '6px 12px',
             borderRadius: '8px',
             fontSize: '0.75rem',
             fontWeight: 'bold',
             border: '1px solid rgba(16, 185, 129, 0.2)'
           }}>
             <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
             Listo para usar
           </div>
        ) : isSyncing ? (
          <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>
            {Math.round((progress.current / (progress.total || 1)) * 100)}%
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .project-cache-status:hover {
          background: ${syncComplete ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.05)'};
          border-color: ${syncComplete ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.15)'};
        }
      `}</style>
    </div>
  )
}
