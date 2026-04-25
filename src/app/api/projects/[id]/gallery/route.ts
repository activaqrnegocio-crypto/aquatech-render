import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin, isOperator } from '@/lib/rbac'

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
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!isAdmin(userRole) && !isOperator(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)
    let { url, filename, mimeType, sizeBytes, category, createdAt } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'Faltan datos de la imagen' }, { status: 400 })
    }

    // 0. Handle Base64 uploads (offline sync fallback)
    if (url.startsWith('data:')) {
      const { uploadToBunny } = await import('@/lib/bunny')
      try {
        const matches = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64')
          const uploadResult = await uploadToBunny(buffer, filename || `gallery_${Date.now()}.jpg`, `projects/${projectId}/gallery`)
          url = uploadResult // Now it's a URL string
        }
      } catch (error) {
        console.error('Error uploading Base64 to Bunny:', error)
        return NextResponse.json({ error: 'Error al subir archivo a BunnyCDN' }, { status: 500 })
      }
    }

    const newItem = await prisma.projectGalleryItem.create({
      data: {
        projectId,
        url,
        filename: filename || 'upload',
        mimeType: mimeType || 'image/jpeg',
        sizeBytes: sizeBytes || null,
        category: category || 'MASTER',
        createdAt: createdAt ? new Date(createdAt) : undefined
      }
    })

    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('Error adding to gallery:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
