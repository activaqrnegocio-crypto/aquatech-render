const { PrismaClient } = require('@prisma/client')
const { shouldUseReactServerCondition } = require('next/dist/build/utils')
const prisma = new PrismaClient()

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, username: true }
  })
  console.log(JSON.stringify(users, null, 2))
  await prisma.$disconnect()
}

check()
scre