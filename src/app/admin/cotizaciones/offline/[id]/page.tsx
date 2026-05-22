'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { db } from '@/lib/db'
import QuoteDetailClient from '../../compuesto/[id]/QuoteDetailClient'

export default function OfflineQuotePage() {
  const { id } = useParams()
  const [quotePayload, setQuotePayload] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const item = await db.outbox.get(Number(id))
        if (item && item.type === 'QUOTE') {
          // Convert the payload to match what QuoteDetailClient expects from Prisma
          const q = item.payload
          setQuotePayload({
            id: 'OFFLINE_PENDING',
            status: 'BORRADOR', // Offline quotes are always drafts
            clientId: q.clientId,
            clientName: q.clientName,
            clientRuc: q.clientRuc,
            clientAddress: q.clientAddress,
            clientPhone: q.clientPhone,
            clientAttention: q.clientAttention,
            subtotal: q.subtotal,
            subtotal0: q.subtotal0,
            subtotal15: q.subtotal15,
            ivaAmount: q.ivaAmount,
            discountTotal: q.discountTotal,
            totalAmount: q.totalAmount,
            notes: q.notes,
            validUntil: q.validUntil,
            createdAt: new Date(),
            items: q.items,
            project: q.projectId ? { title: 'Proyecto Vinculado (Offline)' } : null
          })
        } else {
          setError(true)
        }
      } catch (err) {
        setError(true)
      }
    }
    load()
  }, [id])

  if (error) {
    return (
      <div className="p-6 text-center">
        <h2>Cotización no encontrada</h2>
        <p className="text-muted">Parece que esta cotización ya se sincronizó con el servidor o fue eliminada.</p>
        <button onClick={() => window.location.href = '/admin/cotizaciones'} className="btn btn-primary mt-4">Volver al Historial</button>
      </div>
    )
  }

  if (!quotePayload) {
    return <div className="p-6">Generando vista offline...</div>
  }

  return (
    <div className="p-6">
      <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '10px 15px', borderRadius: '5px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Modo sin conexión</strong> 
        <span>Esta cotización no ha sido subida al servidor todavía. Puedes descargar el PDF ahora, y se sincronizará cuando tengas internet.</span>
      </div>
      <QuoteDetailClient quote={quotePayload} />
    </div>
  )
}
