import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    const { isAdmin } = await import('@/lib/rbac')
    if (!session || !isAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = Number(id)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        username: true,
        displayPassword: true,
        branch: true,
        permissions: true,
        createdAt: true,
        isActive: true,
        projectTeams: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                status: true,
                type: true,
                createdAt: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            assignedAt: 'desc'
          }
        },
        _count: {
          select: {
            chatMessages: true,
            expenses: true,
            dayRecords: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Format the response
    const formattedUser = {
      ...user,
      projects: user.projectTeams.map((pt: any) => ({
        ...pt.project,
        assignedAt: pt.assignedAt
      })),
      stats: {
        totalMessages: user._count.chatMessages,
        totalExpenses: user._count.expenses,
        totalDayRecords: user._count.dayRecords
      }
    }

    // Explicitly remove the internal mapping field to avoid confusion
    delete (formattedUser as any).projectTeams
    delete (formattedUser as any)._count

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    const { isAdmin } = await import('@/lib/rbac')
    if (!session || !isAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, phone, branch, role, permissions } = await request.json()
    const userId = Number(id)

    // Security check: only superadmins can change roles
    const updateData: any = {
      name,
      email,
      phone,
      branch,
      permissions
    }

    if (role && (session.user as any).role === 'SUPERADMIN') {
      updateData.role = role
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        branch: true,
        permissions: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Error updating user' }, { status: 500 })
  }
}
