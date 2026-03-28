import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const filePath = path.join(process.cwd(), 'public', 'inventario.XLS')
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    return
  }

  console.log('Reading inventory file...')
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 'A' })

  console.log(`Processing ${data.length} items (using Column F for price)...`)

  let imported = 0
  let skipped = 0

  const parseNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return 0
    if (typeof val === 'number') return val
    const cleaned = String(val).replace(',', '.')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  // Start from i=1 to skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    try {
      // Mapping Excel columns by letter as requested
      const code = String(row.A || row.B || '').trim()
      const name = String(row.C || '').trim()
      
      if (!code || !name) {
        skipped++
        continue
      }

      await prisma.material.upsert({
        where: { code },
        update: {
          name,
          unit: String(row.D || 'unidad'),
          unitPrice: parseNumber(row.F), // USANDO COLUMNA F POR PETICIÓN DEL USUARIO
          category: String(row.E || 'General'),
          stock: Math.max(0, parseNumber(row.K)), // USANDO COLUMNA K POR PETICIÓN DEL USUARIO
          isActive: true,
        },
        create: {
          code,
          name,
          unit: String(row.D || 'unidad'),
          unitPrice: parseNumber(row.F),
          category: String(row.E || 'General'),
          stock: Math.max(0, parseNumber(row.K)),
          isActive: true,
        },
      })
      imported++
      
      if (imported % 100 === 0) {
        console.log(`Imported ${imported} items...`)
      }
    } catch (error) {
      console.error(`Error importing row: ${JSON.stringify(row)}`, error)
      skipped++
    }
  }

  console.log('\n--- Import Results ---')
  console.log(`Successfully imported/updated: ${imported}`)
  console.log(`Skipped: ${skipped}`)
  console.log('----------------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
