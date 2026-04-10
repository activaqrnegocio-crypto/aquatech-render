const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const projectId = 21
  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } }
  })
  
  console.log(`Total messages for Project ${projectId}: ${messages.length}`)
  messages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] ${m.user.name} (Phase: ${m.phaseId}, Type: ${m.type}): ${m.content.substring(0, 30)}`)
  })
}

check()
