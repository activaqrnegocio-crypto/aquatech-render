import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  return NextResponse.json({ publicKey })
}
