import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // PRUEBA DE FUEGO: Hardcoded key
  const publicKey = "BJotzEHg1SMQSlfh0YkAELw02WmF0r9XHJ2ExnAMzfeDMGcyiJYXc5nKiE1hGDnX9FQFc_OI8RM1FLaitWurISo"
  return NextResponse.json({ publicKey })
}
