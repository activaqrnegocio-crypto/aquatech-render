'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/db'
import ProjectDetailClient from './ProjectDetailClient'

export default function ProjectErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id

  const [cachedProject, setCachedProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCachedProject() {
      if (!projectId) {
        setLoading(false)
        return
      }

      try {
        const cached = await db.projectsCache.get(Number(projectId))
        if (cached) {
          setCachedProject(cached)
        }
      } catch (err) {
        console.error('Error loading project from cache:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCachedProject()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white/50">
        Comprobando caché offline...
      </div>
    )
  }

  // If we found it in cache, render the client directly!
  if (cachedProject) {
    return (
      <>
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-amber-500 flex items-center gap-3 text-sm font-semibold justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Estás viendo una versión guardada (Offline) porque falló la conexión al servidor.
        </div>
        <ProjectDetailClient project={cachedProject} availableOperators={[]} />
      </>
    )
  }

  // If not in cache, show standard error UI
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Error de Carga</h2>
      <p className="text-white/60 max-w-md mb-8">
        No pudimos conectar con el servidor para cargar este proyecto y no tienes una versión guardada en este dispositivo.
      </p>
      
      <div className="flex gap-4">
        <button
          onClick={() => {
            setLoading(true);
            reset();
          }}
          className="px-6 py-3 rounded-xl font-bold text-[#0F172A] bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          Reintentar Carga
        </button>
        <button
          onClick={() => router.push('/admin/proyectos')}
          className="px-6 py-3 rounded-xl font-bold text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
        >
          Ver Lista de Proyectos
        </button>
      </div>
      
      <div className="mt-12 text-left bg-black/20 p-4 rounded-lg max-w-2xl w-full hidden md:block">
        <p className="text-xs text-white/40 font-mono">Detalles técnicos (Timeouts en móvil son comunes):</p>
        <p className="text-xs text-red-400/60 font-mono mt-1 break-all">{error.message}</p>
      </div>
    </div>
  )
}
