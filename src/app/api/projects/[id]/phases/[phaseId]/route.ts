import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string, phaseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, phaseId } = await params
    const { status, createdAt } = await req.json()
    const timestamp = createdAt ? new Date(createdAt) : new Date()

    // Validate if user belongs to the project team
    const teamMember = await prisma.projectTeam.findUnique({
      where: {
        projectId_userId: {
          projectId: Number(id),
          userId: Number(session.user.id)
        }
      }
    })

    if (!teamMember && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const updatedPhase = await prisma.projectPhase.update({
      where: { id: Number(phaseId) },
      data: { 
        status,
        completedAt: status === 'COMPLETADA' ? timestamp : null,
        startedAt: status === 'EN_PROGRESO' ? timestamp : undefined
      }
    })

    // If phase is completed, optionally find next phase and set to EN_PROGRESO?
    // User didn't ask for auto-start, but it's good practice.
    if (status === 'COMPLETADA') {
      const nextPhase = await prisma.projectPhase.findFirst({
        where: {
          projectId: Number(id),
          displayOrder: { gt: updatedPhase.displayOrder }
        },
        orderBy: { displayOrder: 'asc' }
      })

      if (nextPhase && nextPhase.status === 'PENDIENTE') {
        await prisma.projectPhase.update({
          where: { id: nextPhase.id },
          data: { status: 'EN_PROGRESO', startedAt: new Date() }
        })
      }
    }

    return NextResponse.json(updatedPhase)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
