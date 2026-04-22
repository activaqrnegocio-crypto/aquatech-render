import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(params.id) },
      select: { image: true }
    })
    
    if (!user || !user.image) {
      return new NextResponse(null, { status: 404 })
    }

    // image is likely 'data:image/jpeg;base64,....' or 'data:image/png;base64,....'
    const match = user.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (match) {
      const mimeType = match[1]
      const base64Data = match[2]
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
        }
      })
    }
    
    // If it's a URL instead of base64
    if (user.image.startsWith('http')) {
      return NextResponse.redirect(user.image)
    }
    
    return new NextResponse(null, { status: 404 })
  } catch (err) {
    return new NextResponse(null, { status: 500 })
  }
}
