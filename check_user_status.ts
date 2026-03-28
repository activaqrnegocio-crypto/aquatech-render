import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'cristhophers' },
    select: { id: true, username: true, isActive: true, passwordHash: true }
  })
  console.log(JSON.stringify(user, null, 2))
}
main().finally(() => prisma.$disconnect())
