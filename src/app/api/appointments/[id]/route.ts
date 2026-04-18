import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin as checkIsAdmin } from '@/lib/rbac'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { formatTimeEcuador, formatDateEcuador } from '@/lib/date-utils'
import { notifyUser } from '@/lib/push'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, startTime, endTime, status, projectId } = body

    const existing = await prisma.appointment.findUnique({
      where: { id: Number(id) }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const isAdmin = checkIsAdmin((session.user as any).role)
    if (!isAdmin && existing.userId !== Number(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validar rango si se está actualizando
    const start = startTime ? new Date(startTime) : existing.startTime
    const end = endTime ? new Date(endTime) : existing.endTime
    if (end <= start) {
      return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })
    }

    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (startTime !== undefined) data.startTime = new Date(startTime)
    if (endTime !== undefined) data.endTime = new Date(endTime)
    if (status !== undefined) data.status = status
    if (projectId !== undefined) data.projectId = projectId ? Number(projectId) : null

    const updated = await prisma.appointment.update({
      where: { id: Number(id) },
      data,
      include: {
        project: { select: { title: true } },
        user: { select: { id: true, name: true, phone: true } }
      }
    })

    // Enviar notificaciones de actualización
    const sendUpdateNotifications = async () => {
      const startLocale = formatTimeEcuador(updated.startTime)
      
      notifyUser(
        updated.userId,
        '✏️ Tarea Actualizada',
        `${updated.title} — ${startLocale}`,
        `/admin/operador`,
        `task-${updated.id}`
      )

      if (updated.user?.phone) {
        try {
          const startTimeLocale = formatTimeEcuador(updated.startTime);
          const startDateLocale = formatDateEcuador(updated.startTime);
          const descrText = updated.description ? `\n📝 *Notas:*\n${updated.description}` : '';
          
          const message = `*Notificación Aquatech*\n\nHola ${updated.user.name}, se ha *actualizado* una tarea que tienes asignada:\n📌 *${updated.title}*\n📅 Nueva fecha: ${startDateLocale}\n⏰ Nueva hora: ${startTimeLocale}${descrText}\n\nRevisa tu perfil para ver los cambios.`;

          await sendWhatsAppMessage(updated.user.phone, message);
          console.log(`✅ WA actualización enviado a ${updated.user.name} (${updated.user.phone})`);
        } catch (err) {
          console.error(`❌ Error enviando WA de actualización a ${updated.user.name}:`, err);
        }
      }
    }

    try {
      await sendUpdateNotifications()
    } catch (err) {
      console.error('Error global en notificaciones de actualización:', err)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: Number(id) }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const isAdmin = checkIsAdmin((session.user as any).role)
    if (!isAdmin && existing.userId !== Number(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.appointment.delete({
      where: { id: Number(id) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
