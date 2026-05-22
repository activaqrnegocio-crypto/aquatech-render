const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.update({
    where: { id: 29 },
    data: { permissions: null }
  })
  console.log('Pablo reset to defaults:', user.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())
