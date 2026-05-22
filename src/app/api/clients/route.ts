import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')

    let whereClause = {}
    if (search) {
      whereClause = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ]
      }
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      take: 20
    })

    return NextResponse.json(clients, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' }
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
