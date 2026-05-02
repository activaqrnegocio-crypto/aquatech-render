import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { formatTimeEcuador, forceEcuadorTZ, formatDateEcuador } from '@/lib/date-utils'
import { isAdmin as checkIsAdmin, hasModuleAccess } from '@/lib/rbac'
import { notifyUser } from '@/lib/push'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = checkIsAdmin((session.user as any).role)
    const canManage = isAdmin || hasModuleAccess(session.user as any, 'calendario')
    const where: any = {}
    
    // If Admin/Manager and userId is "all" or not provided, show all.
    // Otherwise, if not Manager, force current userId.
    if (canManage) {
      if (userId && userId !== 'all') {
        where.userId = Number(userId)
      }
    } else {
      where.userId = Number(session.user.id)
    }

    if (start && end) {
      where.startTime = {
        gte: new Date(forceEcuadorTZ(start)),
      }
      where.endTime = {
        lte: new Date(forceEcuadorTZ(end)),
      }
    } else {
      // Default optimized range: 1 month ago to 6 months ahead to prevent full DB scan
      const now = new Date()
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0)
      where.startTime = { gte: defaultStart }
      where.endTime = { lte: defaultEnd }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        project: { select: { title: true } },
        user: { select: { id: true, name: true, role: true } }
      },
      orderBy: { startTime: 'asc' }
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// v261: In-memory cache for idempotency (deduplication)
// Stores sync-id -> timestamp to avoid processing the same offline sync twice
const processedSyncIds = new Map<string, number>();

// Clean up old IDs every 10 minutes to prevent memory leaks
if (typeof global !== 'undefined') {
  if (!(global as any).idempotencyCleanupInterval) {
    (global as any).idempotencyCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, timestamp] of processedSyncIds.entries()) {
        if (now - timestamp > 5 * 60 * 1000) processedSyncIds.delete(id);
      }
    }, 10 * 60 * 1000);
  }
}

export async function POST(request: Request) {
  try {
    const syncId = request.headers.get('x-sync-id');
    if (syncId) {
      if (processedSyncIds.has(syncId)) {
        console.log(`[Idempotency] Skipping already processed sync-id: ${syncId}`);
        return NextResponse.json({ success: true, message: 'Already processed', isDuplicate: true }, { status: 200 });
      }
      processedSyncIds.set(syncId, Date.now());
    }

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, startTime, endTime, userId, userIds, projectId, clientLocation, operatorLocation, attachments, attachmentLinks, clientName, clientPhone } = body;

    const isAdmin = checkIsAdmin((session.user as any).role)
    const canManage = isAdmin || hasModuleAccess(session.user as any, 'calendario')
    
    // Determine target user IDs
    let targetUserIds: number[] = []
    if (canManage && userIds && Array.isArray(userIds) && userIds.length > 0) {
      targetUserIds = userIds.map((id: any) => Number(id))
    } else if (userId) {
      targetUserIds = [Number(userId)]
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un operador' }, { status: 400 })
    }

    // v261: Asegurar IDs únicos para evitar duplicados accidentales
    targetUserIds = Array.from(new Set(targetUserIds));

    // Non-managers can only assign to themselves
    if (!canManage) {
      const selfId = Number(session.user.id)
      if (targetUserIds.length !== 1 || targetUserIds[0] !== selfId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const start = new Date(forceEcuadorTZ(startTime))
    const end = new Date(forceEcuadorTZ(endTime))
    if (end <= start) {
      return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })
    }

    // Idempotency: Check if an identical appointment was created very recently (e.g., last 15 seconds)
    // to prevent duplicates during flaky network retries
    const recentDuplicate = await prisma.appointment.findFirst({
      where: {
        title,
        startTime: start,
        userId: targetUserIds[0], // Check at least for the first one
        createdAt: { gte: new Date(Date.now() - 15000) }
      }
    });

    if (recentDuplicate) {
      console.log('[Idempotency] Found identical recent appointment, skipping creation.');
      return NextResponse.json(recentDuplicate, { status: 201 });
    }

    // PASO 1: Crear todas las citas
    const results: any[] = []
    for (const targetUserId of targetUserIds) {
      const appointment = await prisma.appointment.create({
        data: {
          title,
          description,
          startTime: start,
          endTime: end,
          userId: targetUserId,
          projectId: projectId ? Number(projectId) : null,
          clientName: clientName || null,
          clientPhone: clientPhone || null,
          clientLocation: clientLocation || null,
          operatorLocation: operatorLocation || null,
          files: body.files ? (typeof body.files === 'string' ? body.files : JSON.stringify(body.files)) : null,
        },
        include: {
          project: { select: { title: true } },
          user: { select: { id: true, name: true, phone: true } }
        }
      })
      results.push(appointment)
    }

    // PASO 2: Enviar notificaciones en segundo plano (No debe bloquear el éxito de la creación)
    const sendNotificationsSafe = async () => {
      try {
        for (let i = 0; i < results.length; i++) {
          const appointment = results[i]
          const startLocale = formatTimeEcuador(startTime)
          
          try {
            await notifyUser(
              appointment.userId,
              '📌 Nueva Tarea Asignada',
              `${title} — ${startLocale}`,
              `URL_TASK:${projectId || 0}:${appointment.id}`, // v281: Deep link to project/task
              `task-${appointment.id}`
            )
          } catch (e) { console.error('Push error:', e) }

          if (appointment.user?.phone) {
            try {
              const startTimeLocale = formatTimeEcuador(startTime);
              const startDateLocale = formatDateEcuador(startTime);
              const descrText = description ? `\n📝 *Notas:*\n${description}` : '';
              const locClientText = clientLocation ? `\n📍 *Ubicación Cliente:*\n${clientLocation}` : '';
              const nameClientText = clientName ? `\n👤 *Cliente:*\n${clientName}` : '';
              const phoneClientText = clientPhone ? `\n📞 *Teléfono Cliente:*\n${clientPhone}` : '';
              const locOpText = operatorLocation ? `\n📡 *Ubicación Operario (GPS):*\n${operatorLocation}` : '';
              
              const allAttachments = [...(attachments || []), ...(attachmentLinks || [])];
              const fileManifest = allAttachments.length > 0 
                ? `\n📦 *Archivos adjuntos:* ${allAttachments.map(a => a.name).join(', ')}` 
                : '';

              const videoLinks = attachmentLinks?.filter((a: any) => a.type === 'video') || [];
              const audioLinks = attachmentLinks?.filter((a: any) => a.type === 'audio') || [];

              let linksText = '';
              if (videoLinks.length) {
                linksText += `\n\n🎥 *Videos (Links):*\n${videoLinks.map((a: any) => `• ${a.url}`).join('\n')}`;
              }
              if (audioLinks.length) {
                linksText += `\n\n🔊 *Audios (Respaldo):*\n${audioLinks.map((a: any) => `• [Escuchar Audio](${a.url})`).join('\n')}`;
              }

              const message = `*Notificación Aquatech*\n\nHola ${appointment.user.name}, tienes una *nueva tarea* asignada:\n📌 *${title}*\n📅 Fecha: ${startDateLocale}\n⏰ Hora: ${startTimeLocale}${descrText}${nameClientText}${phoneClientText}${locClientText}${locOpText}${fileManifest}${linksText}\n\nConsulta más detalles en tu perfil.`;

              await sendWhatsAppMessage(appointment.user.phone, message, attachments);
            } catch (err) {
              console.error(`❌ Error enviando WA a ${appointment.user.name}:`, err);
            }

            if (i < results.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          }
        }
      } catch (err) {
        console.error('Error global en notificaciones:', err);
      }
    }

    await sendNotificationsSafe();

    return NextResponse.json(results.length === 1 ? results[0] : results, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
