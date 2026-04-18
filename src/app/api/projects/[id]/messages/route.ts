import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { uploadToBunny } from '@/lib/bunny'
import { notifyProjectTeam } from '@/lib/push'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA' && userRole !== 'SUPERADMIN') {
      const isMember = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId: Number(id), userId: Number(session.user.id) } }
      })
      if (!isMember) {
        const isCreator = await prisma.project.findFirst({
          where: { id: Number(id), createdBy: Number(session.user.id) }
        })
        if (!isCreator) {
          return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
        }
      }
    }

    const { searchParams } = new URL(req.url)
    const since = searchParams.get('since')

    const messages = await prisma.chatMessage.findMany({
      where: {
        projectId: Number(id),
        ...(since ? { createdAt: { gt: new Date(since) } } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            branch: true
          }
        },
        media: true
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('[API Messages GET ERROR]:', error)
    return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      
    const { phaseId, content, type, lat, lng, media, createdAt, extraData } = await req.json()
    const projectId = Number(id)
    const userId = Number(session.user.id)
    
    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA' && userRole !== 'SUPERADMIN') {
      const isMember = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId, userId } }
      })
      if (!isMember) {
        const isCreator = await prisma.project.findFirst({
          where: { id: projectId, createdBy: userId }
        })
        if (!isCreator) {
          return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
        }
      }
    }

    let mediaUrl = null
    if (media && media.base64) {
      try {
        const parts = media.base64.split(',')
        if (parts.length > 1) {
          const buffer = Buffer.from(parts[1], 'base64')
          mediaUrl = await uploadToBunny(buffer, media.filename || 'upload.jpg', `projects/${projectId}/chat`)
        } else {
          console.warn('Invalid base64 format received')
        }
      } catch (uploadError) {
        console.error('Error uploading to Bunny:', uploadError)
        // We can continue or throw. Let's throw to give feedback to the client.
        throw new Error('Failed to upload file to storage')
      }
    }

    // Determine type if not provided
    let finalType = type
    if (!finalType && (mediaUrl || media?.url)) {
      const mime = media?.mimeType || ''
      if (mime.startsWith('image/')) finalType = 'IMAGE'
      else if (mime.startsWith('video/')) finalType = 'VIDEO'
      else if (mime.includes('pdf')) finalType = 'DOCUMENT'
      else finalType = 'IMAGE' // Default fallback
    } else if (!finalType) {
      finalType = 'TEXT'
    }

    const msg = await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        phaseId: phaseId ? Number(phaseId) : null,
        content: content || (mediaUrl || media?.url ? '' : null),
        type: finalType,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        extraData: extraData ? (typeof extraData === 'string' ? extraData : JSON.stringify(extraData)) : undefined,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        media: (mediaUrl || (media && media.url)) ? {
          create: {
            url: mediaUrl || media.url,
            filename: media.filename || 'upload.jpg',
            mimeType: media.mimeType || 'image/jpeg'
          }
        } : undefined
      },
      include: {
        media: true
      }
    })

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true }
    })
    const projectTitle = project?.title || 'Proyecto'

    // If it's an expense, record it in the expenses table too (EXCEPT if it's just a note)
    if (finalType === 'EXPENSE_LOG' && extraData && extraData.amount !== undefined && !extraData.isNote) {
      await prisma.expense.create({
        data: {
          projectId,
          userId,
          amount: Number(extraData.amount),
          description: content || 'Gasto registrado desde chat',
          category: extraData.category || 'OTRO',
          date: extraData.date ? new Date(extraData.date) : new Date(),
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
        }
      })
    }

    // 🔔 Push Notification to team (fire-and-forget)
    const pushBody = content?.substring(0, 80) || (mediaUrl || media?.url ? '📎 Nuevo archivo adjunto' : 'Nuevo mensaje')
    notifyProjectTeam(
      projectId, userId,
      `💬 ${projectTitle} - ${session.user.name}`,
      pushBody,
      `/admin/operador/proyecto/${projectId}?view=chat`,
      `chat-${projectId}`
    )

    return NextResponse.json(msg)
  } catch (error) {
    console.error('[API Messages ERROR]:', error)
    return NextResponse.json({ 
      error: 'Error interno al enviar mensaje'
    }, { status: 500 })
  }
}
