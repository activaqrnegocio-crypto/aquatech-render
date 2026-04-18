import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const quote = await prisma.quote.findUnique({
      where: { id: Number(id) },
      include: { items: true, client: true }
    })
    
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    
    return NextResponse.json(quote)
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching quote' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const quoteId = Number(id)

    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        select: { clientId: true, projectId: true }
      })

      if (quote?.projectId) {
        throw new Error('NO_DELETE_LINKED_QUOTE');
      }

      await tx.quote.delete({ where: { id: quoteId } })

      if (quote?.clientId) {
        const remainingProjects = await tx.project.count({ where: { clientId: quote.clientId } })
        const remainingQuotes = await tx.quote.count({ where: { clientId: quote.clientId } })
        
        if (remainingProjects === 0 && remainingQuotes === 0) {
          await tx.client.delete({
            where: { id: quote.clientId }
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'NO_DELETE_LINKED_QUOTE') {
      return NextResponse.json({ 
        error: 'No se puede eliminar una cotización vinculada a un proyecto activo. Esto garantiza la integridad financiera del proyecto.' 
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error deleting quote' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    const data = await req.json()
    const items = data.items || []

    const updatedQuote = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing items for this quote
      await tx.quoteItem.deleteMany({
        where: { quoteId: id }
      })

      // 2. Update quote and create new items
      const q = await tx.quote.update({
        where: { id },
        data: {
          status: data.status || 'BORRADOR',
          
          // Snapshot client data (might have been edited in form)
          clientName: data.clientName,
          clientRuc: data.clientRuc,
          clientAddress: data.clientAddress,
          clientPhone: data.clientPhone,
          clientAttention: data.clientAttention,

          // Financial summary
          subtotal: Number(data.subtotal || 0),
          subtotal0: Number(data.subtotal0 || 0),
          subtotal15: Number(data.subtotal15 || 0),
          ivaAmount: Number(data.ivaAmount || 0),
          discountTotal: Number(data.discountTotal || 0),
          totalAmount: Number(data.totalAmount || 0),

          notes: data.notes,
          optionalTitle: data.optionalTitle || null,
          optionalDescription: data.optionalDescription || null,
          optionalImage: data.optionalImage || null,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          
          items: {
            create: items.map((item: any) => ({
              materialId: item.materialId ? Number(item.materialId) : null,
              description: item.description,
              quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discountPct: Number(item.discountPct || 0),
              isTaxed: item.isTaxed !== undefined ? Boolean(item.isTaxed) : true,
              total: Number(item.total)
            }))
          }
        },
        include: { items: true }
      })

      // 3. Sync to Project if linked
      if (q.projectId) {
        // Delete project budget items
        await tx.budgetItem.deleteMany({
          where: { projectId: q.projectId }
        })

        // Create new project budget items
        await tx.budgetItem.createMany({
          data: items.map((item: any) => ({
            projectId: q.projectId as number,
            materialId: item.materialId ? Number(item.materialId) : null,
            name: item.description || 'Sin descripción',
            quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity),
            unit: 'UND',
            estimatedCost: Number(item.unitPrice)
          }))
        })

        // Update project totals and status
        const projectUpdateData: any = {
          estimatedBudget: q.totalAmount
        }

        if (q.status === 'ACEPTADA') {
          projectUpdateData.status = 'ACTIVO'
        }

        await tx.project.update({
          where: { id: q.projectId },
          data: projectUpdateData
        })
      }

      return q
    }, { timeout: 20000 })

    return NextResponse.json(updatedQuote)
  } catch (error) {
    console.error('[QUOTE_UPDATE_ERROR]', error)
    return NextResponse.json({ error: 'Error updating quote' }, { status: 500 })
  }
}
