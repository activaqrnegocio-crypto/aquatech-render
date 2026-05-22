import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import DashboardClient from './DashboardClient'
import OfflinePrefetcher from '@/components/OfflinePrefetcher'

export const dynamic = 'force-dynamic'

// v2: Cache dashboard data for 30s — multiple admins hit the dashboard
// frequently and 30s freshness is acceptable for aggregate stats.
const getDashboardData = unstable_cache(
  async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalProjects, activeProjects, pendingProjects, completedProjects, leadProjects,
      totalOperators, recentExpenses, recentMessages, projectsList, teamList,
      recent7DayRecords, recent7DayMessagesCount, recent7DayExpenses,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'ACTIVO' } }),
      prisma.project.count({ where: { status: 'PENDIENTE' } }),
      prisma.project.count({ where: { status: 'COMPLETADO' } }),
      prisma.project.count({ where: { status: 'LEAD' } }),
      prisma.user.count({ where: { role: 'OPERATOR', isActive: true } }),
      prisma.expense.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { project: { select: { title: true } }, user: { select: { name: true } } } }),
      prisma.chatMessage.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { project: { select: { title: true } }, user: { select: { name: true } }, phase: { select: { title: true } } } }),
      prisma.project.findMany({ where: { status: { in: ['ACTIVO', 'LEAD', 'PENDIENTE', 'COMPLETADO', 'ARCHIVADO'] } }, take: 30, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, type: true, status: true, estimatedBudget: true, startDate: true, updatedAt: true, client: { select: { name: true } }, phases: { select: { id: true, title: true, status: true, estimatedDays: true } }, team: { select: { user: { select: { name: true } } } }, expenses: { select: { amount: true } }, _count: { select: { expenses: true } } } }),
      prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true, phone: true, _count: { select: { projectTeams: true } } } }),
      prisma.dayRecord.findMany({ where: { startTime: { gte: sevenDaysAgo } }, select: { startTime: true, endTime: true } }),
      prisma.chatMessage.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.expense.aggregate({ where: { createdAt: { gte: sevenDaysAgo } }, _sum: { amount: true } }),
    ])

    const budgetData = await prisma.project.aggregate({ where: { status: 'ACTIVO' }, _sum: { estimatedBudget: true, realCost: true } })

    const last7DaysHours = recent7DayRecords.reduce((total: number, record: any) => {
      const start = record.startTime; const end = record.endTime || new Date()
      return total + (end.getTime() - start.getTime())
    }, 0)

    return {
      totalProjects, activeProjects, pendingProjects, completedProjects, leadProjects,
      totalOperators, totalBudget: Number(budgetData._sum.estimatedBudget || 0),
      totalSpent: Number(budgetData._sum.realCost || 0),
      totalHours7d: +(last7DaysHours / 3600000).toFixed(1),
      totalMessages7d: recent7DayMessagesCount,
      totalExpenses7d: Number(recent7DayExpenses._sum.amount || 0),
      serializedExpenses: recentExpenses.map((e: any) => ({ id: e.id, amount: Number(e.amount), description: e.description, date: e.createdAt.toISOString(), projectTitle: e.project.title, userName: e.user.name })),
      serializedMessages: recentMessages.map((m: any) => ({ id: m.id, content: m.content, type: m.type, createdAt: m.createdAt.toISOString(), projectTitle: m.project.title, userName: m.user.name, phaseTitle: m.phase?.title || null })),
      serializedProjects: projectsList.map((p: any) => {
        const totalExpenses = p.expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0)
        return { id: p.id, title: p.title, type: p.type as string, status: p.status as string, clientName: p.client?.name || 'Sin cliente', phasesTotal: p.phases.length, phasesCompleted: p.phases.filter((ph: any) => ph.status === 'COMPLETADA').length, teamMembers: p.team.map((t: any) => t.user.name), expenseCount: p._count.expenses, estimatedBudget: Number((p as any).estimatedBudget || 0), realCost: totalExpenses, estimatedDays: p.phases.reduce((sum: number, ph: any) => sum + Number(ph.estimatedDays || 0), 0), phases: p.phases.map((ph: any) => ({ id: ph.id, title: ph.title, status: ph.status, estimatedDays: Number(ph.estimatedDays || 0) })) }
      }),
      serializedTeam: teamList.map((u: any) => ({ id: u.id, name: u.name, role: u.role, phone: u.phone, projectCount: u._count.projectTeams })),
      prefetchUrls: ['/admin/proyectos/nuevo', '/admin/cotizaciones/nuevo', '/admin/inventario', '/admin/team', '/admin/calendario', ...projectsList.map((p: any) => `/admin/proyectos/${p.id}`)],
    }
  },
  ['admin-dashboard-data'],
  { revalidate: 30, tags: ['admin-dashboard'] }
)

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role === 'OPERATOR') redirect('/admin/operador')
  if (session?.user?.role === 'SUBCONTRATISTA') redirect('/admin/subcontratista')

  const data = await getDashboardData()

  return (
    <>
      <OfflinePrefetcher urls={data.prefetchUrls} />
      <DashboardClient
        stats={{
          totalProjects: data.totalProjects,
          activeProjects: data.activeProjects,
          pendingProjects: data.pendingProjects,
          completedProjects: data.completedProjects,
          leadProjects: data.leadProjects,
          totalOperators: data.totalOperators,
          totalBudget: data.totalBudget,
          totalSpent: data.totalSpent,
          totalHours7d: data.totalHours7d,
          totalMessages7d: data.totalMessages7d,
          totalExpenses7d: data.totalExpenses7d,
        }}
        recentExpenses={data.serializedExpenses}
        recentMessages={data.serializedMessages}
        activeProjects={data.serializedProjects}
        teamList={data.serializedTeam}
      />
    </>
  )
}
