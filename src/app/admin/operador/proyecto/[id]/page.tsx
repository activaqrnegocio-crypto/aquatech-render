import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ProjectExecutionClient from '@/components/ProjectExecutionClient'
import { deepSerialize } from '@/lib/serializable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OperatorProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const userId = Number(session.user.id)
  const projectId = Number(id)

  // v280: ALL queries in parallel, gallery capped at 20 (was unlimited = slow)
  const [project, globalActiveRecord, myExpenses, availableOperators] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { name: true, phone: true, address: true, city: true } },
        phases: { orderBy: { displayOrder: 'asc' } },
        team: { include: { user: { select: { name: true, role: true } } } },
        chatMessages: { take: 1 },
        // v280: gallery was UNBOUNDED before — that alone caused 10s loads on big projects
        gallery: { orderBy: { createdAt: 'desc' }, take: 20 },
        budgetItems: true
      }
    }),
    prisma.dayRecord.findFirst({
      where: { userId, endTime: null },
      include: { project: { select: { id: true, title: true } } }
    }),
    prisma.expense.findMany({
      where: { projectId, OR: [{ userId }, { isNote: true }] },
      orderBy: { createdAt: 'desc' },
      take: 30 // v280: capped for speed
    }),
    prisma.user.findMany({
      where: { role: { in: ['OPERATOR', 'SUBCONTRATISTA'] }, isActive: true },
      select: { id: true, name: true, phone: true }
    })
  ])

  // If project doesn't exist or user not in team, back to dashboard
  const isInTeam = project?.team.some((t: any) => t.userId === userId)
  if (!project || !isInTeam) {
    redirect('/admin/operador')
  }

  // v280: Parallel fire — mark seen + fetch chat at the same time
  const [rawChatMessages] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 150, // v369: Increased to 150 to accommodate large offline bulk syncs of photos without truncating text msgs
      include: { user: { select: { name: true } }, media: true }
    }),
    prisma.projectView.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { lastSeen: new Date() },
      create: { userId, projectId, lastSeen: new Date() }
    })
  ])

  // Reverse to maintain chronological order [oldest -> newest] for the UI
  const chatMessages = rawChatMessages.reverse()

  // Combine and limit to 60 items for performance
  const unifiedGallery = [
    ...(project.gallery || []),
    ...(chatMessages.flatMap((m: any) => m.media || []).map((m: any) => ({
      ...m,
      isFromChat: true
    })))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, 60)

  // Manually build safe objects to ensure correct types and field names
  const safeProject = {
    id: project.id,
    title: project.title,
    status: project.status,
    type: project.type,
    subtype: project.subtype,
    startDate: project.startDate?.toISOString(),
    endDate: project.endDate?.toISOString(),
    categoryList: project.categoryList ? JSON.parse(project.categoryList) : [],
    technicalSpecs: project.technicalSpecs ? JSON.parse(project.technicalSpecs) : {},
    specsTranscription: project.specsTranscription,
    contractTypeList: project.contractTypeList ? JSON.parse(project.contractTypeList) : [],
    address: project.address || project.client?.address,
    phases: project.phases.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      description: p.description,
      estimatedDays: p.estimatedDays
    })),
    team: project.team.map(t => ({
      id: t.userId,
      name: t.user.name,
      role: t.user.role
    })),
    budgetItems: project.budgetItems.map(bi => ({
      id: bi.id,
      name: bi.name,
      quantity: Number(bi.quantity),
      estimatedCost: Number(bi.estimatedCost),
      unit: bi.unit
    })),
    gallery: unifiedGallery.map(g => ({ 
      id: (g as any).isFromChat ? `chat-${g.id}` : `gal-${g.id}`, 
      url: g.url, 
      filename: g.filename, 
      mimeType: g.mimeType,
      category: g.category,
      isFromChat: (g as any).isFromChat
    }))
  }

  const safeChat = chatMessages.map(msg => ({
    id: msg.id,
    phaseId: msg.phaseId,
    content: msg.content,
    type: msg.type,
    createdAt: msg.createdAt.toISOString(),
    userName: msg.user.name,
    isMe: msg.userId === userId,
    media: msg.media,
    extraData: msg.extraData
  }))

  const safeRecord = globalActiveRecord ? { 
    id: globalActiveRecord.id, 
    projectId: globalActiveRecord.projectId,
    projectName: globalActiveRecord.project.title,
    startTime: globalActiveRecord.startTime.toISOString() 
  } : null

  const safeExpenses = myExpenses.map(e => ({ 
    id: e.id, 
    description: e.description, 
    amount: Number(e.amount), 
    date: e.date.toISOString(),
    isNote: e.isNote,
    userName: (e as any).user?.name || 'Operador'
  }))

  // v280: availableOperators already fetched in the top Promise.all

  return (
    <div className="pt-0 pl-0 pr-0 sm:pt-6 sm:pl-6 sm:pr-6">
      <ProjectExecutionClient 
        {...deepSerialize({
          project: safeProject,
          initialChat: safeChat, 
          activeRecord: safeRecord, // Renamed but serves as "my current active session"
          expenses: safeExpenses,
          userId: userId,
          clientName: project.client?.name || 'Cliente sin nombre',
          projectAddress: project.address || project.client?.address || '',
          projectCity: project.client?.city || '',
          availableOperators,
          panelBase: "/admin/operador"
        })}
      />
    </div>
  )
}
