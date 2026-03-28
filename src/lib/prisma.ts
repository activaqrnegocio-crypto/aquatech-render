import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  if (!globalForPrisma.prisma) {
    console.log('🔄 Iniciando nueva instancia de Prisma Client Pool')
  }
  globalForPrisma.prisma = prisma
}
