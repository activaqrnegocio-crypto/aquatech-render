import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const apiUrl = process.env.EVOLUTION_API_URL
const apiKey = process.env.EVOLUTION_API_KEY
const instance = process.env.EVOLUTION_INSTANCE_NAME

// ── Helpers ──

async function getConnectionState(): Promise<string> {
  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { 'apikey': apiKey! }
    })
    if (!res.ok) return 'not_found'
    const data = await res.json()
    return data?.instance?.state || data?.state || 'unknown'
  } catch {
    return 'not_found'
  }
}

async function ensureInstanceExists(): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey! },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })
    return res.ok || res.status === 409
  } catch {
    return false
  }
}

async function doLogout(): Promise<void> {
  await fetch(`${apiUrl}/instance/logout/${instance}`, {
    method: 'DELETE',
    headers: { 'apikey': apiKey! }
  }).catch(() => {})
}

function extractQR(data: any): string | null {
  const candidates = [
    data?.qrcode?.code,
    data?.qrcode?.base64,
    data?.base64,
  ]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      return candidate.startsWith('data:') ? candidate : `data:image/png;base64,${candidate}`
    }
  }
  return null
}

async function tryConnect(): Promise<{ qr: string | null; raw: any }> {
  const res = await fetch(`${apiUrl}/instance/connect/${instance}`, {
    headers: { 'apikey': apiKey! }
  })
  if (!res.ok) return { qr: null, raw: { error: res.status } }
  const data = await res.json()
  return { qr: extractQR(data), raw: data }
}

// ── GET: Generar código QR ──
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!apiUrl || !apiKey || !instance) {
      return NextResponse.json({ error: 'Configuración faltante' }, { status: 500 })
    }

    // 1. Verificar estado actual
    const state = await getConnectionState()
    console.log('[EVOLUTION] Estado actual de la instancia:', state)

    // Si ya está conectada, no generar QR
    if (state === 'open') {
      return NextResponse.json({ instance: { state: 'open' } })
    }

    // 2. Si no existe la instancia, crearla
    if (state === 'not_found') {
      console.log('[EVOLUTION] Instancia no encontrada, creando...')
      await ensureInstanceExists()
      await new Promise(r => setTimeout(r, 1000))
    }

    // 3. Intentar obtener QR
    console.log('[EVOLUTION] Solicitando código QR...')
    const { qr, raw } = await tryConnect()

    if (qr) {
      console.log('[EVOLUTION] ✅ QR obtenido correctamente.')
      return NextResponse.json({ base64: qr })
    }

    // 4. Si no devolvió QR (sesión stale), hacer logout y reintentar
    console.log('[EVOLUTION] QR no obtenido. Intentando logout + reconexión...')
    await doLogout()
    await new Promise(r => setTimeout(r, 1500))

    const retry = await tryConnect()
    if (retry.qr) {
      console.log('[EVOLUTION] ✅ QR obtenido en segundo intento.')
      return NextResponse.json({ base64: retry.qr })
    }

    console.log('[EVOLUTION] ❌ No se pudo obtener QR. Respuesta:', retry.raw)
    return NextResponse.json(retry.raw)
  } catch (error) {
    console.error('[WA CONNECT ERROR]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ── DELETE: Desconectar teléfono ──
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!apiUrl || !apiKey || !instance) {
      return NextResponse.json({ error: 'Configuración faltante' }, { status: 500 })
    }

    // 1. Logout: cierra sesión en el teléfono y en Evolution
    console.log('[EVOLUTION] Desconectando teléfono (logout):', instance)
    await doLogout()

    // 2. Darle 3.5 segundos para que el paquete de red se envíe y procese en el celular del usuario
    console.log('[EVOLUTION] Esperando 3.5 segundos para que WhatsApp procese la desconexión...')
    await new Promise(r => setTimeout(r, 3500))

    // 3. Verificar estado post-logout
    const state = await getConnectionState()
    console.log('[EVOLUTION] Estado verificado post-logout:', state)

    console.log('[EVOLUTION] ✅ Desconexión completada con éxito.')
    return NextResponse.json({ success: true, state: state })
  } catch (error) {
    console.error('[WA DISCONNECT ERROR]:', error)
    return NextResponse.json({ success: true, state: 'close' })
  }
}
