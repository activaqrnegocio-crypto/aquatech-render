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

    // Always filter by isActive: true to hide "deleted" (renamed) users
    let whereClause: any = { isActive: true }
    if (role) {
      whereClause.role = role
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
      error: isUniqueError ? 'Error: Nombre de usuario duplicado (intenta otro).' : 'Error al registrar miembro',
      details: error.message 
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

    // Instead of just deactivating, we RENAME to free the username immediately
    const userToDeactivate = await prisma.user.findUnique({ where: { id: Number(id) } })
    if (userToDeactivate) {
      await prisma.user.update({
        where: { id: Number(id) },
        data: { 
          isActive: false,
          username: `${userToDeactivate.username}_old_${Date.now()}`
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Error al desactivar miembro' }, { status: 500 })
  }
}
