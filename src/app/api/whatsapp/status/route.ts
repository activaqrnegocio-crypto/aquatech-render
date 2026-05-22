import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE_NAME

    if (!apiUrl || !apiKey || !instance) {
      return NextResponse.json({ error: 'Configuración faltante' }, { status: 500 })
    }

    const response = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { 'apikey': apiKey }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Error al consultar Evolution API' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[WA STATUS ERROR]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
