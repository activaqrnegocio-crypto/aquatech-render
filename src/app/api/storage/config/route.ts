import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    // Only authenticated users (Admin/Operators) can get the storage configuration
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      storageZone: process.env.BUNNY_STORAGE_ZONE,
      accessKey: process.env.BUNNY_STORAGE_API_KEY,
      storageHost: process.env.BUNNY_STORAGE_HOST,
      pullZoneUrl: process.env.BUNNY_PULLZONE_URL || process.env.BUNNY_PULL_ZONE_URL,
    })
  } catch (error) {
    console.error('Failed to get storage config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
