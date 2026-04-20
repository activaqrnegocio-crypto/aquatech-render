'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDateEcuador } from '@/lib/date-utils'
import { generateProfessionalPDF } from '@/lib/pdf-generator'
import { useSession } from 'next-auth/react'

export default function QuotesListClient({ initialQuotes, activeProjects = [] }: { initialQuotes: any[], activeProjects?: any[] }) {
  const { data: session } = useSession()
  const [quotes, setQuotes] = useState(initialQuotes)
  const [filter, setFilter] = useState('ALL')
  
  // Modal State
  const [modalMode, setModalMode] = useState<'LINK' | 'SHARE' | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null)
  const [projectId, setProjectId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return

    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (res.ok) {
        setQuotes(quotes.filter((q: any) => q.id !== id))
        alert('Cotización eliminada con éxito')
      } else {
        alert(data.error || 'Error al eliminar la cotización')
      }
    } catch (error) {
      console.error(error)
      alert('Error de red al eliminar')
    }
  }

  const handleAction = async () => {
    if (!selectedQuoteId || !projectId) return
    
    const targetProject = activeProjects.find(p => p.id === Number(projectId))
    const confirmTitle = modalMode === 'LINK' ? 'VINCULAR PRESUPUESTO' : 'ENVIAR COTIZACIÓN'
    const confirmMsg = modalMode === 'LINK' 
      ? `¿Confirmas que el proyecto "${targetProject?.title}" tome los valores de esta cotización como su presupuesto oficial?` 
      : `¿Confirmas enviar esta cotización al chat del proyecto "${targetProject?.title}"?`

    if (!confirm(confirmMsg)) return

    setLoading(true)
    try {
      const endpoint = modalMode === 'LINK' ? 'link' : 'share'
      const body: any = { projectId: Number(projectId) }
      
      if (modalMode === 'SHARE') {
        body.message = message
        
        // Find the quote object
        const quote = quotes.find((q: any) => q.id === selectedQuoteId)
        if (quote) {
          const clientInfo = {
            name: quote.clientName || quote.client?.name || '',
            ruc: quote.clientRuc || quote.client?.ruc,
            address: quote.clientAddress || quote.client?.address,
            phone: quote.clientPhone || quote.client?.phone,
            date: new Date(quote.createdAt)
          }

          const items = (quote.items || []).map((item: any) => ({
            quantity: item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity),
            code: item.material?.code || item.code || '',
            description: item.description,
            unitPrice: Number(item.unitPrice),
            total: Number(item.total)
          }))

          const totals = {
            subtotal: Number(quote.subtotal || 0),
            subtotal0: Number(quote.subtotal0 || 0),
            subtotal15: Number(quote.subtotal15 || 0),
            discountTotal: Number(quote.discountTotal || 0),
            ivaAmount: Number(quote.ivaAmount || 0),
            totalAmount: Number(quote.totalAmount)
          }

          const doc = generateProfessionalPDF(clientInfo, items, totals, {
            docType: 'COTIZACIÓN',
            docId: quote.id,
            notes: quote.notes,
            sellerName: session?.user?.name || quote.creator?.name || 'Aquatech',
            action: 'instance'
          });

          body.pdfBase64 = (doc as any).output('datauristring').split(',')[1];
          body.filename = `Cotizacion_${quote.id}_${(quote.clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;
        }
      }

      const res = await fetch(`/api/quotes/${selectedQuoteId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        alert(modalMode === 'LINK' ? 'Presupuesto vinculado correctamente.' : 'Cotización enviada al proyecto.')
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error || 'Error al procesar')
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setLoading(false)
      closeModal()
    }
  }

  const openModal = (mode: 'LINK' | 'SHARE', quoteId: number) => {
    setModalMode(mode)
    setSelectedQuoteId(quoteId)
    setProjectId('')
    setMessage('')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedQuoteId(null)
    setProjectId('')
    setMessage('')
  }

  const filtered = filter === 'ALL' 
    ? quotes 
    : filter === 'PROJECT' 
      ? quotes.filter((q: any) => q.projectId !== null)
      : quotes.filter((q: any) => q.projectId === null)

  return (
    <>
      {/* Filtros eliminados según solicitud */}

      <div className="card shadow-sm" style={{ padding: 0, overflowX: 'auto', borderRadius: '16px' }}>
        <table style={{ minWidth: '900px', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-deep)' }}>
              <th style={{ padding: '20px 15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Cliente / ID</th>
              <th style={{ padding: '20px 15px', textAlign: 'left', whiteSpace: 'nowrap' }}>Fecha</th>
              <th style={{ padding: '20px 15px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
              <th style={{ padding: '20px 15px', textAlign: 'center', whiteSpace: 'nowrap' }}>Acciones Especiales</th>
              <th style={{ padding: '20px 15px', textAlign: 'center', whiteSpace: 'nowrap' }}>Gestión</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((quote: any) => (
              <tr key={quote.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '15px' }}>
                  <div style={{ fontWeight: '600' }}>{quote.clientName || quote.client?.name || 'C. Final'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cotización #{quote.id}</div>
                </td>
                <td style={{ padding: '15px' }} suppressHydrationWarning>
                   <div style={{ fontSize: '0.85rem' }}>{formatDateEcuador(quote.createdAt)}</div>
                </td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                  $ {new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote.totalAmount)}
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                    <button 
                      onClick={() => openModal('SHARE', quote.id)}
                      className="btn btn-ghost btn-xs" 
                      style={{ fontSize: '0.65rem', borderRadius: '6px', border: '1px solid var(--primary)', padding: '6px 10px' }}
                      title="Enviar a chat de proyecto"
                    >
                      Enviar a Proyecto
                    </button>
                  </div>
                </td>
                <td style={{ padding: '15px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Link href={`/admin/cotizaciones/compuesto/${quote.id}`} className="btn btn-ghost btn-sm" title="Ver PDF" style={{ border: '1px solid var(--border)' }}>PDF</Link>
                  <Link href={`/admin/cotizaciones/${quote.id}/edit`} className="btn btn-ghost btn-sm" title="Editar" style={{ border: '1px solid var(--border)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </Link>
                  <button onClick={() => handleDelete(quote.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', border: '1px solid var(--border)' }} title="Eliminar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron cotizaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {modalMode && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div className="card shadow-lg" style={{ width: '100%', maxWidth: '500px', padding: '30px', borderRadius: '24px', backgroundColor: 'var(--card-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'LINK' ? 'Vincular Presupuesto Oficial' : 'Enviar a Proyecto'}</h3>
                <button onClick={closeModal} className="btn btn-ghost btn-sm">✕</button>
              </div>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                {modalMode === 'LINK' 
                  ? 'Esta acción hará que el proyecto seleccionado actualice su costo estimado y sus ítems de presupuesto basándose en esta cotización.'
                  : 'Esta cotización se enviará al chat del proyecto seleccionado únicamente como información, sin alterar el presupuesto.'}
              </p>

              <div className="form-group mb-md">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Proyecto Destino</label>
                <select 
                  className="form-input" 
                  value={projectId} 
                  onChange={e => setProjectId(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                >
                  <option value="">-- Selecciona un proyecto --</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.client?.name || 'S.C'})</option>
                  ))}
                </select>
              </div>

              {modalMode === 'SHARE' && (
                <div className="form-group mb-lg">
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Mensaje (Opcional)</label>
                  <textarea 
                    className="form-input" 
                    value={message} 
                    onChange={e => setMessage(e.target.value)}
                    disabled={loading}
                    placeholder="Ej: Hola equipo, les comparto esta propuesta para revisión..."
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', minHeight: '80px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn btn-ghost" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={closeModal} disabled={loading}>
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1.5 }} 
                  onClick={handleAction}
                  disabled={!projectId || loading}
                >
                  {loading ? 'Procesando...' : (modalMode === 'LINK' ? 'Vincular como Oficial' : 'Enviar a Proyecto')}
                </button>
              </div>
           </div>
        </div>
      )}
    </>
  )
}
