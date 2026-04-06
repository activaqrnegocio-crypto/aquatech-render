const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function reset() {
  await prisma.contentPipeline.update({
    where: { id: 2 },
    data: { status: 'HEADLINES' }
  })
  console.log('Pipeline 2 reset to HEADLINES')
  process.exit(0)
}

reset()
