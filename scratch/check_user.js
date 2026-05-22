const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { id: 29 }
  })
  console.log('User permissions in DB:', JSON.stringify(user?.permissions))
  console.log('Full User Object:', JSON.stringify(user, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
