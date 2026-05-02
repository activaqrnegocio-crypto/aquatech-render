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
    const safeLimit = Math.min(limit, 500) // v252: Increased for full Admin coverage
    
    const rawRole = (session.user as any).role || ''
    const userRole = String(rawRole).toUpperCase().trim()
    const userId = (session.user as any).id
    
    console.log(`[BulkCache] User: ${userId}, Role: ${userRole}`)

    const whereClause: any = {}

    // v226: Expanded Admin check to be ultra-robust (includes all common variants)
    const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole)

    if (!isAdmin) {
      console.log(`[BulkCache] Applying operator filter for user ${userId}`)
      whereClause.team = {
        some: {
          userId: Number(userId)
        }
      }
      // v226: Removed status filter for operators to ensure 100% project parity (e.g. 7/7)
    } else {
      console.log(`[BulkCache] Admin mode: Syncing all projects (no status filter)`)
    }

    // v280: RADICAL DIET — Gallery and Expenses removed from bulk payload.
    // They load lazily when the user opens a specific project.
    // This is the primary cause of the 5-minute sync on mobile.
    const projects = await prisma.project.findMany({
      where: whereClause,
      take: safeLimit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        address: true,
        city: true,
        startDate: true,
        endDate: true,
        client: {
          select: { id: true, name: true, phone: true, address: true }
        },
        phases: {
          select: { id: true, title: true, status: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        team: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } }
          }
        },
        // v280: Only 5 latest messages for the unread badge count. Full chat loads on-demand.
        chatMessages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            type: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // v280: Cache for 5 minutes in browser to avoid hammering the DB on every sync cycle
    return NextResponse.json(projects, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      }
    })
  } catch (error) {
    console.error('Error in bulk-cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
