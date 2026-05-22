import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ProjectExecutionClient from '@/components/ProjectExecutionClient'
import { deepSerialize } from '@/lib/serializable'

export const dynamic = 'force-dynamic'

export default async function SubcontratistaProjectDetail({ params }: { params: Promise<{ id: string }> }) {
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
      gallery: { orderBy: { createdAt: 'desc' } }
    }
  })

  // If project doesn't exist or user not in team, back to dashboard
  const isInTeam = project?.team.some((t: any) => t.userId === userId)
  if (!project || !isInTeam) {
    redirect('/admin/subcontratista')
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

  // Find if user has an active day record for this project
  const activeDayRecord = await prisma.dayRecord.findFirst({
    where: { userId, projectId, endTime: null }
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

  // Combine direct gallery uploads and chat media into a unified gallery
  const unifiedGallery = [
    ...(project.gallery || []),
    ...(chatMessages.flatMap((m: any) => m.media || []).map((m: any) => ({
      ...m,
      isFromChat: true
    })))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Manually build safe objects
  const safeProject = {
    id: project.id,
    title: project.title,
    status: project.status,
    address: project.address || project.client?.address,
    phases: project.phases.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      description: p.description
    })),
    team: project.team.map(t => ({
      id: t.userId,
      name: t.user.name,
      role: t.user.role
    })),
    gallery: unifiedGallery.map(g => ({ 
      id: (g as any).isFromChat ? `chat-${g.id}` : `gal-${g.id}`, 
      url: g.url, 
      filename: g.filename, 
      mimeType: g.mimeType,
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

  const safeRecord = activeDayRecord ? { id: activeDayRecord.id, startTime: activeDayRecord.startTime.toISOString() } : null

  const safeExpenses = myExpenses.map(e => ({ 
    id: e.id, 
    description: e.description, 
    amount: Number(e.amount), 
    date: e.date.toISOString(),
    isNote: e.isNote,
    userName: (e as any).user?.name || 'Subcontratista'
  }))

  return (
    <div className="p-0 sm:p-6 pb-24">
      <ProjectExecutionClient 
        {...deepSerialize({
          project: safeProject,
          initialChat: safeChat, 
          activeRecord: safeRecord,
          expenses: safeExpenses,
          userId: userId,
          clientName: project.client?.name || 'Cliente sin nombre',
          projectAddress: project.address || project.client?.address || '',
          projectCity: project.client?.city || '',
          panelBase: "/admin/subcontratista"
        })}
      />
    </div>
  )
}
