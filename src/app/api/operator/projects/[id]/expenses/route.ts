import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = Number(id)
    const userId = Number(session.user.id)

    // Check if user is in team or is admin
    const userRole = (session.user as any).role
    const isAdmin = ['ADMIN', 'ADMINISTRADORA', 'SUPERADMIN'].includes(userRole)
    
    if (!isAdmin) {
      const isMember = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId, userId } }
      })
      if (!isMember) return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 })
    }

    // Get expenses for this specific operator + public notes
    const expenses = await prisma.expense.findMany({
      where: {
        projectId,
        OR: isAdmin ? undefined : [
          { userId },
          { isNote: true }
        ]
      },
      orderBy: { date: 'desc' },
      include: {
        user: { select: { name: true } }
      }
    })

    const safeExpenses = expenses.map(e => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date.toISOString(),
      isNote: e.isNote,
      userName: e.user?.name || 'Operador',
      chatMessageId: (e as any).chatMessageId || null
    }))

    return NextResponse.json(safeExpenses)
  } catch (error) {
    console.error('[API Operator Expenses GET Error]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
