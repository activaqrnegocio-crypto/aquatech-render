import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.mediaFile.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.dayRecord.deleteMany()
  await prisma.phaseCompletion.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.budgetItem.deleteMany()
  await prisma.quoteItem.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.projectPhase.deleteMany()
  await prisma.projectTeam.deleteMany()
  await prisma.project.deleteMany()
  await prisma.client.deleteMany()
  await prisma.material.deleteMany()
  await prisma.contentPipeline.deleteMany()
  await prisma.brandConfig.deleteMany()
  await prisma.user.deleteMany()

  // Create admin user
  const adminPassword = await bcrypt.hash('Contraseña123.', 10)
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador Aquatech',
      email: 'admin@aquatech.ec',
      phone: '+593 99 123 4567',
      role: 'ADMIN',
      username: 'Aquatech',
      passwordHash: adminPassword,
    },
  })

  // Create operators
  const opPassword = await bcrypt.hash('operador123', 10)
  const op1 = await prisma.user.create({
    data: {
      name: 'Carlos Mendoza',
      email: 'carlos@aquatech.ec',
      phone: '+593 99 234 5678',
      role: 'OPERATOR',
      username: 'carlos.mendoza',
      passwordHash: opPassword,
    },
  })
  const op2 = await prisma.user.create({
    data: {
      name: 'María Fernanda López',
      email: 'maria@aquatech.ec',
      phone: '+593 99 345 6789',
      role: 'OPERATOR',
      username: 'maria.lopez',
      passwordHash: opPassword,
    },
  })
  const op3 = await prisma.user.create({
    data: {
      name: 'Jorge Ramírez',
      email: 'jorge@aquatech.ec',
      phone: '+593 99 456 7890',
      role: 'OPERATOR',
      username: 'jorge.ramirez',
      passwordHash: opPassword,
    },
  })

  // Create clients
  const client1 = await prisma.client.create({
    data: {
      name: 'Roberto Espinoza',
      email: 'roberto.espinoza@gmail.com',
      phone: '+593 99 567 8901',
      address: 'Av. Universitaria y Mercadillo',
      city: 'Loja',
      notes: 'Cliente frecuente, tiene residencia con jardín amplio',
    },
  })
  const client2 = await prisma.client.create({
    data: {
      name: 'Hacienda San Martín',
      email: 'hacienda.sanmartin@gmail.com',
      phone: '+593 99 678 9012',
      address: 'Km 12 Vía Vilcabamba',
      city: 'Vilcabamba',
      notes: 'Sistema de riego para 5 hectáreas de café',
    },
  })
  const client3 = await prisma.client.create({
    data: {
      name: 'Hotel El Cardenal',
      email: 'gerencia@hotelelcardenal.com',
      phone: '+593 99 789 0123',
      address: 'Calle Bolívar 14-23',
      city: 'Loja',
    },
  })

  // Create projects
  const project1 = await prisma.project.create({
    data: {
      title: 'Piscina Residencial Espinoza',
      type: 'PISCINA',
      subtype: 'Piscina 8x4m con cascada',
      status: 'ACTIVO',
      description: 'Construcción de piscina residencial con acabado en cerámica antideslizante, cascada decorativa y sistema de filtrado SPIN.',
      address: 'Av. Universitaria y Mercadillo',
      city: 'Loja',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-05-15'),
      estimatedBudget: 12500.00,
      realCost: 3200.00,
      clientId: client1.id,
    },
  })
  const project2 = await prisma.project.create({
    data: {
      title: 'Sistema de Riego Hacienda San Martín',
      type: 'RIEGO',
      subtype: 'Riego por goteo automatizado',
      status: 'ACTIVO',
      description: 'Instalación de sistema de riego por goteo para 5 hectáreas de café, incluye bomba Pedrollo, timer y tanque de 2500L.',
      address: 'Km 12 Vía Vilcabamba',
      city: 'Vilcabamba',
      startDate: new Date('2026-03-20'),
      endDate: new Date('2026-04-20'),
      estimatedBudget: 8500.00,
      realCost: 1500.00,
      clientId: client2.id,
    },
  })
  const project3 = await prisma.project.create({
    data: {
      title: 'Spa Hotel El Cardenal',
      type: 'JACUZZI',
      subtype: 'Jacuzzi + Sauna + Turco',
      status: 'LEAD',
      description: 'Diseño y construcción de área de spa completa para el hotel.',
      address: 'Calle Bolívar 14-23',
      city: 'Loja',
      estimatedBudget: 25000.00,
      leadNotes: 'El gerente quiere ver presupuesto primero. Visitamos el sitio el martes.',
      clientId: client3.id,
    },
  })
  const project4 = await prisma.project.create({
    data: {
      title: 'Mantenimiento Piscina Municipal',
      type: 'MANTENIMIENTO',
      status: 'COMPLETADO',
      description: 'Mantenimiento trimestral de piscina olímpica municipal',
      city: 'Loja',
      estimatedBudget: 2000.00,
      realCost: 1850.00,
      clientId: client1.id,
    },
  })

  // Project phases
  await prisma.projectPhase.createMany({
    data: [
      { projectId: project1.id, title: 'Excavación y obra gris', description: 'Excavación del terreno, armado de estructura y vertido de hormigón armado', estimatedHours: 80, displayOrder: 1, status: 'COMPLETADA', startedAt: new Date('2026-03-15'), completedAt: new Date('2026-03-25') },
      { projectId: project1.id, title: 'Instalación hidráulica', description: 'Colocación de tuberías PVC, skimmers, boquillas de retorno y desagüe de fondo', estimatedHours: 40, displayOrder: 2, status: 'EN_PROGRESO', startedAt: new Date('2026-03-26') },
      { projectId: project1.id, title: 'Sistema de filtrado y bombeo', description: 'Instalación de bomba SPIN 1.5HP, filtro de arena, y conexiones eléctricas', estimatedHours: 24, displayOrder: 3 },
      { projectId: project1.id, title: 'Acabados y cascada', description: 'Colocación de cerámica antideslizante, grifería cascada y pintura', estimatedHours: 48, displayOrder: 4 },
      { projectId: project2.id, title: 'Estudio de terreno', description: 'Levantamiento topográfico y diseño del sistema', estimatedHours: 16, displayOrder: 1, status: 'COMPLETADA', completedAt: new Date('2026-03-22') },
      { projectId: project2.id, title: 'Instalación de tanque y bomba', description: 'Colocación de tanque Rotoplas 2500L y bomba Pedrollo sumergible', estimatedHours: 24, displayOrder: 2, status: 'EN_PROGRESO', startedAt: new Date('2026-03-23') },
      { projectId: project2.id, title: 'Tendido de mangueras y goteros', description: 'Instalación de líneas principales y goteros en 5 hectáreas', estimatedHours: 60, displayOrder: 3 },
      { projectId: project2.id, title: 'Timer y pruebas', description: 'Programación del timer automático y pruebas de presión', estimatedHours: 8, displayOrder: 4 },
    ],
  })

  // Assign team
  await prisma.projectTeam.createMany({
    data: [
      { projectId: project1.id, userId: op1.id },
      { projectId: project1.id, userId: op2.id },
      { projectId: project2.id, userId: op1.id },
      { projectId: project2.id, userId: op3.id },
    ],
  })

  // Create some expenses
  await prisma.expense.createMany({
    data: [
      { projectId: project1.id, userId: op1.id, amount: 1200.00, description: 'Cemento, arena y grava para estructura', category: 'MATERIAL', date: new Date('2026-03-16') },
      { projectId: project1.id, userId: op1.id, amount: 800.00, description: 'Varillas de acero y malla electrosoldada', category: 'MATERIAL', date: new Date('2026-03-17') },
      { projectId: project1.id, userId: op2.id, amount: 350.00, description: 'Transporte de materiales pesados', category: 'TRANSPORTE', date: new Date('2026-03-16') },
      { projectId: project1.id, userId: op1.id, amount: 450.00, description: 'Tubería PVC y accesorios hidráulicos', category: 'MATERIAL', date: new Date('2026-03-26') },
      { projectId: project1.id, userId: op2.id, amount: 400.00, description: 'Jornales auxiliares excavación', category: 'MANO_OBRA', date: new Date('2026-03-15') },
      { projectId: project2.id, userId: op3.id, amount: 900.00, description: 'Tanque Rotoplas 2500L', category: 'MATERIAL', date: new Date('2026-03-23') },
      { projectId: project2.id, userId: op3.id, amount: 600.00, description: 'Bomba Pedrollo sumergible', category: 'EQUIPO', date: new Date('2026-03-23') },
    ],
  })

  // Create some chat messages
  const phases = await prisma.projectPhase.findMany({ where: { projectId: project1.id }, orderBy: { displayOrder: 'asc' } })
  
  await prisma.chatMessage.createMany({
    data: [
      { projectId: project1.id, phaseId: phases[0].id, userId: op1.id, content: 'Excavación completada. Profundidad 1.8m, dimensiones 8x4m confirmadas.', type: 'TEXT', createdAt: new Date('2026-03-18T09:30:00') },
      { projectId: project1.id, phaseId: phases[0].id, userId: op2.id, content: 'Estructura de hormigón armado vertida. Esperando fraguado 48hrs.', type: 'TEXT', createdAt: new Date('2026-03-20T14:15:00') },
      { projectId: project1.id, phaseId: phases[0].id, userId: op1.id, content: 'Fase 1 completada. Estructura lista para instalación hidráulica.', type: 'PHASE_COMPLETE', createdAt: new Date('2026-03-25T16:00:00') },
      { projectId: project1.id, phaseId: phases[1].id, userId: op1.id, content: 'Iniciando instalación de tuberías PVC. Conexión principal al sistema de agua realizada.', type: 'TEXT', createdAt: new Date('2026-03-26T08:00:00') },
      { projectId: project1.id, phaseId: phases[1].id, userId: op2.id, content: 'Skimmers colocados en posición. Falta conectar boquillas de retorno.', type: 'TEXT', createdAt: new Date('2026-03-26T15:30:00') },
    ],
  })

  // Some materials for the catalog
  await prisma.material.createMany({
    data: [
      { code: 'BOM-SPIN-1.5', name: 'Bomba SPIN 1.5HP', unit: 'unidad', unitPrice: 380.00, category: 'Bombas', stock: 5 },
      { code: 'BOM-PED-SUM', name: 'Bomba Pedrollo Sumergible', unit: 'unidad', unitPrice: 620.00, category: 'Bombas', stock: 3 },
      { code: 'FIL-ARENA-24', name: 'Filtro de Arena 24"', unit: 'unidad', unitPrice: 450.00, category: 'Filtración', stock: 4 },
      { code: 'TUB-PVC-2', name: 'Tubería PVC 2" (6m)', unit: 'tubo', unitPrice: 12.50, category: 'Tuberías', stock: 100 },
      { code: 'TUB-PVC-3', name: 'Tubería PVC 3" (6m)', unit: 'tubo', unitPrice: 18.75, category: 'Tuberías', stock: 60 },
      { code: 'SKI-STD', name: 'Skimmer Standard', unit: 'unidad', unitPrice: 85.00, category: 'Accesorios Piscina', stock: 12 },
      { code: 'BOQ-RET', name: 'Boquilla de Retorno', unit: 'unidad', unitPrice: 35.00, category: 'Accesorios Piscina', stock: 20 },
      { code: 'LED-SUB-RGB', name: 'Luz LED Subacuática RGB', unit: 'unidad', unitPrice: 95.00, category: 'Iluminación', stock: 15 },
      { code: 'CLO-SPIN-5', name: 'Cloro SPIN Clin Clor 5kg', unit: 'galón', unitPrice: 28.00, category: 'Químicos', stock: 30 },
      { code: 'GOT-16MM', name: 'Manguera Gotero 16mm (100m)', unit: 'rollo', unitPrice: 45.00, category: 'Riego', stock: 25 },
      { code: 'TMR-RIEGO', name: 'Timer Programable Riego', unit: 'unidad', unitPrice: 120.00, category: 'Riego', stock: 8 },
      { code: 'TAN-ROT-2500', name: 'Tanque Rotoplas 2500L', unit: 'unidad', unitPrice: 380.00, category: 'Almacenamiento', stock: 6 },
    ],
  })

  // Create BrandConfig
  await prisma.brandConfig.create({
    data: {
      name: 'Aquatech Principal',
      imagePrompt: 'Genera una imagen fotográfica profesional, realista, luminosa, tema de piscinas cristalinas, spas o sistemas hidráulicos. Usa una paleta con acentos en azul turquesa (#0891b2) y tonos limpios.',
      brandColors: '["#0891b2", "#ffffff", "#f8fafc", "#334155"]',
      typography: 'Inter, sans-serif',
      isActive: true,
      additionalNotes: 'Evitar incluir texto en la imagen. Priorizar agua limpia y ambientes soleados o iluminación profesional.',
    }
  })

  console.log('✅ Seed completed successfully!')
  console.log(`   Admin: Aquatech / Contraseña123.`)
  console.log(`   Operators: carlos.mendoza, maria.lopez, jorge.ramirez / operador123`)
  console.log(`   Projects: ${4} created`)
  console.log(`   Materials: ${12} created`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
