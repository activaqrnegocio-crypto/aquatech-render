const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const messages = await prisma.chatMessage.findMany({
    where: { projectId: 21 },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { id: true, name: true, role: true } } }
  })
  
  console.log('Last 10 messages for Project 21:')
  messages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] (ID ${m.id}) User: ${m.user.name} (ID ${m.user.id}, Role ${m.user.role}) - Content: ${m.content}`)
  })
}

check()
