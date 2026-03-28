import { prisma } from '@/lib/prisma'
import QuoteDetailClient from './QuoteDetailClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await prisma.quote.findUnique({
    where: { id: Number(id) },
    include: {
      client: true,
      project: true,
      items: {
        include: { material: true }
      }
    }
  })

  if (!quote) notFound()

  return (
    <div className="p-6">
      <QuoteDetailClient quote={{
        ...quote,
        // @ts-ignore
        subtotal: Number(quote.subtotal || 0),
        // @ts-ignore
        totalAmount: Number(quote.totalAmount),
        // @ts-ignore
        subtotal0: Number(quote.subtotal0 || 0),
        // @ts-ignore
        subtotal15: Number(quote.subtotal15 || 0),
        // @ts-ignore
        ivaAmount: Number(quote.ivaAmount || 0),
        // @ts-ignore
        discountTotal: Number(quote.discountTotal || 0),
        items: quote.items.map(i => ({
          ...i,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          // @ts-ignore
          discountPct: Number(i.discountPct || 0),
          total: Number(i.total),
          material: i.material ? {
            ...i.material,
            unitPrice: Number(i.material.unitPrice)
          } : null
        }))
      }} />
    </div>
  )
}
