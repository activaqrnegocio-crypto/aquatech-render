const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const messages = await prisma.chatMessage.findMany({
    where: { 
      projectId: 21,
      content: { contains: 'hola' }
    },
    orderBy: { createdAt: 'desc' },
    take: 5 }
  )
  
  console.log(`Checking Phase IDs for 'hola' messages in Project 21:`)
  messages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] Content: '${m.content}' -> PhaseId: ${m.phaseId}`)
  })
}

check()
