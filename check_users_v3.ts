import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ 
    select: { 
      id: true, 
      username: true, 
      role: true,
      name: true
    } 
  })
  console.log('--- USER LIST ---')
  for (const u of users) {
    console.log(`ID: ${u.id} | USER: "${u.username}" | NAME: "${u.name}" | ROLE: ${u.role}`)
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
