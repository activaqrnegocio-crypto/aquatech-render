import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runStressTest() {
  console.log('🚀 Iniciando Prueba de Estrés de Alto Volumen...\n');

  try {
    // 1. Obtener o crear usuarios de prueba
    console.log('Buscando usuarios de prueba...');
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
    let operator = await prisma.user.findFirst({ where: { role: 'OPERATOR' } });

    if (!admin || !operator) {
      console.log('⚠️ Requieres al menos un rol ADMIN y un OPERATOR en la base de datos para simular.');
      return;
    }

    // 2. Comprobar la latencia y rendimiento de inserciones de Chat (500 interacciones rápidas)
    console.log(`\n============================`);
    console.log(`1. PRUEBA DE VOLUMEN (500 Interacciones en 1 Proyecto)`);
    console.log(`============================`);
    
    console.time('Tiempo en crear Proyecto Destino');
    let testProject = await prisma.project.create({
      data: {
        title: '[STRESS TEST] Proyecto de Alta Carga',
        status: 'ACTIVO',
        type: 'INSTALLATION',
        createdBy: admin.id,
      }
    });
    console.timeEnd('Tiempo en crear Proyecto Destino');

    console.log('Generando 500 mensajes de interacciones/log de campo...');
    const messagePayloads = Array.from({ length: 500 }).map((_, i) => ({
      projectId: testProject.id,
      userId: operator!.id,
      content: `Reporte automatizado #${i} desde campo (coordenadas incluidas).`,
      type: 'TEXT' as any,
      createdAt: new Date(Date.now() - i * 1000) // Tiempos escalonados
    }));

    console.time('Tiempo en Insertar 500 Interacciones');
    await prisma.chatMessage.createMany({
      data: messagePayloads
    });
    console.timeEnd('Tiempo en Insertar 500 Interacciones');

    console.time('Tiempo en Leer 500 Interacciones desde BD (Indexado)');
    const readMessages = await prisma.chatMessage.findMany({
      where: { projectId: testProject.id },
      orderBy: { createdAt: 'asc' }
    });
    console.timeEnd('Tiempo en Leer 500 Interacciones desde BD (Indexado)');
    console.log(`Verificación: ${readMessages.length} mensajes leídos satisfactoriamente.\n`);


    // 3. Simular creación masiva de proyectos (como si el CRM llevara años)
    console.log(`============================`);
    console.log(`2. PRUEBA DE CARGA (1,000 PROYECTOS HISTORICOS)`);
    console.log(`============================`);
    
    console.log('Preparando 1000 proyectos simulados...');
    const projectPayloads = Array.from({ length: 1000 }).map((_, i) => ({
      title: `[STRESS TEST HISTORICO] Proyecto #${i}`,
      status: (i % 2 === 0 ? 'ACTIVO' : 'LEAD') as any,
      type: 'OTRO' as any,
      createdBy: i % 2 === 0 ? admin!.id : operator!.id, 
    }));

    console.time('Tiempo en Inserción de 1,000 Proyectos');
    await prisma.project.createMany({
      data: projectPayloads
    });
    console.timeEnd('Tiempo en Inserción de 1,000 Proyectos');

    // 4. Probar la nueva consulta del dashboard del Operador
    console.log(`\n============================`);
    console.log(`3. MEDICION DEL DASHBOARD (Escalabilidad del nuevo Query)`);
    console.log(`============================`);
    
    console.log('Consultando Proyectos del Operador (con lógica OR de Creador + Equipo)...');
    console.time('Tiempo en consultar Dashboard del Operador (Miles de registros)');
    const operatorProjects = await prisma.project.findMany({
      where: {
        OR: [
          { team: { some: { userId: operator.id } } },
          { createdBy: operator.id }
        ],
        status: { in: ['LEAD', 'ACTIVO', 'PENDIENTE'] }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50 // Limitado como en paginaciones reales
    });
    console.timeEnd('Tiempo en consultar Dashboard del Operador (Miles de registros)');
    console.log(`Proyectos encontrados para el operador: ${operatorProjects.length}`);

    // Limpieza
    console.log(`\n============================`);
    console.log('🧹 Limpiando los datos del Stress Test para no saturar tu base de datos...');
    await prisma.chatMessage.deleteMany({
      where: { project: { title: { contains: '[STRESS TEST' } } }
    });
    await prisma.project.deleteMany({
      where: { title: { contains: '[STRESS TEST' } }
    });
    console.log('✅ Base de datos restaurada y limpia.');

  } catch (error) {
    console.error('Error durante la prueba:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n🏁 PRUEBA FINALIZADA');
  }
}

runStressTest();
