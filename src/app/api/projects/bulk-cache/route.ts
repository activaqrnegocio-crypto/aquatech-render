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
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const safeLimit = Math.min(limit, 100) // Optimized for speed
    
    const rawRole = (session.user as any).role || ''
    const userRole = String(rawRole).toUpperCase().trim()
    const userId = (session.user as any).id
    
    console.log(`[BulkCache] User: ${userId}, Role: ${userRole}`)

    const whereClause: any = {}

    // Strict Admin check: Only ADMIN, ADMINISTRADOR, or SUPERADMIN get everything
    const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN'].includes(userRole)

    if (!isAdmin) {
      console.log(`[BulkCache] Applying operator filter for user ${userId}`)
      whereClause.team = {
        some: {
          userId: Number(userId)
        }
      }
      // Match dashboard filter for operators
      whereClause.status = { in: ['LEAD', 'ACTIVO', 'PENDIENTE'] }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      take: safeLimit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        address: true,
        city: true,
        startDate: true,
        endDate: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true
          }
        },
        phases: {
          select: {
            id: true,
            title: true,
            status: true,
            displayOrder: true
          },
          orderBy: { displayOrder: 'asc' }
        },
        team: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        chatMessages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            user: {
              select: {
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 15
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error in bulk-cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
