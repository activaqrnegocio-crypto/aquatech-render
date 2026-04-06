import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotes = await prisma.quote.findMany({
      include: {
        client: { select: { name: true } },
        project: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(quotes)
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    const items = data.items || []
    let finalClientId = data.clientId ? Number(data.clientId) : null

    // Create client if it's a new one
    if (!finalClientId && data.clientName) {
      // Prevent creating duplicate clients by name
      const existingClient = await prisma.client.findFirst({
        where: { name: data.clientName }
      })

      if (existingClient) {
        finalClientId = existingClient.id
      } else {
        const newClient = await prisma.client.create({
          data: {
            name: data.clientName,
            ruc: data.clientRuc || '',
            address: data.clientAddress || '',
            phone: data.clientPhone || '',
            // Add other default fields if necessary
          }
        })
        finalClientId = newClient.id
      }
    }

    if (!finalClientId) {
       return NextResponse.json({ error: 'Falta información del cliente' }, { status: 400 })
    }

    const operatorNotes = session?.user?.name ? 
      `[Generado por Operador: ${session.user.name}]\n${data.notes || ''}` : data.notes

    const quote = await prisma.$transaction(async (tx) => {
      const newQuote = await tx.quote.create({
        data: {
          userId: session?.user?.id ? Number(session.user.id) : null,
          clientId: finalClientId as number,
          projectId: data.projectId ? Number(data.projectId) : null,
          status: data.status || 'BORRADOR',
          
          // Snapshot client data
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

          notes: operatorNotes,
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

      // Sync to Project if linked
      if (newQuote.projectId) {
        // Delete all project budget items
        await tx.budgetItem.deleteMany({
          where: { projectId: newQuote.projectId }
        })

        // Create new project budget items based on quote items
        await tx.budgetItem.createMany({
          data: items.map((item: any) => ({
            projectId: newQuote.projectId as number,
            materialId: item.materialId ? Number(item.materialId) : null,
            name: item.description || 'Sin descripción',
            quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity),
            unit: 'UND', // Default, QuoteItem doesn't have unit
            estimatedCost: Number(item.unitPrice)
          }))
        })

        // Update project total
        await tx.project.update({
          where: { id: newQuote.projectId },
          data: { 
            estimatedBudget: newQuote.totalAmount,
            // If quote is already accepted, start project
            status: newQuote.status === 'ACEPTADA' ? 'ACTIVO' : undefined
          }
        })
      }

      return newQuote
    }, { timeout: 20000 })
    
    return NextResponse.json(quote)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error creating quote' }, { status: 500 })
  }
}
