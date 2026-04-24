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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { name: true, phone: true, address: true, city: true } },
      phases: { orderBy: { displayOrder: 'asc' } },
      team: { include: { user: { select: { name: true, role: true } } } },
      chatMessages: {
        take: 1
      },
      gallery: { orderBy: { createdAt: 'desc' } },
      budgetItems: true
    }
  })

  // If project doesn't exist or user not in team, back to dashboard
  const isInTeam = project?.team.some((t: any) => t.userId === userId)
  if (!project || !isInTeam) {
    redirect('/admin/operador')
  }

  // Mark chat as seen for this user
  await prisma.projectView.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    update: { lastSeen: new Date() },
    create: {
      userId,
      projectId,
      lastSeen: new Date()
    }
  })

  // Reload all chat messages for this project with user info
  const chatMessages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } }, media: true }
  })

  // Find if user has ANY active day record across ALL projects
  const globalActiveRecord = await prisma.dayRecord.findFirst({
    where: { userId, endTime: null },
    include: { project: { select: { id: true, title: true } } }
  })

  // get user's expenses + all project notes
  const myExpenses = await prisma.expense.findMany({
    where: { 
      projectId, 
      OR: [
        { userId },
        { isNote: true }
      ]
    },
    orderBy: { createdAt: 'desc' }
  })

  // Combine direct gallery uploads and chat media into a unified gallery with unique IDs
  const unifiedGallery = [
    ...(project.gallery || []),
    ...(chatMessages.flatMap((m: any) => m.media || []).map((m: any) => ({
      ...m,
      isFromChat: true
    })))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

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
          panelBase: "/admin/operador"
        })}
      />
    </div>
  )
}
