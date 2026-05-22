import { prisma } from '@/lib/prisma'
import QuoteDetailClient from './QuoteDetailClient'
import { notFound } from 'next/navigation'

import { deepSerialize } from '@/lib/serializable'

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

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, clientId: true, client: { select: { name: true } } }
  })

  if (!quote) return <div>Cotización no encontrada</div>

  return (
    <div className="p-6">
      <QuoteDetailClient quote={deepSerialize(quote)} projects={projects} />
    </div>
  )
}
