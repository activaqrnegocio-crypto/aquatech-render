import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

// v400: Optimized — single SQL for unread counts instead of N+1 queries
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)

    const activeProjects = await prisma.project.findMany({
      where: {
        OR: [
          { team: { some: { userId } } },
          { createdBy: userId }
        ],
        status: { in: ['LEAD', 'ACTIVO', 'PENDIENTE'] }
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        client: { select: { name: true, city: true, address: true } },
        team: { 
          select: { 
            id: true, 
            userId: true,
            user: { select: { id: true, name: true, phone: true } }
          } 
        },
        phases: { 
          orderBy: { displayOrder: 'asc' },
          select: { id: true, title: true, status: true } 
        },
      }
    })

    // v400: Single SQL query for ALL unread counts (replaces N+1 individual counts)
    const unreadCountsMap: Record<number, number> = {}

    if (activeProjects.length > 0) {
      const projectIds = activeProjects.map(p => p.id)
      
      const sql = `
        SELECT cm.project_id as projectId, CAST(COUNT(*) AS UNSIGNED) as count
        FROM chat_messages cm
        LEFT JOIN project_views pv ON cm.project_id = pv.project_id AND pv.user_id = ${userId}
        WHERE cm.user_id != ${userId}
        AND cm.project_id IN (${projectIds.join(',')})
        AND (pv.last_seen IS NULL OR cm.created_at > pv.last_seen)
        GROUP BY cm.project_id
      `
      try {
        const results: any[] = await prisma.$queryRawUnsafe(sql)
        results.forEach(r => {
          unreadCountsMap[r.projectId] = Number(r.count)
        })
      } catch (err) {
        console.error('[Operator Projects] Unread counts query error:', err)
      }
    }

    const projectsWithUnread = activeProjects.map(project => ({
      ...project,
      unreadCount: unreadCountsMap[project.id] || 0
    }))

    return NextResponse.json(projectsWithUnread)
  } catch (error) {
    console.error('[API Operator Projects]:', error)
    return NextResponse.json({ error: 'Error fetching projects' }, { status: 500 })
  }
}
