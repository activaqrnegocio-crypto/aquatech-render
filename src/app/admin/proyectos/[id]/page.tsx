import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { isAdmin, canAccessProject } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ProjectDetailClient from './ProjectDetailClient'

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
        select: { id: true, url: true, filename: true, mimeType: true, createdAt: true }
      },
      expenses: { 
        orderBy: { date: 'desc' },
        select: { id: true, amount: true, description: true, date: true, isNote: true, category: true, receiptUrl: true, userId: true, createdAt: true, user: { select: { name: true } } }
      },
      chatMessages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { 
          user: { select: { id: true, name: true, role: true } }, 
          media: { select: { id: true, url: true, filename: true, mimeType: true } }
        }
      }
    }
  })

  if (!project) notFound()

  // Guard: Admin or Team Member
  if (!canAccessProject(session.user as any, project.team)) {
    redirect('/admin')
  }

  const availableOperators = await prisma.user.findMany({
    where: { role: { in: ['OPERATOR', 'SUBCONTRATISTA'] }, isActive: true },
    select: { id: true, name: true, phone: true }
  })

  // Serialize to plain JSON to handle Prisma Decimal objects
  const serializedProject = JSON.parse(JSON.stringify(project))

  return <ProjectDetailClient project={serializedProject} availableOperators={availableOperators} />
}
