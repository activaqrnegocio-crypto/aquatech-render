import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role === 'OPERATOR') {
    redirect('/admin/operador')
  }

  // Fetch all dashboard data server-side
  const [
    totalProjects,
    activeProjects,
    pendingProjects,
    completedProjects,
    leadProjects,
    totalOperators,
    recentExpenses,
    recentMessages,
    projectsList,
    teamList,
    recent7DayRecords,
    recent7DayMessagesCount,
    recent7DayExpenses,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: 'ACTIVO' } }),
    prisma.project.count({ where: { status: 'PENDIENTE' } }),
    prisma.project.count({ where: { status: 'COMPLETADO' } }),
    prisma.project.count({ where: { status: 'LEAD' } }),
    prisma.user.count({ where: { role: 'OPERATOR', isActive: true } }),
    prisma.expense.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } }, user: { select: { name: true } } },
    }),
    prisma.chatMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { title: true } },
        user: { select: { name: true } },
        phase: { select: { title: true } },
      },
    }),
    prisma.project.findMany({
      where: { status: { in: ['ACTIVO', 'LEAD'] } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        estimatedBudget: true,
        startDate: true,
        updatedAt: true,
        client: { select: { name: true } },
        phases: { select: { id: true, title: true, status: true, estimatedDays: true } },
        team: { select: { user: { select: { name: true } } } },
        expenses: { select: { amount: true } },
        _count: { select: { expenses: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        _count: {
          select: {
            projectTeams: true
          }
        }
      }
    }),
    // 7-day metrics
    prisma.dayRecord.findMany({
      where: {
        startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: { startTime: true, endTime: true }
    }),
    prisma.chatMessage.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.expense.aggregate({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      _sum: { amount: true }
    })
  ])

  // Calculate 7-day stats
  const last7DaysHours = recent7DayRecords.reduce((total, record) => {
    const start = record.startTime
    const end = record.endTime || new Date()
    return total + (end.getTime() - start.getTime())
  }, 0)
  const totalHours7d = +(last7DaysHours / 3600000).toFixed(1)
  const weeklyExpenseTotal = Number(recent7DayExpenses._sum.amount || 0)

  // Calculate budget totals
  const budgetData = await prisma.project.aggregate({
    where: { status: 'ACTIVO' },
    _sum: { estimatedBudget: true, realCost: true },
  })

  const totalBudget = Number(budgetData._sum.estimatedBudget || 0)
  const totalSpent = Number(budgetData._sum.realCost || 0)

  // Serialize for client component
  const serializedExpenses = recentExpenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    description: e.description,
    date: e.createdAt.toISOString(),
    projectTitle: e.project.title,
    userName: e.user.name,
  }))

  const serializedMessages = recentMessages.map((m) => ({
    id: m.id,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    projectTitle: m.project.title,
    userName: m.user.name,
    phaseTitle: m.phase?.title || null,
  }))

  const serializedProjects = projectsList.map((p) => {
    const totalExpenses = p.expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const estimatedBudget = Number((p as any).estimatedBudget || 0)
    
    // Calculate days
    const totalEstimatedDays = p.phases.reduce((sum, ph) => sum + Number(ph.estimatedDays || 0), 0)
    
    return {
      id: p.id,
      title: p.title,
      type: p.type as string,
      status: p.status as string,
      clientName: p.client?.name || 'Sin cliente',
      phasesTotal: p.phases.length,
      phasesCompleted: p.phases.filter((ph) => ph.status === 'COMPLETADA').length,
      teamMembers: p.team.map((t) => t.user.name),
      expenseCount: p._count.expenses,
      // Meta for bars
      estimatedBudget,
      realCost: totalExpenses,
      estimatedDays: totalEstimatedDays,
      phases: p.phases.map(ph => ({
        id: ph.id,
        title: ph.title,
        status: ph.status,
        estimatedDays: Number(ph.estimatedDays || 0)
      }))
    }
  })

  const serializedTeam = teamList.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    phone: u.phone,
    projectCount: u._count.projectTeams
  }))

  return (
    <DashboardClient
      stats={{
        totalProjects,
        activeProjects,
        pendingProjects,
        completedProjects,
        leadProjects,
        totalOperators,
        totalBudget,
        totalSpent,
        totalHours7d,
        totalMessages7d: recent7DayMessagesCount,
        totalExpenses7d: weeklyExpenseTotal,
      }}
      recentExpenses={serializedExpenses}
      recentMessages={serializedMessages}
      activeProjects={serializedProjects}
      teamList={serializedTeam}
    />
  )
}
