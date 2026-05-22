const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.quote.updateMany({
    where: {
      projectId: { not: null },
      isBudget: false
    },
    data: {
      isBudget: true
    }
  })
  console.log(`Updated ${result.count} quotes to isBudget = true`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
