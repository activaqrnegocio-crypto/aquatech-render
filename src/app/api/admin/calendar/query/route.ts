import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/rbac'
import { getLocalNow, formatToEcuador } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !isAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, currentDate } = await req.json()
    
    let referenceDate: Date
    try {
      referenceDate = currentDate ? new Date(currentDate) : getLocalNow()
      if (isNaN(referenceDate.getTime())) throw new Error('Invalid date')
    } catch {
      referenceDate = getLocalNow()
    }

    // Fetch active operators and subcontractors
    const operators = await prisma.user.findMany({
      where: { 
        role: { in: ['OPERATOR', 'SUBCONTRATISTA'] }, 
        isActive: true 
      },
      select: { id: true, name: true, role: true }
    })

    // Fetch appointments for a generous window around referenceDate (+/- 30 days is safe for context)
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - 10)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(referenceDate)
    endDate.setDate(endDate.getDate() + 45)
    endDate.setHours(23, 59, 59, 999)

    const appointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: startDate, lte: endDate },
        status: { not: 'CANCELADO' },
        user: { role: { in: ['OPERATOR', 'SUBCONTRATISTA'] } }
      },
      include: {
        user: { select: { name: true, id: true } }
      },
      orderBy: { startTime: 'asc' }
    })

    // Prepare context for Groq
    const context = {
      currentDate: formatToEcuador(referenceDate),
      operators: operators.map(o => `${o.name} (${o.role})`),
      appointments: appointments.map(a => ({
        operator: a.user.name,
        title: a.title,
        start: formatToEcuador(a.startTime),
        end: formatToEcuador(a.endTime),
        status: a.status
      }))
    }

    // Call Groq
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      console.warn('AI Assistant Warning: GROQ_API_KEY is missing.')
      return NextResponse.json({ answer: 'El servicio de IA no está configurado (falta GROQ_API_KEY). Por favor contacta al administrador.' }, { status: 200 })
    }

    const systemPrompt = `Eres el "Asistente Ejecutivo" de Aquatech. 
Tu única función es reportar la disponibilidad exacta del equipo.

FECHA ACTUAL: ${context.currentDate}

EQUIPO REGISTRADO (TOTAL):
${context.operators.join('\n- ')}

AGENDA DE EVENTOS:
${JSON.stringify(context.appointments)}

REGLAS DE ORO:
1. Para CADA persona del "EQUIPO REGISTRADO":
   - Si tiene una tarea a la hora consultada en la "AGENDA DE EVENTOS", está OCUPADO.
   - Si NO tiene ninguna tarea a esa hora (o ni siquiera aparece en la agenda), está LIBRE.
2. IMPORTANTE: Si solo ves a una persona ocupada en la agenda, significa que TODOS LOS DEMÁS de la lista "EQUIPO REGISTRADO" están LIBRES. No digas que no hay más registrados.
3. Formato obligatorio: 
   - LIBRES: **Nombres separados por coma** (o "Todo el equipo" si aplica)
   - OCUPADOS: **Nombre** (Tarea: Título)
4. NO SALUDES ni des introducciones. Sé extremadamente breve.`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq Error:', errorText)
      return NextResponse.json({ error: 'Error calling AI service' }, { status: 502 })
    }

    const data = await groqResponse.json()
    const answer = data.choices[0].message.content

    return NextResponse.json({ answer })

  } catch (error: any) {
    console.error('Calendar Query API Error:', error)
    return NextResponse.json({ error: 'Error interno al procesar la consulta' }, { status: 500 })
  }
}
