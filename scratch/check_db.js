const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const allProjects = await prisma.project.count()
  const activeProjects = await prisma.project.count({ where: { status: 'ACTIVO' } })
  const pendingProjects = await prisma.project.count({ where: { status: 'PENDIENTE' } })
  const completedProjects = await prisma.project.count({ where: { status: 'COMPLETADO' } })
  const canceledProjects = await prisma.project.count({ where: { status: 'CANCELADO' } })
  
  console.log('Total Projects:', allProjects)
  console.log('Active:', activeProjects)
  console.log('Pending:', pendingProjects)
  console.log('Completed:', completedProjects)
  console.log('Canceled:', canceledProjects)

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, username: true }
  })
  console.log('Users:', JSON.stringify(users, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
