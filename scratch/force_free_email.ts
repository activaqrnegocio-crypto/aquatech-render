import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'cristhopheryeah113@gmail.com'
  const user = await prisma.user.findFirst({
    where: { email }
  })

  if (user) {
    console.log('User found ID:', user.id)
    const newEmail = `${user.email}_del_${Date.now()}`
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail
      }
    })
    console.log(`Email changed to: ${newEmail}`)
  } else {
    console.log('No user found with that email.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
