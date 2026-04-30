'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import QuoteFormClient from './QuoteFormClient'
import { db } from '@/lib/db'

function NewQuoteContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [clients, setClients] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [prefetchedProject, setPrefetchedProject] = useState<any>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    async function loadInitialData() {
      try {
        // 1. Load from local DB (Dexie) first for speed and offline support
        const cachedClients = await db.clientsCache.toArray()
        const cachedMaterials = await db.materialsCache.toArray()

        setClients(cachedClients)
        setMaterials(cachedMaterials)

        // 2. Fetch projects for linking
        if (navigator.onLine) {
           const projRes = await fetch('/api/projects?all=true')
           if (projRes.ok) {
             const projData = await projRes.json()
             setProjects(Array.isArray(projData) ? projData : [])
           }
        }

        // 3. If online and has projectId, try to fetch the specific project for budget conversion
        if (projectId && navigator.onLine) {
          const res = await fetch(`/api/projects/${projectId}`)
          if (res.ok) {
            const project = await res.json()
            setPrefetchedProject({
              id: project.id,
              clientId: project.clientId,
              title: project.title,
              items: (project.budgetItems || []).map((bi: any) => ({
                materialId: bi.materialId,
                description: bi.material?.name || 'Material sin nombre',
                code: bi.material?.code || 'S/C',
                quantity: Number(bi.quantity),
                unitPrice: Number(bi.material?.unitPrice || 0)
              }))
            })
          }
        }
      } catch (error) {
        console.error('Error loading offline data:', error)
      } finally {
        setInitializing(false)
      }
    }

    loadInitialData()
  }, [projectId])

  if (initializing) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-muted">Preparando formulario offline...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <h2>Nueva Cotización</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
            {prefetchedProject 
              ? `Generando desde presupuesto: ${prefetchedProject.title}` 
              : 'Crea una propuesta comercial desde cero.'}
          </p>
        </div>
      </div>

      <QuoteFormClient 
        clients={clients} 
        materials={materials}
        projects={projects}
        prefetchedProject={prefetchedProject}
      />
    </div>
  )
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <NewQuoteContent />
    </Suspense>
  )
}
