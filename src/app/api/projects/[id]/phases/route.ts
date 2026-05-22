import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { notifyProjectTeam } from '@/lib/push'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)
    const { title, description, estimatedDays, status, displayOrder } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const newPhase = await prisma.projectPhase.create({
      data: {
        projectId,
        title,
        description: description || null,
        estimatedDays: estimatedDays ? Number(estimatedDays) : null,
        status: status || 'PENDIENTE',
        displayOrder: displayOrder || 0
      }
    })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } })

    // Notify project team about new phase
    notifyProjectTeam(
      projectId, Number(session.user.id),
      `📋 Nueva tarea en: ${project?.title || 'Proyecto'}`,
      `Se agregó la tarea: ${title}`,
      `/admin/operador/proyecto/${projectId}`,
      `phase-${projectId}`
    )

    return NextResponse.json(newPhase, { status: 201 })
  } catch (error) {
    console.error('Error creating phase:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
