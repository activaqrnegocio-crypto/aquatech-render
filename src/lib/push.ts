import webpush from 'web-push'
import { prisma } from './prisma'

// Configure VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:aquatech@cesarreyesjaramillo.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string       // URL to open on click
  tag?: string        // Groups notifications of the same type
  badge?: string
}

/**
 * Send a push notification to all devices of a specific user.
 * Automatically cleans up expired subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subs.length === 0) return []

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      url: payload.url || '/admin/operador',
      tag: payload.tag || 'general',
      vibrate: [300, 100, 300, 100, 400],
      renotify: true
    })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          pushPayload,
          {
            TTL: 86400,
            urgency: 'high'
          }
        ).catch(async (err: any) => {
          // If the endpoint expired (410 Gone or 404), delete the subscription
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
            console.log(`[PUSH] Removed expired subscription for user ${userId}`)
          }
          throw err
        })
      )
    )

    return results
  } catch (error) {
    console.error('[PUSH] Error sending to user:', userId, error)
    return []
  }
}

/**
 * Send a push notification to all team members of a project,
 * plus all admins. Excludes the sender.
 */
export async function sendPushToProjectTeam(
  projectId: number,
  excludeUserId: number,
  payload: PushPayload
) {
  try {
    // Get project team members
    const team = await prisma.projectTeam.findMany({
      where: { projectId },
      select: { userId: true }
    })

    // Also include admins
    const admins = await prisma.user.findMany({
      where: { 
        role: { in: ['ADMIN', 'ADMINISTRADORA', 'SUPERADMIN'] }, 
        isActive: true 
      },
      select: { id: true }
    })

    // Combine and deduplicate, exclude sender
    const allUserIds = [...new Set([
      ...team.map(t => t.userId),
      ...admins.map(a => a.id)
    ])].filter(id => id !== excludeUserId)

    if (allUserIds.length === 0) return []

    return Promise.allSettled(
      allUserIds.map(uid => sendPushToUser(uid, payload))
    )
  } catch (error) {
    console.error('[PUSH] Error sending to project team:', projectId, error)
    return []
  }
}

/**
 * Send push notification to a single specific user by ID.
 * Convenience wrapper with error swallowing for fire-and-forget usage.
 */
export async function notifyUser(userId: number, title: string, body: string, url?: string, tag?: string) {
  return sendPushToUser(userId, { title, body, url, tag }).catch(() => {})
}

/**
 * Send push notification to the whole project team.
 * Convenience wrapper with error swallowing for fire-and-forget usage.
 */
export async function notifyProjectTeam(
  projectId: number, 
  excludeUserId: number, 
  title: string, 
  body: string, 
  url?: string, 
  tag?: string
) {
  return sendPushToProjectTeam(projectId, excludeUserId, { title, body, url, tag }).catch(() => {})
}
/**
 * Send push notification to all admins in the system.
 */
export async function notifyAdmins(title: string, body: string, url?: string, tag?: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { 
        role: { in: ['ADMIN', 'ADMINISTRADORA', 'SUPERADMIN'] }, 
        isActive: true 
      },
      select: { id: true }
    })
    
    if (admins.length === 0) return []
    
    return Promise.allSettled(
      admins.map(a => notifyUser(a.id, title, body, url, tag))
    )
  } catch (error) {
    console.error('[PUSH] Error notifying admins:', error)
    return []
  }
}
