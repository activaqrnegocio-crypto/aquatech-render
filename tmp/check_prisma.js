const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && typeof prisma[k] === 'object'))
process.exit(0)
