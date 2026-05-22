import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'ADMINISTRADORA'] }
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true
    }
  })
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
