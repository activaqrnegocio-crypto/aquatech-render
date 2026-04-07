import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { formatTimeEcuador, forceEcuadorTZ } from '@/lib/date-utils'
import { isAdmin as checkIsAdmin } from '@/lib/rbac'

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
    const where: any = {}
    
    // If Admin and userId is "all" or not provided, show all.
    // Otherwise, if not Admin, force current userId.
    if (isAdmin) {
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
    const { title, description, startTime, endTime, userId, projectId } = body

    // Logic: Only Admins can assign to others. Operators can only create for themselves?
    // For now, let's allow it if it's the user's ID or if they are admin.
    const isAdmin = checkIsAdmin((session.user as any).role)
    
    if (!isAdmin && Number(userId) !== Number(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const start = new Date(forceEcuadorTZ(startTime))
    const end = new Date(forceEcuadorTZ(endTime))
    if (end <= start) {
      return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })
    }

    const appointment = await prisma.appointment.create({
      data: {
        title,
        description,
        startTime: start,
        endTime: end,
        userId: Number(userId),
        projectId: projectId ? Number(projectId) : null,
      },
      include: {
        project: { select: { title: true } },
        user: { select: { id: true, name: true, phone: true } }
      }
    })

    // NOTIFICACIÓN AUTOMÁTICA: Si hay un número de teléfono, enviar aviso de nueva tarea
    if (appointment.user?.phone) {
      const startTimeLocale = formatTimeEcuador(startTime);
      
      const message = `*Notificación Aquatech*\n\nHola ${appointment.user.name}, tienes una *nueva tarea* asignada para hoy/próximamente:\n📌 *${title}*\n⏰ Hora: ${startTimeLocale}\n\nConsulta más detalles en tu perfil.`;
      
      // Enviamos de forma asíncrona para no bloquear la respuesta de la API
      sendWhatsAppMessage(appointment.user.phone, message).catch(err => {
        console.error('Error enviando notificación WA de nueva tarea:', err);
      });
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
