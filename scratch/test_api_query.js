const fetch = require('node-fetch')
// Note: We need a session, so we can't easily fetch from outside.
// But we can use prisma directly to see what the query would return.

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testQuery() {
  const id = 21
  const since = "2026-04-06T19:51:33.454Z" // fsdfsdf's date
  
  console.log(`Simulating API query for Project ${id} since ${since}`)
  
  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId: Number(id),
      createdAt: { gt: new Date(since) }
    },
    orderBy: { createdAt: 'asc' }
  })
  
  console.log(`Found ${messages.length} messages.`)
  messages.forEach(m => {
    console.log(`- [${m.createdAt.toISOString()}] ${m.content}`)
  })
}

testQuery()
