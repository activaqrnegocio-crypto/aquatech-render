import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { uploadToBunny } from '@/lib/bunny'
import { notifyProjectTeam } from '@/lib/push'

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
          projectId: null, // Standalone quote, never linked automatically
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
          optionalTitle: data.optionalTitle || null,
          optionalDescription: data.optionalDescription || null,
          optionalImage: data.optionalImage || null,
          optionalImage2: data.optionalImage2 || null,
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

      // Send to Chat if requested (Standalone Document + Message)
      if (data.sendToBitacoraId) {
        let fileUrl = null
        if (data.pdfBase64 && data.filename) {
          try {
            const buffer = Buffer.from(data.pdfBase64, 'base64')
            fileUrl = await uploadToBunny(buffer, data.filename, 'quotes')
          } catch (error) {
            console.error('Error uploading quote PDF to Bunny:', error)
          }
        }

        const chatMsg = await tx.chatMessage.create({
          data: {
            projectId: Number(data.sendToBitacoraId),
            userId: Number(session.user.id),
            content: data.bitacoraMessage || `📄 NUEVA COTIZACIÓN GENERADA (#${newQuote.id})\n\nTotal: $${Number(newQuote.totalAmount).toFixed(2)}`,
            type: fileUrl ? 'DOCUMENT' : 'TEXT',
            media: fileUrl ? {
               create: {
                 filename: data.filename || `Cotizacion_${newQuote.id}.pdf`,
                 mimeType: 'application/pdf',
                 url: fileUrl
               }
            } : undefined
          },
          include: { 
            user: { select: { name: true } },
            project: { select: { title: true } }
          }
        })

        // Notify Project Team
        try {
          await notifyProjectTeam(
            Number(data.sendToBitacoraId),
            Number(session.user.id),
            `¡Nueva Cotización!`,
            `${session.user.name} ha compartido una cotización en ${chatMsg.project.title}`,
            `/admin/proyectos/${data.sendToBitacoraId}?view=CHAT`
          )
        } catch (e) {
          console.error("Error at push notify:", e)
        }
      }

      return newQuote
    }, { timeout: 20000 })
    
    return NextResponse.json(quote)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error creating quote' }, { status: 500 })
  }
}
