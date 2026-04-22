import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { uploadToBunny } from '@/lib/bunny'
import { getLocalNow, forceEcuadorTZ } from '@/lib/date-utils'
import { isAdmin } from '@/lib/rbac'
import { notifyProjectTeam } from '@/lib/push'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      
    const projectId = Number(id)
    const userId = Number(session.user.id)
    const userRole = (session.user as any).role

    // 🔒 Security Check: Verify user belongs to the project team OR created the project OR is Admin
    if (!isAdmin(userRole)) {
      const isMember = await prisma.projectTeam.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId
          }
        }
      })
      if (!isMember) {
        // Also allow access if the user created the project (e.g. operators creating original leads)
        const isCreator = await prisma.project.findFirst({
          where: {
            id: projectId,
            createdBy: userId
          }
        })
        if (!isCreator) {
          return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
        }
      }
    }

    const { amount, description, date, createdAt, lat, lng, receiptPhoto, isNote } = await req.json()
    const expenseDate = new Date(forceEcuadorTZ(date || createdAt) || new Date())

    // 🛡️ Deduplication Check: Prevent exactly same expense within 15 seconds
    const possibleDuplicate = await prisma.expense.findFirst({
      where: {
        projectId,
        userId,
        amount: Number(amount),
        description: description,
        createdAt: {
          gte: new Date(Date.now() - 15000)
        }
      }
    })

    if (possibleDuplicate) {
      console.log('[API] Duplicate expense detected and ignored:', description)
      return NextResponse.json(possibleDuplicate)
    }


    let receiptUrl = null
    if (receiptPhoto && typeof receiptPhoto === 'string') {
      if (receiptPhoto.startsWith('data:image')) {
        try {
          const base64Data = receiptPhoto.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          const filename = `expense_${Date.now()}.jpg`
          const folder = `projects/${id}/expenses`
          receiptUrl = await uploadToBunny(buffer, filename, folder)
        } catch (uploadError) {
          console.error('Failed to upload expense receipt to Bunny:', uploadError)
        }
      } else if (receiptPhoto.startsWith('http')) {
        // Direct URL from client-side upload
        receiptUrl = receiptPhoto
      }
    }

    const expense = await prisma.expense.create({
      data: {
        amount,
        description,
        date: expenseDate,
        projectId,
        userId,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        createdAt: createdAt ? new Date(forceEcuadorTZ(createdAt)) : undefined,
        receiptUrl,
        isNote: !!isNote
      }
    })

    if (!isNote) {
      // Automatically increase the project's realCost counter
      await prisma.project.update({
        where: { id: projectId },
        data: {
          realCost: {
            increment: amount
          }
        }
      })
    }

    // Also post it to the project chat/timeline
    await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        type: 'EXPENSE_LOG',
        content: isNote 
          ? `${session.user.name} dejó una nota de gasto: $ ${Number(amount).toFixed(2)} (${description})`
          : `${session.user.name} registró un gasto: $ ${Number(amount).toFixed(2)} (${description})`,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        createdAt: createdAt ? new Date(forceEcuadorTZ(createdAt)) : undefined,
        extraData: JSON.stringify({
          amount: Number(amount),
          isNote: !!isNote,
          description: description
        })
      }
    })

    // 🔔 Push Notification (fire-and-forget)
    if (!isNote) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true }
      })
      const projectTitle = project?.title || 'Proyecto'

      notifyProjectTeam(
        projectId, userId,
        `💰 Gasto: ${projectTitle}`,
        `${session.user.name}: $${Number(amount).toFixed(2)} - ${description || 'Sin descripción'}`,
        `/admin/operador/proyecto/${projectId}?view=records`,
        `expense-${projectId}`
      )
    }

    return NextResponse.json(expense)
  } catch (error: any) {
    console.error('Expense Creation Error:', error)
    return NextResponse.json({ error: 'Error interno al procesar el gasto' }, { status: 500 })
  }
}
