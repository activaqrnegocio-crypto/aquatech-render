import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getLocalNow, formatTimeEcuador, formatDateEcuador } from '@/lib/date-utils';

/**
 * RUTA DE CRON: https://dominio.com/api/cron/notifications?secret=...
 * Esta ruta debe ser llamada cada 5-10 minutos por un servicio externo (CPANEL Cron).
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Configuración de Zona Horaria (Ecuador/LatAm) mediante utilidad
    const localTime = getLocalNow();
    const now = new Date(); // Mantenemos now como UTC para comparaciones de timestamps absolutos
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();

    console.log(`Cron Notification Check: ${localTime.toISOString()} (${currentHour}:${currentMinute})`);

    const results: string[] = [];

    // --- 1. RESUMEN DIARIO (Solo entre las 6:00 AM y las 6:30 AM) ---
    // Aumentamos la ventana pero usamos el campo lastSummarySent para asegurar un solo envío
    if (currentHour === 6) {
      const todayStr = formatDateEcuador(localTime); // YYYY-MM-DD
      
      const operatorsWithTasks = await prisma.user.findMany({
        where: { 
          role: 'OPERATOR', 
          isActive: true,
          OR: [
            { lastSummarySent: { lt: new Date(new Date().setHours(0,0,0,0)) } },
            { lastSummarySent: null }
          ]
        },
        include: {
          appointments: {
            where: {
              startTime: { 
                gte: new Date(new Date(localTime).setHours(0,0,0,0)), 
                lte: new Date(new Date(localTime).setHours(23,59,59,999)) 
              },
              status: { not: 'CANCELADO' }
            },
            orderBy: { startTime: 'asc' }
          }
        }
      });

      for (let i = 0; i < operatorsWithTasks.length; i++) {
        const op = operatorsWithTasks[i];
        
        // Verificación doble: ¿Ya se envió hoy?
        if (op.lastSummarySent) {
           const lastSentStr = formatDateEcuador(op.lastSummarySent);
           if (lastSentStr === todayStr) continue;
        }

        if (op.phone && op.appointments.length > 0) {
          let summary = `📋 *Resumen del Día - Aquatech*\n\nHola *${op.name}*, hoy tienes *${op.appointments.length}* tareas asignadas:\n\n`;
          
          op.appointments.forEach((apt, idx) => {
            const time = formatTimeEcuador(apt.startTime);
            const date = formatDateEcuador(apt.startTime);
            const descrText = apt.description ? `\n   📝 *Nota:* ${apt.description}` : '';
            summary += `${idx + 1}. 🕙 *${apt.title}* a las ${time} (${date})${descrText}\n\n`;
          });

          summary += `\n¡Que tengas un excelente día de trabajo! 👷💦`;
          
          const waResult = await sendWhatsAppMessage(op.phone, summary);
          if (waResult.success) {
            // Actualizar marca de envío para evitar duplicados
            await prisma.user.update({
              where: { id: op.id },
              data: { lastSummarySent: new Date() }
            });
            results.push(`Summary sent to ${op.name}`);
          }

          if (i < operatorsWithTasks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    // --- 2. RECORDATORIOS ESCALONADOS (60, 30 y 10 minutos antes) ---
    const futureLimit = new Date(now.getTime() + 75 * 60000); 
    
    const upcomingApts = await prisma.appointment.findMany({
      where: {
        startTime: { gte: now, lte: futureLimit },
        status: { not: 'CANCELADO' },
        // Solo traer los que NO han sido notificados en sus respectivos rangos
        OR: [
          { reminded60: false },
          { reminded30: false },
          { reminded10: false }
        ]
      },
      include: { user: true }
    });

    for (let i = 0; i < upcomingApts.length; i++) {
      const apt = upcomingApts[i];
      if (!apt.user?.phone) continue;

      const diffMs = apt.startTime.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);

      let reminderMessage = '';
      let flagToUpdate = '';
      
      const dateLocal = formatDateEcuador(apt.startTime);
      const timeLocal = formatTimeEcuador(apt.startTime);
      const descrText = apt.description ? `\n📝 *Nota:* ${apt.description}` : '';
      
      if (diffMins >= 55 && diffMins <= 65 && !apt.reminded60) {
        reminderMessage = `⏰ *Recordatorio (1 hora):*\nHola ${apt.user.name}, tu tarea *"${apt.title}"* comienza en 60 minutos.\n📅 ${dateLocal} a las ${timeLocal}${descrText}`;
        flagToUpdate = 'reminded60';
      } else if (diffMins >= 25 && diffMins <= 35 && !apt.reminded30) {
        reminderMessage = `⏰ *Recordatorio (30 min):*\nHola ${apt.user.name}, tu tarea *"${apt.title}"* comienza en 30 minutos.\n📅 ${dateLocal} a las ${timeLocal}${descrText}`;
        flagToUpdate = 'reminded30';
      } else if (diffMins >= 5 && diffMins <= 15 && !apt.reminded10) {
        reminderMessage = `⚠️ *Aviso (10 min):*\nHola ${apt.user.name}, tu tarea *"${apt.title}"* está por comenzar en 10 minutos.\n📅 ${dateLocal} a las ${timeLocal}${descrText}`;
        flagToUpdate = 'reminded10';
      }

      if (reminderMessage && flagToUpdate) {
        // LOCK ATÓMICO: Intentamos marcar como enviado. Si ya lo estaba, count será 0.
        const updateData: any = {};
        updateData[flagToUpdate] = true;

        const alreadySent = await prisma.appointment.updateMany({
          where: { 
            id: apt.id, 
            [flagToUpdate]: false // Solo si sigue en false
          },
          data: updateData
        });

        if (alreadySent.count > 0) {
          await sendWhatsAppMessage(apt.user.phone, reminderMessage);
          results.push(`Reminder (${diffMins}m) sent to ${apt.user.name} for ${apt.title}`);
          
          if (i < upcomingApts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      time: localTime.toISOString(),
      actions: results 
    });

  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Cron execution error' }, { status: 500 });
  }
}
