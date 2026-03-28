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
    const allowedFields: Record<string, any> = {}
    
    if (data.status) allowedFields.status = data.status
    if (data.title !== undefined) allowedFields.title = data.title
    if (data.address !== undefined) allowedFields.address = data.address
    if (data.city !== undefined) allowedFields.city = data.city
    if (data.startDate !== undefined) allowedFields.startDate = data.startDate ? new Date(data.startDate) : null
    if (data.endDate !== undefined) allowedFields.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.leadNotes !== undefined) allowedFields.leadNotes = data.leadNotes

    const updated = await prisma.project.update({
      where: { id: Number(id) },
      data: allowedFields,
      include: {
        client: true,
        phases: true,
        team: { include: { user: true } }
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
