const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const pipeline = await prisma.contentPipeline.findUnique({
    where: { id: 2 },
    include: { articles: true, headlineOptions: true }
  })
  console.log(JSON.stringify(pipeline, null, 2))
  process.exit(0)
}

check()
