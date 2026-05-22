import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin as checkIsAdmin, hasModuleAccess } from '@/lib/rbac'

/**
 * GET /api/admin/calendar/projects-by-operators?operatorIds=1,2,3
 * 
 * Returns projects where ALL specified operators are assigned (via ProjectTeam).
 * If no operatorIds are provided, returns all non-cancelled projects.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = checkIsAdmin((session.user as any).role)
    const canAccess = isAdmin || hasModuleAccess(session.user as any, 'calendario')

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const operatorIdsParam = searchParams.get('operatorIds')

    if (!operatorIdsParam) {
      // No filter — return all active projects
      const projects = await prisma.project.findMany({
        where: { status: { not: 'CANCELADO' } },
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' }
      })
      return NextResponse.json(projects)
    }

    const operatorIds = operatorIdsParam.split(',').map(Number).filter(n => !isNaN(n))

    if (operatorIds.length === 0) {
      const projects = await prisma.project.findMany({
        where: { status: { not: 'CANCELADO' } },
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' }
      })
      return NextResponse.json(projects)
    }

    // Find projects where ALL specified operators are team members
    // Strategy: For each operator, find their project IDs, then intersect
    const projectIdSets: Set<number>[] = []

    for (const opId of operatorIds) {
      const teamEntries = await prisma.projectTeam.findMany({
        where: { userId: opId },
        select: { projectId: true }
      })
      projectIdSets.push(new Set(teamEntries.map(t => t.projectId)))
    }

    // Intersect all sets
    let commonProjectIds: number[] = []
    if (projectIdSets.length > 0) {
      commonProjectIds = [...projectIdSets[0]].filter(id =>
        projectIdSets.every(s => s.has(id))
      )
    }

    if (commonProjectIds.length === 0) {
      return NextResponse.json([])
    }

    const projects = await prisma.project.findMany({
      where: {
        id: { in: commonProjectIds },
        status: { not: 'CANCELADO' }
      },
      select: { id: true, title: true, status: true },
      orderBy: { title: 'asc' }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects by operators:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
