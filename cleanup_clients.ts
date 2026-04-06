import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpieza de clientes...");

  // 1. Clean up known test dummy clients
  const dummyNames = ['asdasdasdas', 'asdasd', 'asdas', 'asdasd', 'abelino prueba', '-- Selecciona --'];
  
  for (const name of dummyNames) {
    const dummies = await prisma.client.findMany({ where: { name } });
    for (const dummy of dummies) {
      console.log(`Borrando cliente de prueba: ${dummy.name} (ID: ${dummy.id})`);
      
      // Update projects/quotes to unlink or drop cascade
      await prisma.project.deleteMany({ where: { clientId: dummy.id } });
      await prisma.quote.deleteMany({ where: { clientId: dummy.id } });
      await prisma.client.delete({ where: { id: dummy.id } });
    }
  }

  // 2. Consolidate "CONSUMIDOR FINAL"
  const cfClients = await prisma.client.findMany({
    where: { name: 'CONSUMIDOR FINAL' },
    orderBy: { createdAt: 'asc' }
  });

  if (cfClients.length > 1) {
    const master = cfClients[0];
    const duplicates = cfClients.slice(1);
    
    console.log(`Manteniendo CONSUMIDOR FINAL maestro con ID: ${master.id}`);

    for (const dup of duplicates) {
      console.log(`Reasignando datos del duplicado ID: ${dup.id}...`);
      
      await prisma.project.updateMany({
        where: { clientId: dup.id },
        data: { clientId: master.id }
      });
      
      await prisma.quote.updateMany({
        where: { clientId: dup.id },
        data: { clientId: master.id }
      });

      console.log(`Borrando duplicado ID: ${dup.id}`);
      await prisma.client.delete({ where: { id: dup.id } });
    }
  }

  console.log("Limpieza completada con éxito.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
