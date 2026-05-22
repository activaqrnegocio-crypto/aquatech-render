import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await req.json()
    if (!projectId) {
      return NextResponse.json({ error: 'ID de Proyecto es requerido' }, { status: 400 })
    }

    const { id } = await params
    const quoteId = Number(id)
    const targetProjectId = Number(projectId)

    // 1. Fetch quote details
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    // 2. Use RAW SQL to bypass stale prisma client validation for 'is_budget'
    await prisma.$transaction(async (tx) => {
      // Unset previous budget for this project
      await tx.$executeRaw`UPDATE quotes SET is_budget = 0 WHERE project_id = ${targetProjectId} AND is_budget = 1`
      
      // Set this quote as the official budget and link to project
      await tx.$executeRaw`UPDATE quotes SET is_budget = 1, project_id = ${targetProjectId} WHERE id = ${quoteId}`
      
      // Sync Project estimatedBudget
      await tx.project.update({
        where: { id: targetProjectId },
        data: { estimatedBudget: quote.totalAmount }
      })

      // Sync project budget items
      await tx.budgetItem.deleteMany({
        where: { projectId: targetProjectId }
      })

      if (quote.items && quote.items.length > 0) {
        await tx.budgetItem.createMany({
          data: quote.items.map(item => ({
            projectId: targetProjectId,
            materialId: item.materialId,
            name: item.description,
            quantity: item.quantity,
            estimatedCost: item.unitPrice,
            unit: 'UND'
          }))
        })
      }

      // Optional: Add a chat log entry
      await tx.chatMessage.create({
        data: {
          projectId: targetProjectId,
          userId: Number(session.user.id),
          content: `💎 PRESUPUESTO ACTUALIZADO: La cotización #${quoteId} ha sido vinculada como el presupuesto oficial por un total de $${Number(quote.totalAmount).toFixed(2)}.`,
          type: 'TEXT'
        }
      })
    })

    return NextResponse.json({ success: true, message: 'Cotización vinculada como presupuesto oficial.' })
  } catch (error) {
    console.error('Error linking quote to project budget (RAW):', error)
    return NextResponse.json({ error: 'Error interno del servidor al vincular' }, { status: 500 })
  }
}
