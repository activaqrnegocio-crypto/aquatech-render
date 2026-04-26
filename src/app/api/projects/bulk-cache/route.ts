import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const safeLimit = Math.min(limit, 50) // Cap at 50 for cloud stability
    
    // Logic: If NOT an Admin, filter by projects where the user is part of the team
    const rawRole = (session.user as any).role || ''
    const userRole = String(rawRole).toUpperCase()
    const userId = (session.user as any).id

    const whereClause: any = {}

    const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRADOR'

    if (!isAdmin) {
      whereClause.team = {
        some: {
          userId: Number(userId)
        }
      }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      take: safeLimit,
      include: {
        client: true,
        phases: { orderBy: { displayOrder: 'asc' } },
        team: { include: { user: true } },
        gallery: { 
          orderBy: { createdAt: 'desc' },
          select: { id: true, url: true, filename: true, mimeType: true, category: true, createdAt: true },
          take: 10 // Meta-data for offline reference
        },
        expenses: { 
          include: { user: true }, 
          orderBy: { date: 'desc' },
          take: 5 
        },
        chatMessages: { 
          include: { user: true, media: true }, 
          orderBy: { createdAt: 'desc' },
          take: 30 // Recent chat messages
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(JSON.parse(JSON.stringify(projects)))
  } catch (error) {
    console.error('Error in bulk-cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
