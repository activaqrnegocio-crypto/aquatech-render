import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let audio: string | undefined
    let ext = 'webm'
    let buffer: Buffer

    const contentTypeHeader = req.headers.get('content-type') || ''
    
    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File
      if (file) {
        const arrayBuffer = await file.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        ext = file.name.split('.').pop() || 'webm'
      } else {
        return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
      }
    } else {
      const body = await req.json()
      audio = body.audio
      ext = body.ext || 'webm'
      if (!audio) {
        return NextResponse.json({ error: 'No se recibió audio' }, { status: 400 })
      }
      buffer = Buffer.from(audio, 'base64')
    }

    if (buffer.byteLength < 100) {
      return NextResponse.json({ error: 'Audio demasiado corto o vacío' }, { status: 400 })
    }

    console.log(`Transcribe: ${buffer.byteLength} bytes, ext=${ext}`)

    const mimeMap: Record<string, string> = {
      'webm': 'audio/webm', 'm4a': 'audio/mp4', 'mp4': 'audio/mp4',
      'wav': 'audio/wav', 'ogg': 'audio/ogg', 'aac': 'audio/aac'
    }
    const contentType = mimeMap[ext] || 'audio/webm'
    const safeExt = ext && mimeMap[ext] ? ext : 'm4a'
    const audioBlob = new Blob([new Uint8Array(buffer)], { type: contentType })

    const groqKey = process.env.GROQ_API_KEY
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    let transcribedText: string | null = null

    // ========== 1. GROQ WHISPER (Principal) ==========
    if (groqKey && !transcribedText) {
      try {
        console.log('Transcription: Trying Groq Whisper...')
        const fd = new FormData()
        fd.append('file', audioBlob, `audio.${safeExt}`)
        fd.append('model', 'whisper-large-v3')
        fd.append('language', 'es')
        fd.append('prompt', 'Audio de gestión CRM Aquatech, Loja, Ecuador. Mantenimiento, Operador, Agenda, Piscina, Valentín, Instalación.')

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}` },
          body: fd
        })
        if (res.ok) {
          const data = await res.json()
          transcribedText = data.text
          console.log('Transcription: Groq OK')
        } else {
          console.warn('Transcription: Groq failed, status:', res.status)
        }
      } catch (e) {
        console.warn('Transcription: Groq error, trying fallback...')
      }
    }

    // ========== 2. OPENROUTER WHISPER (Fallback 1) ==========
    if (openRouterKey && !transcribedText) {
      try {
        console.log('Transcription: Trying OpenRouter Whisper...')
        const fd = new FormData()
        fd.append('file', audioBlob, `audio.${safeExt}`)
        fd.append('model', 'openai/whisper-1')
        fd.append('language', 'es')

        const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openRouterKey}` },
          body: fd
        })
        if (res.ok) {
          const data = await res.json()
          transcribedText = data.text
          console.log('Transcription: OpenRouter OK')
        } else {
          console.warn('Transcription: OpenRouter failed, status:', res.status)
        }
      } catch (e) {
        console.warn('Transcription: OpenRouter error, trying Gemini...')
      }
    }

    // ========== 3. GEMINI AUDIO (Fallback 2) ==========
    if (geminiKey && !transcribedText) {
      try {
        console.log('Transcription: Trying Gemini Audio...')
        const base64Audio = buffer.toString('base64')

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: contentType, data: base64Audio } },
                { text: 'Transcribe este audio al español exactamente como se dice. Solo devuelve el texto transcrito, nada más.' }
              ]
            }]
          })
        })
        if (res.ok) {
          const data = await res.json()
          transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
          if (transcribedText) console.log('Transcription: Gemini OK')
        } else {
          console.warn('Transcription: Gemini failed, status:', res.status)
        }
      } catch (e) {
        console.warn('Transcription: Gemini error')
      }
    }

    // ========== RESULTADO ==========
    if (!transcribedText) {
      return NextResponse.json({ error: 'Todos los servicios de transcripción fallaron. Intenta de nuevo.' }, { status: 503 })
    }

    return NextResponse.json({ text: transcribedText })

  } catch (error: any) {
    console.error('Transcription Route Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
