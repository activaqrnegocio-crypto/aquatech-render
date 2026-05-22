const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const messages = await prisma.chatMessage.findMany({
    where: { 
      content: { contains: 'hola' }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { project: { select: { id: true, title: true } } }
  })
  
  console.log(`Found ${messages.length} messages containing 'hola'`)
  messages.forEach(m => {
    console.log(`[Proj ${m.project.id}: ${m.project.title}] [${m.createdAt.toISOString()}] ${m.content}`)
  })
}

check()
