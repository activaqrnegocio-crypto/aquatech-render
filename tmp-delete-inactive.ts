import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.user.deleteMany({
    where: { isActive: false }
  })
  console.log(`--- LIMPIEZA COMPLETADA ---`)
  console.log(`Se han eliminado ${result.count} miembros inactivos.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
