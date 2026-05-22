const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Reset all to false first
  await prisma.quote.updateMany({ data: { isBudget: false } })
  
  // 2. Get unique project IDs
  const linkedQuotes = await prisma.quote.findMany({
    where: { projectId: { not: null } },
    select: { id: true, projectId: true },
    orderBy: { id: 'desc' } // Most recent first
  })
  
  const projectsHandled = new Set()
  for (const q of linkedQuotes) {
    if (!projectsHandled.has(q.projectId)) {
      await prisma.quote.update({
        where: { id: q.id },
        data: { isBudget: true }
      })
      projectsHandled.add(q.projectId)
      console.log(`Quote #${q.id} is now the official budget for project #${q.projectId}`)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
