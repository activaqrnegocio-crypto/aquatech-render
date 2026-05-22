import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'cristhopheryeah113' } },
        { username: { contains: 'prueba' } }
      ]
    }
  })
  console.log('Similar users:', JSON.stringify(users, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
