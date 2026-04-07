'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDateEcuador } from '@/lib/date-utils'

export default function QuotesListClient({ initialQuotes }: any) {
  const [quotes, setQuotes] = useState(initialQuotes)
  const [filter, setFilter] = useState('ALL')

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return

    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setQuotes(quotes.filter((q: any) => q.id !== id))
        alert('Cotización eliminada con éxito')
      } else {
        alert('Error al eliminar la cotización')
      }
    } catch (error) {
      console.error(error)
      alert('Error de red al eliminar')
    }
  }

  const filtered = filter === 'ALL' 
    ? quotes 
    : filter === 'PROJECT' 
      ? quotes.filter((q: any) => q.projectId !== null)
      : quotes.filter((q: any) => q.projectId === null)

  return (
    <>
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button onClick={() => setFilter('ALL')} className={`tab ${filter === 'ALL' ? 'active' : ''}`}>Todas</button>
        <button onClick={() => setFilter('PROJECT')} className={`tab ${filter === 'PROJECT' ? 'active' : ''}`}>Vinculadas a Proyectos</button>
        <button onClick={() => setFilter('NO_PROJECT')} className={`tab ${filter === 'NO_PROJECT' ? 'active' : ''}`}>Cotizaciones Individuales (Sin Proyecto)</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ minWidth: '800px', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)' }}>
              <th style={{ padding: '15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Cliente</th>
              <th style={{ padding: '15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Proyecto Relacionado</th>
              <th style={{ padding: '15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Fecha</th>
              <th style={{ padding: '15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Estado</th>
              <th style={{ padding: '15px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
              <th style={{ padding: '15px', textAlign: 'center', whiteSpace: 'nowrap' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((quote: any) => (
              <tr key={quote.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '15px' }}>{quote.client.name}</td>
                <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{quote.project?.title || 'Sin proyecto'}</td>
                <td style={{ padding: '15px' }} suppressHydrationWarning>{formatDateEcuador(quote.createdAt)}</td>
                <td style={{ padding: '15px' }}>
                  {quote.project ? (
                    <span className={`badge ${quote.project.status === 'ACTIVO' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {quote.project.status}
                    </span>
                  ) : ''}
                </td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                  $ {new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote.totalAmount)}
                </td>
                <td style={{ padding: '15px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Link href={`/admin/cotizaciones/compuesto/${quote.id}`} className="btn btn-ghost btn-sm" title="Ver PDF">PDF</Link>
                  <Link href={`/admin/cotizaciones/${quote.id}/edit`} className="btn btn-ghost btn-sm" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </Link>
                  <button onClick={() => handleDelete(quote.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Eliminar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron cotizaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
