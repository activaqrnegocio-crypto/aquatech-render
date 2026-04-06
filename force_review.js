const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function force() {
  await prisma.contentPipeline.update({
    where: { id: 2 },
    data: { status: 'REVIEWING_ARTICLES' }
  })
  console.log('Pipeline 2 FORCE UPDATED to REVIEWING_ARTICLES')
  process.exit(0)
}

force()
