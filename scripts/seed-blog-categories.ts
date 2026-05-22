import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const initialCategories = [
  { name: 'Tratamiento de Agua', slug: 'tratamiento-de-agua' },
  { name: 'Mantenimiento de Piscinas', slug: 'mantenimiento-de-piscinas' },
  { name: 'Equipos de Bombeo', slug: 'equipos-de-bombeo' },
  { name: 'Sistemas Contra Incendios', slug: 'sistemas-contra-incendios' },
  { name: 'Sistemas de Riego', slug: 'sistemas-de-riego' },
  { name: 'Innovación y Tecnología', slug: 'innovacion-tecnologia' },
];

async function main() {
  console.log('Iniciando carga de categorías de Blog...');
  
  for (const category of initialCategories) {
    const existing = await prisma.blogCategory.findUnique({
      where: { slug: category.slug },
    });
    
    if (!existing) {
      await prisma.blogCategory.create({
        data: category,
      });
      console.log(`Categoría creada: ${category.name}`);
    } else {
      console.log(`La categoría ya existe: ${category.name}`);
    }
  }
  
  console.log('Carga de categorías finalizada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
