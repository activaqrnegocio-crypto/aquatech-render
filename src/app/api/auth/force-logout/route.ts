import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import NextAuth from 'next-auth'

const handler = NextAuth(authOptions)

// Override signOut to clear sessionVersion
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body
    
    if (userId) {
      // Invalidar sesión en la base de datos
      const { prisma } = await import('@/lib/prisma')
      
      // El id en Prisma es Int, pero llega como String desde localStorage
      const userIdInt = parseInt(userId, 10)
      if (!isNaN(userIdInt)) {
        await prisma.user.update({
          where: { id: userIdInt },
          data: { sessionVersion: { increment: 1 } }
        })
        console.log('[ForceLogout] Session invalidada para usuario:', userIdInt)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ForceLogout] Error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

// Also handle GET for simple logout
export async function GET() {
  return POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({}) }))
}