import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string, galleryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { galleryId } = await params
    const id = Number(galleryId)

    await prisma.projectGalleryItem.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Imagen eliminada correctamente' })
  } catch (error) {
    console.error('Error deleting gallery item:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
