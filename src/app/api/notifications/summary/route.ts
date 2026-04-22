import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const isAdmin = ['ADMIN', 'SUPERADMIN', 'ADMINISTRADORA'].includes(
      String(session.user.role).toUpperCase()
    )

    // 1. Get project IDs the user cares about (single query)
    let projectIds: number[] = []
    
    if (isAdmin) {
      const projects = await prisma.project.findMany({
        where: { status: { notIn: ['COMPLETADO', 'CANCELADO', 'ARCHIVADO'] } },
        select: { id: true }
      })
      projectIds = projects.map(p => p.id)
    } else {
      const userTeams = await prisma.projectTeam.findMany({
        where: { 
          userId,
          project: { status: { notIn: ['COMPLETADO', 'CANCELADO', 'ARCHIVADO'] } } 
        },
        select: { projectId: true }
      })
      projectIds = userTeams.map(pt => pt.projectId)
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ totalUnread: 0, byProject: {} })
    }

    // 2. Get last seen times (single query)
    const projectViews = await prisma.projectView.findMany({
      where: { userId, projectId: { in: projectIds } }
    })

    const lastSeenMap: Record<number, Date> = {}
    projectViews.forEach((pv: any) => {
      lastSeenMap[pv.projectId] = pv.lastSeen
    })

    // 3. Use raw queries to get all unread counts at once (avoids N+1 and connection limits)
    const byProject: Record<number, number> = {}
    let totalUnread = 0

    // Batch in groups of 100 projects max to keep query manageable
    for (let i = 0; i < projectIds.length; i += 100) {
      const batchIds = projectIds.slice(i, i + 100)
      
      const conditions = batchIds.map(pid => {
        const lastSeen = lastSeenMap[pid] || new Date(0)
        const sqlDate = lastSeen.toISOString().replace('T', ' ').replace('Z', '')
        return `(projectId = ${pid} AND createdAt > '${sqlDate}')`
      })

      const sql = `
        SELECT projectId, CAST(COUNT(*) AS UNSIGNED) as count
        FROM ChatMessage
        WHERE userId != ${userId}
        AND (${conditions.join(' OR ')})
        GROUP BY projectId
      `
      
      try {
        const results: any[] = await prisma.$queryRawUnsafe(sql)
        results.forEach(r => {
          const c = Number(r.count)
          if (c > 0) {
            byProject[r.projectId] = c
            totalUnread += c
          }
        })
      } catch (err) {
        console.error("Error fetching notification counts batch:", err)
      }
    }

    return NextResponse.json({ totalUnread, byProject }, {
      headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=10' }
    })

  } catch (error) {
    console.error('[API Notifications GET ERROR]:', error)
    return NextResponse.json({ totalUnread: 0, byProject: {} })
  }
}

// Update "last seen" for a specific project
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    await prisma.projectView.upsert({
      where: { 
        userId_projectId: {
          userId: Number(session.user.id),
          projectId: Number(projectId)
        }
      },
      update: { lastSeen: new Date() },
      create: {
        userId: Number(session.user.id),
        projectId: Number(projectId),
        lastSeen: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Notifications POST ERROR]:', error)
    return NextResponse.json({ error: 'Error updating' }, { status: 500 })
  }
}
