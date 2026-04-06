import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only 'ADMIN' and 'SUPERADMIN' roles can reset passwords
    if (!session || !['ADMIN', 'SUPERADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized: Solo los administradores pueden realizar esta acción.' }, { status: 401 })
    }

    const { id } = await params
    const targetUserId = Number(id)
    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres.' }, { status: 400 })
    }

    // Encrypt new password
    const hashed = await bcrypt.hash(newPassword, 10)

    // Update user
    await (prisma.user as any).update({
      where: { id: targetUserId },
      data: { 
        passwordHash: hashed,
        displayPassword: newPassword, // Store plain text for admin lookup
        sessionVersion: { increment: 1 } 
      }
    })

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente.' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
