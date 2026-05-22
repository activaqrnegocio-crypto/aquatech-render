import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import BitacoraClient from './BitacoraClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BitacoraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  
  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      phases: { orderBy: { displayOrder: 'asc' } },
      chatMessages: {
        orderBy: { createdAt: 'desc' },
        include: { 
          user: true, 
          phase: true,
          media: true 
        }
      }
    }
  })

  if (!project) notFound()

  // Serialize to plain JSON
  const serializedProject = JSON.parse(JSON.stringify(project))

  return <BitacoraClient project={serializedProject} isAdmin={session.user.role === 'ADMIN'} />
}
