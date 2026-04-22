import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/mail'
import { isAdmin } from '@/lib/rbac'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const userRole = (session.user as any).role
    const hasAccess = isAdmin(userRole) || userRole === 'OPERATOR' || userRole === 'OPERADOR'
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const roles = searchParams.get('roles')

    const currentUserRole = (session.user as any).role
    const isSuperAdmin = currentUserRole === 'SUPERADMIN'

    // Always filter by isActive: true to hide "deleted" (renamed) users
    const whereClause: any = { isActive: true }
    
    // HIDE SUPERADMINS from everyone except Superadmins
    if (!isSuperAdmin) {
      whereClause.role = { not: 'SUPERADMIN' }
    } else {
      // Superadmin sees even deleted if they want? No, keep isActive logic
      whereClause.isActive = true
    }

    if (roles) {
      // If filtering by specific roles, we still respect the Superadmin hiding rule
      const requestedRoles = roles.split(',')
      const validRoles = ['SUPERADMIN', 'ADMIN', 'ADMINISTRADORA', 'OPERATOR', 'SUBCONTRATISTA']
      
      whereClause.role = { 
        in: requestedRoles.filter(r => validRoles.includes(r) && (isSuperAdmin || r !== 'SUPERADMIN'))
      }
    } else if (role) {
      if (role === 'SUPERADMIN' && !isSuperAdmin) {
        return NextResponse.json([]) // Non-superadmins see nothing if they ask for superadmins
      }
      whereClause.role = role
    }

    // Hide their own profile if the user is an ADMINISTRADORA
    // But Superadmin ALWAYS sees everyone
    if (currentUserRole === 'ADMINISTRADORA' && !isSuperAdmin) {
      whereClause.id = { ...whereClause.id, not: Number(session.user.id) }
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
        branch: true,
        permissions: true,
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
        branch: (user as any).branch || null,
        permissions: (user as any).permissions || null,
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
    const isSuperAdmin = currentUserRole === 'SUPERADMIN'
    const isAdminPrivileged = session?.user && (isSuperAdmin || currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA')
    
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Solo el Super Administrador puede crear nuevos miembros.' }, { status: 403 })
    }

    const { name, username, password, role, email, phone, image, branch, permissions } = await request.json()

    if (!name || !username || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // --- RBAC RULES FOR ROLE CREATION ---
    // Only SUPERADMIN can create ADMIN or ADMINISTRADORA or other SUPERADMINS
    const higherRoles = ['SUPERADMIN', 'ADMIN', 'ADMINISTRADORA']
    if (higherRoles.includes(role) && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo el Super Administrador puede crear cuentas de administración.' }, { status: 403 })
    }

    // Check if username is truly taken by an ACTIVE user
    const existingUser = await prisma.user.findFirst({
      where: { username, isActive: true }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está activo en el sistema.' }, { status: 400 })
    }

    // Check if email is already taken by an ACTIVE user
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email, isActive: true }
      })

      if (existingEmail) {
        return NextResponse.json({ error: 'Este correo electrónico ya está registrado en el sistema.' }, { status: 400 })
      }
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
        branch: branch || null,
        permissions: permissions || null,
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
    // If we still get a P2002 here, it means we missed an inactive one or a race condition occurred
    if (error.code === 'P2002') {
      const target = error.meta?.target || ''
      if (typeof target === 'string' && target.includes('email')) {
        return NextResponse.json({ error: 'Error: El correo electrónico ya está en uso.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Error: El nombre de usuario ya está en uso.' }, { status: 400 })
    }
    return NextResponse.json({ 
      error: 'Error al registrar miembro en el servidor.'
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const currentUserRole = (session?.user as any)?.role
    const isSuperAdmin = currentUserRole === 'SUPERADMIN'
    const isAdminPrivileged = session?.user && (isSuperAdmin || currentUserRole === 'ADMIN' || currentUserRole === 'ADMINISTRADORA')
    
    if (!isAdminPrivileged) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    const userIdToDelete = Number(id)
    if (userIdToDelete === Number(session.user.id)) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    // --- RBAC RULES FOR DELETION ---
    const userToDeactivate = await prisma.user.findUnique({ where: { id: userIdToDelete } })
    if (!userToDeactivate) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // RBAC: Only SUPERADMIN can delete another Admin (ADMIN/ADMINISTRADORA)
    const protectedRoles = ['SUPERADMIN' as any, 'ADMIN' as any, 'ADMINISTRADORA' as any]
    if (protectedRoles.includes(userToDeactivate.role) && !isSuperAdmin) {
      return NextResponse.json({ 
        error: 'No tienes permisos para eliminar a otro Administrador. Solo el Super Administrador puede realizar esta acción.' 
      }, { status: 403 })
    }

    // 1. Find a recipient for the data (First active SUPERADMIN or high-level admin)
    const recipientAdmin = await prisma.user.findFirst({
      where: { 
        role: { in: ['SUPERADMIN', 'ADMIN', 'ADMINISTRADORA'] as any }, 
        isActive: true 
      },
      orderBy: { id: 'asc' }
    })
    
    // Safety check: If for some reason we cannot find any active admin, we must abort
    if (!recipientAdmin) {
      console.error('No active admin found to inherit data from user:', userIdToDelete)
      return NextResponse.json({ error: 'No se encontró un administrador activo para reasignar los datos.' }, { status: 500 })
    }
    
    const adminId = recipientAdmin.id 
    const originalName = userToDeactivate.name

    // 2. Data Inheritance Transaction
    try {
      await prisma.$transaction(async (tx) => {
        const authorNote = ` [Autor org: ${originalName}]`

        // --- 1. APPOINTMENTS ---
        await tx.appointment.updateMany({
          where: { userId: userIdToDelete },
          data: { userId: adminId }
        })

        // --- 2-5. HISTORICAL LOGS ---
        // We NO LONGER reassign ChatMessages, Expenses, DayRecords, or PhaseCompletions.
        // We keep them tied to the deactivated user so their specific name is still displayed natively.

        // --- 6. PROJECTS (As Creator) ---
        await tx.project.updateMany({
          where: { createdBy: userIdToDelete },
          data: { createdBy: adminId }
        })

        // --- 7. QUOTES (As Creator) ---
        await tx.quote.updateMany({
          where: { userId: userIdToDelete },
          data: { userId: adminId }
        })

        // --- 8. BLOG POSTS ---
        await tx.blogPost.updateMany({
          where: { authorId: userIdToDelete },
          data: { authorId: adminId }
        })

        // --- 9. CONTENT PIPELINES ---
        await tx.contentPipeline.updateMany({
          where: { createdById: userIdToDelete },
          data: { createdById: adminId }
        })

        // --- 10. PROJECT TEAM ASSIGNMENTS ---
        await tx.projectTeam.deleteMany({
          where: { userId: userIdToDelete }
        })

        // Determine new name
        let deletedName = originalName
        if (userToDeactivate.role === 'OPERATOR' || userToDeactivate.role === 'SUBCONTRATISTA') {
          deletedName = `Admin Aquatech/ Operador ${originalName}`
        } else if (userToDeactivate.role === 'ADMIN' || userToDeactivate.role === 'ADMINISTRADORA' || userToDeactivate.role === 'SUPERADMIN') {
          deletedName = `${originalName} Administrador`
        }

        // 3. Deactivate User and Free Credentials
        await tx.user.update({
          where: { id: userIdToDelete },
          data: { 
            name: deletedName,
            isActive: false,
            email: `${userToDeactivate.email || ''}_del_${Date.now()}`, 
            username: `${userToDeactivate.username}_old_${Date.now()}`,
            sessionVersion: { increment: 1 } // Invalidate existing sessions
          }
        })
      }, { timeout: 20000 }) // High timeout for data-heavy reassignments
    } catch (txError) {
      console.error('Transaction failed during user deactivation:', txError)
      throw txError // Let the outer catch handle it
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Error al desactivar miembro' }, { status: 500 })
  }
}
