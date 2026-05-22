import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        client: true,
        creator: true,
        phases: { orderBy: { displayOrder: 'asc' } },
        team: { include: { user: true } },
        gallery: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { date: 'desc' } },
        dayRecords: { 
          orderBy: { createdAt: 'desc' },
          include: { user: true }
        },
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          include: { 
            user: true, 
            phase: true,
            media: true 
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Serialize to handle Decimal objects
    return NextResponse.json(JSON.parse(JSON.stringify(project)))
  } catch (error) {
    console.error('Error fetching full project data:', error)
    return NextResponse.json({ error: 'Error interno de servidor' }, { status: 500 })
  }
}
