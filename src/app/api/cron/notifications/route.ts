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
    const testPhone = searchParams.get('test'); // ?secret=...&test=593967491847
    const testReminder = searchParams.get('testReminder'); // ?secret=...&testReminder=1

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Si es testReminder, simulamos que son 60 min antes de las tareas (7:00 AM)
    const now = testReminder ? new Date(new Date().setHours(12, 0, 0, 0)) : new Date();
    const localTime = getLocalNow();
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();

    console.log(`Cron Notification Check: ${localTime.toISOString()} (${currentHour}:${currentMinute})`);

    const results: string[] = [];

    // --- 1. RESUMEN DIARIO (Solo entre las 6:00 AM y las 6:30 AM, o modo test) ---
    if (currentHour === 6 || testPhone) {
      const todayStr = formatDateEcuador(localTime); // YYYY-MM-DD
      
      // Si es test, traer solo operadores activos (sin filtro de teléfono aún)
      const operatorsWithTasks = await prisma.user.findMany({
        where: { 
          role: 'OPERATOR', 
          isActive: true
        },
        select: {
          id: true,
          name: true,
          phone: true
        }
      });

      for (let i = 0; i < operatorsWithTasks.length; i++) {
        const op = operatorsWithTasks[i];

        // En modo test, filtrar por teléfono (normalizando formato)
        if (testPhone) {
          const dbPhone = (op.phone || '').replace(/[^0-9]/g, '');
          const testNum = testPhone.replace(/[^0-9]/g, '');
          // Comparar: 593967491847 vs 0967491847 (últimos 10 dígitos)
          if (!dbPhone.endsWith(testNum.slice(-10)) && !testNum.endsWith(dbPhone.slice(-10))) continue;
        }

        // Traer tareas donde sea userId principal O esté en assignedUsers
        const opAppointments = await prisma.appointment.findMany({
          where: {
            startTime: { 
              gte: new Date(new Date(localTime).setHours(0,0,0,0)), 
              lte: new Date(new Date(localTime).setHours(23,59,59,999)) 
            },
            status: { not: 'CANCELADO' },
            OR: [
              { userId: op.id },
              { assignedUsers: { contains: `"id":${op.id}` } }
            ]
          },
          orderBy: { startTime: 'asc' }
        });

        if (op.phone && opAppointments.length > 0) {
          // LOCK ATÓMICO: marcar como enviado SOLO si sigue sin enviar hoy
          const updated = await prisma.user.updateMany({
            where: { 
              id: op.id, 
              OR: [
                { lastSummarySent: { lt: new Date(new Date().setHours(0,0,0,0)) } },
                { lastSummarySent: null }
              ]
            },
            data: { lastSummarySent: new Date() }
          });

          // Si ya se envió (count = 0), saltar
          if (updated.count === 0) continue;

          let summary = `📋 *Resumen del Día - Aquatech*\n\nHola *${op.name}*, hoy tienes *${opAppointments.length}* tareas asignadas:\n\n`;
          
          // Ordenar las citas por prioridad (title) numéricamente
          const sortedApts = [...opAppointments].sort((a, b) => {
            const prioA = parseInt(a.title || '999999', 10);
            const prioB = parseInt(b.title || '999999', 10);
            return prioA - prioB;
          });

          sortedApts.forEach((apt, idx) => {
            const time = formatTimeEcuador(apt.startTime);
            const date = formatDateEcuador(apt.startTime);
            const descrText = apt.description ? `\n   📝 *Nota:* ${apt.description}` : '';
            summary += `${idx + 1}. 🕙 *Prioridad ${idx + 1}* a las ${time} (${date})${descrText}\n\n`;
          });

          summary += `\n¡Que tengas un excelente día de trabajo! 👷💦`;
          
          const waResult = await sendWhatsAppMessage(op.phone, summary);
          if (waResult.success) {
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
        OR: [
          { reminded60: false },
          { reminded30: false },
          { reminded10: false }
        ]
      },
      include: { user: true }
    });

    // --- AGRUPAR por USUARIO: UN solo mensaje con TODAS sus tareas ---
    const userMap = new Map<number, { name: string; phone: string; tasks: any[] }>();

    for (const apt of upcomingApts) {
      const addTask = (uid: number, uname: string) => {
        if (!userMap.has(uid)) userMap.set(uid, { name: uname, phone: '', tasks: [] });
        if (!userMap.get(uid)!.tasks.some(t => t.id === apt.id)) userMap.get(uid)!.tasks.push(apt);
      };
      if (apt.user?.phone) { addTask(apt.userId, apt.user.name); userMap.get(apt.userId)!.phone = apt.user.phone; }
      if (apt.assignedUsers) {
        try {
          const assigned = typeof apt.assignedUsers === 'string' ? JSON.parse(apt.assignedUsers) : apt.assignedUsers;
          if (Array.isArray(assigned)) assigned.forEach((u: any) => addTask(u.id, u.name));
        } catch {}
      }
    }

    // Completar teléfonos faltantes
    const missingPhones = Array.from(userMap.keys()).filter(id => !userMap.get(id)!.phone);
    if (missingPhones.length > 0) {
      const phones = await prisma.user.findMany({ where: { id: { in: missingPhones } }, select: { id: true, phone: true } });
      for (const u of phones) if (userMap.has(u.id) && u.phone) userMap.get(u.id)!.phone = u.phone;
    }

    const windows = [
      { flag: 'reminded60', min: 58, max: 62, label: '1 hora', icon: '⏰' },
      { flag: 'reminded30', min: 28, max: 32, label: '30 minutos', icon: '⏰' },
      { flag: 'reminded10', min: 8, max: 12, label: '10 minutos', icon: '⚠️' }
    ];

    for (const [userId, ud] of userMap) {
      if (!ud.phone || ud.tasks.length === 0) continue;

      const diffMins = Math.round((ud.tasks[0].startTime.getTime() - now.getTime()) / 60000);
      const win = windows.find(w => diffMins >= w.min && diffMins <= w.max);
      if (!win) continue;

      // En modo test, solo enviar al número indicado (normalizando formato)
      if (testPhone) {
        const dbPhone = (ud.phone || '').replace(/[^0-9]/g, '');
        const testNum = testPhone.replace(/[^0-9]/g, '');
        if (!dbPhone.endsWith(testNum.slice(-10)) && !testNum.endsWith(dbPhone.slice(-10))) continue;
      }

      // Atomic lock: marcar TODAS sus tareas como notificadas
      const locked = await prisma.appointment.updateMany({
        where: { id: { in: ud.tasks.map(t => t.id) }, [win.flag]: false },
        data: { [win.flag]: true }
      });
      if (locked.count === 0) continue;

      const sorted = [...ud.tasks].sort((a, b) => (parseInt(a.title||'999999',10)||999999) - (parseInt(b.title||'999999',10)||999999));
      const dateLocal = formatDateEcuador(ud.tasks[0].startTime);
      const timeLocal = formatTimeEcuador(ud.tasks[0].startTime);

      let msg = `${win.icon} *Recordatorio (${win.label}):*\n\nHola *${ud.name}*, tienes *${sorted.length} tareas* por realizar hoy:\n\n`;
      sorted.forEach((t, i) => {
        msg += `${i+1}. 🕙 *Prioridad ${i+1}* a las ${timeLocal} (${dateLocal})${t.description ? `\n   📝 *Nota:* ${t.description}` : ''}\n\n`;
      });
      msg += `¡Que tengas un excelente día de trabajo! 👷💦`;

      await sendWhatsAppMessage(ud.phone, msg);
      results.push(`Reminder (${win.label}) sent to ${ud.name} (${sorted.length} tasks)`);
      await new Promise(resolve => setTimeout(resolve, 1500));
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
