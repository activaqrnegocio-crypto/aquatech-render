import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const reqFormData = await req.formData()
    const file = reqFormData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ error: 'Configuración de IA faltante' }, { status: 500 })
    }

    // Explicitly load the file into memory to avoid Next.js stream dropping (0 bytes bug)
    const arrayBuffer = await file.arrayBuffer()
    const audioBlob = new Blob([arrayBuffer], { type: file.type })

    const groqFormData = new FormData()
    // Append the fully loaded Blob with the correct filename
    groqFormData.append('file', audioBlob, file.name || 'audio.weba')
    groqFormData.append('model', 'whisper-large-v3-turbo')
    groqFormData.append('language', 'es')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: groqFormData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
      console.error('Groq API Error Detail:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      return NextResponse.json({ 
        error: 'Error en la transcripción IA', 
        details: errorData.error?.message || 'Error en la API de Groq'
      }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })

  } catch (error: any) {
    console.error('Transcription Route Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
