import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { isAdmin, canAccessProject } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ProjectDetailClient from './ProjectDetailClient'
import { deepSerialize } from '@/lib/serializable'

export const dynamic = 'force-dynamic'

export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  const projectId = Number(id)
  
  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      client: {
        select: { id: true, name: true, ruc: true, phone: true, email: true, city: true, address: true }
      },
      phases: { 
        orderBy: { displayOrder: 'asc' },
        select: { id: true, title: true, description: true, status: true, displayOrder: true, estimatedDays: true, estimatedHours: true, startedAt: true, completedAt: true }
      },
      team: { include: { user: { select: { id: true, name: true, phone: true, role: true } } } },
      gallery: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, url: true, filename: true, mimeType: true, category: true, createdAt: true }
      },
      chatMessages: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { 
          user: { select: { id: true, name: true, role: true } }, 
          media: { select: { id: true, url: true, filename: true, mimeType: true } }
        }
      }
    }
  })

  if (!project) notFound()

  // Guard: Admin, Creator or Team Member
  if (!canAccessProject(session.user as any, project.team, project.createdBy ?? undefined)) {
    redirect('/admin')
  }

  const availableOperators = await prisma.user.findMany({
    where: { role: { in: ['OPERATOR', 'SUBCONTRATISTA'] }, isActive: true },
    select: { id: true, name: true, phone: true }
  })

  // Mark as seen for this user
  await prisma.projectView.upsert({
    where: { 
      userId_projectId: { 
        userId: Number(session.user.id), 
        projectId 
      } 
    },
    create: { 
      userId: Number(session.user.id), 
      projectId,
      lastSeen: new Date()
    },
    update: { 
      lastSeen: new Date() 
    }
  })

  // Serialize to plain JSON using fast serializer
  const serializedProject = deepSerialize(project)

  return <ProjectDetailClient project={serializedProject} availableOperators={availableOperators} />
}
