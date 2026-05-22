import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const apiUrl = process.env.EVOLUTION_API_URL
const apiKey = process.env.EVOLUTION_API_KEY
const instance = process.env.EVOLUTION_INSTANCE_NAME

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apiUrl || !apiKey || !instance) {
      return NextResponse.json({ error: 'Configuración faltante' }, { status: 500 })
    }

    const response = await fetch(`${apiUrl}/instance/connect/${instance}`, {
      headers: { 'apikey': apiKey }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Error al obtener QR' }, { status: response.status })
    }

    const data = await response.json()
    console.log('[EVOLUTION QR DEBUG]:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[WA CONNECT ERROR]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apiUrl || !apiKey || !instance) {
      return NextResponse.json({ error: 'Configuración faltante' }, { status: 500 })
    }

    const response = await fetch(`${apiUrl}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey }
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return NextResponse.json({ error: err.message || 'Error al cerrar sesión' }, { status: response.status })
    }

    return NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' })
  } catch (error) {
    console.error('[WA LOGOUT ERROR]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
