import { prisma } from '@/lib/prisma'
import QuoteFormClient from './QuoteFormClient'

export const dynamic = 'force-dynamic'

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const params = await searchParams;
  const [clients, materials, prefetchedProject] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    params.projectId 
      ? prisma.project.findUnique({ 
          where: { id: Number(params.projectId) },
          include: { budgetItems: { include: { material: true } } } 
        })
      : null
  ])

  return (
    <div className="p-6">
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <h2>Nueva Cotización</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
            {prefetchedProject ? `Generando desde presupuesto: ${prefetchedProject.title}` : 'Crea una propuesta comercial desde cero.'}
          </p>
        </div>
      </div>

      <QuoteFormClient 
        clients={clients} 
        materials={materials.map(m => ({ ...m, unitPrice: Number(m.unitPrice) }))}
        prefetchedProject={prefetchedProject ? {
            id: prefetchedProject.id,
            clientId: prefetchedProject.clientId,
            items: prefetchedProject.budgetItems.map(bi => ({
                materialId: bi.materialId,
                description: bi.material?.name || 'Material sin nombre',
                code: bi.material?.code || 'S/C',
                quantity: Number(bi.quantity),
                unitPrice: Number(bi.material?.unitPrice || 0)
            }))
        } : null}
      />
    </div>
  )
}
