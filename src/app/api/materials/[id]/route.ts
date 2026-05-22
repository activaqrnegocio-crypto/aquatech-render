import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await req.json()
    const material = await prisma.material.update({
      where: { id: Number(id) },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        unit: data.unit,
        unitPrice: Number(data.unitPrice),
        category: data.category,
        stock: Number(data.stock)
      }
    })
    return NextResponse.json(material)
  } catch (error) {
    return NextResponse.json({ error: 'Error updating material' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.material.update({
      where: { id: Number(id) },
      data: { isActive: false }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error soft-deleting material' }, { status: 500 })
  }
}
