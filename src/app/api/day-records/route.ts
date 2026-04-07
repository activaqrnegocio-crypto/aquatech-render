import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Timestamps are stored as proper UTC; display conversion happens in the frontend via formatTimeEcuador()

// Iniciar día
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      
    const { projectId, location, createdAt } = await req.json()
    const userId = Number(session.user.id)
    const startTime = createdAt ? new Date(createdAt) : new Date()

    // Check if there is an active day record for this user and project
    const existing = await prisma.dayRecord.findFirst({
      where: { userId, endTime: null }
    })

    if (existing) {
      return NextResponse.json({ error: 'Ya tienes un día activo' }, { status: 400 })
    }

    const record = await prisma.dayRecord.create({
      data: {
        userId,
        projectId: Number(projectId),
        startTime,
        startLat: location?.lat,
        startLng: location?.lng,
      }
    })

    // Also push a system message to the project chat
    await prisma.chatMessage.create({
      data: {
        projectId: Number(projectId),
        userId,
        type: 'DAY_START',
        content: `${session.user.name} inició su jornada.`,
        createdAt: startTime
      }
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error creating day record' }, { status: 500 })
  }
}

// Terminar día
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      
    const { recordId, projectId, location, createdAt } = await req.json()
    const endTime = createdAt ? new Date(createdAt) : new Date()

    const record = await prisma.dayRecord.update({
      where: { id: Number(recordId) },
      data: { 
        endTime,
        endLat: location?.lat,
        endLng: location?.lng,
      }
    })

    await prisma.chatMessage.create({
      data: {
        projectId: Number(projectId),
        userId: Number(session.user.id),
        type: 'DAY_END',
        content: `${session.user.name} terminó su jornada.`,
        createdAt: endTime
      }
    })

    return Response.json(record)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Error updating day record' }, { status: 500 })
  }
}
