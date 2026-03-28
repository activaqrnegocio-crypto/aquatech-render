import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('--- RESETTING AQUATECH CRM ---')

  // 1. Delete ALL Projects (Cascades nearly everywhere)
  const projResult = await prisma.project.deleteMany({})
  console.log(`Eliminados ${projResult.count} proyectos.`)

  // 2. Delete ALL Clients
  const clientResult = await prisma.client.deleteMany({})
  console.log(`Eliminados ${clientResult.count} clientes.`)

  // 3. Delete ALL Users EXCEPT the main admin
  const adminUsername = 'aquatech'
  const userResult = await prisma.user.deleteMany({
    where: {
      username: { not: adminUsername }
    }
  })
  console.log(`Eliminados ${userResult.count} operadore/administradoras.`)

  console.log('--- RESET COMPLETADO ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
