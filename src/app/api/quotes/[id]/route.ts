import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Quotes have cascading deletes in Prisma usually, but let's be safe
    // If id is 0 or NaN, ignore
    if (!id || isNaN(Number(id))) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.quote.delete({
      where: { id: Number(id) }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}
