import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Keep-Alive endpoint para evitar que StackCP cierre las conexiones MySQL por inactividad
export async function GET() {
  try {
    // Consulta súper ligera para mantener viva la conexión
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', time: Date.now() })
  } catch (error) {
    console.error('Error en health ping:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
