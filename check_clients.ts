import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allClients = await prisma.client.findMany({
    select: { name: true, id: true }
  });
  
  const duplicated = allClients.reduce((acc, client) => {
    acc[client.name] = (acc[client.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("Conteo de clientes por nombre:");
  for (const [name, count] of Object.entries(duplicated)) {
    if (count > 1) {
      console.log(`- ${name}: ${count} veces`);
    } else {
        console.log(`- ${name} (1)`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
