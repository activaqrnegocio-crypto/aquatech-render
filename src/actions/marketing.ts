'use server'

import { prisma as db } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

export async function createContentPipelineAction(idea: string, ideaContext: string) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session?.user?.email) {
      // Fallback a "offline" si no hay sesión para pruebas locales, o tirar error
      throw new Error('No autorizado')
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      throw new Error('Usuario no encontrado')
    }

    // Calcular weekNumber
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const diff = now.getTime() - start.getTime()
    const oneWeek = 1000 * 60 * 60 * 24 * 7
    const weekNumber = Math.ceil(diff / oneWeek)

    // Crear el pipeline en DB
    const pipeline = await db.contentPipeline.create({
      data: {
        idea,
        ideaContext,
        status: 'IDEA',
        weekNumber,
        year: now.getFullYear(),
        createdById: user.id,
      }
    })

    // Aquí iría la llamada a GROQ para obtener H1s
    // Haremos el fetch con la API Key configurada
    const groqKey = process.env.GROQ_API_KEY
    
    if (!groqKey) {
      console.warn('GROQ_API_KEY no encontrada. Generando H1 de prueba.')
      // Fallback
      await db.headlineOption.createMany({
        data: [
          { pipelineId: pipeline.id, headline: `¿Cómo mejorar ${idea}?`, keyword: idea },
          { pipelineId: pipeline.id, headline: `La Guía Definitiva sobre ${idea}`, keyword: idea },
          { pipelineId: pipeline.id, headline: `5 Mitos y Verdades de ${idea}`, keyword: idea },
        ]
      })
      return { success: true, pipelineId: pipeline.id }
    }

    // Llamada real a GROQ para generar 5 ideas de títulos (H1)
    const prompt = `Eres un experto en SEO y marketing de contenido para la marca Aquatech (soluciones hidráulicas, piscinas, spas, riego).
El usuario quiere escribir sobre: "${idea}".
Contexto extra: "${ideaContext}".

Tu tarea es generar exactamente 5 opciones de títulos (H1) altamente atractivos, optimizados para SEO y con potencial de conversión o retención.
También asocia una palabra clave (keyword) principal para cada H1.

Devuelve EXCLUSIVAMENTE un archivo JSON válido con esta estructura, sin markdown, sin texto extra:
[
  { "headline": "Título SEO 1", "keyword": "keyword 1" },
  { "headline": "Título SEO 2", "keyword": "keyword 2" },
  ...
]`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Error en GROQ API: ${errorText}`)
    }

    const data = await groqResponse.json()
    
    // Parse the JSON. Depending on LLaMA standard behavior, it might wrap it if we use json_object
    let parsedHeadlines: any[] = []
    try {
      const content = data.choices[0].message.content
      const parsedContent = JSON.parse(content)
      // Puede devolver array directo o un objeto con key ej. "headlines"
      if (Array.isArray(parsedContent)) {
        parsedHeadlines = parsedContent
      } else {
        parsedHeadlines = parsedContent.headlines || parsedContent.options || Object.values(parsedContent)[0] as any[]
      }
    } catch (e) {
      console.error('Error parseando H1s de GROQ', e)
      // Fallback
      parsedHeadlines = [
        { headline: `El mejor contenido sobre ${idea}`, keyword: idea }
      ]
    }

    // Insertar las opciones
    if (parsedHeadlines?.length > 0) {
      await db.headlineOption.createMany({
        data: parsedHeadlines.slice(0, 5).map(item => ({
          pipelineId: pipeline.id,
          headline: item.headline || item.title || `Generado para: ${idea}`,
          keyword: item.keyword || idea,
        }))
      })
      
      // Actualizar estado
      await db.contentPipeline.update({
        where: { id: pipeline.id },
        data: { status: 'HEADLINES' }
      })
    }

    return { success: true, pipelineId: pipeline.id }

  } catch (error: any) {
    console.error('Error createContentPipelineAction:', error)
    return { success: false, error: error.message }
  }
}

export async function selectHeadlineAction(pipelineId: number, headlineId: number) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session?.user?.email) throw new Error('No autorizado')

    // 0. VERIFICAR SI YA EXISTE UN ARTÍCULO PILAR PARA EVITAR LOOPS
    const existingPillar = await db.pipelineArticle.findFirst({
      where: { pipelineId, type: 'PILLAR' }
    })

    if (existingPillar) {
      await db.contentPipeline.update({
        where: { id: pipelineId },
        data: { status: 'REVIEWING_ARTICLES' }
      })
      revalidatePath(`/admin/marketing/content/${pipelineId}`)
      return { success: true }
    }

    // 1. Marcar el pipeline con status 'WRITING' y guardar el headline seleccionado
    await db.headlineOption.updateMany({
      where: { pipelineId },
      data: { isSelected: false }
    })
    
    const selectedHeadline = await db.headlineOption.update({
      where: { id: headlineId },
      data: { isSelected: true }
    })

    const pipeline = await db.contentPipeline.update({
      where: { id: pipelineId },
      data: { status: 'WRITING' },
      include: { articles: true }
    })

    // Confirm that we don't already have the pillar article
    if (!existingPillar) {
      // 2. Generar Artículo Pilar con GROQ
      const groqKey = process.env.GROQ_API_KEY
      let articleMarkdown = ''
      
      if (!groqKey) {
        articleMarkdown = `# ${selectedHeadline.headline}\n\nEste es un artículo pilar autogenerado simulado porque no hay API key de GROQ.\n\n## Subtema 1\nContenido del subtema.\n\n## Subtema 2\nContenido del subtema.`
      } else {
        const prompt = `Escribe un Artículo Pilar (aproximadamente 1200-1500 palabras) sobre: "${selectedHeadline.headline}".
Keyword focal objetivo: "${selectedHeadline.keyword}".
Contexto de la idea original: "${pipeline.ideaContext || pipeline.idea}".
Marca: Aquatech (empresa en Ecuador de soluciones hidráulicas, piscinas, spas).
Tono: Técnico pero accesible, profesional, persuasivo.

Estructura requerida:
- H1 (ya dado)
- Introducción atractiva con gancho.
- Varios H2 con contenido profundo (mínimo 5 secciones).
- Algunos H3 para detalles técnicos.
- Conclusión con llamada a la acción (CTA) sugerida.

Retorna SOLO el contenido en formato Markdown. No devuelvas ningún JSON ni saludos. Sólo Markdown puro.`

        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }]
            })
          })

          if (!groqResponse.ok) {
            const errBody = await groqResponse.text()
            throw new Error(`Falló GROQ: ${errBody}`)
          }

          const data = await groqResponse.json()
          articleMarkdown = data.choices[0].message.content
        } catch (genError: any) {
          console.error('Error generando artículo:', genError)
          // Revertimos status para que el usuario pueda reintentar
          await db.contentPipeline.update({
            where: { id: pipelineId },
            data: { status: 'HEADLINES' }
          })
          throw genError
        }
      }

      // 3. Guardar el PipelineArticle
      await db.pipelineArticle.create({
        data: {
          pipelineId,
          type: 'PILLAR',
          title: selectedHeadline.headline,
          content: articleMarkdown,
          focusKeyword: selectedHeadline.keyword,
          status: 'AI_GENERATED',
          displayOrder: 1, // 1 for PILLAR
        }
      })
      
      // 4. ACTUALIZAR ESTADO PARA QUE LA UI AVANCE
      await db.contentPipeline.update({
        where: { id: pipelineId },
        data: { status: 'REVIEWING_ARTICLES' }
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error selectHeadlineAction:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Acción para refinar un artículo usando IA basado en el feedback del usuario.
 */
export async function refineArticleAction(articleId: number, feedback: string, currentContent: string) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) throw new Error('GROQ_API_KEY no configurada')

    const prompt = `Eres un editor experto de contenido SEO para Aquatech.
Tu objetivo es modificar el siguiente Artículo Pilar basado estrictamente en el feedback del usuario.

REQUERIMIENTO DEL USUARIO: "${feedback}"

TEXTO ACTUAL (MARKDOWN):
---
${currentContent}
---

Instrucciones:
1. Aplica el cambio solicitado (añadir, quitar, reescribir, cambiar tono, etc).
2. Mantén el formato Markdown profesional.
3. Si el usuario pide "hacerla de nuevo", genera una nueva versión mejorada manteniendo el tema.
4. Si el usuario pide "añadir una sección", intégrala de forma natural.
5. Retorna EXCLUSIVAMENTE el nuevo Markdown completo. No digas "Aquí tienes el cambio", ni "Entendido". Sólo Markdown.`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!groqResponse.ok) {
      const err = await groqResponse.text()
      throw new Error(`Error en GROQ: ${err}`)
    }

    const data = await groqResponse.json()
    const newContent = data.choices[0].message.content

    // Guardamos en DB para persistencia
    await db.pipelineArticle.update({
      where: { id: articleId },
      data: { 
        content: newContent,
        status: 'AI_GENERATED' // O USER_REVIEWING
      }
    })

    return { success: true, newContent }
  } catch (error: any) {
    console.error('Error refineArticleAction:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Guarda manualmente el contenido editado por el usuario.
 */
export async function updateArticleContentAction(articleId: number, content: string) {
  try {
    await db.pipelineArticle.update({
      where: { id: articleId },
      data: { content, status: 'USER_REVIEWING' }
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error updateArticleContentAction:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Acción de rescate/forzado de estado para el pipeline.
 */
export async function forcePipelineStatusAction(pipelineId: number, status: any) {
  try {
    await db.contentPipeline.update({
      where: { id: pipelineId },
      data: { status }
    })
    revalidatePath(`/admin/marketing/content/${pipelineId}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

