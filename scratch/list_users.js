const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        name: true
      }
    })
    console.log(JSON.stringify(users, null, 2))
  } catch (err) {
    console.error('Error fetching users:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
