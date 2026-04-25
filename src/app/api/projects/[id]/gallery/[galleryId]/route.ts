import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin, isOperator, isSubcontractor } from '@/lib/rbac'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string, galleryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: projectIdStr, galleryId: rawGalleryId } = await params
    const projectId = Number(projectIdStr)
    const galleryId = Number(rawGalleryId.replace('gal-', ''))
    const userRole = (session.user as any).role
    const userId = Number(session.user.id)

    // Authorization check
    if (!isAdmin(userRole)) {
      const isAllowed = isOperator(userRole) || isSubcontractor(userRole)
      if (!isAllowed) return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 })

      // Check if part of team
      const isInTeam = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId, userId } }
      })
      if (!isInTeam) return NextResponse.json({ error: 'No asignado a este proyecto' }, { status: 403 })
    }

    const { filename } = await request.json()

    // Ensure item belongs to project
    const item = await prisma.projectGalleryItem.findFirst({
      where: { id: galleryId, projectId }
    })

    if (!item) return NextResponse.json({ error: 'Archivo no encontrado en este proyecto' }, { status: 404 })

    const updated = await prisma.projectGalleryItem.update({
      where: { id: galleryId },
      data: { filename }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating gallery item:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string, galleryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: projectIdStr, galleryId: rawGalleryId } = await params
    const projectId = Number(projectIdStr)
    const galleryId = Number(rawGalleryId.replace('gal-', ''))
    const userRole = (session.user as any).role
    const userId = Number(session.user.id)

    // Authorization check
    if (!isAdmin(userRole)) {
      const isAllowed = isOperator(userRole) || isSubcontractor(userRole)
      if (!isAllowed) return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 })

      // Check if part of team
      const isInTeam = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId, userId } }
      })
      if (!isInTeam) return NextResponse.json({ error: 'No asignado a este proyecto' }, { status: 403 })
    }

    // Ensure item exists AND belongs to project for security
    const item = await prisma.projectGalleryItem.findFirst({
      where: { id: galleryId, projectId }
    })

    if (!item) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    await prisma.projectGalleryItem.delete({
      where: { id: galleryId }
    })

    return NextResponse.json({ success: true, message: 'Imagen eliminada correctamente' })
  } catch (error) {
    console.error('Error deleting gallery item:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
