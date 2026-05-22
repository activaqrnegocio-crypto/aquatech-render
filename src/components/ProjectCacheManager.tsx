'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

export default function ProjectCacheManager({ userId }: { userId?: number | string }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncComplete, setSyncComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [projectCount, setProjectCount] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isOptimizingAssets, setIsOptimizingAssets] = useState(false)
  const [isAwaitingData, setIsAwaitingData] = useState(true) // v302: Guard against premature "Done"
  
  const isSyncingRef = useRef(false)
  const isAwaitingDataRef = useRef(true)
  const hasStartedSyncRef = useRef(false)
  const isSyncCompleteRef = useRef(false) // v315: Prevent banner from reverting from green

  // v289: Debounce — only declare "done" after 5s of SW silence (no new batch messages)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // v279: Use Live Query scoped to the specific user ID to avoid cross-account contamination
  const cacheKey = `projects_bulk_${userId || 'default'}`;
  const meta = useLiveQuery(() => db.cacheMetadata.get(cacheKey), [cacheKey]);

  useEffect(() => {
    if (!meta) return;
    setLastSync(meta.lastSync);
    setProjectCount(meta.count);
    
    // v302: Sync logic parity with GlobalSyncWorker
    const FRESHNESS_WINDOW = 15 * 60 * 1000;
    const isActuallyFresh = meta.lastSync && (Date.now() - meta.lastSync < FRESHNESS_WINDOW);

    if (meta.status === 'syncing') {
      setIsSyncing(true);
      isSyncingRef.current = true;
      setSyncComplete(false);
      isSyncCompleteRef.current = false;
      setIsAwaitingData(false);
      isAwaitingDataRef.current = false;
    } else {
      setIsSyncing(false);
      isSyncingRef.current = false;
      // If it's NOT fresh, we shouldn't show "Complete" (Green) on mount, 
      // because GlobalSyncWorker will start in 5s.
      setSyncComplete(!!isActuallyFresh);
      isSyncCompleteRef.current = !!isActuallyFresh;
      
      if (!isActuallyFresh) {
        setIsAwaitingData(true);
        isAwaitingDataRef.current = true;
      } else {
        setIsAwaitingData(false);
        isAwaitingDataRef.current = false;
      }
    }
  }, [meta]);

  useEffect(() => {
    const onStarted = () => {
      setIsSyncing(true)
      isSyncingRef.current = true
      setSyncComplete(false)
      isSyncCompleteRef.current = false
      setIsAwaitingData(false)
      isAwaitingDataRef.current = false
    }

    const onProgress = (e: any) => {
      setIsSyncing(true)
      isSyncingRef.current = true
      setSyncComplete(false)
      isSyncCompleteRef.current = false
      setIsAwaitingData(false)
      isAwaitingDataRef.current = false
      setProgress(e.detail)
    }

    const onFinished = (e: any) => {
      if (e.detail?.count) setProjectCount(e.detail.count);
      // Data sync done → SW warm-caching is now running in background
      setIsOptimizingAssets(true);
      setIsSyncing(false); // v302: Data phase done
      isSyncingRef.current = false;
      setIsAwaitingData(false); // Data is definitely here now
      isAwaitingDataRef.current = false;
      
      // v316: Do NOT ask for GET_PRECACHE_STATUS. GlobalSyncWorker guarantees 
      // PRECACHE_URLS is sent, which broadcasts count: 0 naturally if empty.
      
      // Safety timeout: 30s. If SW hasn't finished by then, something is wrong.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setIsOptimizingAssets(false);
      }, 30000); 
    }

    const onSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ASSETS_CACHED') {
        const remaining = e.data.count ?? 0;
        
        // v316: Removed the ignore check for 'remaining > 0'. If SW is working, we MUST show it.
        // The 30-min throttle in warmCache already prevents unwanted blinking.
        
        // As long as there is activity, we reset the safety timeout
        if (debounceRef.current) clearTimeout(debounceRef.current);
        
        if (remaining === 0) {
          // v302: Only accept "0" if we are not awaiting data sync to start or finish
          // Using REFS here because the listener closure is stale (empty deps array)
          if (isSyncingRef.current || isAwaitingDataRef.current) {
            // console.log('[CacheManager] SW reports 0, but still awaiting data sync (Ref check)...');
            return;
          }

          console.log('[CacheManager] ✅ SW reports 0 pending assets. Sync complete.');
          setIsOptimizingAssets(false);
          setSyncComplete(true);
          isSyncCompleteRef.current = true;
          
          // v302: Force persistent save to DB using .put (safer than .update)
          db.cacheMetadata.put({
            id: cacheKey,
            lastSync: Date.now(),
            count: 0,
            status: 'idle'
          }).catch(err => console.error('[CacheManager] DB persist failed:', err));
        } else {
          // If we receive any count > 0, we MUST stay in optimizing state
          setIsOptimizingAssets(true);
          setSyncComplete(false);
          isSyncCompleteRef.current = false;
          
          if (debounceRef.current) clearTimeout(debounceRef.current);
          
          // Reset safety timeout for another 15 seconds of silence
          // v305: ONLY allow silence timeout to finish if we are NOT in the middle of a data sync
          if (isSyncingRef.current) {
            // console.log('[CacheManager] Silence detected but data sync still active. Waiting...');
            return;
          }

          debounceRef.current = setTimeout(() => {
            setIsOptimizingAssets(false);
            setSyncComplete(true);
            isSyncCompleteRef.current = true;
            db.cacheMetadata.put({
              id: cacheKey,
              lastSync: Date.now(),
              count: 0,
              status: 'idle'
            }).catch(() => {});
          }, 15000);
        }
      }
    };

    window.addEventListener('bulk-cache-sync-started', onStarted)
    window.addEventListener('bulk-cache-sync-progress', onProgress)
    window.addEventListener('bulk-cache-sync-finished', onFinished)
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
      // v291: Initial check for SW status
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_PRECACHE_STATUS' });
      }
    }

    return () => {
      window.removeEventListener('bulk-cache-sync-started', onStarted)
      window.removeEventListener('bulk-cache-sync-progress', onProgress)
      window.removeEventListener('bulk-cache-sync-finished', onFinished)
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [])

  if (isDismissed) return null;

  const isFullyDone = syncComplete && !isOptimizingAssets && !isSyncing && !isAwaitingData;
  const isWorking = isSyncing || isOptimizingAssets || isAwaitingData;

  // Render Premium Status Badge
  return (
    <div className="project-cache-status" style={{
      marginBottom: '24px',
      position: 'relative',
      borderRadius: '16px',
      overflow: 'hidden',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      background: isFullyDone
        ? 'rgba(16, 185, 129, 0.05)'
        : isWorking
          ? 'rgba(56, 189, 248, 0.05)'
          : 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${isFullyDone ? 'rgba(16, 185, 129, 0.2)' : isWorking ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.08)'}`,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: isFullyDone ? '0 4px 20px rgba(16, 185, 129, 0.1)' : 'none'
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
          background: isFullyDone ? 'rgba(16, 185, 129, 0.15)' : isWorking ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isFullyDone ? '#10b981' : isWorking ? '#38bdf8' : 'rgba(255,255,255,0.4)',
          transition: 'all 0.3s ease'
        }}>
          {isWorking ? (
            <svg style={{ animation: 'spin 2s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : isFullyDone ? (
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
            color: isFullyDone ? '#10b981' : 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isSyncing
              ? 'Sincronizando Datos...'
              : isOptimizingAssets
                ? 'Optimizando interfaz...'
                : isFullyDone
                  ? 'Sincronizado Offline'
                  : 'Estado Offline'}
            {isSyncing && progress.total > 0 && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 'normal' }}>
                ({progress.current}/{progress.total})
              </span>
            )}
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            {isSyncing
              ? 'Descargando chats y tareas en base de datos local.'
              : isOptimizingAssets
                ? 'Preparando archivos de interfaz para acceso sin internet...'
                : isFullyDone
                  ? 'Todos los datos y archivos de interfaz están listos para trabajar sin conexión.'
                  : 'Iniciando descarga de datos necesarios...'}
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isFullyDone ? (
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

        {/* Dismiss Button */}
        <button 
          onClick={() => setIsDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          title="Cerrar aviso"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .project-cache-status:hover {
          background: ${isFullyDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.05)'};
          border-color: ${isFullyDone ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.15)'};
        }
      `}</style>
    </div>
  )
}
