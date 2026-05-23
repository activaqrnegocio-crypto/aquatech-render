import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const { title, description, startTime, endTime, status, projectId, clientName, clientPhone, clientLocation, operatorLocation, userIds, silent } = body

    const existing = await prisma.appointment.findUnique({
      where: { id: Number(id) }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
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
    if (clientName !== undefined) data.clientName = clientName
    if (clientPhone !== undefined) data.clientPhone = clientPhone
    if (clientLocation !== undefined) data.clientLocation = clientLocation || null
    if (operatorLocation !== undefined) data.operatorLocation = operatorLocation || null
    if (body.files !== undefined) data.files = body.files ? (typeof body.files === 'string' ? body.files : JSON.stringify(body.files)) : null

    // v500: Handle userIds update (admin or assigned user)
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const newUserIds = Array.from(new Set(userIds.map((id: any) => Number(id))))
      const newUsers = await prisma.user.findMany({
        where: { id: { in: newUserIds } },
        select: { id: true, name: true, phone: true }
      })
      data.assignedUsers = JSON.stringify(newUsers.map(u => ({ id: u.id, name: u.name })))
      data.userId = newUserIds[0]
    }

    const updated = await prisma.appointment.update({
      where: { id: Number(id) },
      data,
      include: {
        project: { select: { title: true } },
        user: { select: { id: true, name: true, phone: true } }
      }
    })

    // v500: Determine which users to notify
    const updatedAssigned = updated.assignedUsers ? JSON.parse(updated.assignedUsers) : [{ id: updated.userId, name: updated.user?.name }]

    // Enviar notificaciones de actualización a TODOS los asignados
    const sendUpdateNotifications = async () => {
      const startLocale = formatTimeEcuador(updated.startTime)
      
      for (const op of updatedAssigned) {
        if (!op.id) continue
        notifyUser(
          op.id,
          '✏️ Tarea Actualizada',
          `${updated.description ? (updated.description.substring(0, 30) + '...') : 'Tarea'} — ${startLocale}`,
          `URL_TASK:${updated.projectId || 0}:${updated.id}`,
          `task-${updated.id}`
        )

        if (op.phone) {
          try {
            const startTimeLocale = formatTimeEcuador(updated.startTime);
            const startDateLocale = formatDateEcuador(updated.startTime);
            const nameClientText = updated.clientName ? `\n👤 *Cliente:* ${updated.clientName}` : '';
            const phoneClientText = updated.clientPhone ? `\n📞 *Teléfono:* ${updated.clientPhone}` : '';
            
            const message = `*Notificación Aquatech*\n\nHola ${op.name}, se ha *actualizado* una tarea que tienes asignada:\n📌 *Prioridad ${updated.title || 'Sin prioridad'}*\n📅 Nueva fecha: ${startDateLocale}\n⏰ Nueva hora: ${startTimeLocale}\n📝 *Nota:* ${updated.description || '(Sin nota)'}${nameClientText}${phoneClientText}\n\nRevisa tu perfil para ver los cambios.`;

            await sendWhatsAppMessage(op.phone, message);
            console.log(`✅ WA actualización enviado a ${op.name} (${op.phone})`);
          } catch (err) {
            console.error(`❌ Error enviando WA de actualización a ${op.name}:`, err);
          }
        }
      }
    }

    if (!silent) {
      try {
        await sendUpdateNotifications()
      } catch (err) {
        console.error('Error global en notificaciones de actualización:', err)
      }
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

    await prisma.appointment.delete({
      where: { id: Number(id) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
