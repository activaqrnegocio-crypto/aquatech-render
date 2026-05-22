/**
 * Script para agregar la columna assigned_users a la tabla appointments.
 * Ejecutar: npx tsx scripts/add-column.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Verificando columna assigned_users...')
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE appointments ADD COLUMN assigned_users TEXT NULL`)
    console.log('✅ Columna assigned_users agregada correctamente')
  } catch (e: any) {
    if (e.message?.includes('Duplicate column') || e.message?.includes('already exists')) {
      console.log('ℹ️ La columna assigned_users ya existe')
    } else {
      console.error('❌ Error:', e.message)
    }
  }
  await prisma.$disconnect()
}

main()
