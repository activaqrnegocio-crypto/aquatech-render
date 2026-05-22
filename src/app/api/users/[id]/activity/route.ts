import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    const { isAdmin } = await import('@/lib/rbac')
    if (!session || !isAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = Number(id)

    // Parallel fetch for all activity types
    const [chatMessages, expenses, dayRecords, projects, quotes] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { userId },
        include: { 
          media: true,
          project: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.expense.findMany({
        where: { userId },
        include: {
          project: { select: { title: true } }
        },
        orderBy: { date: 'desc' },
        take: 50
      }),
      prisma.dayRecord.findMany({
        where: { userId },
        include: {
          project: { select: { title: true } }
        },
        orderBy: { startTime: 'desc' },
        take: 50
      }),
      prisma.project.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.quote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ])

    // Unified timeline
    const timeline: any[] = []

    chatMessages.forEach(msg => {
      timeline.push({
        type: 'CHAT_MESSAGE',
        timestamp: msg.createdAt,
        projectId: msg.projectId,
        projectTitle: msg.project.title,
        data: msg
      })
    })

    expenses.forEach(exp => {
      timeline.push({
        type: 'EXPENSE',
        timestamp: exp.date,
        projectId: exp.projectId,
        projectTitle: exp.project.title,
        data: exp
      })
    })

    dayRecords.forEach(rec => {
      timeline.push({
        type: 'ATTENDANCE',
        timestamp: rec.startTime,
        projectId: rec.projectId,
        projectTitle: rec.project.title,
        data: rec
      })
    })

    projects.forEach(proj => {
      timeline.push({
        type: 'PROJECT',
        timestamp: proj.createdAt,
        projectId: proj.id,
        projectTitle: proj.title,
        data: proj
      })
    })

    quotes.forEach(quote => {
      timeline.push({
        type: 'QUOTE',
        timestamp: quote.createdAt,
        projectId: quote.projectId,
        projectTitle: `Cotización #${quote.id}`,
        data: quote
      })
    })

    // Global sort (latest first). Handle potential null timestamps safely.
    timeline.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return timeB - timeA
    })

    return NextResponse.json({
      userId,
      activityCount: timeline.length,
      timeline
    })
  } catch (error) {
    console.error('Error fetching global user activity:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
