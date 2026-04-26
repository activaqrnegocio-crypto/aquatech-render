import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Diagnóstico de Base de Datos Aquatech ---')
  try {
    // 1. Probar conexión
    await prisma.$connect()
    console.log('✅ Conexión establecida con StackCP MySQL.')

    // 2. Contar Usuarios
    const userCount = await prisma.user.count()
    console.log(`👥 Usuarios registrados: ${userCount}`)

    // 3. Contar Proyectos
    const projectCount = await prisma.project.count()
    const activeProjects = await prisma.project.count({ where: { status: 'ACTIVO' } })
    const pendingProjects = await prisma.project.count({ where: { status: 'PENDIENTE' } })
    const leadProjects = await prisma.project.count({ where: { status: 'LEAD' } })
    const negotiatingProjects = await prisma.project.count({ where: { status: 'NEGOCIANDO' } })
    
    console.log(`🏗️ Proyectos totales: ${projectCount}`)
    console.log(`   - Activos: ${activeProjects}`)
    console.log(`   - Pendientes: ${pendingProjects}`)
    console.log(`   - Leads: ${leadProjects}`)
    console.log(`   - Negociando: ${negotiatingProjects}`)

    // 4. Contar Citas/Calendario
    const appointmentCount = await prisma.appointment.count()
    console.log(`📅 Tareas en calendario: ${appointmentCount}`)

    // 5. Verificar si hay tareas para el usuario 61 (el que salía en consola)
    const user61Tasks = await prisma.appointment.count({ where: { userId: 61 } })
    console.log(`📍 Tareas asignadas al usuario 61: ${user61Tasks}`)

  } catch (e) {
    console.error('❌ ERROR CRÍTICO EN DB:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
