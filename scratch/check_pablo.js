const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: 29 }
  })
  console.log('--- USER DATA (PABLO) ---')
  console.log('Role:', user.role)
  console.log('Permissions (Raw):', JSON.stringify(user.permissions))
  console.log('Permissions (Type):', typeof user.permissions)
  console.log('-------------------------')
}

main().catch(console.error).finally(() => prisma.$disconnect())
