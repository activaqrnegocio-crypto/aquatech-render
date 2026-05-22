import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Corrigiendo proyectos con tipo inválido usando Raw SQL...')
  
  const result = await prisma.$executeRawUnsafe(
    `UPDATE projects SET type = 'PISCINA' WHERE type = '' OR type IS NULL`
  )
  
  console.log(`Finalizado. Proyectos actualizados: ${result}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
