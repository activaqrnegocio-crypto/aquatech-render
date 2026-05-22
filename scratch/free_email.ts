import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'cristhopheryeah113@gmail.com'
  const user = await prisma.user.findFirst({
    where: { email }
  })

  if (user) {
    console.log('User found:', JSON.stringify(user, null, 2))
    if (user.isActive) {
      console.log('User is active. Renaming to free email...')
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          email: `${user.email}_del_${Date.now()}`,
          username: `${user.username}_old_${Date.now()}`
        }
      })
      console.log('Email freed successfully.')
    } else {
      console.log('User is already inactive.')
    }
  } else {
    console.log('No user found with that email.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
