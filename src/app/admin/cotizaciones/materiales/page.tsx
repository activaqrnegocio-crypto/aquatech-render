import { prisma } from '@/lib/prisma'
import MaterialsClient from './MaterialsClient'

export const dynamic = 'force-dynamic'

export default async function MaterialsPage() {
  const materials = await prisma.material.findMany({
    where: { isActive: true },
    orderBy: { category: 'asc' }
  })

  // Grouped for display
  const categories = Array.from(new Set(materials.map(m => m.category).filter(Boolean)))

  return (
    <div className="p-6">
      <div className="dashboard-header" style={{ marginBottom: '30px' }}>
        <div>
          <h2>Catálogo de Materiales</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Administra los insumos y precios base para tus cotizaciones.</p>
        </div>
      </div>

      <MaterialsClient initialMaterials={materials.map(m => ({ ...m, unitPrice: Number(m.unitPrice) }))} categories={categories} />
    </div>
  )
}
