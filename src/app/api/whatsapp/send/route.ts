import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phone, message, projectId, category } = await request.json()

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Número de teléfono y mensaje son requeridos' },
        { status: 400 }
      )
    }

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
    const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      return NextResponse.json(
        { error: 'Evolution API no configurada. Contacte al administrador.' },
        { status: 500 }
      )
    }

    // Send message via Evolution API
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Evolution API error:', errorData)
      return NextResponse.json(
        { error: 'Error al enviar mensaje por WhatsApp' },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data,
    })
  } catch (error) {
    console.error('WhatsApp send error:', error)
    return NextResponse.json(
      { error: 'Error interno al enviar mensaje' },
      { status: 500 }
    )
  }
}
