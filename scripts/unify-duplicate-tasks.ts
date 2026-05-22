/**
 * Script para UNIFICAR tareas duplicadas del calendario.
 *
 * Antes: se creaba 1 tarea por cada operador (mismo título, misma fecha/hora).
 * Ahora: se crea 1 sola tarea con múltiples operadores en assignedUsers.
 *
 * Este script busca duplicados y los fusiona en una sola tarea.
 *
 * USO:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/unify-duplicate-tasks.ts
 *   (o si usas Bun: bun run scripts/unify-duplicate-tasks.ts)
 *
 * No modifica el esquema de la BD, solo limpia datos existentes.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DuplicateGroup {
  keep: any        // la tarea que se conserva
  duplicates: any[] // las que se eliminan
  allUserIds: Set<number>
}

async function main() {
  console.log('🔍 Buscando tareas duplicadas...\n')

  // 1. Obtener todas las citas
  const allAppointments = await prisma.appointment.findMany({
    orderBy: { startTime: 'asc' }
  })

  console.log(`📊 Total de tareas en BD: ${allAppointments.length}`)

  // 2. Agrupar por clave de duplicado: title + startTime + projectId
  const groups = new Map<string, DuplicateGroup>()

  for (const apt of allAppointments) {
    // Ignorar tareas que ya tienen assignedUsers con más de 1 operador
    if (apt.assignedUsers) {
      try {
        const parsed = JSON.parse(apt.assignedUsers)
        if (Array.isArray(parsed) && parsed.length > 1) continue // ya unificada
      } catch { /* no es JSON válido, sigue */ }
    }

    const key = `${apt.title}|${apt.startTime.toISOString()}|${apt.projectId || 'null'}`

    if (!groups.has(key)) {
      groups.set(key, { keep: apt, duplicates: [], allUserIds: new Set([apt.userId]) })
    } else {
      const group = groups.get(key)!
      group.duplicates.push(apt)
      group.allUserIds.add(apt.userId)
    }
  }

  // 3. Filtrar solo los grupos que realmente tienen duplicados
  const groupsWithDuplicates = Array.from(groups.values()).filter(g => g.duplicates.length > 0)

  if (groupsWithDuplicates.length === 0) {
    console.log('✅ No se encontraron tareas duplicadas. Todo limpio.')
    await prisma.$disconnect()
    return
  }

  console.log(`\n🔀 Se encontraron ${groupsWithDuplicates.length} grupo(s) de tareas duplicadas:\n`)

  for (const group of groupsWithDuplicates) {
    const keep = group.keep
    const totalOperators = group.allUserIds.size
    const operatorNames: string[] = []

    // Obtener nombres de todos los operadores involucrados
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(group.allUserIds) } },
      select: { id: true, name: true }
    })

    const assignedUsersList = users.map(u => ({ id: u.id, name: u.name }))
    operatorNames.push(...users.map(u => u.name))

    console.log(`📌 "${keep.title}" — ${keep.startTime.toLocaleDateString('es-EC')}`)
    console.log(`   Operadores: ${operatorNames.join(', ')}`)
    console.log(`   Tareas a eliminar: ${group.duplicates.length}`)

    // Actualizar la tarea que conservamos con todos los operadores
    await prisma.appointment.update({
      where: { id: keep.id },
      data: {
        assignedUsers: JSON.stringify(assignedUsersList),
        userId: assignedUsersList[0]?.id || keep.userId
      }
    })

    // Eliminar las duplicadas
    const duplicateIds = group.duplicates.map(d => d.id)
    await prisma.appointment.deleteMany({
      where: { id: { in: duplicateIds } }
    })

    console.log(`   ✅ Unificada: tarea #${keep.id} conservada con ${totalOperators} operador(es), ${duplicateIds.length} duplicada(s) eliminada(s)\n`)
  }

  // 4. Resumen final
  const totalKept = groupsWithDuplicates.length
  const totalDeleted = groupsWithDuplicates.reduce((acc, g) => acc + g.duplicates.length, 0)
  console.log(`═══════════════════════════════════════`)
  console.log(`✨ LIMPIEZA COMPLETADA`)
  console.log(`   Tareas unificadas: ${totalKept}`)
  console.log(`   Duplicados eliminados: ${totalDeleted}`)
  console.log(`   Total operaciones: ${totalKept + totalDeleted}`)
  console.log(`═══════════════════════════════════════`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ Error durante la limpieza:', e)
  prisma.$disconnect()
  process.exit(1)
})
