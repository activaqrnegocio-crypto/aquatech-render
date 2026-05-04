import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { sendSilentPush } from '@/lib/push'

// ─── v334: Silent Wake-Up Push ───────────────────────────────────
// POST /api/push/wake-up
// Called when the client goes from offline → online and has pending
// outbox items. Sends a silent push to wake the Service Worker
// without showing any notification to the user.
//
// No auth? Return 401. No subscriptions? Return { skipped: true }.
// Success → SW wakes up → processOutboxSync() → items sync.

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = Number(session.user.id)
    
    console.log(`[WakeUp] Silent push requested for user ${userId}`);
    await sendSilentPush(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Silent wake-up push sent' 
    })
  } catch (error) {
    console.error('[WakeUp ERROR]:', error)
    return NextResponse.json({ error: 'Error sending wake-up push' }, { status: 500 })
  }
}
