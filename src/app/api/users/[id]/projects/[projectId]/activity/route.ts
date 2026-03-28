import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string, projectId: string }> }
) {
  try {
    const { id, projectId: pId } = await params
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = Number(id)
    const projectId = Number(pId)

    // 1. Fetch Chat Messages (including media, expenses logs, phase completions, day start/end)
    const chatMessages = await prisma.chatMessage.findMany({
      where: {
        userId,
        projectId
      },
      include: {
        media: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 2. Fetch specific Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        projectId
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 3. Fetch Day Records (Attendance)
    const dayRecords = await prisma.dayRecord.findMany({
      where: {
        userId,
        projectId
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // 4. Combine into a sorted timeline
    const timeline: any[] = []

    chatMessages.forEach(msg => {
      timeline.push({
        type: 'CHAT_MESSAGE',
        timestamp: msg.createdAt,
        data: msg
      })
    })

    expenses.forEach(exp => {
      timeline.push({
        type: 'EXPENSE',
        timestamp: exp.date,
        data: exp
      })
    })

    dayRecords.forEach(rec => {
      timeline.push({
        type: 'ATTENDANCE',
        timestamp: rec.startTime,
        data: rec
      })
    })

    // Sort complete timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return NextResponse.json({
      userId,
      projectId,
      activityCount: timeline.length,
      timeline
    })
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
