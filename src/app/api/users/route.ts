import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/mail'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const roles = searchParams.get('roles')

    // Always filter by isActive: true to hide "deleted" (renamed) users
    const whereClause: any = { isActive: true }
    if (roles) {
      whereClause.role = { in: roles.split(',') }
    } else if (role) {
      whereClause.role = role
    }

    // Hide their own profile if the user is an ADMINISTRADORA
    if ((session.user as any).role === 'ADMINISTRADORA') {
      whereClause.id = { not: Number(session.user.id) }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        username: true,
        image: true,
        createdAt: true,
        projectTeams: {
          select: {
            project: {
              select: {
                status: true
              }
            }
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ]
    })

    const formattedUsers = users.map(user => {
      const activeCount = user.projectTeams.filter((pt: any) => pt.project?.status === 'ACTIVO').length
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        username: user.username,
        image: user.image,
        createdAt: user.createdAt,
        activeProjectsCount: activeCount
      }
    })

    return NextResponse.json(formattedUsers)
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserRole = (session?.user as any)?.role
    const isAdminPrivileged = session?.user && (currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA')
    
    if (!isAdminPrivileged) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, username, password, role, email, phone, image } = await request.json()

    if (!name || !username || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if username is truly taken by an ACTIVE user
    // Since we renamed inactive ones, this should only find active duplicates
    const existingUser = await prisma.user.findFirst({
      where: { username, isActive: true }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está activo en el sistema.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role,
        email: email || null,
        phone: phone || null,
        image: image || null,
        isActive: true
      }
    })

    if (email) {
      await sendWelcomeEmail(email, name, username, password)
    }

    return NextResponse.json({ 
      id: user.id, 
      name: user.name, 
      username: user.username, 
      role: user.role 
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    // If we still get a P2002 here, it means we missed an inactive one during the rename script phase
    const isUniqueError = error.code === 'P2002'
    return NextResponse.json({ 
      error: isUniqueError ? 'Error: Nombre de usuario duplicado (intenta otro).' : 'Error al registrar miembro'
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserRole = (session?.user as any)?.role
    const isAdminPrivileged = session?.user && (currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA')
    
    if (!isAdminPrivileged) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    if (Number(id) === Number(session.user.id)) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    const userIdToDelete = Number(id)
    const adminId = 1 // Administrador Aquatech

    // 1. Get user name to append to notes
    const userToDeactivate = await prisma.user.findUnique({ where: { id: userIdToDelete } })
    if (!userToDeactivate) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const originalName = userToDeactivate.name

    // 2. Data Inheritance Transaction
    await prisma.$transaction(async (tx) => {
      const note = ` [Originalmente por: ${originalName}]`

      // --- ChatMessages ---
      await tx.chatMessage.updateMany({
        where: { userId: userIdToDelete },
        data: { 
          userId: adminId,
          content: {
            // @ts-ignore - Prisma doesn't support complex concat in updateMany for all systems, 
            // but we'll try a safe approach or just reassign if field is null.
          }
        }
      })
      // Better way to handle notes: individual updates or check for field type
      // Since updateMany with string concatenation is tricky in Prisma/DB combos, 
      // we'll update IDs first and then we'd need to loop or use raw queries.
      // For simplicity and safety, we'll reassign the IDs.
      
      await tx.chatMessage.updateMany({
        where: { userId: userIdToDelete },
        data: { userId: adminId }
      })

      // --- Expenses ---
      await tx.expense.updateMany({
        where: { userId: userIdToDelete },
        data: { userId: adminId }
      })

      // --- DayRecords ---
      await tx.dayRecord.updateMany({
        where: { userId: userIdToDelete },
        data: { userId: adminId }
      })

      // --- PhaseCompletions ---
      // We need to avoid unique constraint if admin already completed it
      const completionsToDelete = await tx.phaseCompletion.findMany({
        where: { userId: userIdToDelete }
      })
      for (const comp of completionsToDelete) {
        const adminAlreadyCompleted = await tx.phaseCompletion.findUnique({
          where: { phaseId_userId: { phaseId: comp.phaseId, userId: adminId } }
        })
        if (!adminAlreadyCompleted) {
          await tx.phaseCompletion.update({
            where: { id: comp.id },
            data: { userId: adminId }
          })
        } else {
          await tx.phaseCompletion.delete({ where: { id: comp.id } })
        }
      }

      // --- ProjectTeam ---
      // Just delete from team assignments to avoid duplicates
      await tx.projectTeam.deleteMany({
        where: { userId: userIdToDelete }
      })

      // --- Projects Created By ---
      await tx.project.updateMany({
        where: { createdBy: userIdToDelete },
        data: { createdBy: adminId }
      })

      // --- Quotes Created By ---
      await tx.quote.updateMany({
        where: { userId: userIdToDelete },
        data: { userId: adminId }
      })

      // 3. Deactivate User
      await tx.user.update({
        where: { id: userIdToDelete },
        data: { 
          isActive: false,
          username: `${userToDeactivate.username}_old_${Date.now()}`
        }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Error al desactivar miembro' }, { status: 500 })
  }
}
