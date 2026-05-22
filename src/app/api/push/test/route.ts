import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

// POST: Send a test notification to the current user
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)

    await sendPushToUser(userId, {
      title: '🔔 ¡Notificaciones Activadas!',
      body: `Hola ${session.user.name}, recibirás alertas de proyectos, mensajes y más.`,
      url: '/admin/operador',
      tag: 'test'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH Test ERROR]:', error)
    return NextResponse.json({ error: 'Error sending test notification' }, { status: 500 })
  }
}
