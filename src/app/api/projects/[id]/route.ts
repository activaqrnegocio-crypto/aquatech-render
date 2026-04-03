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
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.project.delete({
      where: { id: Number(id) }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error interno al eliminar proyecto' }, { status: 500 })
  }
}
