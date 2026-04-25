import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLocalNow, forceEcuadorTZ } from '@/lib/date-utils'
import { isAdmin, isOperator } from '@/lib/rbac'
import { notifyUser, notifyAdmins } from '@/lib/push'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { uploadToBunny } from '@/lib/bunny'

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
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        estimatedBudget: true,
        client: { select: { name: true } },
        phases: { select: { status: true, estimatedDays: true } },
        team: { select: { id: true, userId: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch views for this user
    const views = await prisma.projectView.findMany({
      where: { userId: Number(userId), projectId: { in: projects.map(p => p.id) } }
    })

    // Map to include unreadCount
    const unreadCountsMap: Record<number, number> = {}

    if (projects.length > 0) {
      const projectIds = projects.map(p => p.id)
      
      // Use a single query with LEFT JOIN to count unread messages efficiently
      const sql = `
        SELECT cm.project_id as projectId, CAST(COUNT(*) AS UNSIGNED) as count
        FROM chat_messages cm
        LEFT JOIN project_views pv ON cm.project_id = pv.project_id AND pv.user_id = ${Number(userId)}
        WHERE cm.user_id != ${Number(userId)}
        AND cm.project_id IN (${projectIds.join(',')})
        AND (pv.last_seen IS NULL OR cm.created_at > pv.last_seen)
        GROUP BY cm.project_id
      `
      try {
        const results: any[] = await prisma.$queryRawUnsafe(sql)
        results.forEach(r => {
          unreadCountsMap[r.projectId] = Number(r.count)
        })
      } catch (err) {
        console.error("Error fetching unread counts:", err)
      }
    }

    const projectsWithCounts = projects.map((project) => ({
      ...project,
      unreadCount: unreadCountsMap[project.id] || 0
    }))

    return NextResponse.json(projectsWithCounts)
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
      return NextResponse.json({ error: 'Faltan campos obligatorios. Asegúrese de ingresar el título y de tener un cliente seleccionado o creado.' }, { status: 400 })
    }

    if (!budgetItems || budgetItems.length === 0) {
      return NextResponse.json({ error: 'Es obligatorio incluir los ítems de la cotización para crear el proyecto.' }, { status: 400 })
    }

    // 0. Idempotency check: Don't create same project for same user/client in last 60s
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const existingRecentProject = await prisma.project.findFirst({
      where: {
        title,
        createdBy: Number(userId),
        clientId: clientId ? Number(clientId) : undefined,
        createdAt: { gte: sixtySecondsAgo }
      }
    });

    if (existingRecentProject) {
      console.log(`[IDEMPOTENCY] Project "${title}" already created recently (ID: ${existingRecentProject.id})`);
      return NextResponse.json(existingRecentProject, { status: 201 }); // Return existing instead of erroring
    }

    // 0.1 Handle Base64 files before transaction
    const processedFiles: any[] = [];
    if (data.files && Array.isArray(data.files)) {
      for (const file of data.files) {
        if (typeof file.url === 'string' && file.url.startsWith('data:')) {
          try {
            const matches = file.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const buffer = Buffer.from(matches[2], 'base64');
              const bunnyUrl = await uploadToBunny(buffer, file.filename || 'upload.jpg', 'projects');
              processedFiles.push({ ...file, url: bunnyUrl });
            } else {
              processedFiles.push(file);
            }
          } catch (err) {
            console.error('Error uploading base64 file to Bunny:', err);
            processedFiles.push(file);
          }
        } else {
          processedFiles.push(file);
        }
      }
    }

    const project = await prisma.$transaction(async (tx) => {
      // 1. Get or Create Client
      let targetClientId = clientId ? Number(clientId) : null

      if (!targetClientId && client?.name) {
        // Prevent creating duplicate clients by name (e.g. CONSUMIDOR FINAL)
        const existingClient = await tx.client.findFirst({
          where: { name: client.name }
        })

        if (existingClient) {
          targetClientId = existingClient.id
        } else {
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
      }

      // 2. Map Legacy Type from CategoryList if needed
      let mappedType = (categoryList && Array.isArray(categoryList) && categoryList.length > 0) 
        ? categoryList[0] 
        : (type || 'OTRO')
        
      const validTypes = ['PISCINA', 'JACUZZI', 'BOMBAS', 'TRATAMIENTO', 'RIEGO', 'CALENTAMIENTO', 'CONTRA_INCENDIOS', 'MANTENIMIENTO', 'INSTALLATION', 'REPAIR', 'OTRO']
      if (!validTypes.includes(mappedType)) {
        mappedType = 'OTRO'
      }

      // 3. Create Project
      const newProject = await tx.project.create({
        data: {
          title,
          type: mappedType as any,
          subtype: subtype || null,
          status: status || 'LEAD',
          startDate: startDate ? new Date(forceEcuadorTZ(startDate)) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          address: address || null,
          city: city || null,
          clientId: targetClientId,
          createdBy: Number(userId),
          estimatedBudget: budgetItems ? budgetItems.reduce((acc: number, item: any) => {
            const qty = item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)
            const sub = (qty * Number(item.estimatedCost || 0))
            const iva = item.isTaxed ? (sub * 0.15) : 0
            return acc + sub + iva
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
            create: (team || []).map((id: string | number) => ({
              userId: Number(id)
            }))
          },
          
          gallery: {
            create: (processedFiles).map((file: any) => ({
              url: file.url,
              filename: file.filename || 'upload',
              mimeType: file.mimeType || 'application/octet-stream',
              sizeBytes: file.size || file.sizeBytes || null,
              category: file.category || 'MASTER'
            }))
          }
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
            clientName: client?.name || '',
            clientRuc: client?.ruc || '',
            clientAddress: client?.address || '',
            clientPhone: client?.phone || '',

            // Financial summary - Calculate with actual item data
            subtotal: (budgetItems || []).reduce((acc: number, item: any) => acc + ((item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0)), 0),
            subtotal0: (budgetItems || []).filter((item: any) => !item.isTaxed).reduce((acc: number, item: any) => acc + ((item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0)), 0),
            subtotal15: (budgetItems || []).filter((item: any) => item.isTaxed).reduce((acc: number, item: any) => acc + ((item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0)), 0),
            ivaAmount: (budgetItems || []).filter((item: any) => item.isTaxed).reduce((acc: number, item: any) => acc + ((item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0) * 0.15), 0),
            discountTotal: 0,
            totalAmount: newProject.estimatedBudget,

            items: {
              create: (budgetItems || []).map((item: any) => ({
                materialId: item.materialId ? Number(item.materialId) : null,
                description: item.name || 'Sin descripción',
                quantity: item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0),
                unitPrice: Number(item.estimatedCost || 0),
                total: (item.quantity === 'GLOBAL' ? 1 : Number(item.quantity || 0)) * Number(item.estimatedCost || 0),
                isTaxed: !!item.isTaxed,
                discountPct: 0
              }))
            }
          }
        })
      }

      return newProject
    }, { timeout: 20000 })

    // 🔔 Notification: Notify assigned team members via Push and WhatsApp
    if (team && team.length > 0) {
      const creatorId = Number(userId)
      const usersToNotify = await prisma.user.findMany({
        where: { id: { in: team.map((id: any) => Number(id)) } },
        select: { id: true, phone: true, name: true }
      });

      for (let i = 0; i < usersToNotify.length; i++) {
        const user = usersToNotify[i];
        if (user.id === creatorId) continue;

        // Web Push
        await notifyUser(
          user.id,
          '📊 Nuevo Proyecto Asignado',
          `Te asignaron al proyecto: ${title}`,
          `/admin/operador`,
          `project-new-${project.id}`
        ).catch(e => console.error('Push error:', e));

        // WhatsApp
        if (user.phone) {
          const message = `🚀 *Aquatech CRM*\nHola ${user.name},\nhas sido asignado al proyecto: *${title}*.\nPor favor, revisa la plataforma para más detalles.`;
          await sendWhatsAppMessage(user.phone, message).catch((e) => console.error('WA error:', e));
        }

        // Delay 1.5s between messages to avoid collapsing Evolution API
        if (i < usersToNotify.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // 🔔 Notification: Notify all Admins about new project
    notifyAdmins(
      '🆕 Nuevo Proyecto Creado',
      `${session.user.name} creó: ${title}`,
      `/admin/proyectos/${project.id}`,
      `new-project-${project.id}`
    ).catch(e => console.error('Admin notify error:', e));

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Error creating project:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Error: Entrada duplicada (nombre de cliente ya existe, intente usar el buscador).' }, { status: 400 })
    }
    if (error.code === 'P2024' || error.message?.includes('timed out') || error.message?.includes('connection')) {
      return NextResponse.json({ error: 'La base de datos MySQL tardó demasiado en responder o está saturada. Por favor, reintente en unos momentos.' }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: 'Error de Servidor BD: ' + (error?.message || 'Contacte al desarrollador'), 
      details: error 
    }, { status: 500 })
  }
}
