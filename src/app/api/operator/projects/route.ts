import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

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
        client: { select: { name: true, city: true, address: true } },
        phases: { 
          orderBy: { displayOrder: 'asc' },
          select: { id: true, title: true, status: true } 
        },
      }
    })

    // Calculate unread counts
    const userViews = await prisma.projectView.findMany({ where: { userId } })
    
    const projectsWithUnread = await Promise.all(activeProjects.map(async (project) => {
      const view = userViews.find((v: any) => v.projectId === project.id)
      const lastSeen = view?.lastSeen || new Date(0)
      const unreadCount = await prisma.chatMessage.count({
        where: {
          projectId: project.id,
          userId: { not: userId },
          createdAt: { gt: lastSeen }
        }
      })
      return { ...project, unreadCount }
    }))

    return NextResponse.json(projectsWithUnread)
  } catch (error) {
    console.error('[API Operator Projects]:', error)
    return NextResponse.json({ error: 'Error fetching projects' }, { status: 500 })
  }
}
