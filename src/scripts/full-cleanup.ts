import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('--- Iniciando limpieza total de datos de prueba ---')

  // 1. Datos asociados a proyectos y fases
  await prisma.mediaFile.deleteMany({})
  await prisma.chatMessage.deleteMany({})
  await prisma.dayRecord.deleteMany({})
  await prisma.phaseCompletion.deleteMany({})
  await prisma.expense.deleteMany({})
  
  // 2. Cotizaciones y materiales
  await prisma.budgetItem.deleteMany({})
  await prisma.quoteItem.deleteMany({})
  await prisma.quote.deleteMany({})
  
  // 3. Estructura de proyectos
  await prisma.projectPhase.deleteMany({})
  await prisma.projectTeam.deleteMany({})
  await prisma.project.deleteMany({})
  
  // 4. Clientes
  await prisma.client.deleteMany({})
  
  // 5. Usuarios (Mantenemos al Administrador Principal con id 1)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { not: 1 }
    }
  })

  console.log(`✅ Usuarios eliminados: ${deletedUsers.count}`)
  console.log('✅ Todos los proyectos, gastos, registros y clientes han sido eliminados.')
  console.log('--- Limpieza completada con éxito ---')
}

main()
  .catch(e => {
    console.error('❌ Error durante la limpieza:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
