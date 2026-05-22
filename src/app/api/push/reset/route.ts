import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only allow admins to reset subscriptions if needed, 
    // but here we follow the user's request for a general reset.
    const deleted = await prisma.pushSubscription.deleteMany({})
    
    return NextResponse.json({ 
      success: true,
      message: 'Todas las suscripciones han sido eliminadas',
      deletedCount: deleted.count 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST to reset.' }, { status: 405 })
}
