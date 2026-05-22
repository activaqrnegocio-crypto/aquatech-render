'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { db } from '@/lib/db'
import QuoteDetailClient from '../compuesto/[id]/QuoteDetailClient'

function OfflineQuoteContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const cachedId = searchParams.get('cachedId')
  const [quotePayload, setQuotePayload] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        if (!id && !cachedId) {
          setError(true)
          return
        }

        let q: any = null;

        if (id) {
          const item = await db.outbox.get(Number(id))
          if (item && item.type === 'QUOTE') {
            q = item.payload
          }
        } else if (cachedId) {
          q = await db.quotesCache.get(Number(cachedId))
        }

        if (q) {
          // Convert the payload to match what QuoteDetailClient expects from Prisma
          setQuotePayload({
            id: q.id || '(PENDIENTE)',
            status: q.status || 'BORRADOR', 
            clientId: q.clientId,
            clientName: q.clientName,
            clientRuc: q.clientRuc,
            clientAddress: q.clientAddress,
            clientPhone: q.clientPhone,
            clientAttention: q.clientAttention,
            subtotal: q.subtotal || 0,
            subtotal0: q.subtotal0 || 0,
            subtotal15: q.subtotal15 || 0,
            ivaAmount: q.ivaAmount || 0,
            discountTotal: q.discountTotal || 0,
            totalAmount: q.totalAmount || 0,
            notes: q.notes || '',
            validUntil: q.validUntil,
            createdAt: q.createdAt || new Date(),
            items: q.items || [],
            optionalTitle: q.optionalTitle || '',
            optionalDescription: q.optionalDescription || '',
            optionalImage: q.optionalImage || '',
            optionalImage2: q.optionalImage2 || '',
            project: q.projectId ? { title: 'Proyecto Vinculado (Local)' } : null
          })
        } else {
          setError(true)
        }
      } catch (err) {
        setError(true)
      }
    }
    load()
  }, [id, cachedId])

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
      <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '10px 15px', borderRadius: '5px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <strong>Modo sin conexión</strong> 
        <span style={{ fontSize: '0.85rem' }}>Esta cotización no ha sido subida al servidor todavía. Puedes descargar el PDF ahora, y se sincronizará cuando tengas internet.</span>
      </div>
      <QuoteDetailClient quote={quotePayload} />
    </div>
  )
}

export default function OfflineQuotePage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando cotización pendiente...</div>}>
      <OfflineQuoteContent />
    </Suspense>
  )
}
