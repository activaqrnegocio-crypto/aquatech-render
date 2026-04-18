import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename') || `upload-${Date.now()}`
    
    // Bunny.net Credentials
    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const accessKey = process.env.BUNNY_STORAGE_API_KEY
    const storageHost = process.env.BUNNY_STORAGE_HOST
    const pullZoneUrl = process.env.BUNNY_PULLZONE_URL

    if (!storageZone || !accessKey || !storageHost) {
      return NextResponse.json({ error: 'Bunny.net not configured' }, { status: 500 })
    }

    // Clean filename for URL
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
    const path = `crm/appointments/${Date.now()}-${cleanName}`

    // Proxy the request to Bunny.net using streaming
    const bunnyResp = await fetch(`https://${storageHost}/${storageZone}/${path}`, {
      method: 'PUT',
      headers: {
        'AccessKey': accessKey,
        'Content-Type': 'application/octet-stream',
      },
      body: request.body, // Pass the request stream directly
      // @ts-ignore
      duplex: 'half'
    })

    if (!bunnyResp.ok) {
      const errorText = await bunnyResp.text()
      console.error('Bunny.net Upload Error:', errorText)
      return NextResponse.json({ error: 'Failed to upload to CDN' }, { status: 502 })
    }

    const url = `${pullZoneUrl}/${path}`
    return NextResponse.json({ url })

  } catch (error) {
    console.error('Upload route error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
