const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function count() {
  const c = await prisma.pipelineArticle.count({ where: { pipelineId: 2 } })
  const articles = await prisma.pipelineArticle.findMany({ where: { pipelineId: 2 } })
  console.log(`Pipeline 2 has ${c} articles.`)
  console.log(JSON.stringify(articles, null, 2))
  process.exit(0)
}

count()
