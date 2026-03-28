import { prisma } from '@/lib/prisma'
import QuotesListClient from './QuotesListClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CotizacionesPage() {
  const quotes = await prisma.quote.findMany({
    include: {
      client: { select: { name: true } },
      project: { select: { title: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

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

      <QuotesListClient initialQuotes={quotes.map(q => ({ 
        ...q, 
        totalAmount: Number(q.totalAmount),
        // @ts-ignore
        subtotal: Number(q.subtotal || 0),
        // @ts-ignore
        subtotal0: Number(q.subtotal0 || 0),
        // @ts-ignore
        subtotal15: Number(q.subtotal15 || 0),
        // @ts-ignore
        ivaAmount: Number(q.ivaAmount || 0),
        // @ts-ignore
        discountTotal: Number(q.discountTotal || 0)
      }))} />
    </div>
  )
}
