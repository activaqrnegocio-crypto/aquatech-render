import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST: Register a new push subscription
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const { subscription, deviceName } = await req.json()

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    // Upsert: create or update if same endpoint exists
    const pushSub = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        }
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceName: deviceName || null,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceName: deviceName || null,
      }
    })

    console.log(`[PUSH] Subscription registered for user ${userId} (${deviceName || 'unknown device'})`)
    return NextResponse.json({ success: true, id: pushSub.id })
  } catch (error) {
    console.error('[PUSH Subscribe ERROR]:', error)
    return NextResponse.json({ error: 'Error registering subscription' }, { status: 500 })
  }
}

// DELETE: Remove a push subscription
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const { endpoint } = await req.json()

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint }
    })

    console.log(`[PUSH] Subscription removed for user ${userId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH Unsubscribe ERROR]:', error)
    return NextResponse.json({ error: 'Error removing subscription' }, { status: 500 })
  }
}
