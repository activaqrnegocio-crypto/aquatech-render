import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { uploadToBunny } from '@/lib/bunny'
import { getLocalNow, forceEcuadorTZ } from '@/lib/date-utils'
import { isAdmin } from '@/lib/rbac'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      
    const projectId = Number(id)
    const userId = Number(session.user.id)
    const userRole = (session.user as any).role

    // 🔒 Security Check: Verify user belongs to the project team OR is Admin
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
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    const { amount, description, date, createdAt, lat, lng, receiptPhoto, isNote } = await req.json()
    const expenseDate = new Date(forceEcuadorTZ(date || createdAt) || new Date())

    let receiptUrl = null
    if (receiptPhoto && typeof receiptPhoto === 'string' && receiptPhoto.startsWith('data:image')) {
      try {
        const base64Data = receiptPhoto.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const filename = `expense_${Date.now()}.jpg`
        const folder = `projects/${id}/expenses`
        receiptUrl = await uploadToBunny(buffer, filename, folder)
      } catch (uploadError) {
        console.error('Failed to upload expense receipt to Bunny:', uploadError)
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
      }
    })

    return NextResponse.json(expense)
  } catch (error: any) {
    console.error('Expense Creation Error:', error)
    return NextResponse.json({ error: 'Error interno al procesar el gasto' }, { status: 500 })
  }
}
