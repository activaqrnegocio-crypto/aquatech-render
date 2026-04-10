const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const team = await prisma.projectTeam.findUnique({
    where: { 
      projectId_userId: { 
        projectId: 21, 
        userId: 30 
      } 
    }
  })
  
  if (team) {
    console.log(`César (ID 30) IS in Project 21 team.`)
  } else {
    console.log(`César (ID 30) IS NOT in Project 21 team! THIS IS REASON HE GETS 403.`)
  }
}

check()
