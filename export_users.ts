import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ 
    select: { 
      id: true, 
      username: true, 
      name: true,
      role: true
    } 
  })
  fs.writeFileSync('users_detailed.json', JSON.stringify(users, null, 2))
  console.log('Saved to users_detailed.json')
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
