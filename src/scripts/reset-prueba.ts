import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = 'aquatech123'
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(password, salt)
  
  await prisma.user.update({
    where: { username: 'Prueba' },
    data: { passwordHash: hash }
  })
  
  console.log('Password for user "Prueba" has been reset to "aquatech123"')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
