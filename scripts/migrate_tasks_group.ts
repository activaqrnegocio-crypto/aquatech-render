/**
 * Migration script: Group duplicate appointments (same title + startTime + endTime + projectId)
 * into single appointments with assignedUsers JSON array.
 * 
 * Run: npx tsx scripts/migrate_tasks_group.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Finding duplicate appointments to consolidate...')

  // Find all appointments that share the same (title, startTime, endTime, projectId)
  const duplicates = await prisma.$queryRawUnsafe<Array<{id: number, title: string, start_time: Date, end_time: Date, project_id: number | null, user_id: number}>>(`
    SELECT a1.id, a1.title, a1.start_time, a1.end_time, a1.project_id, a1.user_id
    FROM appointments a1
    INNER JOIN (
      SELECT title, start_time, end_time, COALESCE(project_id, 0) as project_group
      FROM appointments
      GROUP BY title, start_time, end_time, COALESCE(project_id, 0)
      HAVING COUNT(*) > 1
    ) a2 ON a1.title = a2.title 
         AND a1.start_time = a2.start_time 
         AND a1.end_time = a2.end_time 
         AND COALESCE(a1.project_id, 0) = a2.project_group
    ORDER BY a1.title, a1.start_time, a1.id
  `)

  if (duplicates.length === 0) {
    console.log('✅ No duplicate appointments found to consolidate.')
    return
  }

  // Group by (title, start_time, end_time, project_id)
  const groups = new Map<string, typeof duplicates>()
  for (const app of duplicates) {
    const key = `${app.title}|${app.start_time.toISOString()}|${app.end_time.toISOString()}|${app.project_id ?? 0}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(app)
  }

  console.log(`📦 Found ${groups.size} task groups to consolidate (${duplicates.length} total appointments).`)

  let consolidated = 0
  let deleted = 0

  for (const [key, apps] of groups.entries()) {
    // Keep the first appointment, add all user IDs to its assignedUsers
    const keep = apps[0]
    const duplicatesToRemove = apps.slice(1)
    
    // Get user names for all assigned users
    const allUserIds = apps.map(a => a.user_id)
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true }
    })
    
    const assignedUsers = JSON.stringify(users.map(u => ({ id: u.id, name: u.name })))
    
    // Update the kept appointment with assignedUsers
    await prisma.appointment.update({
      where: { id: keep.id },
      data: { assignedUsers }
    })
    
    // Delete duplicate appointments
    for (const dup of duplicatesToRemove) {
      await prisma.appointment.delete({ where: { id: dup.id } })
      deleted++
    }
    
    consolidated++
    if (consolidated % 10 === 0) {
      console.log(`  → ${consolidated}/${groups.size} groups processed...`)
    }
  }

  console.log(`✅ Migration complete!`)
  console.log(`   - ${consolidated} task groups consolidated`)
  console.log(`   - ${deleted} duplicate appointments deleted`)
}

main()
  .catch(e => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
