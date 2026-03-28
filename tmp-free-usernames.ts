import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const inactiveUsers = await prisma.user.findMany({
    where: { isActive: false }
  })

  console.log(`--- PROCESO DE LIBERACIÓN DE NOMBRES ---`)
  console.log(`Encontrados ${inactiveUsers.length} miembros inactivos.`)

  for (const user of inactiveUsers) {
    const newUsername = `${user.username}_old_${Date.now()}`
    await prisma.user.update({
      where: { id: user.id },
      data: { username: newUsername }
    })
    console.log(`Liberando username: ${user.username} -> ${newUsername}`)
  }

  console.log(`--- LIBERACIÓN COMPLETADA ---`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
