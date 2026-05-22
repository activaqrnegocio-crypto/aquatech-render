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
    const safeLimit = Math.min(limit, 2000) // v289: Increased for full Admin coverage
    
    const rawRole = (session.user as any).role || ''
    const userRole = String(rawRole).toUpperCase().trim()
    const userId = (session.user as any).id
    
    console.log(`[BulkCache] User: ${userId}, Role: ${userRole}`)

    const whereClause: any = {}

    // v226: Expanded Admin check to be ultra-robust (includes all common variants)
    const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole)

    if (!isAdmin) {
      console.log(`[BulkCache] Applying operator filter for user ${userId}`)
      whereClause.OR = [
        { team: { some: { userId: Number(userId) } } },
        { createdBy: Number(userId) }
      ]
      // v226: Removed status filter for operators to ensure 100% project parity (e.g. 7/7)
    } else {
      console.log(`[BulkCache] Admin mode: Syncing all projects (no status filter)`)
    }

    // v316: COMPLETE TEXT DATA — All project text fields included for full offline parity.
    // Only gallery items (media URLs) are excluded to keep payload manageable.
    const projects = await prisma.project.findMany({
      where: whereClause,
      take: safeLimit,
      select: {
        id: true,
        title: true,
        type: true,
        subtype: true,
        status: true,
        description: true,
        address: true,
        city: true,
        startDate: true,
        endDate: true,
        estimatedBudget: true,
        realCost: true,
        leadNotes: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
        categoryList: true,
        technicalSpecs: true,
        contractTypeList: true,
        specsTranscription: true,
        createdBy: true,
        client: {
          select: { id: true, name: true, phone: true, address: true, email: true, ruc: true, city: true, notes: true }
        },
        phases: {
          select: { id: true, title: true, description: true, status: true, displayOrder: true, estimatedDays: true, estimatedHours: true, startedAt: true, completedAt: true },
          orderBy: { displayOrder: 'asc' }
        },
        team: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, role: true, phone: true } }
          }
        },
        // v316: Enriched chat messages with user info and phase reference for offline display
        chatMessages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            type: true,
            extraData: true,
            user: { select: { id: true, name: true } },
            phase: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        // v316: Lightweight expenses (text only, no receipt images)
        expenses: {
          select: {
            id: true,
            amount: true,
            description: true,
            category: true,
            date: true,
            createdAt: true,
            userId: true,
            isNote: true,
            user: { select: { id: true, name: true } }
          },
          orderBy: { date: 'desc' },
          take: 30
        },
        // v316: Day records for attendance tracking offline
        dayRecords: {
          select: {
            id: true,
            userId: true,
            startTime: true,
            endTime: true,
            createdAt: true,
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 15
        },
        // v370: Gallery items (planos, finales, evidencias) para visualización offline
        // Sin esto, la galería siempre se carga desde cero al abrir el proyecto
        gallery: {
          select: {
            id: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            category: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
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
