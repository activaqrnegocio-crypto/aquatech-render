import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkBomba() {
  const allMaterials = await prisma.material.findMany({
    where: { isActive: true }
  });

  const searchTerm = 'bomba';

  // 1. Logic from MaterialsClient (Inventario)
  const inventoryMatch = allMaterials.filter((m: any) => 
    m.name.toLowerCase().includes(searchTerm) || 
    m.code.toLowerCase().includes(searchTerm) ||
    (m.category && m.category.toLowerCase().includes(searchTerm))
  );

  // 2. Logic from BudgetBuilder (Cotizaciones)
  const budgetMatch = allMaterials.filter(m => 
    m.name.toLowerCase().includes(searchTerm) || 
    (m.code && m.code.toLowerCase().includes(searchTerm)) ||
    (m.category && m.category.toLowerCase().includes(searchTerm))
  );

  console.log('--- RESULTADOS DE VERIFICACIÓN ---');
  console.log('Total Materiales Activos:', allMaterials.length);
  console.log('Coincidencias en Inventario para "Bomba":', inventoryMatch.length);
  console.log('Coincidencias en Cotizaciones para "Bomba":', budgetMatch.length);
  
  if (inventoryMatch.length === budgetMatch.length) {
    console.log('¡VERIFICACIÓN EXITOSA! Los conteos son idénticos.');
  } else {
    console.log('ERROR: Los conteos no coinciden.');
  }

  await prisma.$disconnect();
}

checkBomba();
