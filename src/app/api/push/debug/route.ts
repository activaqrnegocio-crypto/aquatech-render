import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import webpush from 'web-push'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)

    // 1. Verificar variables de entorno
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const vapidSubject = process.env.VAPID_SUBJECT

    // 2. Buscar suscripciones del usuario
    const subs = await prisma.pushSubscription.findMany({ where: { userId } })

    if (subs.length === 0) {
      return NextResponse.json({
        error: 'NO HAY SUSCRIPCIONES en la DB para este usuario',
        userId,
        vapidPublicPresent: !!vapidPublic,
        vapidPrivatePresent: !!vapidPrivate,
        vapidPublicFirst20: vapidPublic?.substring(0, 20)
      })
    }

    // 3. Intentar envío real y capturar el error exacto
    try {
      webpush.setVapidDetails(
        vapidSubject || 'mailto:test@test.com',
        vapidPublic!,
        vapidPrivate!
      )

      await webpush.sendNotification(
        { endpoint: subs[0].endpoint, keys: { p256dh: subs[0].p256dh, auth: subs[0].auth } },
        JSON.stringify({ title: 'Test Debug', body: 'Si ves esto, funciona', url: '/' })
      )

      return NextResponse.json({
        success: true,
        message: 'Notificación enviada OK',
        subsCount: subs.length,
        endpoint: subs[0].endpoint.substring(0, 50)
      })

    } catch (pushErr: any) {
      // Aquí veremos el error REAL de Google/FCM
      return NextResponse.json({
        error: 'FALLO AL ENVIAR',
        statusCode: pushErr.statusCode,
        pushErrorBody: pushErr.body,
        pushErrorMessage: pushErr.message,
        vapidPublicPresent: !!vapidPublic,
        vapidPrivatePresent: !!vapidPrivate,
        vapidPublicFirst20: vapidPublic?.substring(0, 20),
        subsCount: subs.length,
        endpointStart: subs[0].endpoint.substring(0, 60)
      })
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
