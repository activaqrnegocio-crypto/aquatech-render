import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('--- RESETTING SELECTIVE AQUATECH CRM ---')

  // 1. Find main admin account
  const mainAdmin = await prisma.user.findUnique({
    where: { username: 'aquatech' }
  })

  if (!mainAdmin) {
    throw new Error('Error crítico: No se encontró al administrador maestro (aquatech). Cancelando purga.')
  }

  // 2. Preserve Quotes (Cotizaciones)
  // Reassign to admin and detach from projects
  const quoteUpdate = await prisma.quote.updateMany({
    data: {
      userId: mainAdmin.id,
      projectId: null
    }
  })
  console.log(`Preservadas y reasignadas ${quoteUpdate.count} cotizaciones reales.`)

  // 3. Delete ALL Projects (Cascades to Phases, Expenses, DayRecords, Teams, Chats, Gallery)
  const projResult = await prisma.project.deleteMany({})
  console.log(`Eliminados ${projResult.count} proyectos de prueba (y sus reportes/gastos vinculados).`)

  // 4. Delete ALL Users EXCEPT the main admin
  const userResult = await prisma.user.deleteMany({
    where: {
      id: { not: mainAdmin.id }
    }
  })
  console.log(`Eliminados ${userResult.count} operadore/administradoras de prueba (correos liberados).`)

  // 5. Note status of Material (Inventario) and Client
  const matCount = await prisma.material.count()
  const cliCount = await prisma.client.count()
  console.log(`Inventario: ${matCount} ítems preservados.`)
  console.log(`Clientes: ${cliCount} registros preservados.`)

  console.log('--- RESET SELECTIVO COMPLETADO ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
