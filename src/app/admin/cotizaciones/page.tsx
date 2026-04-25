'use client'

import { useState, useEffect } from 'react'
import QuotesListClient from './QuotesListClient'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function CotizacionesPage() {
  const { data: session } = useSession()
  const [quotes, setQuotes] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!session) return
      
      try {
        const [quotesRes, projectsRes] = await Promise.all([
          fetch('/api/quotes'),
          fetch('/api/projects?status=ACTIVO')
        ])
        
        if (quotesRes.ok) {
          const data = await quotesRes.json()
          setQuotes(data)
        }
        
        if (projectsRes.ok) {
          const data = await projectsRes.json()
          setProjects(data)
        }
      } catch (err) {
        console.error("Error loading cotizaciones data:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (session) {
      loadData()
    }
  }, [session])

  return (
    <div className="p-6">
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <h2>Cotizaciones</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Gestiona presupuestos y propuestas para clientes.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/cotizaciones/materiales" className="btn btn-ghost">Ver Materiales</Link>
          <Link href="/admin/cotizaciones/nuevo" className="btn btn-primary">+ Nueva Cotización</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: 'var(--text-muted)' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p>Cargando cotizaciones...</p>
          </div>
        </div>
      ) : (
        <QuotesListClient 
          initialQuotes={quotes} 
          activeProjects={projects}
        />
      )}
    </div>
  )
}
