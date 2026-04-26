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
    
    // For operators, only return their projects
    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    const whereClause: any = {}

    if (userRole === 'OPERATOR' || userRole === 'SUBCONTRATISTA') {
      whereClause.team = {
        some: {
          userId: Number(userId)
        }
      }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
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
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json(JSON.parse(JSON.stringify(projects)))
  } catch (error) {
    console.error('Error in bulk-cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
