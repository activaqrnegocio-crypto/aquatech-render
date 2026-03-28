import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('--- USERS IN DATABASE ---')
  console.log(JSON.stringify(users, (key, value) => {
    if (key === 'image' && value) return `[IMAGE ${value.length} chars]`
    return value
  }, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
