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

export async function POST(request: Request) {
  try {
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

    // PASO 1: Crear todas las citas primero
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
        },
        include: {
          project: { select: { title: true } },
          user: { select: { id: true, name: true, phone: true } }
        }
      })
      results.push(appointment)
    }

    // Responder inmediatamente al cliente para no bloquearlo
    const response = NextResponse.json(results.length === 1 ? results[0] : results)

    // PASO 2: Enviar notificaciones SECUENCIALMENTE después de crear las citas
    const sendNotifications = async () => {
      for (let i = 0; i < results.length; i++) {
        const appointment = results[i]

        // 🔔 Push Notification
        const startLocale = formatTimeEcuador(startTime)
        notifyUser(
          appointment.userId,
          '📌 Nueva Tarea Asignada',
          `${title} — ${startLocale}`,
          `/admin/operador`,
          `task-${appointment.id}`
        )

        // WhatsApp
        if (appointment.user?.phone) {
          try {
            const startTimeLocale = formatTimeEcuador(startTime);
            const startDateLocale = formatDateEcuador(startTime);
            const descrText = description ? `\n📝 *Notas:*\n${description}` : '';
            const locClientText = clientLocation ? `\n📍 *Ubicación Cliente:*\n${clientLocation}` : '';
            const nameClientText = clientName ? `\n👤 *Cliente:*\n${clientName}` : '';
            const phoneClientText = clientPhone ? `\n📞 *Teléfono Cliente:*\n${clientPhone}` : '';
            const locOpText = operatorLocation ? `\n📡 *Ubicación Operario (GPS):*\n${operatorLocation}` : '';
            
            // Listado de archivos para diagnóstico
            const allAttachments = [...(attachments || []), ...(attachmentLinks || [])];
            const fileManifest = allAttachments.length > 0 
              ? `\n📦 *Archivos adjuntos:* ${allAttachments.map(a => a.name).join(', ')}` 
              : '';

            // Los links de respaldo para Videos y Audios
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

            // Enviar mensaje de texto + adjuntos reales (imgs, audios, docs)
            await sendWhatsAppMessage(appointment.user.phone, message, attachments);
            console.log(`✅ WA enviado a ${appointment.user.name} (${appointment.user.phone})`);
          } catch (err) {
            console.error(`❌ Error enviando WA a ${appointment.user.name}:`, err);
          }

          if (i < results.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    try {
      await sendNotifications()
    } catch (err) {
      console.error('Error global en notificaciones:', err);
    }

    return response
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
