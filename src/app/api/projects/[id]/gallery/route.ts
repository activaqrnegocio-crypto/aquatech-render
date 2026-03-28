import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)

    const gallery = await prisma.projectGalleryItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(gallery)
  } catch (error) {
    console.error('Error fetching gallery:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)
    const { url, filename, mimeType, sizeBytes } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'Faltan datos de la imagen' }, { status: 400 })
    }

    const newItem = await prisma.projectGalleryItem.create({
      data: {
        projectId,
        url,
        filename: filename || 'upload',
        mimeType: mimeType || 'image/jpeg',
        sizeBytes: sizeBytes || null
      }
    })

    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('Error adding to gallery:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
