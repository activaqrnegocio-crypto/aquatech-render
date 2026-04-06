import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()

    // Only allow certain fields to be updated
    const allowedFields: any = {}
    
    if (data.status) allowedFields.status = data.status
    if (data.title !== undefined) allowedFields.title = data.title
    if (data.type !== undefined) allowedFields.type = data.type
    if (data.subtype !== undefined) allowedFields.subtype = data.subtype
    if (data.address !== undefined) allowedFields.address = data.address
    if (data.city !== undefined) allowedFields.city = data.city
    if (data.startDate !== undefined) allowedFields.startDate = data.startDate ? new Date(data.startDate) : null
    if (data.endDate !== undefined) allowedFields.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.leadNotes !== undefined) allowedFields.leadNotes = data.leadNotes
    if (data.categoryList !== undefined) allowedFields.categoryList = data.categoryList
    if (data.contractTypeList !== undefined) allowedFields.contractTypeList = data.contractTypeList
    if (data.technicalSpecs !== undefined) allowedFields.technicalSpecs = data.technicalSpecs
    if (data.specsTranscription !== undefined) allowedFields.specsTranscription = data.specsTranscription
    if (data.estimatedBudget !== undefined) allowedFields.estimatedBudget = data.estimatedBudget

    // Handle nested client update if provided
    if (data.client) {
      allowedFields.client = {
        update: {
          name: data.client.name,
          ruc: data.client.ruc,
          phone: data.client.phone,
          email: data.client.email,
          city: data.client.city,
          address: data.client.address
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: Number(id) },
        data: allowedFields,
        include: {
          client: true,
          phases: true,
          team: { include: { user: true } },
          gallery: true,
          expenses: { include: { user: true } },
          chatMessages: { include: { user: true, phase: true, media: true }, orderBy: { createdAt: 'desc' } },
          dayRecords: { include: { user: true } }
        }
      })

      // If project becomes ACTIVE, accept the associated quote
      if (data.status === 'ACTIVO') {
        await tx.quote.updateMany({
          where: { projectId: proj.id, status: 'BORRADOR' },
          data: { status: 'ACEPTADA' }
        })
      }
      
      return proj
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Error interno al actualizar proyecto' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'SUPERADMIN' && userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)

    // Delete in transaction to handle related quotes and orphaned clients
    await prisma.$transaction(async (tx) => {
      // 0. Get the project to find its clientId
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { clientId: true }
      })

      // 1. Delete quotes associated with this project (instead of unlinking them)
      await tx.quote.deleteMany({
        where: { projectId: projectId }
      })

      // 2. Delete the project (cascades to phases, budgetItems, teams, etc. based on schema)
      await tx.project.delete({
        where: { id: projectId }
      })

      // 3. Clean up the client if it is now orphaned (no other projects, no other quotes)
      if (project?.clientId) {
        const remainingProjects = await tx.project.count({ where: { clientId: project.clientId } })
        const remainingQuotes = await tx.quote.count({ where: { clientId: project.clientId } })
        
        if (remainingProjects === 0 && remainingQuotes === 0) {
          await tx.client.delete({
            where: { id: project.clientId }
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error interno al eliminar proyecto' }, { status: 500 })
  }
}
