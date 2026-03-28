'use client'

import { useState } from 'react'
import Link from 'next/link'

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

  const filtered = filter === 'ALL' ? quotes : quotes.filter((q: any) => q.status === filter)

  return (
    <>
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button onClick={() => setFilter('ALL')} className={`tab ${filter === 'ALL' ? 'active' : ''}`}>Todas</button>
        <button onClick={() => setFilter('BORRADOR')} className={`tab ${filter === 'BORRADOR' ? 'active' : ''}`}>Borradores</button>
        <button onClick={() => setFilter('ENVIADA')} className={`tab ${filter === 'ENVIADA' ? 'active' : ''}`}>Enviadas</button>
        <button onClick={() => setFilter('ACEPTADA')} className={`tab ${filter === 'ACEPTADA' ? 'active' : ''}`}>Aceptadas</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)' }}>
              <th style={{ padding: '15px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Proyecto Relacionado</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Fecha</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Estado</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((quote: any) => (
              <tr key={quote.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '15px' }}>{quote.client.name}</td>
                <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{quote.project?.title || 'Sin proyecto'}</td>
                <td style={{ padding: '15px' }}>{new Date(quote.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '15px' }}>
                  <span className={`status-badge status-${quote.status.toLowerCase()}`}>
                    {quote.status}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                  $ {quote.totalAmount.toLocaleString()}
                </td>
                <td style={{ padding: '15px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Link href={`/admin/cotizaciones/compuesto/${quote.id}`} className="btn btn-ghost btn-sm">PDF</Link>
                  <button onClick={() => handleDelete(quote.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
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
