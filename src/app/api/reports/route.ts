import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getLocalNow } from '@/lib/date-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const projectIdStr = searchParams.get('projectId')

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)
    endDate.setHours(23, 59, 59, 999)

    const projectWhere: any = {}
    if (projectIdStr && projectIdStr !== 'ALL') {
      projectWhere.id = Number(projectIdStr)
    } else {
      // If ALL, only fetch projects that had SOME activity in this date range to avoid empty reports
      // We'll fetch all projects for now and filter out empty ones later
    }

    // Fetch projects
    const projects = await prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        title: true,
        status: true,
      }
    })

    const reports = []

    for (const project of projects) {
      // 1. Get Chat Messages (events)
      const messages = await prisma.chatMessage.findMany({
        where: {
          projectId: project.id,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { user: { select: { id: true, name: true } } }
      })

      // 2. Get Day Records (Work Hours)
      const exactDayRecords = await prisma.dayRecord.findMany({
        where: {
          projectId: project.id,
          startTime: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { user: { select: { id: true, name: true } } }
      })

      // Also get day records that started before but ended in this period
      const overlappingDayRecords = await prisma.dayRecord.findMany({
        where: {
          projectId: project.id,
          startTime: { lt: startDate },
          endTime: { gte: startDate, lte: endDate }
        },
        include: { user: { select: { id: true, name: true } } }
      })

      // Combine and deduplicate records by ID
      const allRecordsMap = new Map()
      exactDayRecords.forEach(r => allRecordsMap.set(r.id, r))
      overlappingDayRecords.forEach(r => allRecordsMap.set(r.id, r))
      const dayRecords = Array.from(allRecordsMap.values())


      // 3. Get Expenses (Viáticos)
      const expenses = await prisma.expense.findMany({
        where: {
          projectId: project.id,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // If no activity at all, skip if 'ALL' was selected
      if (messages.length === 0 && dayRecords.length === 0 && expenses.length === 0 && (!projectIdStr || projectIdStr === 'ALL')) {
        continue
      }

      // Calculate Statistics

      // --- USER STATS ---
      const userStats: Record<number, { name: string, msWorked: number, msgCount: number, photoCount: number, expenseTotal: number }> = {}

      // Calculate hours worked
      for (const record of dayRecords) {
        if (!userStats[record.userId]) {
          userStats[record.userId] = { name: record.user.name, msWorked: 0, msgCount: 0, photoCount: 0, expenseTotal: 0 }
        }
        
        let start = record.startTime
        let end = record.endTime || getLocalNow() // If still working, calculate up to now in Guayaquil
        
        // Constrain to the requested date window to be accurate for "daily" reports
        if (start < startDate) start = startDate
        if (end > endDate) end = endDate

        userStats[record.userId].msWorked += (end.getTime() - start.getTime())
      }

      // Calculate message contributions
      for (const msg of messages) {
        if (!userStats[msg.userId]) {
           userStats[msg.userId] = { name: msg.user.name, msWorked: 0, msgCount: 0, photoCount: 0, expenseTotal: 0 }
        }
        userStats[msg.userId].msgCount++
        if (msg.type === 'IMAGE' || msg.type === 'VIDEO') {
          userStats[msg.userId].photoCount++
        }
      }

      // --- PROJECT STATS ---
      const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
      
      let totalMsWorked = 0
      Object.values(userStats).forEach(us => {
        totalMsWorked += us.msWorked
      })
      const totalHoursWorked = +(totalMsWorked / 3600000).toFixed(2)

      reports.push({
        project,
        stats: {
          totalMessages: messages.length,
          totalImages: messages.filter(m => m.type === 'IMAGE').length,
          totalHours: totalHoursWorked,
          totalExpenses: totalExpenses,
          users: Object.values(userStats).map(u => ({
            ...u,
            hoursWorked: +(u.msWorked / 3600000).toFixed(2)
          })).sort((a, b) => b.hoursWorked - a.hoursWorked)
        },
        // Only return the 5 most recent important log notes for context 
        recentNotes: messages
          .filter(m => m.type === 'NOTE' || m.type === 'TEXT')
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5)
          .map(m => ({
            id: m.id,
            user: m.user.name,
            content: m.content || '',
            date: m.createdAt,
            type: m.type
          }))
      })
    }

    return NextResponse.json({ reports })
    
  } catch (error) {
    console.error('Reports API Error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
