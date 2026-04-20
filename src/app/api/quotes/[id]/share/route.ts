import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { uploadToBunny } from '@/lib/bunny'
import { notifyProjectTeam } from '@/lib/push'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, message, pdfBase64, filename: providedFilename } = await req.json()
    if (!projectId) {
      return NextResponse.json({ error: 'ID de Proyecto es requerido' }, { status: 400 })
    }

    const { id } = await params
    const quoteId = Number(id)

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { client: true }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    // IMPORTANT: Per user request, "sharing" DOES NOT link.
    // So we do NOT update quote.projectId or quote.isBudget.
    
    const clientName = quote.clientName || quote.client?.name || 'Cliente'
    
    // 1. Upload to Bunny if provided
    let fileUrl = null
    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64')
        fileUrl = await uploadToBunny(buffer, providedFilename || `Cotizacion_${quoteId}.pdf`, 'quotes')
        
        if (!fileUrl) {
          return NextResponse.json({ error: 'Fallo al subir el PDF a la nube. Intente nuevamente.' }, { status: 500 })
        }
      } catch (error) {
        console.error('Error uploading PDF in share route:', error)
        return NextResponse.json({ error: 'Error al procesar el documento PDF.' }, { status: 500 })
      }
    } else {
      // If modalMode was SHARE, we EXPECT a PDF. 
      // If it's missing, we could allow text-only or fail. 
      // Let's allow text if pdfBase64 is explicitly missing, 
      // but usually the client SHOULD send it.
    }

    const chatContent = `📤 COTIZACIÓN COMPARTIDA (#${quote.id})\nPara: ${clientName}\n\n${message || 'Se ha compartido esta cotización para revisión.'}\n\nTotal: $${Number(quote.totalAmount).toFixed(2)}\n\n📄 Ver cotización completa:`

    // Create chat message with DOCUMENT type and MediaFile
    const msg = await prisma.chatMessage.create({
      data: {
        projectId: Number(projectId),
        userId: Number(session.user.id),
        content: chatContent,
        type: fileUrl ? 'DOCUMENT' : 'TEXT',
        media: fileUrl ? {
           create: {
             filename: providedFilename || `Cotización #${quote.id} - ${clientName}.pdf`,
             mimeType: 'application/pdf',
             url: fileUrl
           }
        } : undefined
      }
    })

    // 🔔 Push Notification
    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) },
      select: { title: true }
    })
    notifyProjectTeam(
      Number(projectId), 
      Number(session.user.id),
      `💬 ${project?.title || 'Proyecto'} - ${session.user.name}`,
      `Se ha compartido la cotización #${quote.id}`,
      `/admin/operador/proyecto/${projectId}?view=chat`,
      `chat-${projectId}`
    )

    return NextResponse.json({ success: true, message: 'Cotización enviada al proyecto (sin vinculación).' })
  } catch (error) {
    console.error('Error sharing quote to project chat:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

