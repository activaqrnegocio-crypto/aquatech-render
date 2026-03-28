import bcrypt from 'bcryptjs'

const password = '54yaJcKF@u'
const hash = '$2b$10$1mulPDsAawZhVgzt1jk1u72206' // Taking a guess based on the split output, but I'll query it again to be sure

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'cristhophers' },
    select: { passwordHash: true }
  })
  
  if (!user) {
    console.log('User not found')
    return
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash)
  console.log('--- PASSWORD CHECK ---')
  console.log(`Password: ${password}`)
  console.log(`Hash in DB: ${user.passwordHash}`)
  console.log(`Is Match: ${isValid}`)
}

main().finally(() => prisma.$disconnect())
