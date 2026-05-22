import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only the 'ADMIN' or 'SUPERADMIN' role can force logouts
    if (!session || !['ADMIN', 'SUPERADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized: Solo los administradores pueden realizar esta acción.' }, { status: 401 })
    }

    const { id } = await params
    const targetUserId = Number(id)

    // Simply increment sessionVersion to invalidate all existing JWTs for this user
    await (prisma.user as any).update({
      where: { id: targetUserId },
      data: { 
        sessionVersion: { increment: 1 } 
      }
    })

    return NextResponse.json({ success: true, message: 'Sesiones invalidadas globalmente.' })
  } catch (error) {
    console.error('Error forcing logout:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
