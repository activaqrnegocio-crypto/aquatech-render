
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const now = new Date();
  const offset = -5;
  const localTime = new Date(now.getTime() + offset * 60 * 60 * 1000);
  
  console.log('Now (UTC):', now.toISOString());
  console.log('LocalTime (Ecuador shifted):', localTime.toISOString());

  const todayStart = new Date(localTime);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(localTime);
  todayEnd.setHours(23, 59, 59, 999);

  console.log('Query Range (todayStart):', todayStart.toISOString());
  console.log('Query Range (todayEnd):', todayEnd.toISOString());

  const operators = await prisma.user.findMany({
    where: { role: 'OPERATOR' },
    select: { id: true, name: true, phone: true, isActive: true }
  });

  console.log('Operators found:', operators.length);
  for (const op of operators) {
    const apts = await prisma.appointment.findMany({
      where: {
        userId: op.id,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { not: 'CANCELADO' }
      }
    });
    console.log(`- Operator: ${op.name} (${op.phone}) - Active: ${op.isActive} - Appointments today: ${apts.length}`);
    if (apts.length > 0) {
        apts.forEach(a => console.log(`  * ${a.title} @ ${a.startTime.toISOString()}`));
    }
  }

  // Also check ALL appointments for today to see if they are outside the range
  const allToday = await prisma.appointment.findMany({
    where: {
      startTime: {
        gte: new Date(new Date().setHours(0,0,0,0)), // Rough UTC today
      }
    },
    include: { user: true }
  });
  console.log('\nAll appointments from today (UTC 00:00 onwards):', allToday.length);
  for (const a of allToday) {
      console.log(`- ${a.title} @ ${a.startTime.toISOString()} (User: ${a.user?.name})`);
  }
}

debug();
