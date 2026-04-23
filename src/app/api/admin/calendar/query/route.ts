import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin, hasModuleAccess } from '@/lib/rbac'
import { getLocalNow, formatToEcuador } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    const canAccess = session && (isAdmin((session.user as any).role) || hasModuleAccess(session.user as any, 'calendario'))

    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, messages, currentDate } = await req.json()
    let referenceDate = currentDate ? new Date(currentDate) : getLocalNow()
    if (isNaN(referenceDate.getTime())) referenceDate = getLocalNow()

    // Context & Data fetching
    const operators = await prisma.user.findMany({
      where: { role: { in: ['OPERATOR', 'SUBCONTRATISTA'] }, isActive: true },
      select: { id: true, name: true, role: true }
    })

    const startDate = new Date(referenceDate); startDate.setDate(startDate.getDate() - 5)
    const endDate = new Date(referenceDate); endDate.setDate(endDate.getDate() + 30)

    const appointments = await prisma.appointment.findMany({
      where: { startTime: { gte: startDate, lte: endDate }, status: { not: 'CANCELADO' } },
      include: { user: { select: { name: true } } },
      orderBy: { startTime: 'asc' }
    })

    const context = {
      currentDate: formatToEcuador(referenceDate),
      operators: operators.map(o => `ID: ${o.id} | Nombre: ${o.name}`),
      appointments: appointments.map(a => `- ${a.user.name}: ${a.title} (${formatToEcuador(a.startTime)})`)
    }

    // API Keys
    const groqKey = process.env.GROQ_API_KEY
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    const systemPrompt = `TU OBJETIVO: Resolver dudas de forma QUIRÚRGICA y HUMANA. 
REGLAS DE AGENDAMIENTO:
1. PIDE INSTRUCCIONES: Si falta el detalle de la tarea, PREGUNTA: "¿Qué instrucciones o detalles le pongo?" antes de resumir.
2. CONFIRMACIÓN: Acepta Sí, Dale, OK, etc.
3. FORMATO HORA: Usa HH:MM AM/PM.

EQUIPO: ${context.operators.join(', ')}
AGENDA: ${context.appointments.length > 0 ? context.appointments.join(' | ') : 'Sin citas.'}`

    const userMessages = messages || [{ role: 'user', content: query }]
    const trimmedMessages = userMessages.slice(-8)
    const apiMessages = [{ role: 'system', content: systemPrompt }, ...trimmedMessages]

    const tools = [{
      type: "function",
      function: {
        name: "crear_cita",
        description: "Agendar cita tras confirmar Operador, Tarea, Inicio, Fin e Instrucciones.",
        parameters: {
          type: "object",
          properties: {
            operatorId: { type: "integer" },
            title: { type: "string" },
            startTime: { type: "string" },
            endTime: { type: "string" },
            description: { type: "string" }
          },
          required: ["operatorId", "title", "startTime", "endTime", "description"]
        }
      }
    }]

    let finalAnswer = null
    let toolCall = null

    // 1. Groq
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: apiMessages, tools, tool_choice: 'auto' })
        })
        if (res.ok) {
          const d = await res.json()
          finalAnswer = d.choices[0].message.content
          toolCall = d.choices[0].message.tool_calls?.[0]
        }
      } catch (e) {}
    }

    // 2. DeepSeek
    if (!finalAnswer && !toolCall && deepseekKey) {
      try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'deepseek-chat', messages: apiMessages, tools })
        })
        if (res.ok) {
          const d = await res.json()
          finalAnswer = d.choices[0].message.content
          toolCall = d.choices[0].message.tool_calls?.[0]
        }
      } catch (e) {}
    }

    // 3. OpenRouter
    if (!finalAnswer && !toolCall && openRouterKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct', messages: apiMessages, tools })
        })
        if (res.ok) {
          const d = await res.json()
          finalAnswer = d.choices[0].message.content
          toolCall = d.choices[0].message.tool_calls?.[0]
        }
      } catch (e) {}
    }

    // 4. Gemini
    if (!finalAnswer && !toolCall && geminiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: apiMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) })
        })
        if (res.ok) {
          const d = await res.json()
          finalAnswer = d.candidates[0].content.parts[0].text
        }
      } catch (e) {}
    }

    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments)
      await prisma.appointment.create({
        data: {
          userId: args.operatorId,
          title: args.title,
          description: args.description,
          startTime: new Date(args.startTime),
          endTime: new Date(args.endTime),
          status: 'PENDIENTE',
        }
      })
      return NextResponse.json({ answer: `✅ **Hecho.** Tarea agendada para hoy.` })
    }

    return NextResponse.json({ answer: finalAnswer || 'Servicio temporalmente no disponible.' })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

