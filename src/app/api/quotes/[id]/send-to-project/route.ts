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

    const { projectId, message, pdfBase64, filename } = await req.json()
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const { id } = await params
    const quoteId = Number(id)

    // 1. Fetch quote details
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const chatContent = message 
      ? message
      : `📄 COTIZACIÓN COMPARTIDA (#${quote.id})\n\nTotal: $${Number(quote.totalAmount).toFixed(2)}\n\nEsta es una copia informativa enviada al chat.`

    // 2. Upload PDF to Bunny if provided
    let fileUrl = null
    if (pdfBase64 && filename) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64')
        fileUrl = await uploadToBunny(buffer, filename, 'quotes')
      } catch (error) {
        console.error('Error uploading quote PDF to Bunny:', error)
      }
    }

    // 3. CREATE chat message (WITHOUT permanent link update)
    const chatMsg = await prisma.chatMessage.create({
      data: {
        projectId: Number(projectId),
        userId: Number(session.user.id),
        content: chatContent,
        type: fileUrl ? 'DOCUMENT' : 'TEXT',
        media: fileUrl ? {
           create: {
             filename: filename || `Cotizacion_${quoteId}.pdf`,
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

    // 4. Notify Project Team
    try {
      await notifyProjectTeam(
        Number(projectId),
        Number(session.user.id),
        `¡Documento Recibido!`,
        `${session.user.name} ha compartido una cotización en ${chatMsg.project.title}`,
        `/admin/proyectos/${projectId}?view=CHAT`
      )
    } catch (e) {
      console.error("Error at push notify:", e)
    }

    return NextResponse.json({ success: true, result: chatMsg })
  } catch (error) {
    console.error('Error sending quote to project:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
