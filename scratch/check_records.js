const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const projectId = 21
  const records = await prisma.dayRecord.findMany({
    where: { projectId },
    orderBy: { startTime: 'desc' },
    include: { user: { select: { name: true } } }
  })
  
  console.log(`Total day records for Project ${projectId}: ${records.length}`)
  records.forEach(r => {
    console.log(`[Start: ${r.startTime.toISOString()}] [End: ${r.endTime?.toISOString()}] ${r.user.name}`)
  })
}

check()
