const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, status: true }
  })
  
  const statusCounts = {}
  projects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1
  })

  console.log('Total Projects:', projects.length)
  console.log('Status Counts:', JSON.stringify(statusCounts, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
