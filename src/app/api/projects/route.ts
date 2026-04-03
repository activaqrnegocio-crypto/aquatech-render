import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLocalNow } from '@/lib/date-utils'
import { isAdmin, isOperator } from '@/lib/rbac'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    // For operators, only return their projects
    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    const whereClause: any = {}
    
    if (status && status !== 'ALL') {
      whereClause.status = status
    }

    if (isOperator(userRole)) {
      whereClause.team = {
        some: {
          userId: Number(userId)
        }
      }
      if (!whereClause.status) {
        whereClause.status = { not: 'LEAD' }
      }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: {
          select: { name: true }
        },
        creator: {
          select: { name: true }
        },
        phases: {
          select: {
            id: true,
            status: true,
            estimatedDays: true
          },
          orderBy: { displayOrder: 'asc' }
        },
        team: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id

    if (!isAdmin(userRole) && !isOperator(userRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isOp = isOperator(userRole)
    const data = await request.json()
    const { 
      title, type, subtype, address, city, startDate, endDate, client, 
      phases, team, budgetItems, categoryList, technicalSpecs, 
      contractTypeList, clientId, specsAudioUrl, specsTranscription, status 
    } = data

    // Validate minimum required data
    if (!title || (!client?.name && !clientId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const project = await prisma.$transaction(async (tx) => {
      // 1. Get or Create Client
      let targetClientId = clientId ? Number(clientId) : null

      if (!targetClientId && client?.name) {
        const createdClient = await tx.client.create({
          data: {
            name: client.name,
            ruc: client.ruc || null,
            email: client.email || null,
            phone: client.phone || null,
            address: client.address || null,
            city: client.city || null,
            notes: client.notes || null,
          }
        })
        targetClientId = createdClient.id
      }

      // 2. Map Legacy Type from CategoryList if needed
      const mappedType = (categoryList && Array.isArray(categoryList) && categoryList.length > 0) 
        ? categoryList[0] 
        : (type || 'OTRO')

      // 3. Create Project
      const newProject = await tx.project.create({
        data: {
          title,
          type: mappedType as any,
          subtype: subtype || null,
          status: isOp ? 'LEAD' : (status || 'ACTIVO'),
          startDate: startDate ? new Date(startDate) : getLocalNow(),
          endDate: endDate ? new Date(endDate) : null,
          address: address || null,
          city: city || null,
          clientId: targetClientId,
          createdBy: Number(userId),
          estimatedBudget: budgetItems ? budgetItems.reduce((acc: number, item: any) => {
            const qty = item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)
            return acc + (qty * Number(item.estimatedCost || 0))
          }, 0) : 0,
          categoryList: categoryList ? JSON.stringify(categoryList) : null,
          contractTypeList: contractTypeList ? JSON.stringify(contractTypeList) : null,
          technicalSpecs: technicalSpecs ? JSON.stringify(technicalSpecs) : null,
          specsAudioUrl: specsAudioUrl || null,
          specsTranscription: specsTranscription || null,
          
          budgetItems: {
            create: (budgetItems || []).map((item: any) => ({
              materialId: item.materialId ? Number(item.materialId) : null,
              name: item.name || null,
              quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0),
              unit: item.unit || (item.quantity === 'GLOBAL' ? 'GLOBAL' : 'UND'),
              estimatedCost: Number(item.estimatedCost || 0)
            }))
          },
          
          phases: {
            create: (phases || []).map((phase: any, index: number) => ({
              title: phase.title,
              description: phase.description || null,
              estimatedDays: phase.estimatedDays ? Number(phase.estimatedDays) : null,
              displayOrder: index + 1,
              status: 'PENDIENTE'
            }))
          },
          team: {
            create: (!isOp ? (team || []) : []).map((id: string | number) => ({
              userId: Number(id)
            }))
          },
          
          gallery: {
            create: (data.files || []).map((file: any) => ({
              url: file.url,
              filename: file.filename || 'upload',
              mimeType: file.mimeType || 'application/octet-stream',
              sizeBytes: file.sizeBytes || null
            }))
          }
        },
        include: {
          client: true,
          phases: true,
          team: {
            include: { user: true }
          },
          budgetItems: true
        }
      })

      // 4. Create Linked Quote
      if (budgetItems && budgetItems.length > 0) {
        const subtotal = newProject.estimatedBudget
        const quote = await tx.quote.create({
          data: {
            projectId: newProject.id,
            clientId: targetClientId as number,
            userId: Number(userId),
            status: 'BORRADOR',
            
            // Snapshot client data
            clientName: newProject.client?.name,
            clientRuc: newProject.client?.ruc,
            clientAddress: newProject.client?.address,
            clientPhone: newProject.client?.phone,

            // Financial summary (Simplified for now, match project total)
            subtotal: subtotal,
            subtotal0: subtotal, // Default to 0% for now if not specified
            subtotal15: 0,
            ivaAmount: 0,
            discountTotal: 0,
            totalAmount: subtotal,

            items: {
              create: (budgetItems || []).map((item: any) => ({
                materialId: item.materialId ? Number(item.materialId) : null,
                description: item.name || 'Sin descripción',
                quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0),
                unitPrice: Number(item.estimatedCost || 0),
                total: (item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0),
                isTaxed: false, // Default to false to match estimatedBudget simplicity
                discountPct: 0
              }))
            }
          }
        })
      }

      return newProject
    }, { timeout: 20000 })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Error creating project:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Error: Entrada duplicada detectada.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
