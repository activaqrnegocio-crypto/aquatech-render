import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    
    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { code: { contains: query } },
          { category: { contains: query } }
        ],
        isActive: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })
    
    return NextResponse.json(materials, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' }
    })
  } catch (error) {
    console.error('Error fetching materials:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    const material = await prisma.material.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        unit: data.unit,
        unitPrice: Number(data.unitPrice),
        category: data.category,
        stock: Number(data.stock || 0)
      }
    })
    return NextResponse.json(material)
  } catch (error) {
    console.error('Error creating material:', error)
    return NextResponse.json({ error: 'Error creating material' }, { status: 500 })
  }
}
